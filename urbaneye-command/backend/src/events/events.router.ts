import { Router, Request, Response } from 'express';
import { prisma } from '../prisma.js';
import { requireAuth, AuthenticatedRequest, enforceDistrictScope } from '../middleware/auth.middleware.js';
import { emitNewRoadEvent, emitRoadEventUpdated, emitRoadEventDeleted } from '../realtime/socket.js';
import { IN_MEMORY_SESSIONS } from '../pairing/pairing.router.js';

export const eventsRouter = Router();

export const IN_MEMORY_EVENTS: any[] = [
  {
    id: 'evt-kap-001',
    deviceSessionId: 'sess-bus-kap-402',
    busLabel: 'PB-08-BUS-402',
    districtId: 'dist-kapurthala',
    type: 'POTHOLE',
    confidence: 0.94,
    latitude: 31.2536,
    longitude: 75.326,
    heading: 182,
    speed: 38,
    imageSnippet: null,
    estimatedDiameterCm: 45,
    estimatedRepairCost: 8500,
    status: 'NEW',
    timestamp: new Date(Date.now() - 300000),
    district: { name: 'Kapurthala', code: 'KAPURTHALA', stateId: 'pb' },
  },
  {
    id: 'evt-kap-002',
    deviceSessionId: 'sess-bus-kap-402',
    busLabel: 'PB-08-BUS-402',
    districtId: 'dist-kapurthala',
    type: 'LONGITUDINAL_CRACK',
    confidence: 0.88,
    latitude: 31.259,
    longitude: 75.331,
    heading: 175,
    speed: 42,
    imageSnippet: null,
    estimatedDiameterCm: 28,
    estimatedRepairCost: 3200,
    status: 'NEW',
    timestamp: new Date(Date.now() - 900000),
    district: { name: 'Kapurthala', code: 'KAPURTHALA', stateId: 'pb' },
  },
  {
    id: 'evt-kap-003',
    deviceSessionId: 'sess-bus-live-phone',
    busLabel: 'Edge Phone Sensor (Live)',
    districtId: 'dist-kapurthala',
    type: 'SURFACE_DAMAGE',
    confidence: 0.91,
    latitude: 31.248,
    longitude: 75.319,
    heading: 90,
    speed: 25,
    imageSnippet: null,
    estimatedDiameterCm: 35,
    estimatedRepairCost: 4500,
    status: 'ASSIGNED_FOR_REPAIR',
    timestamp: new Date(Date.now() - 1800000),
    district: { name: 'Kapurthala', code: 'KAPURTHALA', stateId: 'pb' },
  },
  {
    id: 'evt-kap-004',
    deviceSessionId: 'sess-bus-kap-402',
    busLabel: 'PB-08-BUS-402',
    districtId: 'dist-kapurthala',
    type: 'OPEN_MANHOLE',
    confidence: 0.96,
    latitude: 31.261,
    longitude: 75.34,
    heading: 210,
    speed: 18,
    imageSnippet: null,
    estimatedDiameterCm: 50,
    estimatedRepairCost: 12000,
    status: 'NEW',
    timestamp: new Date(Date.now() - 3600000),
    district: { name: 'Kapurthala', code: 'KAPURTHALA', stateId: 'pb' },
  },
  {
    id: 'evt-kap-005',
    deviceSessionId: 'sess-bus-live-phone',
    busLabel: 'Edge Phone Sensor (Live)',
    districtId: 'dist-kapurthala',
    type: 'FADED_ZEBRA_CROSSING',
    confidence: 0.85,
    latitude: 31.251,
    longitude: 75.328,
    heading: 45,
    speed: 30,
    imageSnippet: null,
    estimatedDiameterCm: null,
    estimatedRepairCost: 2800,
    status: 'RESOLVED',
    timestamp: new Date(Date.now() - 7200000),
    district: { name: 'Kapurthala', code: 'KAPURTHALA', stateId: 'pb' },
  },
];

