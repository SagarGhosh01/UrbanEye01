import { Router } from 'express';

export const trafficRouter = Router();

// Mock Route Database for Kapurthala & Jalandhar
const KAPURTHALA_ROUTES = [
  {
    id: 'route-nh44-kap',
    name: 'NH-44 — Kapurthala Section',
    junctionTag: 'Junction 04',
    districtId: 'dist-kapurthala',
    trafficLevel: 'HEAVY',
    vehiclesPerMin: 184,
    avgSpeedKmh: 21,
    normalSpeedKmh: 42,
    estimatedDelayMin: 14,
    bottleneckStatus: 'ACTIVE',
    coordinates: [
      [31.378, 75.385],
      [31.382, 75.395],
      [31.389, 75.405],
      [31.395, 75.418],
    ],
    vehicleClassification: {
      cars: 61,
      twoWheelers: 18,
      buses: 11,
      trucks: 7,
      other: 3,
    },
    detectedByBuses: ['Bus Fleet #24', 'Bus Fleet #31', 'Bus Fleet #42'],
    lastUpdated: 'Just now',
  },
  {
    id: 'route-gt-road-j4',
    name: 'GT Road — Junction 04',
    junctionTag: 'Junction 04',
    districtId: 'dist-kapurthala',
    trafficLevel: 'SEVERE',
    vehiclesPerMin: 210,
    avgSpeedKmh: 18,
    normalSpeedKmh: 45,
    estimatedDelayMin: 12,
    bottleneckStatus: 'ACTIVE',
    coordinates: [
      [31.365, 75.370],
      [31.370, 75.380],
      [31.378, 75.385],
      [31.385, 75.390],
    ],
    vehicleClassification: {
      cars: 58,
      twoWheelers: 22,
      buses: 9,
      trucks: 8,
      other: 3,
    },
    detectedByBuses: ['Bus Fleet #12', 'Bus Fleet #24', 'Bus Fleet #55'],
    lastUpdated: '1 min ago',
  },
  {
    id: 'route-nakodar-rd',
    name: 'Nakodar Road Corridor',
    junctionTag: 'Sector 12 Flyover',
    districtId: 'dist-kapurthala',
    trafficLevel: 'MODERATE',
    vehiclesPerMin: 98,
    avgSpeedKmh: 34,
    normalSpeedKmh: 40,
    estimatedDelayMin: 4,
    bottleneckStatus: 'NORMAL',
    coordinates: [
      [31.360, 75.350],
      [31.365, 75.360],
      [31.370, 75.370],
    ],
    vehicleClassification: {
      cars: 50,
      twoWheelers: 30,
      buses: 8,
      trucks: 7,
      other: 5,
    },
    detectedByBuses: ['Bus Fleet #08', 'Bus Fleet #19'],
    lastUpdated: '2 mins ago',
  },
  {
    id: 'route-phagwara-bypass',
    name: 'Phagwara Express Bypass',
    junctionTag: 'Bypass Toll Plaza',
    districtId: 'dist-kapurthala',
    trafficLevel: 'LOW',
    vehiclesPerMin: 42,
    avgSpeedKmh: 68,
    normalSpeedKmh: 70,
    estimatedDelayMin: 1,
    bottleneckStatus: 'NORMAL',
    coordinates: [
      [31.350, 75.410],
      [31.360, 75.425],
      [31.375, 75.440],
    ],
    vehicleClassification: {
      cars: 65,
      twoWheelers: 10,
      buses: 5,
      trucks: 18,
      other: 2,
    },
    detectedByBuses: ['Bus Fleet #05', 'Bus Fleet #14'],
    lastUpdated: '3 mins ago',
  },
];

// GET /api/traffic/routes
trafficRouter.get('/routes', (req, res) => {
  const { districtId } = req.query;
  res.json({
    status: 'SUCCESS',
    routes: KAPURTHALA_ROUTES,
    districtId: districtId || 'dist-kapurthala',
    timestamp: new Date().toISOString(),
  });
});

// GET /api/traffic/stats
trafficRouter.get('/stats', (req, res) => {
  const activeBottlenecks = KAPURTHALA_ROUTES.filter(r => r.bottleneckStatus === 'ACTIVE').length;
  res.json({
    status: 'SUCCESS',
    stats: {
      vehiclesDetectedToday: 12486,
      trafficDensityPercent: 72,
      densityLevel: 'HEAVY',
      activeBottlenecksCount: activeBottlenecks,
      avgRouteDelayMinutes: 11,
      classification: {
        cars: 61,
        twoWheelers: 18,
        buses: 11,
        trucks: 7,
        other: 3,
      },
      routesCount: KAPURTHALA_ROUTES.length,
    },
    timestamp: new Date().toISOString(),
  });
});

