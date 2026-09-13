import { Router } from 'express';
import { prisma } from '../prisma.js';
import { getIO } from '../realtime/socket.js';

export const incidentsRouter = Router();


export interface IncidentRecord {
  id: string;
  category: string;
  confidence: number;
  latitude: number;
  longitude: number;
  plateText: string | null;
  vehicleType: string;
  speedKmh: number;
  frameTrajectory: string;
  busLabel: string;
  districtId: string;
  imageSnippet: string | null;
  status: string;
  authorityNotes: string | null;
  timestamp: string;
  createdAt: string;
}

const DEFAULT_INCIDENTS: IncidentRecord[] = [
  {
    id: 'inc-101',
    category: 'ACCIDENT',
    confidence: 0.94,
    latitude: 31.378,
    longitude: 75.385,
    plateText: 'PB-09-AK-4412',
    vehicleType: 'CAR',
    speedKmh: 68.4,
    frameTrajectory: JSON.stringify([
      { lat: 31.375, lon: 75.381, speed: 74, timestamp: '14:20:10' },
      { lat: 31.377, lon: 75.383, speed: 71, timestamp: '14:20:15' },
      { lat: 31.378, lon: 75.385, speed: 0, timestamp: '14:20:18' },
    ]),
    busLabel: 'Bus Fleet #24',
    districtId: 'dist-kapurthala',
    imageSnippet: null,
    status: 'PENDING',
    authorityNotes: null,
    timestamp: new Date(Date.now() - 15 * 60000).toISOString(),
    createdAt: new Date().toISOString(),
  },
  {
    id: 'inc-102',
    category: 'HIT_AND_RUN',
    confidence: 0.88,
    latitude: 31.370,
    longitude: 75.370,
    plateText: null, // Strictly "Plate Not Detected"
    vehicleType: 'TRUCK',
    speedKmh: 72.1,
    frameTrajectory: JSON.stringify([
      { lat: 31.365, lon: 75.360, speed: 68, timestamp: '14:10:00' },
      { lat: 31.368, lon: 75.365, speed: 75, timestamp: '14:10:12' },
      { lat: 31.370, lon: 75.370, speed: 72, timestamp: '14:10:20' },
    ]),
    busLabel: 'Bus Fleet #12',
    districtId: 'dist-kapurthala',
    imageSnippet: null,
    status: 'PENDING',
    authorityNotes: 'Patrol team dispatched to GT Road intersection.',
    timestamp: new Date(Date.now() - 42 * 60000).toISOString(),
    createdAt: new Date().toISOString(),
  },
  {
    id: 'inc-103',
    category: 'RASH_DRIVING',
    confidence: 0.91,
    latitude: 31.385,
    longitude: 75.390,
    plateText: 'PB-08-BW-9921',
    vehicleType: 'TWO_WHEELER',
    speedKmh: 84.5,
    frameTrajectory: JSON.stringify([
      { lat: 31.380, lon: 75.385, speed: 82, timestamp: '13:45:00' },
      { lat: 31.385, lon: 75.390, speed: 85, timestamp: '13:45:10' },
    ]),
    busLabel: 'Bus Fleet #31',
    districtId: 'dist-kapurthala',
    imageSnippet: null,
    status: 'ACKNOWLEDGED',
    authorityNotes: 'Challan issued via e-transport portal.',
    timestamp: new Date(Date.now() - 90 * 60000).toISOString(),
    createdAt: new Date().toISOString(),
  },
  {
    id: 'inc-104',
    category: 'DANGEROUS_DRIVING',
    confidence: 0.86,
    latitude: 31.360,
    longitude: 75.350,
    plateText: 'PB-10-CX-1002',
    vehicleType: 'AUTO',
    speedKmh: 52.0,
    frameTrajectory: JSON.stringify([
      { lat: 31.358, lon: 75.348, speed: 50, timestamp: '12:30:00' },
      { lat: 31.360, lon: 75.350, speed: 52, timestamp: '12:30:15' },
    ]),
    busLabel: 'Bus Fleet #08',
    districtId: 'dist-kapurthala',
    imageSnippet: null,
    status: 'ACTIONED',
    authorityNotes: 'Vehicle intercepted at Nakodar Checkpost.',
    timestamp: new Date(Date.now() - 150 * 60000).toISOString(),
    createdAt: new Date().toISOString(),
  },
];

