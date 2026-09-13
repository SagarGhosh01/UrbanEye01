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

/**
 * 1. Mobile App: Request a new short-lived 6-digit PIN
 * Anonymous endpoint called on app launch or session reset.
 */
pairingRouter.post('/request', async (req: Request, res: Response): Promise<void> => {
  try {
    // Generate secure 6-digit numeric PIN (100000 - 999999)
    const pin = crypto.randomInt(100000, 999999).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes TTL

    const session = await prisma.busDeviceSession.create({
      data: {
        pin,
        status: 'PENDING',
        expiresAt,
      },
    });

    res.status(201).json({
      deviceSessionId: session.id,
      pin: session.pin,
      expiresAt: session.expiresAt.toISOString(),
      ttlSeconds: 600,
    });
  } catch (err: any) {
    console.error('Pairing request error:', err);
    res.status(500).json({ error: 'Failed to initiate device pairing session.' });
  }
});

/**
 * 2. Mobile App: Poll status of its pairing session
 */
pairingRouter.get('/status/:deviceSessionId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { deviceSessionId } = req.params;

    const session = await prisma.busDeviceSession.findUnique({
      where: { id: deviceSessionId },
      include: {
        district: {
          select: { id: true, name: true, code: true },
        },
      },
    });

    if (!session) {
      res.status(404).json({ error: 'Pairing session not found.' });
      return;
    }

    // Check expiry
    const isExpired = session.status === 'PENDING' && new Date() > session.expiresAt;
    if (isExpired && session.status !== 'EXPIRED') {
      await prisma.busDeviceSession.update({
        where: { id: session.id },
        data: { status: 'EXPIRED' },
      });
      session.status = 'EXPIRED';
    }

    res.json({
      deviceSessionId: session.id,
      status: session.status,
      busLabel: session.busLabel,
      routeTag: session.routeTag,
      districtId: session.districtId,
      districtName: session.district?.name,
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
        boundDistrictId = req.user!.districtId!;
      } else {
        // State or National Admin can specify a target district in their jurisdiction
        if (!targetDistrictId) {
          res.status(400).json({ error: 'Admins must specify the target district for the bus.' });
          return;
        }
        if (req.user!.role === 'STATE_ADMIN') {
          const district = await prisma.district.findUnique({
            where: { id: targetDistrictId },
          });
          if (!district || district.stateId !== req.user!.stateId) {
            res.status(403).json({ error: 'Target district is outside your state jurisdiction.' });
            return;
          }
        }
        boundDistrictId = targetDistrictId;
      }

      const cleanPin = pin.toString().trim();

      // Find pending session matching PIN
      const session = await prisma.busDeviceSession.findFirst({
        where: {
          pin: cleanPin,
          status: 'PENDING',
        },
      });

      if (!session) {
        res.status(404).json({ error: 'Invalid PIN or pairing session already used.' });
        return;
      }

      if (new Date() > session.expiresAt) {
        await prisma.busDeviceSession.update({
          where: { id: session.id },
          data: { status: 'EXPIRED' },
        });
        res.status(410).json({ error: 'PIN has expired. Please request a new PIN on the mobile device.' });
        return;
      }

      // Bind session
      const updatedSession = await prisma.busDeviceSession.update({
        where: { id: session.id },
        data: {
          status: 'PAIRED',
          busLabel: busLabel.trim(),
          routeTag: routeTag?.trim() || null,
          districtId: boundDistrictId,
          pairedAt: new Date(),
          lastHeartbeat: new Date(),
        },
        include: {
          district: true,
        },
      });

      // Automatically retire older active sessions for the same bus label
      await prisma.busDeviceSession.updateMany({
        where: {
          busLabel: busLabel.trim(),
          status: 'PAIRED',
          id: { not: session.id },
        },
        data: {
          status: 'SUPERSEDED',
        },
      });

      // Broadcast real-time confirmation to mobile device over WebSocket room
      emitPairingConfirmed(updatedSession);

      res.json({
        success: true,
        message: `Bus '${updatedSession.busLabel}' successfully paired to ${updatedSession.district?.name}!`,
        session: {
          deviceSessionId: updatedSession.id,
          busLabel: updatedSession.busLabel,
          routeTag: updatedSession.routeTag,
          districtId: updatedSession.districtId,
          districtName: updatedSession.district?.name,
          pairedAt: updatedSession.pairedAt,
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
