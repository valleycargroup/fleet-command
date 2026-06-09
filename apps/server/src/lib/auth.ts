import { randomBytes, createHash } from 'crypto';
import { Request, Response } from 'express';
import db from './db';

export async function hashPassword(pw: string): Promise<string> {
  const saltHex = randomBytes(16).toString('hex');
  const hashHex = createHash('sha256').update(saltHex + pw).digest('hex');
  return `${saltHex}:${hashHex}`;
}

export async function verifyPassword(pw: string, stored: string): Promise<boolean> {
  const [saltHex, hashHex] = stored.split(':');
  if (!saltHex || !hashHex) return false;
  const check = createHash('sha256').update(saltHex + pw).digest('hex');
  return check === hashHex;
}

export function generateToken(): string {
  return randomBytes(32).toString('hex');
}

export async function getUserFromToken(token: string) {
  const result = await db.raw(
    `SELECT u.* FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.token = ? AND s.expires_at > NOW()`,
    [token]
  );
  return result.rows[0] || null;
}

export async function requireAuth(req: Request, res: Response, roles?: string[]) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }
  const token = authHeader.slice(7);
  const user = await getUserFromToken(token);
  if (!user) {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }
  if (roles && !roles.includes(user.role)) {
    res.status(403).json({ error: 'Forbidden' });
    return null;
  }
  return user;
}