// GET /api/traffic/bottlenecks
trafficRouter.get('/bottlenecks', (req, res) => {
  const bottlenecks = KAPURTHALA_ROUTES
    .filter(r => r.bottleneckStatus === 'ACTIVE')
    .map(r => ({
      id: `btn-${r.id}`,
      routeName: r.name,
      junctionTag: r.junctionTag,
      densityLevel: r.trafficLevel,
      currentSpeedKmh: r.avgSpeedKmh,
      normalSpeedKmh: r.normalSpeedKmh,
      delayMinutes: r.estimatedDelayMin,
      detectedByBuses: r.detectedByBuses,
      coordinates: r.coordinates,
      districtId: r.districtId,
    }));

  res.json({
    status: 'SUCCESS',
    bottlenecks,
    timestamp: new Date().toISOString(),
  });
});

// POST /api/traffic/analyze - Central Congestion & Bottleneck Decision Engine
trafficRouter.post('/analyze', (req, res) => {
  const { routeId, routeName, densityPercent, avgSpeedKmh, vehicleCount } = req.body;

  const route = KAPURTHALA_ROUTES.find(r => r.id === routeId || r.name === routeName) || KAPURTHALA_ROUTES[0];

  const currentSpeed = Number(avgSpeedKmh || route.avgSpeedKmh);
  const baselineSpeed = route.normalSpeedKmh;
  const currentDensity = Number(densityPercent || (route.trafficLevel === 'SEVERE' ? 88 : route.trafficLevel === 'HEAVY' ? 76 : 45));
  const vpm = Number(vehicleCount || route.vehiclesPerMin);

  const speedReductionRatio = Math.max(0, (baselineSpeed - currentSpeed) / baselineSpeed);
  const queueLengthMeters = Math.round(vpm * 2.25 + (speedReductionRatio * 350));
  const durationMinutes = Math.round(8 + (speedReductionRatio * 15));

  // Bottleneck Score calculation (0 - 100):
  const bottleneckScore = Math.min(100, Math.round(
    (speedReductionRatio * 45) +
    (currentDensity * 0.35) +
    (Math.min(queueLengthMeters, 1500) / 1500 * 20)
  ));

  const congestionLevel = bottleneckScore >= 80 ? 'SEVERE' : bottleneckScore >= 60 ? 'HEAVY' : bottleneckScore >= 40 ? 'MODERATE' : 'LOW';

  res.json({
    status: 'SUCCESS',
    bottleneckEngine: 'UrbanEye Central Congestion Engine (YOLO26 + BoT-SORT)',
    analysis: {
      routeId: route.id,
      routeName: route.name,
      junctionTag: route.junctionTag,
      bottleneckScore,
      trafficLevel: congestionLevel,
      currentSpeedKmh: currentSpeed,
      baselineSpeedKmh: baselineSpeed,
      speedReductionRatio: Math.round(speedReductionRatio * 100) / 100,
      queueLengthMeters,
      durationMinutes,
      delayMinutes: Math.round(route.estimatedDelayMin * (bottleneckScore / 70)),
      vehiclesPerMin: vpm,
      vehicleClassification: route.vehicleClassification,
      diagnostics: [
        {
          factor: 'Vehicle Density Spike',
          severity: currentDensity >= 80 ? 'CRITICAL' : 'HIGH',
          description: `Telemetry detected ${vpm} vehicles/min exceeding normal design capacity. Density: ${currentDensity}%.`,
        },
        {
          factor: 'Queue Tailback Accumulation',
          severity: queueLengthMeters > 500 ? 'CRITICAL' : 'HIGH',
          description: `Bottleneck node at ${route.junctionTag} causing queue tailback of ${queueLengthMeters}m over ${durationMinutes} mins.`,
        },
        {
          factor: 'Commercial Vehicle Drag',
          severity: 'MEDIUM',
          description: `Trucks & heavy vehicles represent ${route.vehicleClassification.trucks}% of stream, reducing acceleration recovery.`,
        },
      ],
      recommendedDiversions: [
        {
          id: 'div-1',
          name: 'Phagwara Express Bypass',
          via: 'Sector 14 Outer Ring',
          extraDistanceKm: 2.4,
          estimatedTimeSavedMin: Math.max(5, Math.round(durationMinutes * 0.8)),
          trafficStatus: 'CLEAR',
          confidenceScore: 94,
        },
        {
          id: 'div-2',
          name: 'Nakodar Road Corridor',
          via: 'Sector 12 Flyover Link',
          extraDistanceKm: 1.1,
          estimatedTimeSavedMin: Math.max(3, Math.round(durationMinutes * 0.6)),
          trafficStatus: 'MODERATE',
          confidenceScore: 88,
        },
      ],
      suggestedActions: [
        { id: 'act-warden', title: 'Dispatch Traffic Warden', icon: 'UserCheck', note: 'Notify nearest precinct for manual signal override' },
        { id: 'act-signal', title: 'Extend Green Light Signal (Phase +15s)', icon: 'Sliders', note: 'Push dynamic timing optimization to urban traffic controller' },
        { id: 'act-vms', title: 'Broadcast VMS Diversion Alert', icon: 'Radio', note: 'Display detour notice on electronic gantries' },
      ],
      sensorDataSources: route.detectedByBuses,
      analyzedAt: new Date().toISOString(),
    },
  });
});
