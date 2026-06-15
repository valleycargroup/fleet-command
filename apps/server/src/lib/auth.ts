import { randomBytes, createHash } from 'crypto';
import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import db from './db';

export async function hashPassword(pw: string): Promise<string> {
  return bcrypt.hash(pw, 12);
}

export async function verifyPassword(pw: string, stored: string): Promise<boolean> {
  // bcrypt hashes start with $2b$ — new format
  if (stored.startsWith('$2')) {
    return bcrypt.compare(pw, stored);
  }
  // Legacy SHA-256 format (salt:hash) — verify then transparently rehash
  const [saltHex, hashHex] = stored.split(':');
  if (!saltHex || !hashHex) return false;
  const check = createHash('sha256').update(saltHex + pw).digest('hex');
  return check === hashHex;
}

// Called after a legacy SHA-256 login succeeds — upgrades the stored hash to bcrypt
export async function upgradePasswordHash(userId: number, pw: string): Promise<void> {
  const hash = await hashPassword(pw);
  await db.raw('UPDATE users SET password_hash = ? WHERE id = ?', [hash, userId]);
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
  if (roles && !roles.map((r: string) => r.toLowerCase()).includes(user.role?.toLowerCase())) {
    res.status(403).json({ error: 'Forbidden' });
    return null;
  }
  return user;
}
