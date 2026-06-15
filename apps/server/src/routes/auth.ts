import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import db from '../lib/db';
import { hashPassword, verifyPassword, upgradePasswordHash, generateToken, requireAuth } from '../lib/auth';
import { sendEmail, logEmail, passwordResetEmail } from '../lib/email';

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts — try again in 15 minutes' },
});

const router = Router();

const APP_URL = process.env.APP_URL || 'https://fleetcommandrecon.com';

// POST /api/auth/setup — first-run admin account creation
router.post('/setup', async (req: Request, res: Response) => {
  try {
    const { count } = (await db.raw('SELECT COUNT(*) as count FROM users')).rows[0];
    if (Number(count) > 0) return res.status(400).json({ error: 'Setup already completed. Use /api/auth/login.' });

    const { email, phone, first_name, last_name } = req.body;
    if (!email || !phone || !first_name) return res.status(400).json({ error: 'Email, phone, and first name required' });

    const hash = await hashPassword(phone.replace(/[^0-9]/g, ''));
    await db.raw(
      `INSERT INTO users (email, password_hash, first_name, last_name, phone, role, is_buyer, is_seller, location, must_change_password)
       VALUES (?, ?, ?, ?, ?, 'admin', TRUE, TRUE, 'Both', TRUE)`,
      [email.toLowerCase(), hash, first_name, last_name || '', phone]
    );

    res.json({ ok: true, message: 'Admin account created. Log in with your email and phone number as password.' });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/login
router.post('/login', authLimiter, async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const user = (await db.raw('SELECT * FROM users WHERE email = ? AND active = TRUE', [email.toLowerCase()])).rows[0];
    if (!user) return res.status(401).json({ error: 'Invalid email or password' });

    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid email or password' });

    // Silently upgrade legacy SHA-256 hashes to bcrypt on successful login
    if (!user.password_hash.startsWith('$2')) {
      upgradePasswordHash(user.id, password).catch(() => {});
    }

    const token = generateToken();
    const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await db.raw('INSERT INTO sessions (user_id, token, expires_at) VALUES (?, ?, ?)', [user.id, token, expires]);

    res.json({
      ok: true, token,
      user: {
        id: user.id, email: user.email,
        first_name: user.first_name, last_name: user.last_name,
        role: user.role, is_buyer: user.is_buyer, is_seller: user.is_seller,
        is_ap: user.is_ap, location: user.location, vendor_tag: user.vendor_tag,
        must_change_password: user.must_change_password,
      },
    });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/change-password
router.post('/change-password', async (req: Request, res: Response) => {
  try {
    const user = await requireAuth(req, res);
    if (!user) return;

    const { new_password } = req.body;
    if (!new_password || new_password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
    if (!/[A-Z]/.test(new_password)) return res.status(400).json({ error: 'Password must contain an uppercase letter' });
    if (!/[0-9]/.test(new_password)) return res.status(400).json({ error: 'Password must contain a number' });

    const hash = await hashPassword(new_password);
    await db.raw('UPDATE users SET password_hash = ?, must_change_password = FALSE, updated_at = NOW() WHERE id = ?', [hash, user.id]);

    res.json({ ok: true, message: 'Password changed' });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/forgot-password
router.post('/forgot-password', authLimiter, async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required' });

    const user = (await db.raw('SELECT * FROM users WHERE email = ? AND active = TRUE', [email.toLowerCase()])).rows[0];
    // Always return same response so we don't reveal whether email exists
    if (!user) return res.json({ ok: true, message: 'If that email exists, a reset link was sent.' });

    const resetToken = generateToken();
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await db.raw('INSERT INTO sessions (user_id, token, expires_at) VALUES (?, ?, ?)', [user.id, `reset:${resetToken}`, expires]);

    const resetUrl = `${APP_URL}?reset=${resetToken}`;
    const { subject, html } = passwordResetEmail(user.first_name, resetUrl);
    const emailRes = await sendEmail(user.email, subject, html);
    await logEmail('forgot_password', user.email, null, subject, emailRes.ok ? 'sent' : 'failed');

    res.json({ ok: true, message: 'If that email exists, a reset link was sent.' });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/reset-password
router.post('/reset-password', authLimiter, async (req: Request, res: Response) => {
  try {
    const { token, new_password } = req.body;
    if (!token || !new_password) return res.status(400).json({ error: 'Token and new password required' });
    if (new_password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

    const session = (await db.raw('SELECT * FROM sessions WHERE token = ? AND expires_at > NOW()', [`reset:${token}`])).rows[0];
    if (!session) return res.status(401).json({ error: 'Invalid or expired reset token' });

    const hash = await hashPassword(new_password);
    await db.raw('UPDATE users SET password_hash = ?, must_change_password = FALSE, updated_at = NOW() WHERE id = ?', [hash, session.user_id]);
    await db.raw('DELETE FROM sessions WHERE token = ?', [`reset:${token}`]);

    res.json({ ok: true, message: 'Password reset successful' });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/auth/me
router.get('/me', async (req: Request, res: Response) => {
  try {
    const user = await requireAuth(req, res);
    if (!user) return;
    res.json({
      id: user.id, email: user.email,
      first_name: user.first_name, last_name: user.last_name,
      role: user.role, is_buyer: user.is_buyer, is_seller: user.is_seller,
      is_ap: user.is_ap, location: user.location, vendor_tag: user.vendor_tag,
      must_change_password: user.must_change_password,
    });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/auth/db-status — needs_setup check (no auth required)
router.get('/db-status', async (_req: Request, res: Response) => {
  try {
    const users = (await db.raw('SELECT COUNT(*) as c FROM users')).rows[0].c;
    const vehicles = (await db.raw('SELECT COUNT(*) as c FROM vehicles')).rows[0].c;
    const vendors = (await db.raw('SELECT COUNT(*) as c FROM vendors')).rows[0].c;
    res.json({
      status: 'ok',
      needs_setup: Number(users) === 0,
      counts: { users: Number(users), vehicles: Number(vehicles), vendors: Number(vendors) },
    });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
