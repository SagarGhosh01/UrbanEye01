import { Router } from 'express';
import { prisma } from '../prisma.js';
import { getIO } from '../realtime/socket.js';

export const predictiveRouter = Router();


const DEFAULT_HOTSPOTS: any[] = [];
const DEFAULT_RECOMMENDATIONS: any[] = [];

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