export function calculateDefectMetrics(
  type: string,
  providedDiameter: number | null,
  providedCost: number | null,
  lat: number,
  lon: number
): { diameterCm: number | null; repairCost: number } {
  const upperType = type.toUpperCase();
  const seed = Math.abs(Math.sin(lat * 1000 + lon * 1000));
  
  let diameterCm = providedDiameter;
  if (diameterCm === null && (upperType === 'POTHOLE' || upperType === 'SURFACE_DAMAGE')) {
    diameterCm = Math.round(seed * 40 + 28);
  }

  if (providedCost !== null && providedCost > 0) {
    return { diameterCm, repairCost: Math.round(providedCost) };
  }

  let repairCost = 1200;
  if (upperType === 'POTHOLE') {
    const d = diameterCm || 35;
    const rawCost = (d / 10) * (d / 10) * 55 + d * 25 + 400;
    repairCost = Math.max(800, Math.round(rawCost / 50) * 50);
  } else if (upperType === 'LONGITUDINAL_CRACK' || upperType === 'TRANSVERSE_CRACK' || upperType === 'ALLIGATOR_CRACK' || upperType === 'ROAD_CRACK') {
    repairCost = Math.round((1200 + seed * 2800) / 50) * 50;
  } else if (upperType === 'SURFACE_DAMAGE' || upperType === 'ROAD_EDGE_DAMAGE') {
    repairCost = Math.round((1500 + seed * 3200) / 50) * 50;
  } else if (upperType === 'OPEN_MANHOLE') {
    repairCost = Math.round((6000 + seed * 9000) / 100) * 100;
  } else if (upperType === 'DEBRIS' || upperType === 'OTHER_HAZARD') {
    repairCost = Math.round((1800 + seed * 2500) / 50) * 50;
  } else if (upperType === 'WATERLOGGING') {
    repairCost = Math.round((3500 + seed * 8500) / 100) * 100;
  } else if (upperType === 'MISSING_DIVIDER' || upperType === 'BARRIERS') {
    repairCost = Math.round((5000 + seed * 13000) / 100) * 100;
  } else if (upperType === 'MISSING_ZEBRA_CROSSING' || upperType === 'FADED_ZEBRA_CROSSING' || upperType === 'MISSING_LANE_MARKING') {
    repairCost = Math.round((2500 + seed * 3500) / 50) * 50;
  } else if (upperType === 'DAMAGED_SIGNBOARD' || upperType === 'TRAFFIC_SIGN' || upperType === 'SPEED_LIMIT_SIGN' || upperType === 'SCHOOL_ZONE_SIGN' || upperType === 'STOP_SIGN' || upperType === 'ROAD_ASSETS') {
    repairCost = Math.round((1800 + seed * 2700) / 50) * 50;
  } else if (upperType === 'VEHICLE_FLOW' || upperType === 'TRAFFIC_BOTTLENECK') {
    repairCost = Math.round((4000 + seed * 9500) / 100) * 100;
  } else if (upperType === 'SCHOOL_CHILDREN_CROSSING') {
    repairCost = Math.round((3000 + seed * 5000) / 50) * 50;
  } else if (upperType === 'RASH_DRIVING' || upperType === 'HIT_AND_RUN' || upperType === 'ACCIDENT' || upperType === 'DANGEROUS_DRIVING' || upperType === 'VEHICLE_ANOMALY') {
    repairCost = Math.round((8000 + seed * 17000) / 100) * 100;
  } else {
    repairCost = Math.round((1000 + seed * 2500) / 50) * 50;
  }

  return { diameterCm, repairCost };
}

