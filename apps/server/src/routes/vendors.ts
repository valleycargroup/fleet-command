import { Router, Request, Response } from 'express';
import db from '../lib/db';
import { hashPassword, requireAuth } from '../lib/auth';
import { sendEmail, logEmail, welcomeVendorEmail } from '../lib/email';

const router = Router();

// GET /api/vendors
router.get('/', async (req: Request, res: Response) => {
  try {
    const user = await requireAuth(req, res);
    if (!user) return;
    const vendors = (await db.raw('SELECT * FROM vendors WHERE active = TRUE ORDER BY name')).rows;
    res.json({ vendors });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/vendors
router.post('/', async (req: Request, res: Response) => {
  try {
    const user = await requireAuth(req, res);
    if (!user) return;
    if (user.role === 'vendor') return res.status(403).json({ error: 'Forbidden' });

    const v = req.body;
    if (!v.name || !String(v.name).trim()) return res.status(400).json({ error: 'Vendor name required' });

    const cleanName    = String(v.name).trim();
    const cleanEmail   = v.email ? String(v.email).trim().toLowerCase() : null;
    const cleanContact = v.contact_name ? String(v.contact_name).trim() : '';
    const cleanPhone   = v.phone ? String(v.phone).trim() : '';

    const existing = (await db.raw(
      'SELECT id, email, active FROM vendors WHERE LOWER(TRIM(name)) = LOWER(?) LIMIT 1', [cleanName]
    )).rows[0];

    let vendorId: number;

    if (existing) {
      await db.raw(
        `UPDATE vendors SET location = ?, categories = ?, contact_name = ?, email = ?, phone = ?, office_phone = ?, active = TRUE WHERE id = ?`,
        [v.location || '', JSON.stringify(v.categories || []), cleanContact,
         cleanEmail || existing.email || '', cleanPhone, v.office_phone || '', existing.id]
      );
      vendorId = existing.id;
    } else {
      const result = await db.raw(
        'INSERT INTO vendors (name, location, categories, contact_name, email, phone, office_phone) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id',
        [cleanName, v.location || '', JSON.stringify(v.categories || []), cleanContact, cleanEmail || '', cleanPhone, v.office_phone || '']
      );
      vendorId = result.rows[0].id;
    }

    let warning: string | null = null;

    if (cleanEmail && v.password) {
      try {
        const existingUser = (await db.raw('SELECT id, active, role FROM users WHERE email = ?', [cleanEmail])).rows[0];
        if (existingUser && existingUser.role && existingUser.role !== 'vendor') {
          warning = `Vendor saved, but email ${cleanEmail} is already a ${existingUser.role} user — no login created.`;
        } else {
          const hash = await hashPassword(v.password);
          if (existingUser) {
            await db.raw(
              `UPDATE users SET active = TRUE, password_hash = ?, first_name = ?, phone = ?, role = 'vendor',
               is_buyer = FALSE, is_seller = FALSE, vendor_tag = ?, vendor_categories = ?, must_change_password = FALSE, updated_at = NOW()
               WHERE id = ?`,
              [hash, cleanContact || cleanName, cleanPhone, cleanName, JSON.stringify(v.categories || []), existingUser.id]
            );
          } else {
            await db.raw(
              `INSERT INTO users (email, password_hash, first_name, last_name, phone, role, is_buyer, is_seller, vendor_tag, vendor_categories, must_change_password)
               VALUES (?, ?, ?, '', ?, 'vendor', FALSE, FALSE, ?, ?, FALSE)`,
              [cleanEmail, hash, cleanContact || cleanName, cleanPhone, cleanName, JSON.stringify(v.categories || [])]
            );
          }
          const welcome = welcomeVendorEmail(cleanName, cleanContact || cleanName, cleanEmail, v.password, v.categories || []);
          const emailRes = await sendEmail(cleanEmail, welcome.subject, welcome.html);
          await logEmail('welcome_vendor', cleanEmail, null, welcome.subject, emailRes.ok ? 'sent' : 'failed');
        }
      } catch (e) { console.error('Vendor user/email setup failed:', e); }
    }

    res.json({ ok: true, id: vendorId, updated: !!existing, warning });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/vendors/:id
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const user = await requireAuth(req, res);
    if (!user) return;
    if (user.role === 'vendor') return res.status(403).json({ error: 'Forbidden' });

    const vendorId = req.params.id;
    const body = req.body;
    const fields: string[] = [];
    const values: any[] = [];

    if (body.name !== undefined)         { fields.push('name = ?');         values.push(String(body.name).trim()); }
    if (body.contact_name !== undefined) { fields.push('contact_name = ?'); values.push(String(body.contact_name).trim()); }
    if (body.email !== undefined)        { fields.push('email = ?');        values.push(String(body.email).trim().toLowerCase()); }
    if (body.phone !== undefined)        { fields.push('phone = ?');        values.push(String(body.phone).trim()); }
    if (body.office_phone !== undefined) { fields.push('office_phone = ?'); values.push(String(body.office_phone)); }
    if (body.location !== undefined)     { fields.push('location = ?');     values.push(String(body.location)); }
    if (body.active !== undefined)       { fields.push('active = ?');       values.push(!!body.active); }

    if (body.categories !== undefined) {
      const catsArr = Array.isArray(body.categories) ? body.categories :
        (() => { try { const p = JSON.parse(body.categories); return Array.isArray(p) ? p : [body.categories]; } catch { return [body.categories]; } })();
      fields.push('categories = ?');
      values.push(JSON.stringify(catsArr));
    }

    if (fields.length === 0) return res.status(400).json({ error: 'No fields to update' });
    values.push(vendorId);
    await db.raw(`UPDATE vendors SET ${fields.join(', ')} WHERE id = ?`, values);

    // Sync vendor user account
    const vendor = (await db.raw('SELECT name, email, contact_name, phone, categories FROM vendors WHERE id = ?', [vendorId])).rows[0];
    let warning: string | null = null;

    if (vendor?.email) {
      const cleanEmail = vendor.email.trim().toLowerCase();
      try {
        const existingUser = (await db.raw('SELECT id, role FROM users WHERE email = ?', [cleanEmail])).rows[0];
        if (existingUser && existingUser.role && existingUser.role !== 'vendor') {
          warning = `Vendor saved, but email ${cleanEmail} is already a ${existingUser.role} login.`;
        } else if (body.password && body.password.trim()) {
          const hash = await hashPassword(body.password.trim());
          if (existingUser) {
            await db.raw(
              `UPDATE users SET active = TRUE, password_hash = ?, first_name = ?, phone = ?, vendor_tag = ?, vendor_categories = ?, must_change_password = FALSE, updated_at = NOW() WHERE id = ?`,
              [hash, vendor.contact_name || vendor.name, vendor.phone || '', vendor.name, vendor.categories || '[]', existingUser.id]
            );
          } else {
            await db.raw(
              `INSERT INTO users (email, password_hash, first_name, last_name, phone, role, is_buyer, is_seller, vendor_tag, vendor_categories, must_change_password)
               VALUES (?, ?, ?, '', ?, 'vendor', FALSE, FALSE, ?, ?, FALSE)`,
              [cleanEmail, hash, vendor.contact_name || vendor.name, vendor.phone || '', vendor.name, vendor.categories || '[]']
            );
          }
        }
      } catch (e) { warning = 'Vendor saved, but login account sync failed.'; }
    }

    res.json({ ok: true, warning });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/vendors/:id  (soft delete)
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const user = await requireAuth(req, res);
    if (!user) return;
    if (user.role !== 'admin' && !user.is_buyer && !user.is_seller)
      return res.status(403).json({ error: 'Forbidden' });

    await db.raw('UPDATE vendors SET active = FALSE WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