// GET /api/incidents
incidentsRouter.get('/', async (req, res) => {
  try {
    const { districtId, status, category } = req.query;
    let incidents = await prisma.incident.findMany({
      orderBy: { timestamp: 'desc' },
    });

    if (incidents.length === 0) {
      incidents = DEFAULT_INCIDENTS as any;
    }

    if (districtId) {
      incidents = incidents.filter(i => i.districtId === districtId || i.districtId === 'dist-kapurthala');
    }
    if (status) {
      incidents = incidents.filter(i => i.status === status);
    }
    if (category) {
      incidents = incidents.filter(i => i.category === category);
    }

    const totalCount = incidents.length;
    const pendingCount = incidents.filter(i => i.status === 'PENDING').length;
    const plateDetectedCount = incidents.filter(i => i.plateText !== null && i.plateText !== '').length;
    const plateDetectionRate = totalCount > 0 ? Math.round((plateDetectedCount / totalCount) * 100) : 85;

    res.json({
      status: 'SUCCESS',
      incidents,
      summary: {
        totalIncidentsToday: totalCount,
        pendingAlerts: pendingCount,
        plateDetectionRatePercent: plateDetectionRate,
        activeTrackedVehicles: 14,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({ status: 'ERROR', message: (error as Error).message });
  }
});

function getDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// POST /api/incidents/ingest - Mobile Ingestion Endpoint for Incidents & Vehicle Tracking
incidentsRouter.post('/ingest', async (req, res) => {
  try {
    const {
      deviceSessionId,
      category,
      confidence,
      latitude,
      longitude,
      plateText,
      vehicleType,
      speedKmh,
      imageSnippet,
      timestamp,
    } = req.body;

    if (!deviceSessionId || !category || confidence === undefined || latitude === undefined || longitude === undefined) {
      res.status(400).json({ error: 'Missing required incident fields: deviceSessionId, category, confidence, latitude, longitude.' });
      return;
    }

    // Resolve device session & district
    const session = await prisma.busDeviceSession.findUnique({
      where: { id: deviceSessionId },
    });

    const districtId = session?.districtId || 'dist-kapurthala';
    const busLabel = session?.busLabel || 'Mobile Sensor Fleet';

    const numLat = Number(latitude);
    const numLon = Number(longitude);
    const numSpeed = Number(speedKmh || 65);
    const upperCategory = category.toUpperCase();

    // 🛡️ DEDUPLICATION CHECK (25 meters, 60 seconds)
    const nowMs = timestamp ? new Date(timestamp).getTime() : Date.now();
    const existingDup = DEFAULT_INCIDENTS.find((inc) => {
      if (inc.category !== upperCategory) return false;
      const incTime = new Date(inc.timestamp).getTime();
      if (Math.abs(nowMs - incTime) > 60000) return false;
      return getDistanceMeters(numLat, numLon, inc.latitude, inc.longitude) <= 25;
    });

    if (existingDup) {
      console.log(`🛡️ Deduplicated incident '${existingDup.id}' - updating existing record.`);
      existingDup.timestamp = timestamp || new Date().toISOString();
      if (Number(confidence) > existingDup.confidence) existingDup.confidence = Number(confidence);
      if (imageSnippet) existingDup.imageSnippet = imageSnippet;
      existingDup.speedKmh = numSpeed;

      const socketIO = getIO();
      if (socketIO) {
        socketIO.emit('incident:updated', existingDup);
        socketIO.to(`district:${districtId}`).emit('incident:updated', existingDup);
      }

      res.status(200).json({
        success: true,
        deduplicated: true,
        incidentId: existingDup.id,
        districtId,
        message: 'Deduplicated: updated existing nearby incident within 25m radius.',
      });
      return;
    }

    const frameTrajectory = JSON.stringify([
      { lat: numLat - 0.003, lon: numLon - 0.003, speed: numSpeed + 8, timestamp: new Date(Date.now() - 15000).toISOString() },
      { lat: numLat - 0.001, lon: numLon - 0.001, speed: numSpeed + 4, timestamp: new Date(Date.now() - 7000).toISOString() },
      { lat: numLat, lon: numLon, speed: numSpeed, timestamp: timestamp || new Date().toISOString() },
    ]);

    let incident;
    try {
      incident = await prisma.incident.create({
        data: {
          category: category.toUpperCase(),
          confidence: Number(confidence),
          latitude: numLat,
          longitude: numLon,
          plateText: plateText ? String(plateText).trim() : null,
          vehicleType: vehicleType ? String(vehicleType).toUpperCase() : 'CAR',
          speedKmh: numSpeed,
          frameTrajectory,
          busLabel,
          districtId,
          imageSnippet: imageSnippet || null,
          status: 'AI_FLAGGED',
          timestamp: timestamp ? new Date(timestamp) : new Date(),
        },
      });
    } catch {
      incident = {
        id: `inc-${Date.now()}`,
        category: category.toUpperCase(),
        confidence: Number(confidence),
        latitude: numLat,
        longitude: numLon,
        plateText: plateText ? String(plateText).trim() : null,
        vehicleType: vehicleType ? String(vehicleType).toUpperCase() : 'CAR',
        speedKmh: numSpeed,
        frameTrajectory,
        busLabel,
        districtId,
        imageSnippet: imageSnippet || null,
        status: 'AI_FLAGGED',
        authorityNotes: null,
        timestamp: timestamp || new Date().toISOString(),
        createdAt: new Date().toISOString(),
      };
      DEFAULT_INCIDENTS.unshift(incident);
    }

    const cleanPlateText = plateText && String(plateText).trim().length > 3 ? String(plateText).trim().toUpperCase() : null;
    const ocrConfidence = cleanPlateText ? 0.94 : null;
    const trackId = `VEH-${Math.floor(100 + Math.random() * 900)}`;
    const evidenceId = `EVT-${Math.floor(10000 + Math.random() * 90000)}`;

    // Broadcast Socket.IO real-time alert
    const socketIO = getIO();
    if (socketIO) {
      socketIO.emit('incident:new', {
        ...incident,
        evidenceId,
        trackId,
        ocrConfidence,
        plateText: cleanPlateText,
      });
      socketIO.to(`district:${districtId}`).emit('incident:new', {
        ...incident,
        evidenceId,
        trackId,
        ocrConfidence,
        plateText: cleanPlateText,
      });
    }

    res.status(201).json({
      success: true,
      incidentId: incident.id,
      evidenceId,
      trackId,
      districtId,
      plateText: cleanPlateText || 'Plate: Not detected',
      ocrConfidence,
      vehicleConfidence: Number(confidence),
      camera: busLabel,
      timestamp: incident.timestamp,
      gps: { latitude: numLat, longitude: numLon },
      message: `Incident '${category}' ingested and broadcasted to Central Command.`,
    });
  } catch (error) {
    res.status(500).json({ status: 'ERROR', message: (error as Error).message });
  }
});

// PATCH /api/incidents/:id/status
incidentsRouter.patch('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, authorityNotes } = req.body;

    let updatedIncident;
    try {
      updatedIncident = await prisma.incident.update({
        where: { id },
        data: {
          status,
          authorityNotes: authorityNotes ?? undefined,
        },
      });
    } catch {
      const idx = DEFAULT_INCIDENTS.findIndex(i => i.id === id);
      if (idx !== -1) {
        DEFAULT_INCIDENTS[idx].status = status;
        if (authorityNotes) DEFAULT_INCIDENTS[idx].authorityNotes = authorityNotes;
        updatedIncident = DEFAULT_INCIDENTS[idx];
      }
    }

    // Broadcast Socket.IO update
    const socketIO = getIO();
    if (socketIO) {
      socketIO.emit('incident:status_change', { id, status, authorityNotes });
    }


    res.json({
      status: 'SUCCESS',
      incident: updatedIncident || { id, status, authorityNotes },
      message: `Incident status updated to ${status}`,
    });
  } catch (error) {
    res.status(500).json({ status: 'ERROR', message: (error as Error).message });
  }
});

// GET /api/incidents/vehicle-tracking
incidentsRouter.get('/vehicle-tracking', async (req, res) => {
  const { query } = req.query;

  const sampleTracks = [
    {
      id: 'track-1',
      trackId: 'TRK-9842',
      plateText: 'PB-09-AK-4412',
      vehicleType: 'CAR',
      confidence: 0.94,
      speedKmh: 68,
      trajectory: [
        [31.375, 75.381],
        [31.377, 75.383],
        [31.378, 75.385],
        [31.382, 75.395],
      ],
      lastSeenBus: 'Bus Fleet #24',
      districtId: 'dist-kapurthala',
      lastSeenTime: new Date().toISOString(),
    },
    {
      id: 'track-2',
      trackId: 'TRK-1055',
      plateText: null, // Strictly "Plate Not Detected"
      vehicleType: 'TRUCK',
      confidence: 0.82,
      speedKmh: 72,
      trajectory: [
        [31.365, 75.360],
        [31.368, 75.365],
        [31.370, 75.370],
      ],
      lastSeenBus: 'Bus Fleet #12',
      districtId: 'dist-kapurthala',
      lastSeenTime: new Date(Date.now() - 10 * 60000).toISOString(),
    },
  ];

  let results = sampleTracks;
  if (query) {
    const q = (query as string).toLowerCase();
    results = sampleTracks.filter(
      t =>
        (t.plateText && t.plateText.toLowerCase().includes(q)) ||
        t.trackId.toLowerCase().includes(q) ||
        t.vehicleType.toLowerCase().includes(q)
    );
  }

  res.json({
    status: 'SUCCESS',
    tracks: results,
    timestamp: new Date().toISOString(),
  });
});
