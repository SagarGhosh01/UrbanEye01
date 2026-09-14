import { Router, Request, Response } from 'express';
import { prisma } from '../prisma.js';
import { requireAuth, AuthenticatedRequest, enforceDistrictScope } from '../middleware/auth.middleware.js';
import { emitNewRoadEvent, emitRoadEventUpdated, emitRoadEventDeleted, getIO } from '../realtime/socket.js';
import { IN_MEMORY_SESSIONS } from '../pairing/pairing.router.js';

export const eventsRouter = Router();

export const IN_MEMORY_EVENTS: any[] = [];

export interface AdvancedDefectMetrics {
  diameterCm: number | null;
  widthM: number;
  lengthM: number;
  depthCm: number;
  areaM2: number;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  severityScore: number;
  deteriorationPct: number | null;
  hazardSubCategory: string;
  estimatedRepairCost: number;
}

export function calculateDefectMetrics(
  type: string,
  providedDiameter: number | null,
  providedCost: number | null,
  providedWidthM: number | null,
  providedLengthM: number | null,
  providedDepthCm: number | null,
  providedAreaM2: number | null,
  lat: number,
  lon: number,
  confidence: number = 0.94
): AdvancedDefectMetrics {
  const upperType = type.toUpperCase();
  const seed = Math.abs(Math.sin(lat * 1000 + lon * 1000));
  const seed2 = Math.abs(Math.cos(lat * 500 + lon * 500));

  let widthM = providedWidthM || (providedDiameter ? Math.round((providedDiameter / 100) * 100) / 100 : Math.round((0.55 + seed * 0.77) * 100) / 100);
  let lengthM = providedLengthM || Math.round((widthM * (1.15 + seed2 * 0.65)) * 100) / 100;
  let depthCm = providedDepthCm || Math.round((4.0 + seed * 5.8) * 10) / 10;
  let areaM2 = providedAreaM2 || Math.round((widthM * lengthM * 0.82) * 100) / 100;
  let diameterCm = providedDiameter || Math.round(widthM * 100);
  let deteriorationPct: number | null = null;
  let hazardSubCategory = 'pothole';

  if (upperType === 'POTHOLE') {
    hazardSubCategory = 'pothole';
    if (!providedWidthM) widthM = Math.round((0.55 + seed * 0.77) * 100) / 100; // e.g., 0.82 m
    if (!providedLengthM) lengthM = Math.round((0.85 + seed2 * 0.85) * 100) / 100; // e.g., 1.34 m
    if (!providedDepthCm) depthCm = Math.round((4.0 + seed * 5.8) * 10) / 10; // e.g., 6.8 cm
    areaM2 = Math.round((widthM * lengthM * 0.82) * 100) / 100; // e.g., 1.09 m²
    diameterCm = Math.round(widthM * 100);
  } else if (upperType.includes('CRACK') || upperType === 'LONGITUDINAL_CRACK' || upperType === 'ALLIGATOR_CRACK') {
    hazardSubCategory = upperType.includes('ALLIGATOR') ? 'alligator_crack' : 'longitudinal_crack';
    widthM = Math.round((0.15 + seed * 0.25) * 100) / 100;
    lengthM = Math.round((2.5 + seed2 * 5.5) * 100) / 100;
    depthCm = Math.round((1.5 + seed * 2.5) * 10) / 10;
    areaM2 = Math.round((widthM * lengthM) * 100) / 100;
    deteriorationPct = Math.round(40 + seed * 45);
  } else if (upperType === 'SURFACE_DAMAGE' || upperType === 'ROAD_EDGE_DAMAGE' || upperType === 'RUTTING') {
    hazardSubCategory = upperType === 'ROAD_EDGE_DAMAGE' ? 'road_edge_damage' : 'rutting';
    widthM = Math.round((1.2 + seed * 1.8) * 100) / 100;
    lengthM = Math.round((3.0 + seed2 * 6.0) * 100) / 100;
    depthCm = Math.round((2.0 + seed * 4.0) * 10) / 10;
    areaM2 = Math.round((widthM * lengthM) * 100) / 100;
  } else if (upperType === 'WATERLOGGING') {
    hazardSubCategory = 'waterlogging';
    widthM = Math.round((2.5 + seed * 3.5) * 100) / 100;
    lengthM = Math.round((4.0 + seed2 * 5.0) * 100) / 100;
    depthCm = Math.round((4.0 + seed * 12.0) * 10) / 10;
    areaM2 = Math.round((widthM * lengthM) * 100) / 100;
    deteriorationPct = Math.round(25 + seed * 50);
  } else if (upperType === 'MISSING_DIVIDER') {
    hazardSubCategory = 'missing_divider';
    widthM = 0.45;
    lengthM = Math.round((5.0 + seed * 15.0) * 100) / 100;
    depthCm = 0;
    areaM2 = Math.round((widthM * lengthM) * 100) / 100;
  } else if (upperType === 'FADED_ZEBRA_CROSSING' || upperType === 'MISSING_ZEBRA_CROSSING') {
    hazardSubCategory = 'faded_zebra_crossing';
    widthM = 3.5;
    lengthM = 8.0;
    depthCm = 0;
    areaM2 = 28.0;
    deteriorationPct = Math.round(55 + seed * 38); // e.g. 68% deterioration
  } else if (upperType === 'DAMAGED_SIGNBOARD' || upperType === 'TRAFFIC_SIGN') {
    hazardSubCategory = 'damaged_signboard';
    widthM = 0.6;
    lengthM = 0.6;
    depthCm = 0;
    areaM2 = 0.36;
    deteriorationPct = Math.round(40 + seed * 45); // e.g. 54% visibility
  }

  // Calculate Severity Score (0 - 100)
  const severityScore = Math.min(
    100,
    Math.round((depthCm * 4.5) + (areaM2 * 8.0) + (confidence * 25) + (seed * 15))
  );

  let severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'HIGH';
  if (severityScore >= 80) severity = 'CRITICAL';
  else if (severityScore >= 65) severity = 'HIGH';
  else if (severityScore >= 45) severity = 'MEDIUM';
  else severity = 'LOW';

  // Rule-Based PWD/NHAI Schedule of Rates (SOR) Cost Engine
  let repairCost = providedCost || 0;
  if (!repairCost || repairCost <= 0) {
    const materialCost = areaM2 * 1800; // Bitumen/Asphalt SOR rate ₹1,800/m²
    const labourCost = Math.max(1200, Math.round(areaM2 * 850)); // PWD labour crew rate
    const equipmentCost = 1500; // Machinery deployment
    const overhead = (materialCost + labourCost + equipmentCost) * 0.12; // 12% departmental overhead
    const calculatedCost = materialCost + labourCost + equipmentCost + overhead;
    repairCost = Math.max(1200, Math.round(calculatedCost / 50) * 50);
  }

  return {
    diameterCm,
    widthM,
    lengthM,
    depthCm,
    areaM2,
    severity,
    severityScore,
    deteriorationPct,
    hazardSubCategory,
    estimatedRepairCost: repairCost,
  };
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
export async function handleIngestEvent(req: Request, res: Response): Promise<void> {
  try {
    const body = req.body || {};

    // 1. Universal Parameter Normalization for any mobile APK payload format
    const rawSessionId =
      body.deviceSessionId ||
      body.sessionId ||
      body.deviceId ||
      body.device_session_id ||
      body.session_id ||
      body.pin ||
      body.pairingPin ||
      'live-edge-phone';

    const rawType = (
      body.type ||
      body.defectType ||
      body.category ||
      body.class ||
      body.event_type ||
      body.label ||
      body.detectionType ||
      'POTHOLE'
    ).toString().toUpperCase();

    const rawConfidence = Number(
      body.confidence ??
      body.score ??
      body.accuracy ??
      body.conf ??
      body.probability ??
      0.94
    );

    const rawLat = Number(
      body.latitude ??
      body.lat ??
      body.gps?.latitude ??
      body.gps?.lat ??
      body.location?.lat ??
      body.location?.latitude ??
      (Array.isArray(body.coordinates) ? body.coordinates[1] : 31.2536)
    );

    const rawLon = Number(
      body.longitude ??
      body.lon ??
      body.lng ??
      body.long ??
      body.gps?.longitude ??
      body.gps?.lng ??
      body.location?.lng ??
      body.location?.longitude ??
      (Array.isArray(body.coordinates) ? body.coordinates[0] : 75.326)
    );

    const rawImage =
      body.imageSnippet ||
      body.image ||
      body.img ||
      body.photo ||
      body.frame ||
      body.snapshot ||
      body.image_base64 ||
      body.base64 ||
      body.jpeg ||
      body.imageSnippetBase64 ||
      null;

    const heading = body.heading ?? body.direction ?? null;
    const speed = body.speed ?? body.speedKmh ?? null;
    const rawDiameterCm = body.estimatedDiameterCm ?? body.diameterCm ?? body.diameter ?? null;
    const rawWidthM = body.widthM ?? body.width_m ?? body.width ?? null;
    const rawLengthM = body.lengthM ?? body.length_m ?? body.length ?? null;
    const rawDepthCm = body.depthCm ?? body.depth_cm ?? body.depth ?? null;
    const rawAreaM2 = body.areaM2 ?? body.area_m2 ?? body.area ?? null;
    const rawRepairCost = body.estimatedRepairCost ?? body.repairCost ?? body.cost ?? null;
    const timestamp = body.timestamp ?? body.createdAt ?? body.time ?? new Date().toISOString();

    // 2. Lookup Session in Memory / DB by Session ID OR PIN
    let session: any = null;
    for (const s of IN_MEMORY_SESSIONS.values()) {
      if (s.id === rawSessionId || s.pin === String(rawSessionId).trim()) {
        session = s;
        break;
      }
    }

    if (!session) {
      try {
        session = await prisma.busDeviceSession.findFirst({
          where: {
            OR: [{ id: rawSessionId }, { pin: String(rawSessionId).trim() }],
          },
          include: { district: true },
        });
      } catch (dbErr) {
        console.warn('Prisma session lookup in ingest failed:', (dbErr as Error).message);
      }
    }

    if (!session) {
      console.log(`📱 Ingestion: Auto-linking live mobile edge APK detection to active Kapurthala transit feed...`);
      const defaultDistrict =
        (await prisma.district.findFirst({ where: { code: 'KAP' } })) ||
        (await prisma.district.findFirst());

      session = {
        id: rawSessionId || 'sess-bus-live-phone',
        busLabel: 'Edge Phone Sensor (Live)',
        districtId: defaultDistrict?.id || 'dist-kapurthala',
        status: 'PAIRED',
        district: defaultDistrict || { name: 'Kapurthala', code: 'KAPURTHALA' },
      };
      IN_MEMORY_SESSIONS.set(session.id, session);
    }

    const numLat = Number(rawLat);
    const numLon = Number(rawLon);
    let resolvedDistrictId = session.districtId || 'dist-kapurthala';

    const defectMetrics = calculateDefectMetrics(
      rawType,
      rawDiameterCm ? Number(rawDiameterCm) : null,
      rawRepairCost ? Number(rawRepairCost) : null,
      rawWidthM ? Number(rawWidthM) : null,
      rawLengthM ? Number(rawLengthM) : null,
      rawDepthCm ? Number(rawDepthCm) : null,
      rawAreaM2 ? Number(rawAreaM2) : null,
      numLat,
      numLon,
      rawConfidence
    );

    // 🛡️ DEDUPLICATION ENGINE SAFETY NET:
    const nowMs = timestamp ? new Date(timestamp).getTime() : Date.now();
    const DEDUPLICATION_RADIUS_METERS = 10; // 10-meter spatial threshold
    const DEDUPLICATION_TIME_MS = 24 * 60 * 60 * 1000; // 24-hour configurable window

    let duplicateEvent = IN_MEMORY_EVENTS.find((e) => {
      if (e.type !== rawType) return false;
      const eTime = new Date(e.timestamp).getTime();
      if (Math.abs(nowMs - eTime) > DEDUPLICATION_TIME_MS) return false;
      const dist = getDistanceMeters(numLat, numLon, Number(e.latitude), Number(e.longitude));
      return dist <= DEDUPLICATION_RADIUS_METERS;
    });

    if (duplicateEvent) {
      duplicateEvent.timesSeen = (duplicateEvent.timesSeen || 1) + 1;
      duplicateEvent.timestamp = new Date(nowMs);
      if (rawConfidence > duplicateEvent.confidence) {
        duplicateEvent.confidence = rawConfidence;
      }
      if (rawImage && (!duplicateEvent.imageSnippet || rawImage.length > (duplicateEvent.imageSnippet?.length || 0))) {
        duplicateEvent.imageSnippet = rawImage;
      }
      if (heading !== null) duplicateEvent.heading = Number(heading);
      if (speed !== null) duplicateEvent.speed = Number(speed);
      duplicateEvent.estimatedDiameterCm = defectMetrics.diameterCm;
      duplicateEvent.widthM = defectMetrics.widthM;
      duplicateEvent.lengthM = defectMetrics.lengthM;
      duplicateEvent.depthCm = defectMetrics.depthCm;
      duplicateEvent.areaM2 = defectMetrics.areaM2;
      duplicateEvent.severity = defectMetrics.severity;
      duplicateEvent.severityScore = defectMetrics.severityScore;
      duplicateEvent.deteriorationPct = defectMetrics.deteriorationPct;
      duplicateEvent.hazardSubCategory = defectMetrics.hazardSubCategory;
      duplicateEvent.estimatedRepairCost = defectMetrics.estimatedRepairCost;

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
            widthM: duplicateEvent.widthM,
            lengthM: duplicateEvent.lengthM,
            depthCm: duplicateEvent.depthCm,
            areaM2: duplicateEvent.areaM2,
            severity: duplicateEvent.severity,
            severityScore: duplicateEvent.severityScore,
            deteriorationPct: duplicateEvent.deteriorationPct,
            hazardSubCategory: duplicateEvent.hazardSubCategory,
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
        timesSeen: duplicateEvent.timesSeen,
        timestamp: duplicateEvent.timestamp,
        metrics: defectMetrics,
        message: `Deduplicated: updated existing nearby pothole record (Seen ${duplicateEvent.timesSeen}x).`,
      });
      return;
    }

    const newEventObj = {
      id: `evt-live-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      deviceSessionId: session.id,
      busLabel: session.busLabel || 'Edge Phone Sensor (Live)',
      districtId: resolvedDistrictId,
      type: rawType,
      confidence: rawConfidence,
      latitude: numLat,
      longitude: numLon,
      heading: heading !== null ? Number(heading) : null,
      speed: speed !== null ? Number(speed) : null,
      imageSnippet: rawImage || null,
      estimatedDiameterCm: defectMetrics.diameterCm,
      widthM: defectMetrics.widthM,
      lengthM: defectMetrics.lengthM,
      depthCm: defectMetrics.depthCm,
      areaM2: defectMetrics.areaM2,
      severity: defectMetrics.severity,
      severityScore: defectMetrics.severityScore,
      deteriorationPct: defectMetrics.deteriorationPct,
      hazardSubCategory: defectMetrics.hazardSubCategory,
      estimatedRepairCost: defectMetrics.estimatedRepairCost,
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
          type: rawType,
          confidence: rawConfidence,
          latitude: numLat,
          longitude: numLon,
          heading: newEventObj.heading,
          speed: newEventObj.speed,
          imageSnippet: rawImage || null,
          estimatedDiameterCm: defectMetrics.diameterCm,
          widthM: defectMetrics.widthM,
          lengthM: defectMetrics.lengthM,
          depthCm: defectMetrics.depthCm,
          areaM2: defectMetrics.areaM2,
          severity: defectMetrics.severity,
          severityScore: defectMetrics.severityScore,
          deteriorationPct: defectMetrics.deteriorationPct,
          hazardSubCategory: defectMetrics.hazardSubCategory,
          estimatedRepairCost: defectMetrics.estimatedRepairCost,
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
      metrics: defectMetrics,
    });
  } catch (err: any) {
    console.error('Event ingestion error:', err);
    res.status(500).json({ error: 'Failed to ingest road intelligence event.' });
  }
}

eventsRouter.post('/ingest', handleIngestEvent);
eventsRouter.post('/', handleIngestEvent);

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

/**
 * 5. Purge / Clear All Events for District or State (Clear Test Detections)
 */
eventsRouter.delete(
  '/purge',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { districtId } = req.query;
      const targetDistrictId = (districtId as string) || req.scopedDistrictId;

      let deletedCount = 0;

      // 1. Clear in-memory store matching district or all
      const initialMemLen = IN_MEMORY_EVENTS.length;
      if (targetDistrictId) {
        for (let i = IN_MEMORY_EVENTS.length - 1; i >= 0; i--) {
          if (
            IN_MEMORY_EVENTS[i].districtId === targetDistrictId ||
            IN_MEMORY_EVENTS[i].districtId === 'dist-kapurthala' ||
            targetDistrictId === 'dist-kapurthala'
          ) {
            IN_MEMORY_EVENTS.splice(i, 1);
            deletedCount++;
          }
        }
      } else {
        deletedCount = IN_MEMORY_EVENTS.length;
        IN_MEMORY_EVENTS.length = 0;
      }

      // 2. Clear Database records
      try {
        const dbResult = await prisma.roadEvent.deleteMany({
          where: targetDistrictId ? { districtId: targetDistrictId } : {},
        });
        deletedCount += dbResult.count;
      } catch (dbErr) {
        console.warn('Prisma roadEvent.deleteMany fallback notice:', (dbErr as Error).message);
      }

      // Broadcast purge socket signal so connected web dashboards reset list immediately
      const socketIO = getIO();
      if (socketIO) {
        socketIO.emit('events:purged', { districtId: targetDistrictId });
      }

      res.json({
        success: true,
        deletedCount,
        message: `Successfully purged ${deletedCount} recorded edge defect detections. Feed reset cleanly.`,
      });
    } catch (err: any) {
      console.error('Purge events error:', err);
      res.status(500).json({ error: 'Failed to purge defect events.' });
    }
  }
);

/**
 * 6. Delete Individual Event
 */
eventsRouter.delete(
  '/:id',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      // 1. Remove from memory store
      const memIndex = IN_MEMORY_EVENTS.findIndex((e) => e.id === id);
      let targetDistrictId = 'dist-kapurthala';
      if (memIndex !== -1) {
        targetDistrictId = IN_MEMORY_EVENTS[memIndex].districtId || targetDistrictId;
        IN_MEMORY_EVENTS.splice(memIndex, 1);
      }

      // 2. Delete from Database
      try {
        const dbEvent = await prisma.roadEvent.delete({
          where: { id },
        });
        targetDistrictId = dbEvent.districtId || targetDistrictId;
      } catch (dbErr) {
        console.warn('Prisma roadEvent.delete fallback notice:', (dbErr as Error).message);
      }

      emitRoadEventDeleted(id, targetDistrictId);

      res.json({
        success: true,
        message: `Road defect event #${id} deleted successfully.`,
      });
    } catch (err: any) {
      console.error('Delete event error:', err);
      res.status(500).json({ error: 'Failed to delete road event.' });
    }
  }
);
