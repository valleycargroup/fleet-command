import { Router, Request, Response } from 'express';
import db from '../lib/db';
import { hashPassword, requireAuth } from '../lib/auth';
import { sendEmail, logEmail, welcomeUserEmail } from '../lib/email';

const router = Router();

// GET /api/users
router.get('/', async (req: Request, res: Response) => {
  try {
    const user = await requireAuth(req, res);
    if (!user) return;
    if (!user.is_buyer && !user.is_seller && user.role?.toLowerCase() !== 'admin')
      return res.status(403).json({ error: 'Forbidden' });

    const users = (await db.raw(
      `SELECT id, email, first_name, last_name, phone, role, is_buyer, is_seller, is_ap,
              location, vendor_tag, vendor_categories, parts_location, auction_assignments, active, created_at
       FROM users WHERE active = TRUE ORDER BY created_at DESC`
    )).rows;

    res.json({ users });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/users
router.post('/', async (req: Request, res: Response) => {
  try {
    const user = await requireAuth(req, res);
    if (!user) return;
    if (!user.is_buyer && !user.is_seller && user.role?.toLowerCase() !== 'admin')
      return res.status(403).json({ error: 'Only admins can register users' });

    const body = req.body;
    const { email, phone, first_name, last_name, role, is_buyer, is_seller, is_ap,
            location, vendor_tag, vendor_categories, parts_location, auction_assignments,
            recon_categories, recon_customized, password } = body;

    if (!email || !phone || !first_name) return res.status(400).json({ error: 'Email, phone, and first name required' });

    const cleanEmail = String(email).trim().toLowerCase();
    const cleanFirst = String(first_name).trim();
    const cleanLast  = String(last_name || '').trim();
    const cleanPhone = String(phone).trim();

    const existing = (await db.raw('SELECT id, active FROM users WHERE email = ?', [cleanEmail])).rows[0];
    if (existing && existing.active) return res.status(400).json({ error: 'Email already registered' });

    const pw = password && password.length > 0 ? password : cleanPhone.replace(/[^0-9]/g, '');
    const hash = await hashPassword(pw);

    let userId: number;

    if (existing && !existing.active) {
      await db.raw(
        `UPDATE users SET active = TRUE, password_hash = ?, first_name = ?, last_name = ?, phone = ?,
         role = ?, is_buyer = ?, is_seller = ?, is_ap = ?, location = ?, vendor_tag = ?,
         vendor_categories = ?, parts_location = ?, auction_assignments = ?,
         recon_categories = ?, recon_customized = ?, must_change_password = FALSE, updated_at = NOW()
         WHERE id = ?`,
        [hash, cleanFirst, cleanLast, cleanPhone, role || 'admin',
         !!is_buyer, !!is_seller, !!is_ap, location || 'Both', vendor_tag || null,
         vendor_categories ? JSON.stringify(vendor_categories) : null,
         parts_location || null,
         auction_assignments ? JSON.stringify(auction_assignments) : null,
         recon_categories ? JSON.stringify(recon_categories) : null,
         !!recon_customized, existing.id]
      );
      userId = existing.id;
    } else {
      const result = await db.raw(
        `INSERT INTO users (email, password_hash, first_name, last_name, phone, role, is_buyer, is_seller, is_ap,
          location, vendor_tag, vendor_categories, parts_location, auction_assignments, recon_categories, recon_customized, must_change_password)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, FALSE) RETURNING id`,
        [cleanEmail, hash, cleanFirst, cleanLast, cleanPhone, role || 'admin',
         !!is_buyer, !!is_seller, !!is_ap, location || 'Both', vendor_tag || null,
         vendor_categories ? JSON.stringify(vendor_categories) : null,
         parts_location || null,
         auction_assignments ? JSON.stringify(auction_assignments) : null,
         recon_categories ? JSON.stringify(recon_categories) : null,
         !!recon_customized]
      );
      userId = result.rows[0].id;
    }

    try {
      const welcome = welcomeUserEmail(cleanFirst, cleanEmail, pw, role || 'admin', location || 'Both');
      const emailRes = await sendEmail(cleanEmail, welcome.subject, welcome.html);
      await logEmail('welcome_user', cleanEmail, null, welcome.subject, emailRes.ok ? 'sent' : 'failed');
    } catch (e) { console.error('Welcome email failed:', e); }

    res.json({ ok: true, message: existing ? 'User reactivated' : 'User registered', id: userId });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/users/:id
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const user = await requireAuth(req, res);
    if (!user) return;

    const userId = req.params.id;
    if (String(user.id) !== userId && user.role?.toLowerCase() !== 'admin' && !user.is_buyer && !user.is_seller)
      return res.status(403).json({ error: 'Forbidden' });

    const body = req.body;
    const fields: string[] = [];
    const values: any[] = [];
    const allowed = ['first_name', 'last_name', 'phone', 'role', 'is_buyer', 'is_seller', 'is_ap',
                     'location', 'vendor_tag', 'vendor_categories', 'parts_location',
                     'auction_assignments', 'recon_categories', 'recon_customized', 'active'];
    const trimFields = ['first_name', 'last_name', 'phone', 'vendor_tag', 'parts_location'];

    for (const key of allowed) {
      if (body[key] !== undefined) {
        let val = body[key];
        if (typeof val === 'object' && val !== null) val = JSON.stringify(val);
        else if (typeof val === 'string' && trimFields.includes(key)) val = val.trim();
        fields.push(`${key} = ?`);
        values.push(val);
      }
    }

    if (body.password !== undefined && typeof body.password === 'string' && body.password.trim().length > 0) {
      const newPw = body.password.trim();
      if (newPw.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
      if (!/[A-Z]/.test(newPw)) return res.status(400).json({ error: 'Password must contain an uppercase letter' });
      if (!/[0-9]/.test(newPw)) return res.status(400).json({ error: 'Password must contain a number' });
      const hash = await hashPassword(newPw);
      fields.push('password_hash = ?');
      values.push(hash);
      fields.push('must_change_password = FALSE');
    }

    if (fields.length === 0) return res.status(400).json({ error: 'No fields to update' });
    fields.push('updated_at = NOW()');
    values.push(userId);

    await db.raw(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values);
    res.json({ ok: true });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/users/:id  (soft delete)
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const user = await requireAuth(req, res);
    if (!user) return;
    if (user.role?.toLowerCase() !== 'admin' && !user.is_buyer && !user.is_seller)
      return res.status(403).json({ error: 'Forbidden' });

    const userId = req.params.id;
    if (String(user.id) === userId) return res.status(400).json({ error: 'Cannot delete yourself' });

    await db.raw('UPDATE users SET active = FALSE, updated_at = NOW() WHERE id = ?', [userId]);
    res.json({ ok: true });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
