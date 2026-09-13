import { Router, Request, Response } from 'express';
import { prisma } from '../prisma.js';
import { requireAuth, AuthenticatedRequest, enforceDistrictScope } from '../middleware/auth.middleware.js';
import { emitNewRoadEvent, emitRoadEventUpdated, emitRoadEventDeleted } from '../realtime/socket.js';
import { IN_MEMORY_SESSIONS } from '../pairing/pairing.router.js';

export const eventsRouter = Router();

/**
 * 1. Mobile App Ingestion Endpoint
 * Ingests edge-detected road events from paired phones.
 * Phone does NOT send districtId - server resolves it securely from deviceSessionId.
 */
eventsRouter.post('/ingest', async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      deviceSessionId,
      type,
      confidence,
      latitude,
      longitude,
      heading,
      speed,
      imageSnippet,
      timestamp,
      estimatedDiameterCm,
      estimatedRepairCost,
    } = req.body;

    if (!deviceSessionId || !type || confidence === undefined || latitude === undefined || longitude === undefined) {
      res.status(400).json({ error: 'Missing required detection fields: deviceSessionId, type, confidence, latitude, longitude.' });
      return;
    }

    // 1. Verify session exists and is active PAIRED
    let session: any = null;
    try {
      session = await prisma.busDeviceSession.findUnique({
        where: { id: deviceSessionId },
        include: {
          district: true,
        },
      });
    } catch (dbErr) {
      console.warn('Prisma session lookup in ingest failed, checking memory:', (dbErr as Error).message);
    }

    if (!session) {
      session = IN_MEMORY_SESSIONS.get(deviceSessionId);
    }

    if (!session) {
      res.status(404).json({ error: 'Unrecognized device session ID. Please pair device.' });
      return;
    }

    if (session.status !== 'PAIRED' || (!session.districtId && !session.district)) {
      res.status(403).json({ error: 'Device session is not paired to any district. Events cannot be accepted.' });
      return;
    }

    // 2. Resolve district: match GPS coordinates against district bounding boxes, or fallback to session district
    const numLat = Number(latitude);
    const numLon = Number(longitude);
    let resolvedDistrictId = session.districtId;

    const allDistricts = await prisma.district.findMany();
    const matchedDistrict = allDistricts.find(
      (d) =>
        d.minLat !== null &&
        d.maxLat !== null &&
        d.minLon !== null &&
        d.maxLon !== null &&
        numLat >= d.minLat &&
        numLat <= d.maxLat &&
        numLon >= d.minLon &&
        numLon <= d.maxLon
    );

    if (matchedDistrict) {
      resolvedDistrictId = matchedDistrict.id;
      if (session.districtId !== matchedDistrict.id) {
        await prisma.busDeviceSession.update({
          where: { id: session.id },
          data: { districtId: matchedDistrict.id },
        });
      }
    }

    const upperType = type.toUpperCase();
    let finalDiameterCm: number | null =
      estimatedDiameterCm !== undefined && estimatedDiameterCm !== null ? Number(estimatedDiameterCm) : null;
    let finalRepairCost: number | null =
      estimatedRepairCost !== undefined && estimatedRepairCost !== null ? Number(estimatedRepairCost) : null;

    if (upperType === 'POTHOLE' || upperType === 'SURFACE_DAMAGE') {
      if (finalDiameterCm === null) {
        const seed = Math.abs(Math.sin(numLat * 1000 + numLon * 1000)) * 40 + 28;
        finalDiameterCm = Math.round(seed);
      }
      if (finalRepairCost === null) {
        const d = finalDiameterCm;
        const rawCost = (d / 10) * (d / 10) * 55 + d * 25 + 400;
        finalRepairCost = Math.max(800, Math.round(rawCost / 50) * 50);
      }
    }

    const event = await prisma.roadEvent.create({
      data: {
        deviceSessionId: session.id,
        busLabel: session.busLabel || 'Unknown Bus',
        districtId: resolvedDistrictId,
        type: upperType,
        confidence: Number(confidence),
        latitude: numLat,
        longitude: numLon,
        heading: heading !== undefined ? Number(heading) : null,
        speed: speed !== undefined ? Number(speed) : null,
        imageSnippet: imageSnippet || null,
        estimatedDiameterCm: finalDiameterCm,
        estimatedRepairCost: finalRepairCost,
        status: 'NEW',
        timestamp: timestamp ? new Date(timestamp) : new Date(),
      },
      include: {
        district: {
          select: { name: true, code: true, stateId: true },
        },
      },
    });

    // Update heartbeat
    await prisma.busDeviceSession.update({
      where: { id: session.id },
      data: { lastHeartbeat: new Date() },
    });

    // 3. Emit real-time WebSocket event to scoped district dashboard
    emitNewRoadEvent(event);

    res.status(201).json({
      success: true,
      eventId: event.id,
      districtId: event.districtId,
      busLabel: event.busLabel,
      timestamp: event.timestamp,
    });
  } catch (err: any) {
    console.error('Event ingestion error:', err);
    res.status(500).json({ error: 'Failed to ingest road intelligence event.' });
  }
});

