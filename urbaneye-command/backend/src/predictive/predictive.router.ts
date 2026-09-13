import { Router } from 'express';
import { prisma } from '../prisma.js';
import { getIO } from '../realtime/socket.js';

export const predictiveRouter = Router();


const DEFAULT_HOTSPOTS = [
  {
    id: 'hs-101',
    locationName: 'GT Road Junction 04 (Sub-base Degradation)',
    districtId: 'dist-kapurthala',
    latitude: 31.370,
    longitude: 75.370,
    recurrenceCount: 14,
    severityScore: 92.4,
    maintenancePriority: 94.0,
    primaryDefectType: 'POTHOLE',
    recommendedAction: 'Full Sub-base Asphalt Overlay & Drainage Re-engineering',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'hs-102',
    locationName: 'NH-44 Kapurthala Flyover Ramp',
    districtId: 'dist-kapurthala',
    latitude: 31.378,
    longitude: 75.385,
    recurrenceCount: 9,
    severityScore: 78.5,
    maintenancePriority: 82.5,
    primaryDefectType: 'ROAD_CRACK',
    recommendedAction: 'Sealing Longitudinal Fatigue Cracks & Bitumen Resurfacing',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'hs-103',
    locationName: 'Nakodar Road Underpass',
    districtId: 'dist-kapurthala',
    latitude: 31.360,
    longitude: 75.350,
    recurrenceCount: 7,
    severityScore: 71.0,
    maintenancePriority: 75.0,
    primaryDefectType: 'WATERLOGGING',
    recommendedAction: 'Stormwater Culvert Clearing & High-Capacity Sump Pump Installation',
    createdAt: new Date().toISOString(),
  },
];

const DEFAULT_RECOMMENDATIONS = [
  {
    id: 'rec-01',
    type: 'WORK_ORDER',
    title: 'Emergency Pothole Patching — GT Road Junction 04',
    description: 'High recurrence site (14 detections in 30 days). PWD repair team assignment recommended to prevent structural road base failure.',
    urgency: 'CRITICAL',
    impactScore: 95.0,
    estimatedCostINR: 145000,
    districtId: 'dist-kapurthala',
    status: 'PROPOSED',
    linkedEntityId: 'hs-101',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'rec-02',
    type: 'TRAFFIC_REROUTE',
    title: 'Peak-Hour Freight Diversion to Phagwara Express Bypass',
    description: '15-minute predictive algorithm forecasts 88% congestion density on NH-44. Reroute heavy trucks to reduce delay by 11 mins.',
    urgency: 'HIGH',
    impactScore: 88.0,
    estimatedCostINR: 0,
    districtId: 'dist-kapurthala',
    status: 'PROPOSED',
    linkedEntityId: null,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'rec-03',
    type: 'SAFETY_INTERVENTION',
    title: 'School Zone Dynamic Speed Calming — St. Francis Corridor',
    description: 'VRU Safety Risk score spiked to 84.5 during afternoon dismissal. Deploy automated VMS warning & warden dispatch.',
    urgency: 'HIGH',
    impactScore: 91.0,
    estimatedCostINR: 25000,
    districtId: 'dist-kapurthala',
    status: 'PROPOSED',
    linkedEntityId: 'sz-01',
    createdAt: new Date().toISOString(),
  },
];

// GET /api/predictive/forecast
predictiveRouter.get('/forecast', (req, res) => {
  res.json({
    status: 'SUCCESS',
    forecast: {
      min15: {
        predictedDensityPercent: 78,
        trafficLevel: 'HEAVY',
        predictedBottlenecks: [
          { location: 'GT Road Junction 04', lat: 31.370, lon: 75.370, expectedDelayMin: 14, confidence: 0.92 },
          { location: 'NH-44 Flyover Ramp', lat: 31.378, lon: 75.385, expectedDelayMin: 11, confidence: 0.88 },
        ],
      },
      min30: {
        predictedDensityPercent: 86,
        trafficLevel: 'SEVERE',
        predictedBottlenecks: [
          { location: 'GT Road Junction 04', lat: 31.370, lon: 75.370, expectedDelayMin: 22, confidence: 0.95 },
          { location: 'NH-44 Flyover Ramp', lat: 31.378, lon: 75.385, expectedDelayMin: 18, confidence: 0.90 },
          { location: 'Nakodar Road Intersection', lat: 31.360, lon: 75.350, expectedDelayMin: 9, confidence: 0.82 },
        ],
      },
      min60: {
        predictedDensityPercent: 62,
        trafficLevel: 'MODERATE',
        predictedBottlenecks: [
          { location: 'GT Road Junction 04', lat: 31.370, lon: 75.370, expectedDelayMin: 8, confidence: 0.75 },
        ],
      },
    },
    timestamp: new Date().toISOString(),
  });
});

// GET /api/predictive/hotspots
predictiveRouter.get('/hotspots', async (req, res) => {
  try {
    const { districtId } = req.query;
    let hotspots = await prisma.predictiveHotspot.findMany({
      orderBy: { maintenancePriority: 'desc' },
    });

    if (hotspots.length === 0) {
      hotspots = DEFAULT_HOTSPOTS as any;
    }

    if (districtId) {
      hotspots = hotspots.filter(h => h.districtId === districtId || h.districtId === 'dist-kapurthala');
    }

    res.json({
      status: 'SUCCESS',
      hotspots,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({ status: 'ERROR', message: (error as Error).message });
  }
});

// GET /api/predictive/recommendations
predictiveRouter.get('/recommendations', async (req, res) => {
  try {
    const { districtId, status } = req.query;
    let recommendations = await prisma.urbanRecommendation.findMany({
      orderBy: { impactScore: 'desc' },
    });

    if (recommendations.length === 0) {
      recommendations = DEFAULT_RECOMMENDATIONS as any;
    }

    if (districtId) {
      recommendations = recommendations.filter(r => r.districtId === districtId || r.districtId === 'dist-kapurthala');
    }
    if (status) {
      recommendations = recommendations.filter(r => r.status === status);
    }

    res.json({
      status: 'SUCCESS',
      recommendations,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({ status: 'ERROR', message: (error as Error).message });
  }
});

// POST /api/predictive/recommendations/:id/execute
predictiveRouter.post('/recommendations/:id/execute', async (req, res) => {
  const { id } = req.params;
  const { action } = req.body;

  let rec = DEFAULT_RECOMMENDATIONS.find(r => r.id === id);
  if (rec) {
    rec.status = 'DISPATCHED';
  }

  const socketIO = getIO();
  if (socketIO) {
    socketIO.emit('recommendation:new', { id, status: 'DISPATCHED', executedAt: new Date().toISOString() });
  }

  res.json({
    status: 'SUCCESS',
    message: `Recommendation '${id}' executed: converted into ${action || 'Work Order / Dispatch'}.`,
    recommendation: rec || { id, status: 'DISPATCHED' },
  });
});
