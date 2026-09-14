import { Request, Response, NextFunction } from 'express';
import { verifyToken, UserJwtPayload } from '../auth/jwt.js';
import { prisma } from '../prisma.js';

export interface AuthenticatedRequest extends Request {
  user?: UserJwtPayload;
  scopedDistrictId?: string;
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required. Missing Bearer token.' });
    return;
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = verifyToken(token);
    req.user = payload;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired session token.' });
    return;
  }
}

export function requireRole(...allowedRoles: Array<'NATIONAL_ADMIN' | 'STATE_ADMIN' | 'DISTRICT_HEAD' | 'CITIZEN_REPORTER'>) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized. User session missing.' });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        error: `Forbidden. Role '${req.user.role}' is not authorized for this government action.`,
      });
      return;
    }

    next();
  };
}

/**
 * Enforces server-side row-level scoping for District and State views.
 * District Head can NEVER access data outside their assigned districtId.
 */
export async function enforceDistrictScope(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized.' });
    return;
  }

  const requestedDistrictId = (req.query.districtId as string) || (req.body.districtId as string) || req.params.districtId;

  if (req.user.role === 'DISTRICT_HEAD') {
    if (!req.user.districtId) {
      res.status(403).json({ error: 'District Head has no assigned district.' });
      return;
    }
    // If client requested a specific district, ensure it matches their own
    if (requestedDistrictId && requestedDistrictId !== req.user.districtId) {
      res.status(403).json({
        error: 'Access Denied: District Heads can only access data within their assigned district.',
      });
      return;
    }
    req.scopedDistrictId = req.user.districtId;
    return next();
  }

  if (req.user.role === 'STATE_ADMIN') {
    if (!req.user.stateId) {
      res.status(403).json({ error: 'State Admin has no assigned state.' });
      return;
    }
    if (requestedDistrictId) {
      let districtStateId: string | null = null;
      try {
        const district = await prisma.district.findUnique({
          where: { id: requestedDistrictId },
          select: { stateId: true },
        });
        districtStateId = district?.stateId || null;
      } catch (dbErr) {
        console.warn('Scoping lookup warning:', (dbErr as Error).message);
      }

      // Demo mapping fallback for state scoping
      if (!districtStateId) {
        if (requestedDistrictId.includes('kapurthala') || requestedDistrictId.includes('jalandhar') || requestedDistrictId.includes('ludhiana')) {
          districtStateId = 'state-punjab';
        } else if (requestedDistrictId.includes('mumbai')) {
          districtStateId = 'state-maharashtra';
        } else if (requestedDistrictId.includes('bengaluru')) {
          districtStateId = 'state-karnataka';
        }
      }

      if (districtStateId && districtStateId !== req.user.stateId) {
        res.status(403).json({
          error: 'Access Denied: District does not belong to your assigned state jurisdiction.',
        });
        return;
      }
      req.scopedDistrictId = requestedDistrictId;
    }
    return next();
  }

  // National Admin has global access
  if (requestedDistrictId) {
    req.scopedDistrictId = requestedDistrictId;
  }
  next();
}
