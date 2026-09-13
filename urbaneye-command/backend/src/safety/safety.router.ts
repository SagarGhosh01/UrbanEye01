import { Router } from 'express';
import { prisma } from '../prisma';
import { io } from '../realtime/socket';

export const safetyRouter = Router();

const DEFAULT_SAFETY_ZONES = [
  {
    id: 'sz-01',
    zoneName: 'St. Francis School Zone — Kapurthala',
    category: 'SCHOOL_ZONE',
    riskScore: 84.5,
    riskLevel: 'CRITICAL',
    latitude: 31.380,
    longitude: 75.390,
    radiusMeters: 200,
    pedestrianCount: 142,
    nearMissCount: 6,
    avgSpeedKmh: 42,
    suggestedIntervention: 'Deploy Traffic Warden & Speed Reduction Warning Signal',
    districtId: 'dist-kapurthala',
    updatedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  },
  {
    id: 'sz-02',
    zoneName: 'Civil Hospital Main Crossing',
    category: 'PEDESTRIAN_CROSSING',
    riskScore: 68.0,
    riskLevel: 'HIGH',
    latitude: 31.372,
    longitude: 75.380,
    radiusMeters: 150,
    pedestrianCount: 98,
    nearMissCount: 3,
    avgSpeedKmh: 36,
    suggestedIntervention: 'Extend Pedestrian Crossing Phase by +10 seconds',
    districtId: 'dist-kapurthala',
    updatedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  },
  {
    id: 'sz-03',
    zoneName: 'Central Bus Terminal Plaza',
    category: 'BUS_STOP_CROWD',
    riskScore: 45.2,
    riskLevel: 'MODERATE',
    latitude: 31.365,
    longitude: 75.370,
    radiusMeters: 250,
    pedestrianCount: 210,
    nearMissCount: 1,
    avgSpeedKmh: 24,
    suggestedIntervention: 'Implement Bus Lane Barricade & Crowd Channelization',
    districtId: 'dist-kapurthala',
    updatedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  },
];

// GET /api/safety/zones
safetyRouter.get('/zones', async (req, res) => {
  try {
    const { districtId } = req.query;
    let zones = await prisma.safetyRiskZone.findMany({
      orderBy: { riskScore: 'desc' },
    });

    if (zones.length === 0) {
      zones = DEFAULT_SAFETY_ZONES as any;
    }

    if (districtId) {
      zones = zones.filter(z => z.districtId === districtId || z.districtId === 'dist-kapurthala');
    }

    res.json({
      status: 'SUCCESS',
      zones,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({ status: 'ERROR', message: (error as Error).message });
  }
});

// GET /api/safety/stats
safetyRouter.get('/stats', async (req, res) => {
  res.json({
    status: 'SUCCESS',
    stats: {
      overallVruSafetyScore: 78, // 0 to 100
      activeSchoolZonesMonitored: 8,
      nearMissCount24h: 10,
      highRiskCrossingsCount: 3,
      vulnerablePedestriansTracked: 450,
    },
    timestamp: new Date().toISOString(),
  });
});

// POST /api/safety/intervene
safetyRouter.post('/intervene', async (req, res) => {
  const { zoneId, actionType, notes } = req.body;

  if (io) {
    io.emit('vru:risk_alert', { zoneId, actionType, notes, dispatchedAt: new Date().toISOString() });
  }

  res.json({
    status: 'SUCCESS',
    message: `Safety intervention '${actionType}' dispatched for zone ${zoneId}`,
    dispatchedAt: new Date().toISOString(),
  });
});