/**
 * 2. Portal: Retrieve Filtered & Scoped Events
 * Strict server-side row-level security: District Heads only see events in their district.
 */
eventsRouter.get(
  '/',
  requireAuth,
  enforceDistrictScope,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { type, status, limit = '50', offset = '0', busLabel } = req.query;

      const whereClause: any = {};

      // Server-side Scoping
      if (req.scopedDistrictId) {
        whereClause.districtId = req.scopedDistrictId;
      } else if (req.user!.role === 'STATE_ADMIN') {
        whereClause.district = { stateId: req.user!.stateId };
      }

      if (type) {
        whereClause.type = (type as string).toUpperCase();
      }

      if (status) {
        whereClause.status = (status as string).toUpperCase();
      }

      if (busLabel) {
        whereClause.busLabel = { contains: busLabel as string };
      }

      const take = Math.min(parseInt(limit as string, 10) || 50, 200);
      const skip = parseInt(offset as string, 10) || 0;

      const [events, totalCount] = await Promise.all([
        prisma.roadEvent.findMany({
          where: whereClause,
          include: {
            district: { select: { name: true, code: true } },
            reviewedByUser: { select: { name: true, role: true } },
          },
          orderBy: { timestamp: 'desc' },
          take,
          skip,
        }),
        prisma.roadEvent.count({ where: whereClause }),
      ]);

      res.json({
        totalCount,
        limit: take,
        offset: skip,
        events,
      });
    } catch (err: any) {
      console.error('List events error:', err);
      res.status(500).json({ error: 'Failed to retrieve road events.' });
    }
  }
);

/**
 * 3. Portal: Update Defect Lifecycle Status
 * (NEW -> REVIEWED -> ASSIGNED_FOR_REPAIR -> RESOLVED)
 */
