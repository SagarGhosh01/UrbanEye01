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
      id: 'state-maharashtra',
      code: 'MH',
      name: 'Maharashtra',
      centerLat: 19.7515,
      centerLon: 75.7139,
    },
  });

  const ka = await prisma.state.create({
    data: {
      id: 'state-karnataka',
      code: 'KA',
      name: 'Karnataka',
      centerLat: 15.3173,
      centerLon: 75.7139,
    },
  });

  const dl = await prisma.state.create({
    data: {
      id: 'state-delhi',
      code: 'DL',
      name: 'Delhi NCT',
      centerLat: 28.7041,
      centerLon: 77.1025,
    },
  });

  const pb = await prisma.state.create({
    data: {
      id: 'state-punjab',
      code: 'PB',
      name: 'Punjab',
      centerLat: 31.1471,
      centerLon: 75.3412,
    },
  });

  // 2. Create Districts
  const kapurthala = await prisma.district.create({
    data: {
      id: 'dist-kapurthala',
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
      id: 'dist-jalandhar',
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
      id: 'dist-ludhiana',
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
      id: 'dist-mumbai-suburban',
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
      id: 'dist-bengaluru-urban',
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
      id: 'usr-admin-national',
      email: 'admin@urbaneye.gov.in',
      passwordHash,
      name: 'Shri Rajesh Verma (MoRTH Director)',
      role: 'NATIONAL_ADMIN',
    },
  });

  const statePb = await prisma.user.create({
    data: {
      id: 'usr-admin-pb',
      email: 'admin.pb@urbaneye.gov.in',
      passwordHash,
      name: 'S. Harpreet Singh (Punjab PWD Chief Engineer)',
      role: 'STATE_ADMIN',
      stateId: pb.id,
    },
  });

  const headKapurthala = await prisma.user.create({
    data: {
      id: 'usr-kapurthala-1',
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
      id: 'usr-jalandhar-1',
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

  console.log('✅ SQLite Database dev.db successfully initialized with clean user accounts and district structures!');
  console.log('★ Real Ingestion Mode Active: 0 demo events seeded. Live camera & APK scans will record real data.');
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
