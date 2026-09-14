export type Role = 'NATIONAL_ADMIN' | 'STATE_ADMIN' | 'DISTRICT_HEAD' | 'CITIZEN_REPORTER';

export type EventStatus = 'NEW' | 'REVIEWED' | 'ASSIGNED_FOR_REPAIR' | 'RESOLVED';

export type DefectType = 
  | 'POTHOLE' 
  | 'LONGITUDINAL_CRACK' 
  | 'TRANSVERSE_CRACK' 
  | 'ALLIGATOR_CRACK' 
  | 'ROAD_CRACK' 
  | 'SURFACE_DAMAGE' 
  | 'WATERLOGGING' 
  | 'ROAD_EDGE_DAMAGE' 
  | 'DEBRIS' 
  | 'OPEN_MANHOLE' 
  | 'OTHER_HAZARD' 
  | 'MISSING_DIVIDER' 
  | 'MISSING_ZEBRA_CROSSING' 
  | 'FADED_ZEBRA_CROSSING' 
  | 'DAMAGED_SIGNBOARD' 
  | 'TRAFFIC_SIGN' 
  | 'SPEED_LIMIT_SIGN' 
  | 'SCHOOL_ZONE_SIGN' 
  | 'STOP_SIGN' 
  | 'BARRIERS' 
  | 'ROAD_ASSETS' 
  | 'MISSING_LANE_MARKING' 
  | 'VEHICLE_FLOW' 
  | 'TRAFFIC_BOTTLENECK' 
  | 'SCHOOL_CHILDREN_CROSSING' 
  | 'RASH_DRIVING' 
  | 'HIT_AND_RUN' 
  | 'ACCIDENT' 
  | 'DANGEROUS_DRIVING' 
  | 'VEHICLE_ANOMALY';

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  stateId?: string | null;
  stateName?: string | null;
  stateCode?: string | null;
  districtId?: string | null;
  districtName?: string | null;
}

export interface State {
  id: string;
  code: string;
  name: string;
  centerLat: number;
  centerLon: number;
  districts?: District[];
}

export interface District {
  id: string;
  code: string;
  name: string;
  stateId: string;
  centerLat: number;
  centerLon: number;
  minLat?: number | null;
  maxLat?: number | null;
  minLon?: number | null;
  maxLon?: number | null;
  _count?: {
    events: number;
    sessions: number;
  };
}

export interface BusSession {
  id: string;
  pin: string;
  status: 'PENDING' | 'PAIRED' | 'EXPIRED';
  busLabel: string | null;
  routeTag: string | null;
  districtId: string | null;
  district?: {
    name: string;
    code: string;
  };
  pairedAt?: string | null;
  lastHeartbeat: string;
  _count?: {
    events: number;
  };
}

export interface RoadEvent {
  id: string;
  deviceSessionId: string;
  busLabel: string;
  districtId: string;
  district?: {
    name: string;
    code: string;
  };
  type: DefectType;
  confidence: number;
  latitude: number;
  longitude: number;
  heading?: number | null;
  speed?: number | null;
  imageSnippet?: string | null;
  estimatedDiameterCm?: number | null;
  widthM?: number | null;
  lengthM?: number | null;
  depthCm?: number | null;
  areaM2?: number | null;
  severity?: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | null;
  severityScore?: number | null;
  deteriorationPct?: number | null;
  hazardSubCategory?: string | null;
  estimatedRepairCost?: number | null;
  status: EventStatus;
  reviewedByUserId?: string | null;
  reviewedByUser?: {
    name: string;
    role: string;
  } | null;
  reviewNotes?: string | null;
  source?: string;
  timesSeen?: number;
  reporterUserId?: string | null;
  reporterName?: string | null;
  reporterEmail?: string | null;
  timestamp: string;
  createdAt: string;
}

export interface AnalyticsStats {
  totalEvents: number;
  byStatus: {
    new: number;
    reviewed: number;
    assigned: number;
    resolved: number;
  };
  byType: {
    pothole: number;
    roadCrack: number;
    surfaceDamage: number;
    waterlogging: number;
    vehicleFlow: number;
  };
  activeBusesCount: number;
  roadHealthScore: number;
  totalRepairCost?: number;
}

export interface DistrictSummaryItem {
  id: string;
  code: string;
  name: string;
  centerLat: number;
  centerLon: number;
  totalDefects: number;
  newDefects: number;
  assignedDefects: number;
  resolvedDefects: number;
  activeBusesCount: number;
  roadHealthScore: number;
}

export interface StateSummaryItem {
  id: string;
  code: string;
  name: string;
  centerLat: number;
  centerLon: number;
  districtsCount: number;
  totalDefects: number;
  newDefects: number;
  assignedDefects: number;
  resolvedDefects: number;
  activeBusesCount: number;
  roadHealthScore: number;
}

export interface HierarchySummary {
  totalActiveBuses: number;
  totalNewDefects: number;
  totalAssignedDefects: number;
  totalResolvedDefects: number;
  totalDefects: number;
  averageRoadHealthIndex: number;
}

export interface NationalSummaryResponse {
  states: StateSummaryItem[];
  summary: HierarchySummary;
}

export interface StateSummaryResponse {
  state: {
    id: string;
    code: string;
    name: string;
    centerLat: number;
    centerLon: number;
  };
  districts: DistrictSummaryItem[];
  summary: HierarchySummary;
}

