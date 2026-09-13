import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database with comprehensive administrative hierarchy, road defects, incidents, safety risk zones, and predictive hotspots...');

  // Clean existing data for initial fresh seed
  await prisma.urbanRecommendation.deleteMany();
  await prisma.predictiveHotspot.deleteMany();
  await prisma.safetyRiskZone.deleteMany();
  await prisma.vehicleTrack.deleteMany();
  await prisma.incident.deleteMany();
  await prisma.roadEvent.deleteMany();
  await prisma.busDeviceSession.deleteMany();
  await prisma.user.deleteMany();
  await prisma.district.deleteMany();
  await prisma.state.deleteMany();

  // 1. Create States
  const mh = await prisma.state.create({
    data: {
      code: 'MH',
      name: 'Maharashtra',
      centerLat: 19.7515,
      centerLon: 75.7139,
    },
  });

  const ka = await prisma.state.create({
    data: {
      code: 'KA',
      name: 'Karnataka',
      centerLat: 15.3173,
      centerLon: 75.7139,
    },
  });

  const dl = await prisma.state.create({
    data: {
      code: 'DL',
      name: 'Delhi NCT',
      centerLat: 28.7041,
      centerLon: 77.1025,
    },
  });

  const pb = await prisma.state.create({
    data: {
      code: 'PB',
      name: 'Punjab',
      centerLat: 31.1471,
      centerLon: 75.3412,
    },
  });

  // 2. Create Districts
  const kapurthala = await prisma.district.create({
    data: {
      code: 'KAPURTHALA',
      name: 'Kapurthala',
      stateId: pb.id,
      centerLat: 31.2536,
      centerLon: 75.7037, // NH-44 Corridor
      minLat: 31.10,
      maxLat: 31.60,
      minLon: 75.20,
      maxLon: 76.00,
    },
  });

  const jalandhar = await prisma.district.create({
    data: {
      code: 'JALANDHAR',
      name: 'Jalandhar',
      stateId: pb.id,
      centerLat: 31.3260,
      centerLon: 75.5762,
      minLat: 31.00,
      maxLat: 31.60,
      minLon: 75.30,
      maxLon: 75.90,
    },
  });

  const ludhiana = await prisma.district.create({
    data: {
      code: 'LUDHIANA',
      name: 'Ludhiana',
      stateId: pb.id,
      centerLat: 30.9010,
      centerLon: 75.8573,
      minLat: 30.70,
      maxLat: 31.10,
      minLon: 75.60,
      maxLon: 76.20,
    },
  });

  const mumbaiSuburban = await prisma.district.create({
    data: {
      code: 'MUM_SUB',
      name: 'Mumbai Suburban',
      stateId: mh.id,
      centerLat: 19.0760,
      centerLon: 72.8777,
      minLat: 18.90,
      maxLat: 19.27,
      minLon: 72.77,
      maxLon: 72.98,
    },
  });

  const blrUrban = await prisma.district.create({
    data: {
      code: 'BLR_URB',
      name: 'Bengaluru Urban',
      stateId: ka.id,
      centerLat: 12.9716,
      centerLon: 77.5946,
      minLat: 12.80,
      maxLat: 13.15,
      minLon: 77.45,
      maxLon: 77.75,
    },
  });

  // Default password for all seeded accounts
  const defaultPassword = 'UrbanEye@2026';
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(defaultPassword, salt);

  // 3. Create Hierarchical Accounts
  const admin = await prisma.user.create({
    data: {
      email: 'admin@urbaneye.gov.in',
      passwordHash,
      name: 'Shri Rajesh Verma (MoRTH Director)',
      role: 'NATIONAL_ADMIN',
    },
  });

  const statePb = await prisma.user.create({
    data: {
      email: 'admin.pb@urbaneye.gov.in',
      passwordHash,
      name: 'S. Harpreet Singh (Punjab PWD Chief Engineer)',
      role: 'STATE_ADMIN',
      stateId: pb.id,
    },
  });

  const headKapurthala = await prisma.user.create({
    data: {
      email: 'head.kapurthala@urbaneye.gov.in',
      passwordHash,
      name: 'Er. Gurpreet Singh (Kapurthala Road Commissioner)',
      role: 'DISTRICT_HEAD',
      stateId: pb.id,
      districtId: kapurthala.id,
    },
  });

  await prisma.user.create({
    data: {
      email: 'head.jalandhar@urbaneye.gov.in',
      passwordHash,
      name: 'Er. Manjit Kaur (Jalandhar Infrastructure Head)',
      role: 'DISTRICT_HEAD',
      stateId: pb.id,
      districtId: jalandhar.id,
    },
  });

  // 4. Create Paired Bus Session
  const session = await prisma.busDeviceSession.create({
    data: {
      pin: '984210',
      status: 'PAIRED',
      busLabel: 'Bus Fleet #24',
      routeTag: 'Route 335E — NH-44 Corridor',
      districtId: kapurthala.id,
      expiresAt: new Date(Date.now() + 30 * 24 * 3600 * 1000),
      pairedAt: new Date(),
    },
  });

  // 5. Create Road Defect Events
  await prisma.roadEvent.createMany({
    data: [
      {
        deviceSessionId: session.id,
        busLabel: 'Bus Fleet #24',
        districtId: kapurthala.id,
        type: 'POTHOLE',
        confidence: 0.94,
        latitude: 31.378,
        longitude: 75.385,
        heading: 45,
        speed: 38,
        estimatedDiameterCm: 48.5,
        estimatedRepairCost: 8500,
        status: 'NEW',
        timestamp: new Date(Date.now() - 10 * 60000),
      },
      {
        deviceSessionId: session.id,
        busLabel: 'Bus Fleet #24',
        districtId: kapurthala.id,
        type: 'ROAD_CRACK',
        confidence: 0.88,
        latitude: 31.370,
        longitude: 75.370,
        heading: 50,
        speed: 42,
        estimatedDiameterCm: 22.0,
        estimatedRepairCost: 3200,
        status: 'ASSIGNED_FOR_REPAIR',
        timestamp: new Date(Date.now() - 45 * 60000),
      },
      {
        deviceSessionId: session.id,
        busLabel: 'Bus Fleet #12',
        districtId: kapurthala.id,
        type: 'WATERLOGGING',
        confidence: 0.91,
        latitude: 31.360,
        longitude: 75.350,
        heading: 120,
        speed: 25,
        estimatedDiameterCm: 110.0,
        estimatedRepairCost: 18500,
        status: 'NEW',
        timestamp: new Date(Date.now() - 120 * 60000),
      },
      {
        deviceSessionId: session.id,
        busLabel: 'Bus Fleet #31',
        districtId: kapurthala.id,
        type: 'SURFACE_DAMAGE',
        confidence: 0.85,
        latitude: 31.385,
        longitude: 75.390,
        heading: 180,
        speed: 40,
        estimatedDiameterCm: 35.0,
        estimatedRepairCost: 5400,
        status: 'RESOLVED',
        timestamp: new Date(Date.now() - 240 * 60000),
      },
    ],
  });

  // 6. Create Incidents & ANPR Records
  await prisma.incident.createMany({
    data: [
      {
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
        districtId: kapurthala.id,
        status: 'PENDING',
        timestamp: new Date(Date.now() - 15 * 60000),
      },
      {
        category: 'HIT_AND_RUN',
        confidence: 0.88,
        latitude: 31.370,
        longitude: 75.370,
        plateText: null, // Strictly "Plate Not Detected"
        vehicleType: 'TRUCK',
        speedKmh: 72.1,
        frameTrajectory: JSON.stringify([
          { lat: 31.365, lon: 75.360, speed: 68, timestamp: '14:10:00' },
          { lat: 31.370, lon: 75.370, speed: 72, timestamp: '14:10:20' },
        ]),
        busLabel: 'Bus Fleet #12',
        districtId: kapurthala.id,
        status: 'PENDING',
        authorityNotes: 'Patrol team dispatched to GT Road intersection.',
        timestamp: new Date(Date.now() - 42 * 60000),
      },
      {
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
        districtId: kapurthala.id,
        status: 'ACKNOWLEDGED',
        authorityNotes: 'Challan issued via e-transport portal.',
        timestamp: new Date(Date.now() - 90 * 60000),
      },
    ],
  });

  // 7. Create Vehicle Tracks
  await prisma.vehicleTrack.createMany({
    data: [
      {
        trackId: 'TRK-9842',
        plateText: 'PB-09-AK-4412',
        vehicleType: 'CAR',
        confidence: 0.94,
        speedKmh: 68,
        trajectory: JSON.stringify([
          [31.375, 75.381],
          [31.377, 75.383],
          [31.378, 75.385],
          [31.382, 75.395],
        ]),
        lastSeenBus: 'Bus Fleet #24',
        districtId: kapurthala.id,
      },
      {
        trackId: 'TRK-1055',
        plateText: null, // "Plate Not Detected"
        vehicleType: 'TRUCK',
        confidence: 0.82,
        speedKmh: 72,
        trajectory: JSON.stringify([
          [31.365, 75.360],
          [31.368, 75.365],
          [31.370, 75.370],
        ]),
        lastSeenBus: 'Bus Fleet #12',
        districtId: kapurthala.id,
      },
    ],
  });

  // 8. Create VRU Safety Risk Zones
  await prisma.safetyRiskZone.createMany({
    data: [
      {
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
        districtId: kapurthala.id,
      },
      {
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
        districtId: kapurthala.id,
      },
      {
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
        districtId: kapurthala.id,
      },
    ],
  });

  // 9. Create Predictive Hotspots
  await prisma.predictiveHotspot.createMany({
    data: [
      {
        locationName: 'GT Road Junction 04 (Sub-base Degradation)',
        districtId: kapurthala.id,
        latitude: 31.370,
        longitude: 75.370,
        recurrenceCount: 14,
        severityScore: 92.4,
        maintenancePriority: 94.0,
        primaryDefectType: 'POTHOLE',
        recommendedAction: 'Full Sub-base Asphalt Overlay & Drainage Re-engineering',
      },
      {
        locationName: 'NH-44 Kapurthala Flyover Ramp',
        districtId: kapurthala.id,
        latitude: 31.378,
        longitude: 75.385,
        recurrenceCount: 9,
        severityScore: 78.5,
        maintenancePriority: 82.5,
        primaryDefectType: 'ROAD_CRACK',
        recommendedAction: 'Sealing Longitudinal Fatigue Cracks & Bitumen Resurfacing',
      },
      {
        locationName: 'Nakodar Road Underpass',
        districtId: kapurthala.id,
        latitude: 31.360,
        longitude: 75.350,
        recurrenceCount: 7,
        severityScore: 71.0,
        maintenancePriority: 75.0,
        primaryDefectType: 'WATERLOGGING',
        recommendedAction: 'Stormwater Culvert Clearing & High-Capacity Sump Pump Installation',
      },
    ],
  });

  // 10. Create Urban Recommendations
  await prisma.urbanRecommendation.createMany({
    data: [
      {
        type: 'WORK_ORDER',
        title: 'Emergency Pothole Patching — GT Road Junction 04',
        description: 'High recurrence site (14 detections in 30 days). PWD repair team assignment recommended to prevent structural road base failure.',
        urgency: 'CRITICAL',
        impactScore: 95.0,
        estimatedCostINR: 145000,
        districtId: kapurthala.id,
        status: 'PROPOSED',
      },
      {
        type: 'TRAFFIC_REROUTE',
        title: 'Peak-Hour Freight Diversion to Phagwara Express Bypass',
        description: '15-minute predictive algorithm forecasts 88% congestion density on NH-44. Reroute heavy trucks to reduce delay by 11 mins.',
        urgency: 'HIGH',
        impactScore: 88.0,
        estimatedCostINR: 0,
        districtId: kapurthala.id,
        status: 'PROPOSED',
      },
      {
        type: 'SAFETY_INTERVENTION',
        title: 'School Zone Dynamic Speed Calming — St. Francis Corridor',
        description: 'VRU Safety Risk score spiked to 84.5 during afternoon dismissal. Deploy automated VMS warning & warden dispatch.',
        urgency: 'HIGH',
        impactScore: 91.0,
        estimatedCostINR: 25000,
        districtId: kapurthala.id,
        status: 'PROPOSED',
      },
    ],
  });

  console.log('✅ SQLite Database dev.db successfully seeded with full persistent dataset!');
  console.log('★ Demo District Head: head.kapurthala@urbaneye.gov.in / UrbanEye@2026');
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
