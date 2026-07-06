import { Router, Request, Response } from 'express';
import db from '../lib/db';
import { hashPassword, requireAuth } from '../lib/auth';
import { sendEmail, logEmail, welcomeVendorEmail } from '../lib/email';
import { broadcast } from '../lib/ws';

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
             v.active, v.primary_user_id, v.payment_info, v.email_prefs,
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
      payment_info:    r.payment_info   || {},
      email_prefs:     r.email_prefs    || {},
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
    const cleanName = String(body.name || '').trim();

    if (!cleanName) return res.status(400).json({ error: 'Vendor name required' });

    const cats = Array.isArray(body.categories) ? body.categories
      : (() => { try { const p = JSON.parse(body.categories); return Array.isArray(p) ? p : []; } catch { return []; } })();

    const paymentTerms   = body.payment_terms   || 'weekly';
    const cutoffDay      = body.cutoff_day      || 'Friday';
    const cutoffTime     = body.cutoff_time     || '5 PM';
    const deliveryMethod = body.delivery_method || 'USPS Mail';

    let warning: string | null = null;
    let primaryUserId: number;

    // 1a. Link an existing user directly by ID
    if (body.link_user_id) {
      const targetUser = (await db.raw('SELECT id FROM users WHERE id = ? AND active = TRUE', [body.link_user_id])).rows[0];
      if (!targetUser) return res.status(400).json({ error: 'Selected user not found' });
      primaryUserId = targetUser.id;

    // 1b. Resolve or create by email
    } else {
      const cleanEmail   = String(body.email   || '').trim().toLowerCase();
      const cleanContact = String(body.contact_name || '').trim();
      const cleanCell    = String(body.phone   || '').trim();

      if (!cleanEmail) return res.status(400).json({ error: 'Email required' });

      const existingUserRow = (await db.raw('SELECT id, role FROM users WHERE email = ?', [cleanEmail])).rows[0];
      if (existingUserRow && existingUserRow.role !== 'vendor') {
        return res.status(400).json({ error: `Email ${cleanEmail} belongs to a ${existingUserRow.role} account` });
      }

      const { first, last } = splitName(cleanContact || cleanName);

      if (existingUserRow) {
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

      // Send welcome email — scoped here where cleanEmail/first/last are in scope
      if (body.password?.trim()) {
        try {
          const welcome = welcomeVendorEmail(cleanName, (first + ' ' + last).trim(), cleanEmail, body.password.trim(), cats);
          const emailRes = await sendEmail(cleanEmail, welcome.subject, welcome.html);
          await logEmail('welcome_vendor', cleanEmail, null, welcome.subject, emailRes.ok ? 'sent' : 'failed', null, { name: (first + ' ' + last).trim(), role: 'vendor', vendor: cleanName }, 'manual', emailRes.messageId, welcome.html);
        } catch (e) { console.error('Welcome email failed:', e); }
      }
    }

    // 2. Create or update vendor record
    const existingVendor = (await db.raw(
      'SELECT id FROM vendors WHERE LOWER(TRIM(name)) = LOWER(?) LIMIT 1', [cleanName]
    )).rows[0];

    let vendorId: number;
    const emailPrefs = body.email_prefs && typeof body.email_prefs === 'object' ? body.email_prefs : {};

    if (existingVendor) {
      await db.raw(
        `UPDATE vendors SET location = ?, categories = ?::jsonb, office_phone = ?,
         payment_terms = ?, cutoff_day = ?, cutoff_time = ?, delivery_method = ?,
         primary_user_id = ?, email_prefs = ?::jsonb, active = TRUE WHERE id = ?`,
        [body.location || '', JSON.stringify(cats), body.office_phone || '',
         paymentTerms, cutoffDay, cutoffTime, deliveryMethod,
         primaryUserId, JSON.stringify(emailPrefs), existingVendor.id]
      );
      vendorId = existingVendor.id;
    } else {
      const result = (await db.raw(
        `INSERT INTO vendors (name, location, categories, office_phone,
         payment_terms, cutoff_day, cutoff_time, delivery_method, primary_user_id, email_prefs)
         VALUES (?, ?, ?::jsonb, ?, ?, ?, ?, ?, ?, ?::jsonb) RETURNING id`,
        [cleanName, body.location || '', JSON.stringify(cats), body.office_phone || '',
         paymentTerms, cutoffDay, cutoffTime, deliveryMethod, primaryUserId, JSON.stringify(emailPrefs)]
      )).rows[0];
      vendorId = result.id;
    }

    // 3. Link user back to vendor
    await db.raw('UPDATE users SET vendor_id = ? WHERE id = ?', [vendorId, primaryUserId]);

    broadcast('VENDORS_UPDATED');
    broadcast('USERS_UPDATED');
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
    if (body.name             !== undefined) { vFields.push('name = ?');            vValues.push(String(body.name).trim()); }
    if (body.location         !== undefined) { vFields.push('location = ?');        vValues.push(String(body.location)); }
    if (body.office_phone     !== undefined) { vFields.push('office_phone = ?');    vValues.push(String(body.office_phone)); }
    if (body.active           !== undefined) { vFields.push('active = ?');          vValues.push(!!body.active); }
    if (body.payment_terms    !== undefined) { vFields.push('payment_terms = ?');   vValues.push(String(body.payment_terms)); }
    if (body.cutoff_day       !== undefined) { vFields.push('cutoff_day = ?');      vValues.push(String(body.cutoff_day)); }
    if (body.cutoff_time      !== undefined) { vFields.push('cutoff_time = ?');     vValues.push(String(body.cutoff_time)); }
    if (body.delivery_method  !== undefined) { vFields.push('delivery_method = ?'); vValues.push(String(body.delivery_method)); }
    if (body.primary_user_id  !== undefined) { vFields.push('primary_user_id = ?');      vValues.push(body.primary_user_id || null); }
    if (body.payment_info     !== undefined) { vFields.push('payment_info = ?::jsonb');  vValues.push(JSON.stringify(body.payment_info || {})); }
    if (body.email_prefs      !== undefined) { vFields.push('email_prefs = ?::jsonb');   vValues.push(JSON.stringify(body.email_prefs || {})); }
    if (cats !== null)                       { vFields.push('categories = ?::jsonb');    vValues.push(JSON.stringify(cats)); }

    // If reassigning primary_user_id directly, also update that user's vendor_id link
    if (body.primary_user_id !== undefined && body.primary_user_id) {
      await db.raw('UPDATE users SET vendor_id = ?, vendor_tag = ?, updated_at = NOW() WHERE id = ?',
        [vendorId, String(body.name || vendor.name || '').trim(), body.primary_user_id]);
    }

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

    // Assign additional users to this vendor
    if (Array.isArray(body.add_user_ids) && body.add_user_ids.length > 0) {
      for (const uid of body.add_user_ids) {
        await db.raw(
          `UPDATE users SET vendor_id = ?, vendor_tag = ?, updated_at = NOW() WHERE id = ?`,
          [vendorId, vendorName, uid]
        );
      }
    }

    // Unassign users from this vendor
    if (Array.isArray(body.remove_user_ids) && body.remove_user_ids.length > 0) {
      for (const uid of body.remove_user_ids) {
        await db.raw(
          `UPDATE users SET vendor_id = NULL, vendor_tag = NULL, updated_at = NOW() WHERE id = ? AND vendor_id = ?`,
          [uid, vendorId]
        );
      }
      // If primary was removed, clear primary_user_id
      if (vendor.primary_user_id && body.remove_user_ids.map(String).includes(String(vendor.primary_user_id))) {
        await db.raw('UPDATE vendors SET primary_user_id = NULL WHERE id = ?', [vendorId]);
      }
    }

    broadcast('VENDORS_UPDATED');
    broadcast('USERS_UPDATED');
    res.json({ ok: true, warning });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/vendors/:id  (soft delete — also deactivates linked vendor users)
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const user = await requireAuth(req, res);
    if (!user) return;
    if (!['admin','tech support','tech_support','techsupport'].includes(user.role?.toLowerCase()) && !user.is_buyer && !user.is_seller)
      return res.status(403).json({ error: 'Forbidden' });

    const id = req.params.id;
    await db.raw('UPDATE vendors SET active = FALSE WHERE id = ?', [id]);
    await db.raw(`UPDATE users SET active = FALSE WHERE vendor_id = ? AND role = 'vendor'`, [id]);
    broadcast('VENDORS_UPDATED');
    broadcast('USERS_UPDATED');
    res.json({ ok: true });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
