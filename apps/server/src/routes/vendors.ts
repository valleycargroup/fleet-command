import { Router, Request, Response } from 'express';
import db from '../lib/db';
import { hashPassword, requireAuth } from '../lib/auth';
import { sendEmail, logEmail, welcomeVendorEmail } from '../lib/email';

const router = Router();

function splitName(full: string): { first: string; last: string } {
  const parts = full.trim().split(/\s+/);
  return parts.length > 1
    ? { first: parts[0], last: parts.slice(1).join(' ') }
    : { first: full.trim(), last: '' };
}

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

    const paymentTerms   = v.payment_terms   || 'weekly';
    const cutoffDay      = v.cutoff_day      || 'Friday';
    const cutoffTime     = v.cutoff_time     || '5 PM';
    const deliveryMethod = v.delivery_method || 'USPS Mail';

    if (existing) {
      await db.raw(
        `UPDATE vendors SET location = ?, categories = ?, contact_name = ?, email = ?, phone = ?, office_phone = ?,
         payment_terms = ?, cutoff_day = ?, cutoff_time = ?, delivery_method = ?, active = TRUE WHERE id = ?`,
        [v.location || '', JSON.stringify(v.categories || []), cleanContact,
         cleanEmail || existing.email || '', cleanPhone, v.office_phone || '',
         paymentTerms, cutoffDay, cutoffTime, deliveryMethod, existing.id]
      );
      vendorId = existing.id;
    } else {
      const result = await db.raw(
        `INSERT INTO vendors (name, location, categories, contact_name, email, phone, office_phone,
         payment_terms, cutoff_day, cutoff_time, delivery_method) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
        [cleanName, v.location || '', JSON.stringify(v.categories || []), cleanContact, cleanEmail || '', cleanPhone, v.office_phone || '',
         paymentTerms, cutoffDay, cutoffTime, deliveryMethod]
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
          const { first, last } = splitName(cleanContact || cleanName);
          if (existingUser) {
            await db.raw(
              `UPDATE users SET active = TRUE, password_hash = ?, first_name = ?, last_name = ?, phone = ?, role = 'vendor',
               is_buyer = FALSE, is_seller = FALSE, vendor_tag = ?, vendor_categories = ?, vendor_id = ?, must_change_password = FALSE, updated_at = NOW()
               WHERE id = ?`,
              [hash, first, last, cleanPhone, cleanName, JSON.stringify(v.categories || []), vendorId, existingUser.id]
            );
          } else {
            await db.raw(
              `INSERT INTO users (email, password_hash, first_name, last_name, phone, role, is_buyer, is_seller, vendor_tag, vendor_categories, vendor_id, must_change_password)
               VALUES (?, ?, ?, ?, ?, 'vendor', FALSE, FALSE, ?, ?, ?, FALSE)`,
              [cleanEmail, hash, first, last, cleanPhone, cleanName, JSON.stringify(v.categories || []), vendorId]
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

    if (body.payment_terms !== undefined)   { fields.push('payment_terms = ?');   values.push(String(body.payment_terms)); }
    if (body.cutoff_day !== undefined)      { fields.push('cutoff_day = ?');      values.push(String(body.cutoff_day)); }
    if (body.cutoff_time !== undefined)     { fields.push('cutoff_time = ?');     values.push(String(body.cutoff_time)); }
    if (body.delivery_method !== undefined) { fields.push('delivery_method = ?'); values.push(String(body.delivery_method)); }

    if (fields.length === 0) return res.status(400).json({ error: 'No fields to update' });

    // Capture old email before the update so we can find the existing user account
    const oldVendorRow = (await db.raw('SELECT email FROM vendors WHERE id = ?', [vendorId])).rows[0];
    const oldEmail = oldVendorRow?.email?.trim().toLowerCase() || null;

    values.push(vendorId);
    await db.raw(`UPDATE vendors SET ${fields.join(', ')} WHERE id = ?`, values);

    // Sync vendor user account — always (not just on password change)
    const vendor = (await db.raw('SELECT name, email, contact_name, phone, categories FROM vendors WHERE id = ?', [vendorId])).rows[0];
    let warning: string | null = null;

    if (vendor?.email) {
      const cleanEmail = vendor.email.trim().toLowerCase();
      const emailChanged = !!(oldEmail && oldEmail !== cleanEmail);
      try {
        // Look up user by OLD email first (handles the email-change case), fall back to new email
        const lookupEmail = emailChanged ? oldEmail! : cleanEmail;
        let existingUser = (await db.raw('SELECT id, role FROM users WHERE email = ?', [lookupEmail])).rows[0];
        // Fallback: find orphaned vendor user by company name (handles email changes done before this fix)
        if (!existingUser && vendor?.name) {
          existingUser = (await db.raw(
            `SELECT id, role FROM users WHERE vendor_tag = ? AND role = 'vendor' LIMIT 1`, [vendor.name]
          )).rows[0];
        }

        if (existingUser && existingUser.role && existingUser.role !== 'vendor') {
          warning = `Vendor saved, but email ${cleanEmail} is already a ${existingUser.role} login.`;
        } else if (existingUser) {
          // Always sync email, name, phone, categories; only update password if provided
          const { first: syncFirst, last: syncLast } = splitName(vendor.contact_name || vendor.name);
          const syncFields = ['email = ?', 'first_name = ?', 'last_name = ?', 'phone = ?', 'vendor_tag = ?', 'vendor_categories = ?', 'vendor_id = ?', 'active = TRUE', 'updated_at = NOW()'];
          const syncValues: any[] = [cleanEmail, syncFirst, syncLast, vendor.phone || '', vendor.name, vendor.categories || '[]', vendorId];
          if (body.password && body.password.trim()) {
            const hash = await hashPassword(body.password.trim());
            syncFields.push('password_hash = ?', 'must_change_password = FALSE');
            syncValues.push(hash);
          }
          syncValues.push(existingUser.id);
          await db.raw(`UPDATE users SET ${syncFields.join(', ')} WHERE id = ?`, syncValues);
        } else if (body.password && body.password.trim()) {
          // No existing user at all — create one (requires a password to be useful)
          const hash = await hashPassword(body.password.trim());
          const { first: newFirst, last: newLast } = splitName(vendor.contact_name || vendor.name);
          await db.raw(
            `INSERT INTO users (email, password_hash, first_name, last_name, phone, role, is_buyer, is_seller, vendor_tag, vendor_categories, vendor_id, must_change_password)
             VALUES (?, ?, ?, ?, ?, 'vendor', FALSE, FALSE, ?, ?, ?, FALSE)`,
            [cleanEmail, hash, newFirst, newLast, vendor.phone || '', vendor.name, vendor.categories || '[]', vendorId]
          );
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