/* ── STEP 1: Traffic Intelligence & Congestion Data Contracts ── */
export type TrafficLevel = 'LOW' | 'MODERATE' | 'HEAVY' | 'SEVERE';

export interface VehicleClassification {
  cars: number;        // e.g. 61%
  twoWheelers: number; // e.g. 18%
  buses: number;       // e.g. 11%
  trucks: number;      // e.g. 7%
  other: number;       // e.g. 3%
}

export interface TrafficRouteSegment {
  id: string;
  name: string;             // e.g. "NH-44 — Kapurthala"
  junctionTag: string;      // e.g. "Junction 04"
  districtId: string;
  trafficLevel: TrafficLevel;
  vehiclesPerMin: number;   // e.g. 184
  avgSpeedKmh: number;      // e.g. 21
  normalSpeedKmh: number;   // e.g. 42
  estimatedDelayMin: number;// e.g. 14
  bottleneckStatus: 'ACTIVE' | 'NORMAL';
  coordinates: [number, number][]; // Polylines [lat, lon]
  vehicleClassification: VehicleClassification;
  detectedByBuses: string[]; // e.g. ["Bus Fleet #24", "Bus Fleet #31", "Bus Fleet #42"]
  lastUpdated: string;
}

export interface BottleneckAlert {
  id: string;
  routeName: string;
  junctionTag: string;
  densityLevel: TrafficLevel;
  currentSpeedKmh: number;
  normalSpeedKmh: number;
  delayMinutes: number;
  detectedByBuses: string[];
  coordinates: [number, number][];
  districtId: string;
}

export interface TrafficIntelligenceStats {
  vehiclesDetectedToday: number;
  trafficDensityPercent: number; // e.g. 72
  densityLevel: TrafficLevel;
  activeBottlenecksCount: number;
  avgRouteDelayMinutes: number;
  classification: VehicleClassification;
  routesCount: number;
}

/* ── MODULE 1: Incident & Vehicle Intelligence ── */
export type IncidentCategory = 'ACCIDENT' | 'HIT_AND_RUN' | 'RASH_DRIVING' | 'DANGEROUS_DRIVING' | 'VEHICLE_ANOMALY';
export type AlertStatus = 'PENDING' | 'ACKNOWLEDGED' | 'ACTIONED' | 'CLOSED';

export interface FrameTrajectoryPoint {
  lat: number;
  lon: number;
  speed: number;
  timestamp: string;
}

export interface IncidentRecord {
  id: string;
  category: IncidentCategory;
  confidence: number;
  latitude: number;
  longitude: number;
  plateText: string | null; // Nullable; null outputs "Plate Not Detected"
  vehicleType: string;
  speedKmh: number;
  frameTrajectory: string; // JSON string of FrameTrajectoryPoint[]
  busLabel: string;
  districtId: string;
  imageSnippet?: string | null;
  status: AlertStatus;
  authorityNotes?: string | null;
  timestamp: string;
  createdAt: string;
}

export interface TrackedVehicle {
  id: string;
  trackId: string;
  plateText: string | null; // Nullable; null outputs "Plate Not Detected"
  vehicleType: string;
  confidence: number;
  speedKmh: number;
  trajectory: [number, number][];
  lastSeenBus: string;
  districtId: string;
  lastSeenTime: string;
}

/* ── MODULE 2: Vulnerable Road User Safety ── */
export type SafetyRiskLevel = 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
export type VulnerableCategory = 'SCHOOL_ZONE' | 'PEDESTRIAN_CROSSING' | 'BUS_STOP_CROWD';

export interface SafetyRiskZone {
  id: string;
  zoneName: string;
  category: VulnerableCategory;
  riskScore: number; // 0 to 100
  riskLevel: SafetyRiskLevel;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  pedestrianCount: number;
  nearMissCount: number;
  avgSpeedKmh: number;
  suggestedIntervention: string;
  districtId: string;
  updatedAt: string;
  createdAt: string;
}

export interface VRUSafetyStats {
  overallVruSafetyScore: number;
  activeSchoolZonesMonitored: number;
  nearMissCount24h: number;
  highRiskCrossingsCount: number;
  vulnerablePedestriansTracked: number;
}

/* ── MODULE 3: Predictive Urban Risk & AI Recommendations ── */
export interface ForecastTimeframe {
  predictedDensityPercent: number;
  trafficLevel: TrafficLevel;
  predictedBottlenecks: {
    location: string;
    lat: number;
    lon: number;
    expectedDelayMin: number;
    confidence: number;
  }[];
}

export interface CongestionForecastData {
  min15: ForecastTimeframe;
  min30: ForecastTimeframe;
  min60: ForecastTimeframe;
}

export interface RecurringHotspot {
  id: string;
  locationName: string;
  districtId: string;
  latitude: number;
  longitude: number;
  recurrenceCount: number;
  severityScore: number;
  maintenancePriority: number; // 0 to 100
  primaryDefectType: DefectType;
  recommendedAction: string;
  createdAt: string;
}

export type RecommendationType = 'WORK_ORDER' | 'TRAFFIC_REROUTE' | 'SAFETY_INTERVENTION';

export interface UrbanRecommendation {
  id: string;
  type: RecommendationType;
  title: string;
  description: string;
  urgency: 'MEDIUM' | 'HIGH' | 'CRITICAL';
  impactScore: number;
  estimatedCostINR?: number | null;
  districtId: string;
  status: 'PROPOSED' | 'APPROVED' | 'DISPATCHED';
  linkedEntityId?: string | null;
  createdAt: string;
}

