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

// GET /api/vendors — join primary contact from users
router.get('/', async (req: Request, res: Response) => {
  try {
    const user = await requireAuth(req, res);
    if (!user) return;
    const rows = (await db.raw(`
      SELECT v.id, v.name, v.location, v.categories, v.office_phone,
             v.payment_terms, v.cutoff_day, v.cutoff_time, v.delivery_method,
             v.active, v.primary_user_id,
             u.first_name, u.last_name,
             u.email  AS contact_email,
             u.phone  AS contact_phone
      FROM vendors v
      LEFT JOIN users u ON v.primary_user_id = u.id
      WHERE v.active = TRUE
      ORDER BY v.name
    `)).rows;

    const vendors = rows.map((r: any) => ({
      id:             r.id,
      name:           r.name,
      contact_name:   r.first_name ? (r.first_name + ' ' + (r.last_name || '')).trim() : '',
      email:          r.contact_email || '',
      phone:          r.contact_phone || '',
      office_phone:   r.office_phone || '',
      location:       r.location || '',
      categories:     r.categories,
      payment_terms:  r.payment_terms,
      cutoff_day:     r.cutoff_day,
      cutoff_time:    r.cutoff_time,
      delivery_method: r.delivery_method,
      primary_user_id: r.primary_user_id || null,
    }));

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

    const body = req.body;
    const cleanName    = String(body.name    || '').trim();
    const cleanEmail   = String(body.email   || '').trim().toLowerCase();
    const cleanContact = String(body.contact_name || '').trim();
    const cleanCell    = String(body.phone   || '').trim();

    if (!cleanName)  return res.status(400).json({ error: 'Vendor name required' });
    if (!cleanEmail) return res.status(400).json({ error: 'Email required' });

    const cats = Array.isArray(body.categories) ? body.categories
      : (() => { try { const p = JSON.parse(body.categories); return Array.isArray(p) ? p : []; } catch { return []; } })();

    const paymentTerms   = body.payment_terms   || 'weekly';
    const cutoffDay      = body.cutoff_day      || 'Friday';
    const cutoffTime     = body.cutoff_time     || '5 PM';
    const deliveryMethod = body.delivery_method || 'USPS Mail';

    let warning: string | null = null;

    // 1. Resolve or create the contact user
    const existingUserRow = (await db.raw('SELECT id, role FROM users WHERE email = ?', [cleanEmail])).rows[0];
    if (existingUserRow && existingUserRow.role !== 'vendor') {
      return res.status(400).json({ error: `Email ${cleanEmail} belongs to a ${existingUserRow.role} account` });
    }

    const { first, last } = splitName(cleanContact || cleanName);
    let primaryUserId: number;

    if (existingUserRow) {
      // Update existing vendor user's contact details
      const syncFields = ['first_name = ?', 'last_name = ?', 'phone = ?', 'vendor_tag = ?', 'active = TRUE', 'updated_at = NOW()'];
      const syncVals: any[] = [first, last, cleanCell, cleanName];
      if (body.password?.trim()) {
        syncFields.push('password_hash = ?', 'must_change_password = FALSE');
        syncVals.push(await hashPassword(body.password.trim()));
      }
      syncVals.push(existingUserRow.id);
      await db.raw(`UPDATE users SET ${syncFields.join(', ')} WHERE id = ?`, syncVals);
      primaryUserId = existingUserRow.id;
    } else {
      if (!body.password?.trim()) return res.status(400).json({ error: 'Password required for new vendor login' });
      const hash = await hashPassword(body.password.trim());
      const newUser = (await db.raw(
        `INSERT INTO users (email, password_hash, first_name, last_name, phone, role, is_buyer, is_seller, vendor_tag, must_change_password)
         VALUES (?, ?, ?, ?, ?, 'vendor', FALSE, FALSE, ?, FALSE) RETURNING id`,
        [cleanEmail, hash, first, last, cleanCell, cleanName]
      )).rows[0];
      primaryUserId = newUser.id;
    }

    // 2. Create or update vendor record
    const existingVendor = (await db.raw(
      'SELECT id FROM vendors WHERE LOWER(TRIM(name)) = LOWER(?) LIMIT 1', [cleanName]
    )).rows[0];

    let vendorId: number;
    if (existingVendor) {
      await db.raw(
        `UPDATE vendors SET location = ?, categories = ?::jsonb, office_phone = ?,
         payment_terms = ?, cutoff_day = ?, cutoff_time = ?, delivery_method = ?,
         primary_user_id = ?, active = TRUE WHERE id = ?`,
        [body.location || '', JSON.stringify(cats), body.office_phone || '',
         paymentTerms, cutoffDay, cutoffTime, deliveryMethod,
         primaryUserId, existingVendor.id]
      );
      vendorId = existingVendor.id;
    } else {
      const result = (await db.raw(
        `INSERT INTO vendors (name, location, categories, office_phone,
         payment_terms, cutoff_day, cutoff_time, delivery_method, primary_user_id)
         VALUES (?, ?, ?::jsonb, ?, ?, ?, ?, ?, ?) RETURNING id`,
        [cleanName, body.location || '', JSON.stringify(cats), body.office_phone || '',
         paymentTerms, cutoffDay, cutoffTime, deliveryMethod, primaryUserId]
      )).rows[0];
      vendorId = result.id;
    }

    // 3. Link user back to vendor
    await db.raw('UPDATE users SET vendor_id = ? WHERE id = ?', [vendorId, primaryUserId]);

    // 4. Send welcome email if we have a password
    if (body.password?.trim()) {
      try {
        const welcome = welcomeVendorEmail(cleanName, (first + ' ' + last).trim(), cleanEmail, body.password.trim(), cats);
        const emailRes = await sendEmail(cleanEmail, welcome.subject, welcome.html);
        await logEmail('welcome_vendor', cleanEmail, null, welcome.subject, emailRes.ok ? 'sent' : 'failed');
      } catch (e) { console.error('Welcome email failed:', e); }
    }

    res.json({ ok: true, id: vendorId, updated: !!existingVendor, warning });
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

    // Load current vendor (including primary_user_id)
    const vendor = (await db.raw('SELECT * FROM vendors WHERE id = ?', [vendorId])).rows[0];
    if (!vendor) return res.status(404).json({ error: 'Vendor not found' });

    const cats = body.categories !== undefined
      ? (Array.isArray(body.categories) ? body.categories
          : (() => { try { const p = JSON.parse(body.categories); return Array.isArray(p) ? p : [body.categories]; } catch { return [body.categories]; } })())
      : null;

    // Update vendor company fields
    const vFields: string[] = [];
    const vValues: any[] = [];
    if (body.name          !== undefined) { vFields.push('name = ?');           vValues.push(String(body.name).trim()); }
    if (body.location      !== undefined) { vFields.push('location = ?');       vValues.push(String(body.location)); }
    if (body.office_phone  !== undefined) { vFields.push('office_phone = ?');   vValues.push(String(body.office_phone)); }
    if (body.active        !== undefined) { vFields.push('active = ?');         vValues.push(!!body.active); }
    if (body.payment_terms !== undefined) { vFields.push('payment_terms = ?');  vValues.push(String(body.payment_terms)); }
    if (body.cutoff_day    !== undefined) { vFields.push('cutoff_day = ?');     vValues.push(String(body.cutoff_day)); }
    if (body.cutoff_time   !== undefined) { vFields.push('cutoff_time = ?');    vValues.push(String(body.cutoff_time)); }
    if (body.delivery_method !== undefined) { vFields.push('delivery_method = ?'); vValues.push(String(body.delivery_method)); }
    if (cats !== null)                    { vFields.push('categories = ?::jsonb'); vValues.push(JSON.stringify(cats)); }

    if (vFields.length > 0) {
      vValues.push(vendorId);
      await db.raw(`UPDATE vendors SET ${vFields.join(', ')} WHERE id = ?`, vValues);
    }

    // Sync contact user
    const cleanEmail   = body.email   ? String(body.email).trim().toLowerCase()   : null;
    const cleanContact = body.contact_name ? String(body.contact_name).trim()     : null;
    const cleanCell    = body.phone   ? String(body.phone).trim()                  : null;
    const vendorName   = String(body.name || vendor.name || '').trim();
    let warning: string | null = null;

    if (cleanEmail || vendor.primary_user_id) {
      try {
        let targetUserId: number | null = vendor.primary_user_id || null;

        // If email is changing, check the new email isn't taken by a non-vendor
        if (cleanEmail && targetUserId) {
          const currentUser = (await db.raw('SELECT email FROM users WHERE id = ?', [targetUserId])).rows[0];
          if (currentUser?.email !== cleanEmail) {
            const conflict = (await db.raw('SELECT id, role FROM users WHERE email = ? AND id != ?', [cleanEmail, targetUserId])).rows[0];
            if (conflict && conflict.role !== 'vendor') {
              warning = `Email ${cleanEmail} belongs to a ${conflict.role} account — contact info not updated.`;
              cleanEmail && (targetUserId = null); // skip user sync
            }
          }
        }

        // If no primary user yet and we have an email, find or create
        if (!targetUserId && cleanEmail) {
          const existing = (await db.raw('SELECT id, role FROM users WHERE email = ?', [cleanEmail])).rows[0];
          if (existing && existing.role !== 'vendor') {
            warning = `Email ${cleanEmail} belongs to a ${existing.role} account — contact not linked.`;
          } else {
            targetUserId = existing?.id || null;
            if (!targetUserId) {
              if (!body.password?.trim()) {
                warning = 'New contact email provided but no password set — login not created yet.';
              } else {
                const { first, last } = splitName(cleanContact || vendorName);
                const hash = await hashPassword(body.password.trim());
                const newUser = (await db.raw(
                  `INSERT INTO users (email, password_hash, first_name, last_name, phone, role, is_buyer, is_seller, vendor_tag, vendor_id, must_change_password)
                   VALUES (?, ?, ?, ?, ?, 'vendor', FALSE, FALSE, ?, ?, FALSE) RETURNING id`,
                  [cleanEmail, hash, first, last, cleanCell || '', vendorName, vendorId]
                )).rows[0];
                targetUserId = newUser.id;
              }
            }
          }
        }

        if (targetUserId) {
          const { first, last } = splitName(cleanContact || vendorName);
          const uFields = ['vendor_id = ?', 'vendor_tag = ?', 'active = TRUE', 'updated_at = NOW()'];
          const uValues: any[] = [vendorId, vendorName];
          if (cleanEmail)   { uFields.push('email = ?');      uValues.push(cleanEmail); }
          if (cleanContact) { uFields.push('first_name = ?', 'last_name = ?'); uValues.push(first, last); }
          if (cleanCell)    { uFields.push('phone = ?');      uValues.push(cleanCell); }
          if (body.password?.trim()) {
            const hash = await hashPassword(body.password.trim());
            uFields.push('password_hash = ?', 'must_change_password = FALSE');
            uValues.push(hash);
          }
          uValues.push(targetUserId);
          await db.raw(`UPDATE users SET ${uFields.join(', ')} WHERE id = ?`, uValues);

          // Ensure primary_user_id is set on vendor
          if (!vendor.primary_user_id) {
            await db.raw('UPDATE vendors SET primary_user_id = ? WHERE id = ?', [targetUserId, vendorId]);
          }
        }
      } catch (e) {
        console.error('Vendor user sync failed:', e);
        warning = 'Vendor saved, but contact account sync failed.';
      }
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