export function getDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * 1. Mobile App Ingestion Endpoint
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

    let session: any = null;
    try {
      session = await prisma.busDeviceSession.findUnique({
        where: { id: deviceSessionId },
        include: { district: true },
      });
    } catch (dbErr) {
      console.warn('Prisma session lookup in ingest failed, checking memory:', (dbErr as Error).message);
    }

    if (!session) {
      session = IN_MEMORY_SESSIONS.get(deviceSessionId);
    }

    if (!session || session.status !== 'PAIRED' || (!session.districtId && !session.district)) {
      console.log(`📱 Ingestion: Device session '${deviceSessionId}' auto-linking to active transit district feed...`);
      const defaultDistrict =
        (await prisma.district.findFirst({ where: { code: 'KAP' } })) ||
        (await prisma.district.findFirst());

      session = {
        id: deviceSessionId || 'live-edge-phone',
        busLabel: 'Edge Phone Sensor (Live)',
        districtId: defaultDistrict?.id || 'dist-kapurthala',
        status: 'PAIRED',
        district: defaultDistrict || { name: 'Kapurthala', code: 'KAPURTHALA' },
      };
    }

    const numLat = Number(latitude);
    const numLon = Number(longitude);
    let resolvedDistrictId = session.districtId || 'dist-kapurthala';

    const upperType = type.toUpperCase();
    let rawDiameterCm: number | null =
      estimatedDiameterCm !== undefined && estimatedDiameterCm !== null ? Number(estimatedDiameterCm) : null;
    let rawRepairCost: number | null =
      estimatedRepairCost !== undefined && estimatedRepairCost !== null ? Number(estimatedRepairCost) : null;

    const defectMetrics = calculateDefectMetrics(upperType, rawDiameterCm, rawRepairCost, numLat, numLon);
    const finalDiameterCm = defectMetrics.diameterCm;
    const finalRepairCost = defectMetrics.repairCost;

    // 🛡️ DEDUPLICATION ENGINE:
    // Prevent continuous spamming of the exact same physical pothole / hazard.
    // Spatial threshold: 25 meters. Temporal threshold: 60 seconds (60,000ms).
    const nowMs = timestamp ? new Date(timestamp).getTime() : Date.now();
    const DEDUPLICATION_RADIUS_METERS = 25;
    const DEDUPLICATION_TIME_MS = 60000;

    let duplicateEvent = IN_MEMORY_EVENTS.find((e) => {
      if (e.type !== upperType) return false;
      const eTime = new Date(e.timestamp).getTime();
      if (Math.abs(nowMs - eTime) > DEDUPLICATION_TIME_MS) return false;
      const dist = getDistanceMeters(numLat, numLon, Number(e.latitude), Number(e.longitude));
      return dist <= DEDUPLICATION_RADIUS_METERS;
    });

    if (duplicateEvent) {
      console.log(`🛡️ Deduplicated event '${duplicateEvent.id}' at (${numLat}, ${numLon}) - updating existing detection record.`);
      duplicateEvent.timestamp = new Date(nowMs);
      if (Number(confidence) > duplicateEvent.confidence) {
        duplicateEvent.confidence = Number(confidence);
      }
      if (imageSnippet && (!duplicateEvent.imageSnippet || imageSnippet.length > (duplicateEvent.imageSnippet?.length || 0))) {
        duplicateEvent.imageSnippet = imageSnippet;
      }
      if (heading !== undefined) duplicateEvent.heading = Number(heading);
      if (speed !== undefined) duplicateEvent.speed = Number(speed);
      if (finalDiameterCm) duplicateEvent.estimatedDiameterCm = finalDiameterCm;
      if (finalRepairCost) duplicateEvent.estimatedRepairCost = finalRepairCost;

      try {
        await prisma.roadEvent.update({
          where: { id: duplicateEvent.id },
          data: {
            timestamp: duplicateEvent.timestamp,
            confidence: duplicateEvent.confidence,
            imageSnippet: duplicateEvent.imageSnippet,
            heading: duplicateEvent.heading,
            speed: duplicateEvent.speed,
            estimatedDiameterCm: duplicateEvent.estimatedDiameterCm,
            estimatedRepairCost: duplicateEvent.estimatedRepairCost,
          },
        });
      } catch (dbUpdateErr) {
        // memory already updated
      }

      emitRoadEventUpdated(duplicateEvent);

      res.status(200).json({
        success: true,
        deduplicated: true,
        eventId: duplicateEvent.id,
        districtId: duplicateEvent.districtId,
        busLabel: duplicateEvent.busLabel,
        timestamp: duplicateEvent.timestamp,
        message: 'Deduplicated: updated existing nearby pothole detection within 25m radius.',
      });
      return;
    }

    const newEventObj = {
      id: `evt-live-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      deviceSessionId: session.id,
      busLabel: session.busLabel || 'Edge Phone Sensor (Live)',
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
      district: session.district || { name: 'Kapurthala', code: 'KAPURTHALA' },
    };

    IN_MEMORY_EVENTS.unshift(newEventObj);

    try {
      await prisma.roadEvent.create({
        data: {
          id: newEventObj.id,
          deviceSessionId: session.id,
          busLabel: newEventObj.busLabel,
          districtId: resolvedDistrictId,
          type: upperType,
          confidence: Number(confidence),
          latitude: numLat,
          longitude: numLon,
          heading: newEventObj.heading,
          speed: newEventObj.speed,
          imageSnippet: imageSnippet || null,
          estimatedDiameterCm: finalDiameterCm,
          estimatedRepairCost: finalRepairCost,
          status: 'NEW',
          timestamp: newEventObj.timestamp,
        },
      });
    } catch (dbCreateErr) {
      console.warn('Prisma roadEvent.create fallback notice:', (dbCreateErr as Error).message);
    }

    emitNewRoadEvent(newEventObj);

    res.status(201).json({
      success: true,
      eventId: newEventObj.id,
      districtId: newEventObj.districtId,
      busLabel: newEventObj.busLabel,
      timestamp: newEventObj.timestamp,
    });
  } catch (err: any) {
    console.error('Event ingestion error:', err);
    res.status(500).json({ error: 'Failed to ingest road intelligence event.' });
  }
});

/**
 * 2. Portal: Retrieve Filtered & Scoped Events
 */
eventsRouter.get(
  '/',
  requireAuth,
  enforceDistrictScope,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { type, status, limit = '50', offset = '0', busLabel } = req.query;

      const whereClause: any = {};
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

      let dbEvents: any[] = [];
      try {
        dbEvents = await prisma.roadEvent.findMany({
          where: whereClause,
          include: {
            district: { select: { name: true, code: true } },
            reviewedByUser: { select: { name: true, role: true } },
          },
          orderBy: { timestamp: 'desc' },
        });
      } catch (dbErr) {
        console.warn('Prisma findMany events fallback to memory:', (dbErr as Error).message);
      }

      // Filter in-memory events
      let filteredMem = IN_MEMORY_EVENTS.filter((e) => {
        if (req.scopedDistrictId && e.districtId !== req.scopedDistrictId && e.districtId !== 'dist-kapurthala') return false;
        if (type && e.type !== (type as string).toUpperCase()) return false;
        if (status && e.status !== (status as string).toUpperCase()) return false;
        if (busLabel && !e.busLabel?.toLowerCase().includes((busLabel as string).toLowerCase())) return false;
        return true;
      });

      const existingIds = new Set(dbEvents.map((e) => e.id));
      for (const m of filteredMem) {
        if (!existingIds.has(m.id)) {
          dbEvents.push(m);
        }
      }

      dbEvents.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      const take = Math.min(parseInt(limit as string, 10) || 50, 200);
      const skip = parseInt(offset as string, 10) || 0;
      const paginatedEvents = dbEvents.slice(skip, skip + take);

      res.json({
        totalCount: dbEvents.length,
        limit: take,
        offset: skip,
        events: paginatedEvents,
      });
    } catch (err: any) {
      console.error('List events error:', err);
      res.status(500).json({ error: 'Failed to retrieve road events.' });
    }
  }
);

/**
 * 3. Portal: Update Defect Lifecycle Status
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

      let existingEvent = IN_MEMORY_EVENTS.find((e) => e.id === id);
      if (existingEvent) {
        existingEvent.status = status;
        if (reviewNotes !== undefined) existingEvent.reviewNotes = reviewNotes;
      }

      try {
        const dbUpdated = await prisma.roadEvent.update({
          where: { id },
          data: { status, reviewNotes },
          include: { district: { select: { name: true, code: true, stateId: true } } },
        });
        existingEvent = dbUpdated;
      } catch (e) {
        // memory state already updated
      }

      if (!existingEvent) {
        res.status(404).json({ error: 'Event not found.' });
        return;
      }

      emitRoadEventUpdated(existingEvent);

      res.json({
        success: true,
        message: `Event status updated to ${status}.`,
        event: existingEvent,
      });
    } catch (err: any) {
      console.error('Update status error:', err);
      res.status(500).json({ error: 'Failed to update event status.' });
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

      let dbEvents: any[] = [];
      let activeBusSessions: any[] = [];

      try {
        [dbEvents, activeBusSessions] = await Promise.all([
          prisma.roadEvent.findMany({
            where: whereClause,
            select: {
              id: true,
              type: true,
              status: true,
              estimatedRepairCost: true,
              busLabel: true,
              districtId: true,
            },
          }),
          prisma.busDeviceSession.findMany({
            where: {
              status: 'PAIRED',
              ...(req.scopedDistrictId ? { districtId: req.scopedDistrictId } : {}),
              ...(req.user!.role === 'STATE_ADMIN' && req.user!.stateId ? { district: { stateId: req.user!.stateId } } : {}),
            },
            select: { busLabel: true },
          }),
        ]);
      } catch (dbErr) {
        console.warn('Prisma findMany stats fallback to memory:', (dbErr as Error).message);
      }

      // Merge in-memory events
      const scopedMemEvents = IN_MEMORY_EVENTS.filter(
        (e) => !req.scopedDistrictId || e.districtId === req.scopedDistrictId || e.districtId === 'dist-kapurthala'
      );

      const combinedEvents = [...dbEvents];
      const existingIds = new Set(dbEvents.map((e) => e.id));
      for (const m of scopedMemEvents) {
        if (!existingIds.has(m.id)) {
          combinedEvents.push(m);
        }
      }

      const totalEvents = combinedEvents.length;
      const newCount = combinedEvents.filter((e) => e.status === 'NEW').length;
      const reviewedCount = combinedEvents.filter((e) => e.status === 'REVIEWED').length;
      const assignedCount = combinedEvents.filter((e) => e.status === 'ASSIGNED_FOR_REPAIR').length;
      const resolvedCount = combinedEvents.filter((e) => e.status === 'RESOLVED').length;

      const potholeCount = combinedEvents.filter((e) => e.type === 'POTHOLE').length;
      const crackCount = combinedEvents.filter(
        (e) =>
          e.type === 'ROAD_CRACK' ||
          e.type === 'LONGITUDINAL_CRACK' ||
          e.type === 'TRANSVERSE_CRACK' ||
          e.type === 'ALLIGATOR_CRACK'
      ).length;
      const surfaceDamageCount = combinedEvents.filter(
        (e) => e.type === 'SURFACE_DAMAGE' || e.type === 'ROAD_EDGE_DAMAGE'
      ).length;
      const waterloggingCount = combinedEvents.filter((e) => e.type === 'WATERLOGGING').length;
      const vehicleFlowCount = combinedEvents.filter(
        (e) => e.type === 'VEHICLE_FLOW' || e.type === 'TRAFFIC_BOTTLENECK'
      ).length;

      const totalRepairCost = combinedEvents.reduce((acc, e) => acc + (Number(e.estimatedRepairCost) || 0), 0);

      const memBuses = Array.from(IN_MEMORY_SESSIONS.values())
        .filter((s) => s.status === 'PAIRED')
        .map((s) => s.busLabel?.trim())
        .filter(Boolean);

      const activeBusesCount = new Set([
        ...activeBusSessions.map((s) => s.busLabel?.trim()).filter(Boolean),
        ...memBuses,
      ]).size;

      // Calculate Road Health Index (0 - 100):
      const unresolvedDefects = totalEvents - resolvedCount;
      const roadHealthScore = Math.max(
        15,
        Math.min(100, Math.round(100 - unresolvedDefects * 1.5 + resolvedCount * 0.8))
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
        totalRepairCost,
      });
    } catch (err: any) {
      console.error('Event stats error:', err);
      res.status(500).json({ error: 'Failed to compute road intelligence stats.' });
    }
  }
);