eventsRouter.patch(
  '/:id/status',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { status, reviewNotes } = req.body;

      const validStatuses = ['NEW', 'REVIEWED', 'ASSIGNED_FOR_REPAIR', 'RESOLVED'];
      if (!status || !validStatuses.includes(status)) {
        res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
        return;
      }

      const existingEvent = await prisma.roadEvent.findUnique({
        where: { id },
        include: {
          district: {
            include: { state: true },
          },
        },
      });

      if (!existingEvent) {
        res.status(404).json({ error: 'Event not found.' });
        return;
      }

      let newDistrictId: string | undefined = undefined;

      // Security check: District Head can only manage events in their district (or events whose GPS coordinates lie within their district)
      if (req.user!.role === 'DISTRICT_HEAD') {
        const userDistrictId = req.user!.districtId;
        if (!userDistrictId) {
          res.status(403).json({ error: 'Access Denied: District Head profile has no assigned district.' });
          return;
        }

        if (existingEvent.districtId !== userDistrictId) {
          const userDistrict = await prisma.district.findUnique({
            where: { id: userDistrictId },
          });
          const inBounds =
            userDistrict &&
            userDistrict.minLat !== null &&
            userDistrict.maxLat !== null &&
            userDistrict.minLon !== null &&
            userDistrict.maxLon !== null &&
            existingEvent.latitude >= userDistrict.minLat &&
            existingEvent.latitude <= userDistrict.maxLat &&
            existingEvent.longitude >= userDistrict.minLon &&
            existingEvent.longitude <= userDistrict.maxLon;

          if (!inBounds) {
            res.status(403).json({ error: 'Access Denied: You can only modify events in your assigned district.' });
            return;
          }
          newDistrictId = userDistrictId;
        }
      }

      // Security check: State Admin can only manage events in their state (or events whose GPS coordinates lie within their state)
      if (req.user!.role === 'STATE_ADMIN') {
        const userStateId = req.user!.stateId;
        if (!userStateId) {
          res.status(403).json({ error: 'Access Denied: State Admin profile has no assigned state.' });
          return;
        }

        const inState = existingEvent.district?.stateId === userStateId;
        if (!inState) {
          const stateDistricts = await prisma.district.findMany({
            where: { stateId: userStateId },
          });
          const matchedStateDistrict = stateDistricts.find(
            (d) =>
              d.minLat !== null &&
              d.maxLat !== null &&
              d.minLon !== null &&
              d.maxLon !== null &&
              existingEvent.latitude >= d.minLat &&
              existingEvent.latitude <= d.maxLat &&
              existingEvent.longitude >= d.minLon &&
              existingEvent.longitude <= d.maxLon
          );

          if (!matchedStateDistrict) {
            res.status(403).json({ error: 'Access Denied: Event does not belong to your state jurisdiction.' });
            return;
          }
          newDistrictId = matchedStateDistrict.id;
        }
      }

      const updated = await prisma.roadEvent.update({
        where: { id },
        data: {
          status,
          ...(newDistrictId ? { districtId: newDistrictId } : {}),
          reviewedByUserId: req.user!.userId,
          reviewNotes: reviewNotes !== undefined ? reviewNotes : existingEvent.reviewNotes,
        },
        include: {
          district: { select: { name: true, code: true, stateId: true } },
          reviewedByUser: { select: { name: true, role: true } },
        },
      });

      emitRoadEventUpdated(updated);

      res.json({
        success: true,
        event: updated,
      });
    } catch (err: any) {
      console.error('Update event status error:', err);
      res.status(500).json({ error: 'Failed to update event status.' });
    }
  }
);

/**
 * 3b. Portal: Purge / Clear Test Events
 * Allows administrators to reset the register by deleting scoped events
 */
eventsRouter.delete(
  '/purge',
  requireAuth,
  enforceDistrictScope,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const whereClause: any = {};
      if (req.scopedDistrictId) {
        whereClause.districtId = req.scopedDistrictId;
      } else if (req.user!.role === 'STATE_ADMIN') {
        whereClause.district = { stateId: req.user!.stateId };
      }

      const result = await prisma.roadEvent.deleteMany({
        where: whereClause,
      });

      res.json({
        success: true,
        message: `Purged ${result.count} road defect events.`,
        deletedCount: result.count,
      });
    } catch (err: any) {
      console.error('Purge events error:', err);
      res.status(500).json({ error: 'Failed to purge events.' });
    }
  }
);

/**
 * 3c. Portal: Delete Individual Defect Event (e.g. dismiss test / false positive)
 */
