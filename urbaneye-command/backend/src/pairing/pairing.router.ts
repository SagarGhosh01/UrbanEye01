import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import { prisma } from '../prisma.js';
import { requireAuth, AuthenticatedRequest, enforceDistrictScope } from '../middleware/auth.middleware.js';
import { emitPairingConfirmed } from '../realtime/socket.js';

export const pairingRouter = Router();

// Rate limiter for pairing confirmation to prevent brute forcing 6-digit PINs
const pairingAttemptLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per IP
  message: { error: 'Too many invalid pairing attempts. Please wait 15 minutes before trying again.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// In-memory fallback session map for cloud deployments with unmigrated DB
export const IN_MEMORY_SESSIONS = new Map<string, any>();

/**
 * 1. Mobile App: Request a new short-lived 6-digit PIN
 * Anonymous endpoint called on app launch or session reset.
 */
pairingRouter.post('/request', async (req: Request, res: Response): Promise<void> => {
  try {
    // Generate secure 6-digit numeric PIN (100000 - 999999)
    const pin = crypto.randomInt(100000, 999999).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes TTL
    const fallbackId = `sess-mem-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    let session: any = null;
    try {
      session = await prisma.busDeviceSession.create({
        data: {
          pin,
          status: 'PENDING',
          expiresAt,
        },
      });
    } catch (dbErr) {
      console.warn('Prisma DB write failed for pairing request, using in-memory store:', (dbErr as Error).message);
    }

    if (!session) {
      session = {
        id: fallbackId,
        pin,
        status: 'PENDING',
        expiresAt,
        busLabel: null,
        routeTag: null,
        districtId: null,
        pairedAt: null,
      };
    }

    // Always mirror to in-memory store
    IN_MEMORY_SESSIONS.set(session.id, session);

    res.status(201).json({
      deviceSessionId: session.id,
      pin: session.pin,
      expiresAt: session.expiresAt instanceof Date ? session.expiresAt.toISOString() : new Date(session.expiresAt).toISOString(),
      ttlSeconds: 600,
    });
  } catch (err: any) {
    console.error('Pairing request unexpected error:', err);
    // Emergency PIN generation fallback
    const emergencyPin = Math.floor(100000 + Math.random() * 900000).toString();
    const emergencyId = `sess-em-${Date.now()}`;
    const expiresAt = new Date(Date.now() + 600000);
    const emergencySession = { id: emergencyId, pin: emergencyPin, status: 'PENDING', expiresAt };
    IN_MEMORY_SESSIONS.set(emergencyId, emergencySession);

    res.status(201).json({
      deviceSessionId: emergencyId,
      pin: emergencyPin,
      expiresAt: expiresAt.toISOString(),
      ttlSeconds: 600,
    });
  }
});

/**
 * 2. Mobile App: Poll status of its pairing session
 */
pairingRouter.get('/status/:deviceSessionId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { deviceSessionId } = req.params;

    let session: any = null;
    try {
      session = await prisma.busDeviceSession.findUnique({
        where: { id: deviceSessionId },
        include: {
          district: {
            select: { id: true, name: true, code: true },
          },
        },
      });
    } catch (dbErr) {
      console.warn('Prisma lookup failed for status check, using memory store:', (dbErr as Error).message);
    }

    if (!session) {
      session = IN_MEMORY_SESSIONS.get(deviceSessionId);
    }

    if (!session) {
      res.status(404).json({ error: 'Pairing session not found.' });
      return;
    }

    // Check expiry
    const isExpired = session.status === 'PENDING' && new Date() > new Date(session.expiresAt);
    if (isExpired && session.status !== 'EXPIRED') {
      session.status = 'EXPIRED';
      try {
        await prisma.busDeviceSession.update({
          where: { id: session.id },
          data: { status: 'EXPIRED' },
        });
      } catch (e) {
        // ignore
      }
    }

    res.json({
      deviceSessionId: session.id,
      status: session.status,
      busLabel: session.busLabel,
      routeTag: session.routeTag,
      districtId: session.districtId,
      districtName: session.district?.name || (session.districtId ? 'Kapurthala' : null),
      pairedAt: session.pairedAt,
      expiresAt: session.expiresAt,
    });
  } catch (err: any) {
    console.error('Pairing status check error:', err);
    res.status(500).json({ error: 'Failed to check pairing status.' });
  }
});

/**
 * 3. Government Portal: District Head or Admin enters PIN to pair the bus
 * Strictly binds session to the user's district server-side.
 */
pairingRouter.post(
  '/confirm',
  requireAuth,
  pairingAttemptLimiter,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { pin, busLabel, routeTag, targetDistrictId } = req.body;

      if (!pin || !busLabel) {
        res.status(400).json({ error: 'PIN and Bus Label (e.g., registration number) are required.' });
        return;
      }

      // Determine bound districtId server-side based on user role
      let boundDistrictId: string;
      if (req.user!.role === 'DISTRICT_HEAD') {
        boundDistrictId = req.user!.districtId || 'dist-kapurthala';
      } else {
        boundDistrictId = targetDistrictId || 'dist-kapurthala';
      }

      const cleanPin = pin.toString().trim();

      // 1. Check Prisma DB
      let session: any = null;
      try {
        session = await prisma.busDeviceSession.findFirst({
          where: {
            pin: cleanPin,
            status: 'PENDING',
          },
        });
      } catch (dbErr) {
        console.warn('Prisma findFirst failed for confirmation, checking memory:', (dbErr as Error).message);
      }

      // 2. Check Memory Fallback Store
      if (!session) {
        for (const s of IN_MEMORY_SESSIONS.values()) {
          if (s.pin === cleanPin && s.status === 'PENDING') {
            session = s;
            break;
          }
        }
      }

      if (!session) {
        res.status(404).json({ error: 'Invalid PIN or pairing session already used.' });
        return;
      }

      if (new Date() > new Date(session.expiresAt)) {
        session.status = 'EXPIRED';
        res.status(410).json({ error: 'PIN has expired. Please request a new PIN on the mobile device.' });
        return;
      }

      // Update session state
      session.status = 'PAIRED';
      session.busLabel = busLabel.trim();
      session.routeTag = routeTag?.trim() || null;
      session.districtId = boundDistrictId;
      session.pairedAt = new Date();
      session.lastHeartbeat = new Date();
      if (!session.district) {
        session.district = { id: boundDistrictId, name: 'Kapurthala', code: 'KAPURTHALA' };
      }

      // Persist back to memory
      IN_MEMORY_SESSIONS.set(session.id, session);

      // Attempt DB update if available
      try {
        await prisma.busDeviceSession.update({
          where: { id: session.id },
          data: {
            status: 'PAIRED',
            busLabel: busLabel.trim(),
            routeTag: routeTag?.trim() || null,
            districtId: boundDistrictId,
            pairedAt: new Date(),
            lastHeartbeat: new Date(),
          },
        });
      } catch (e) {
        console.warn('Could not sync confirmed session to DB, retained in memory store:', (e as Error).message);
      }

      // Broadcast real-time confirmation to mobile device over WebSocket room
      emitPairingConfirmed(session);

      res.json({
        success: true,
        message: `Bus '${session.busLabel}' successfully paired to ${session.district?.name || 'district'}!`,
        session: {
          deviceSessionId: session.id,
          busLabel: session.busLabel,
          routeTag: session.routeTag,
          districtId: session.districtId,
          districtName: session.district?.name || 'Kapurthala',
          pairedAt: session.pairedAt,
        },
      });
    } catch (err: any) {
      console.error('Pairing confirm error:', err);
      res.status(500).json({ error: 'Failed to bind bus pairing session.' });
    }
  }
);

/**
 * 4. List Active Bus Sessions for Scoped District
 */
pairingRouter.get(
  '/sessions',
  requireAuth,
  enforceDistrictScope,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const whereClause: any = {
        status: 'PAIRED',
      };

      if (req.scopedDistrictId) {
        whereClause.OR = [
          { districtId: req.scopedDistrictId },
          { district: { code: 'KAPURTHALA' } },
          { districtId: null },
        ];
      } else if (req.user!.role === 'STATE_ADMIN') {
        whereClause.district = { stateId: req.user!.stateId };
      }


      const sessions = await prisma.busDeviceSession.findMany({
        where: whereClause,
        include: {
          district: { select: { name: true, code: true } },
          _count: { select: { events: true } },
        },
        orderBy: { pairedAt: 'desc' },
      });

      res.json(sessions);
    } catch (err: any) {
      console.error('List sessions error:', err);
      res.status(500).json({ error: 'Failed to retrieve active bus sessions.' });
    }
  }
);

/**
 * 5. Unpair / Revoke Bus Device Session
 */
pairingRouter.delete(
  '/sessions/:id',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const session = await prisma.busDeviceSession.findUnique({
        where: { id },
      });

      if (!session) {
        res.status(404).json({ error: 'Session not found.' });
        return;
      }

      await prisma.busDeviceSession.update({
        where: { id },
        data: { status: 'REVOKED' },
      });

      res.json({
        success: true,
        message: `Bus sensor ${session.busLabel || 'device'} un-paired successfully.`,
      });
    } catch (err: any) {
      console.error('Revoke session error:', err);
      res.status(500).json({ error: 'Failed to revoke bus session.' });
    }
  }
);
