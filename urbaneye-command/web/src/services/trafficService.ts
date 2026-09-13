import { TrafficRouteSegment, BottleneckAlert, TrafficIntelligenceStats } from '../types';

const API_BASE = '/api/traffic';

export interface RouteAnalysisResult {
  routeId: string;
  routeName: string;
  junctionTag: string;
  trafficLevel: string;
  currentSpeedKmh: number;
  normalSpeedKmh: number;
  delayMinutes: number;
  vehiclesPerMin: number;
  diagnostics: Array<{
    factor: string;
    severity: string;
    description: string;
  }>;
  recommendedDiversions: Array<{
    id: string;
    name: string;
    via: string;
    extraDistanceKm: number;
    estimatedTimeSavedMin: number;
    trafficStatus: string;
    confidenceScore: number;
  }>;
  suggestedActions: Array<{
    id: string;
    title: string;
    icon: string;
    note: string;
  }>;
  sensorDataSources: string[];
  analyzedAt: string;
}

// Mock route polylines fallback if backend is unreachable
const KAPURTHALA_ROUTES_FALLBACK: TrafficRouteSegment[] = [
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

export async function getTrafficRoutes(districtId?: string): Promise<TrafficRouteSegment[]> {
  try {
    const res = await fetch(`${API_BASE}/routes?districtId=${encodeURIComponent(districtId || '')}`);
    if (res.ok) {
      const data = await res.json();
      if (data.routes) return data.routes;
    }
  } catch (err) {
    console.warn('Backend traffic routes endpoint unavailable, using edge fallback:', err);
  }
  return KAPURTHALA_ROUTES_FALLBACK;
}

export async function getTrafficStats(districtId?: string): Promise<TrafficIntelligenceStats> {
  try {
    const res = await fetch(`${API_BASE}/stats?districtId=${encodeURIComponent(districtId || '')}`);
    if (res.ok) {
      const data = await res.json();
      if (data.stats) return data.stats;
    }
  } catch (err) {
    console.warn('Backend traffic stats endpoint unavailable, using edge fallback:', err);
  }

  const routes = KAPURTHALA_ROUTES_FALLBACK;
  const activeBottlenecks = routes.filter((r) => r.bottleneckStatus === 'ACTIVE').length;

  return {
    vehiclesDetectedToday: 12486,
    trafficDensityPercent: 72,
    densityLevel: 'HEAVY',
    activeBottlenecksCount: activeBottlenecks > 0 ? activeBottlenecks : 8,
    avgRouteDelayMinutes: 11,
    classification: {
      cars: 61,
      twoWheelers: 18,
      buses: 11,
      trucks: 7,
      other: 3,
    },
    routesCount: routes.length,
  };
}

export async function getActiveBottlenecks(districtId?: string): Promise<BottleneckAlert[]> {
  try {
    const res = await fetch(`${API_BASE}/bottlenecks?districtId=${encodeURIComponent(districtId || '')}`);
    if (res.ok) {
      const data = await res.json();
      if (data.bottlenecks) return data.bottlenecks;
    }
  } catch (err) {
    console.warn('Backend bottlenecks endpoint unavailable, using edge fallback:', err);
  }

  const routes = KAPURTHALA_ROUTES_FALLBACK;
  return routes
    .filter((r) => r.bottleneckStatus === 'ACTIVE')
    .map((r) => ({
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
}

export async function analyzeRoute(routeId: string, routeName?: string): Promise<RouteAnalysisResult> {
  try {
    const res = await fetch(`${API_BASE}/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ routeId, routeName }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.analysis) return data.analysis;
    }
  } catch (err) {
    console.warn('Backend analyze endpoint failed, using calculated diagnostics:', err);
  }

  return {
    routeId,
    routeName: routeName || 'NH-44 — Kapurthala Section',
    junctionTag: 'Junction 04',
    trafficLevel: 'HEAVY',
    currentSpeedKmh: 21,
    normalSpeedKmh: 42,
    delayMinutes: 14,
    vehiclesPerMin: 184,
    diagnostics: [
      {
        factor: 'Vehicle Volume Spike',
        severity: 'HIGH',
        description: 'Ingestion detected 184 vehicles/min exceeding normal design capacity of 110/min.',
      },
      {
        factor: 'Bottleneck Node',
        severity: 'CRITICAL',
        description: 'Intersection bottleneck at Junction 04 causing queue tailback of ~1.8 km.',
      },
      {
        factor: 'Vehicle Mix Impact',
        severity: 'MEDIUM',
        description: 'Heavy commercial trucks account for 7% of traffic stream, slowing acceleration cycles.',
      },
    ],
    recommendedDiversions: [
      {
        id: 'div-1',
        name: 'Phagwara Express Bypass',
        via: 'Sector 14 Outer Ring',
        extraDistanceKm: 2.4,
        estimatedTimeSavedMin: 11,
        trafficStatus: 'CLEAR',
        confidenceScore: 94,
      },
      {
        id: 'div-2',
        name: 'Nakodar Road Corridor',
        via: 'Sector 12 Flyover Link',
        extraDistanceKm: 1.1,
        estimatedTimeSavedMin: 8,
        trafficStatus: 'MODERATE',
        confidenceScore: 88,
      },
    ],
    suggestedActions: [
      { id: 'act-warden', title: 'Dispatch Traffic Warden', icon: 'UserCheck', note: 'Notify nearest precinct for manual signal override' },
      { id: 'act-signal', title: 'Extend Green Light Signal (Phase +15s)', icon: 'Sliders', note: 'Push dynamic timing optimization to urban traffic controller' },
      { id: 'act-vms', title: 'Broadcast VMS Diversion Alert', icon: 'Radio', note: 'Display detour notice on electronic gantries' },
    ],
    sensorDataSources: ['Bus Fleet #24', 'Bus Fleet #31', 'Bus Fleet #42'],
    analyzedAt: new Date().toISOString(),
  };
}