eventsRouter.delete(
  '/:id',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const existing = await prisma.roadEvent.findUnique({
        where: { id },
        include: { district: true },
      });

      if (!existing) {
        res.status(404).json({ error: 'Event not found.' });
        return;
      }

      if (req.user!.role === 'DISTRICT_HEAD' && req.user!.districtId && existing.districtId !== req.user!.districtId) {
        res.status(403).json({ error: 'Access Denied: You can only delete events in your assigned district.' });
        return;
      }
      if (req.user!.role === 'STATE_ADMIN' && req.user!.stateId && existing.district.stateId !== req.user!.stateId) {
        res.status(403).json({ error: 'Access Denied: You can only delete events in your assigned state.' });
        return;
      }

      await prisma.roadEvent.delete({ where: { id } });
      emitRoadEventDeleted(id, existing.districtId, existing.district?.stateId);

      res.json({ success: true, message: 'Event successfully removed.' });
    } catch (err: any) {
      console.error('Delete event error:', err);
      res.status(500).json({ error: 'Failed to delete event.' });
    }
  }
);

/**
 * 4. District & State Analytics Stats
 */
eventsRouter.get(
  '/stats',
  requireAuth,
  enforceDistrictScope,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const whereClause: any = {};

      if (req.scopedDistrictId) {
        whereClause.districtId = req.scopedDistrictId;
      } else if (req.user!.role === 'STATE_ADMIN') {
        whereClause.district = { stateId: req.user!.stateId };
      }

      const [
        totalEvents,
        newCount,
        reviewedCount,
        assignedCount,
        resolvedCount,
        potholeCount,
        crackCount,
        surfaceDamageCount,
        waterloggingCount,
        vehicleFlowCount,
        activeBusSessions,
      ] = await Promise.all([
        prisma.roadEvent.count({ where: whereClause }),
        prisma.roadEvent.count({ where: { ...whereClause, status: 'NEW' } }),
        prisma.roadEvent.count({ where: { ...whereClause, status: 'REVIEWED' } }),
        prisma.roadEvent.count({ where: { ...whereClause, status: 'ASSIGNED_FOR_REPAIR' } }),
        prisma.roadEvent.count({ where: { ...whereClause, status: 'RESOLVED' } }),
        prisma.roadEvent.count({ where: { ...whereClause, type: 'POTHOLE' } }),
        prisma.roadEvent.count({ where: { ...whereClause, type: 'ROAD_CRACK' } }),
        prisma.roadEvent.count({ where: { ...whereClause, type: 'SURFACE_DAMAGE' } }),
        prisma.roadEvent.count({ where: { ...whereClause, type: 'WATERLOGGING' } }),
        prisma.roadEvent.count({ where: { ...whereClause, type: 'VEHICLE_FLOW' } }),
        prisma.busDeviceSession.findMany({
          where: {
            status: 'PAIRED',
            ...(req.scopedDistrictId ? { districtId: req.scopedDistrictId } : {}),
            ...(req.user!.role === 'STATE_ADMIN' && req.user!.stateId ? { district: { stateId: req.user!.stateId } } : {}),
          },
          select: { busLabel: true },
        }),
      ]);

      const activeBusesCount = new Set(
        activeBusSessions.map((s) => s.busLabel?.trim()).filter(Boolean)
      ).size;

      // Calculate Road Health Index (0 - 100):
      // Higher resolved ratio and lower active defects produce higher score
      const unresolvedDefects = totalEvents - resolvedCount;
      const roadHealthScore = Math.max(
        15,
        Math.min(100, Math.round(100 - unresolvedDefects * 1.5 + (resolvedCount * 0.8)))
      );

      res.json({
        totalEvents,
        byStatus: {
          new: newCount,
          reviewed: reviewedCount,
          assigned: assignedCount,
          resolved: resolvedCount,
        },
        byType: {
          pothole: potholeCount,
          roadCrack: crackCount,
          surfaceDamage: surfaceDamageCount,
          waterlogging: waterloggingCount,
          vehicleFlow: vehicleFlowCount,
        },
        activeBusesCount,
        roadHealthScore,
      });
    } catch (err: any) {
      console.error('Event stats error:', err);
      res.status(500).json({ error: 'Failed to compute road intelligence stats.' });
    }
  }
);
