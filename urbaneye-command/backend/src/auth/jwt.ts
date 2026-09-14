import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'urbaneye_secret_fallback_2026';

export interface UserJwtPayload {
  id?: string;
  userId: string;
  email: string;
  name: string;
  role: 'NATIONAL_ADMIN' | 'STATE_ADMIN' | 'DISTRICT_HEAD' | 'CITIZEN_REPORTER';
  stateId?: string | null;
  districtId?: string | null;
}

export function signToken(payload: UserJwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

export function verifyToken(token: string): UserJwtPayload {
  return jwt.verify(token, JWT_SECRET) as UserJwtPayload;
}
