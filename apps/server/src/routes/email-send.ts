import { Router, Request, Response } from 'express';
import db from '../lib/db';
import { sendEmail, logEmail } from '../lib/email';
import { TEMPLATES } from '../lib/email-templates';

const router = Router();

// ── Recipient resolution ───────────────────────────────────────────────────────

async function findUserEmailByName(name: string | null | undefined): Promise<string | null> {
  if (!name || typeof name !== 'string' || !name.trim()) return null;
  const clean = name.trim();
  // Seller/buyer fields sometimes store an email address directly rather than a display name
  if (clean.includes('@')) return clean;
  const parts = clean.split(/\s+/);
  if (parts.length >= 2) {
    const rows = await db.raw(
      `SELECT email FROM users WHERE active = TRUE AND LOWER(TRIM(first_name)) = LOWER(?) AND LOWER(TRIM(last_name)) = LOWER(?) LIMIT 1`,
      [parts[0], parts.slice(1).join(' ')]
    );
    if (rows.rows[0]?.email) return rows.rows[0].email as string;
  }
  const rows2 = await db.raw(
    `SELECT email FROM users WHERE active = TRUE AND LOWER(TRIM(first_name)) = LOWER(?) LIMIT 1`,
    [parts[0]]
  );
  return rows2.rows[0]?.email ?? null;
}

async function findVendorEmail(vendorName: string | null | undefined): Promise<string | null> {
  if (!vendorName) return null;
  const rows = await db.raw(
    `SELECT u.email FROM vendors v
     LEFT JOIN users u ON v.primary_user_id = u.id
     WHERE LOWER(TRIM(v.name)) = LOWER(?) AND v.active = TRUE LIMIT 1`,
    [vendorName.trim()]
  );
  if (rows.rows[0]?.email) return rows.rows[0].email as string;
  // Fallback: any active user linked to this vendor via vendor_id
  const rows2 = await db.raw(
    `SELECT u.email FROM vendors v
     JOIN users u ON u.vendor_id = v.id
     WHERE LOWER(TRIM(v.name)) = LOWER(?) AND v.active = TRUE AND u.active = TRUE
     ORDER BY u.id LIMIT 1`,
    [vendorName.trim()]
  );
  return rows2.rows[0]?.email ?? null;
}

async function resolveRecipients(type: string, data: any, fallbackTo: string | null): Promise<string[]> {
  try {
    const recipients = new Set<string>();

    if (type.startsWith('vendor_') && data?.vendor?.name) {
      // Fetch vendor record + prefs once
      const vendorRow = (await db.raw(
        `SELECT id, email_prefs FROM vendors WHERE LOWER(TRIM(name)) = LOWER(?) AND active = TRUE LIMIT 1`,
        [data.vendor.name.trim()]
      )).rows[0];
      const prefs: Record<string, any> = vendorRow?.email_prefs || {};

      // Bid-notification types — respect ccPrimaryOnBids and notifyAllOnBids
      const bidTypes = ['vendor_work_assigned','vendor_work_reminder','vendor_bid_requested','vendor_bid_accepted','vendor_work_canceled'];
      if (bidTypes.includes(type)) {
        const skipPrimary = prefs.ccPrimaryOnBids === false; // explicit false only — default is on
        if (!skipPrimary) {
          const ve = await findVendorEmail(data.vendor.name);
          if (ve) recipients.add(ve.toLowerCase());
        }
        if (prefs.notifyAllOnBids && vendorRow?.id) {
          const allUsers = (await db.raw(
            `SELECT email FROM users WHERE vendor_id = ? AND active = TRUE`,
            [vendorRow.id]
          )).rows;
          for (const u of allUsers) if (u.email) recipients.add(u.email.toLowerCase());
        }
      } else {
        // Non-bid vendor emails (payments etc.) — just use primary
        const ve = await findVendorEmail(data.vendor.name);
        if (ve) recipients.add(ve.toLowerCase());
      }
    }

    const buyerTypes = [
      'buyer_work_complete', 'buyer_recon_complete', 'buyer_bid_submitted',
      'buyer_vendor_declined', 'buyer_approved_shipping', 'transport_inbound_set',
      'shipping_hold', 'vehicle_grounded', 'driveway_inbound_pickedup',
      'driveway_outbound_shipped', 'driveway_outbound_delivered',
      'retail_vehicle_shipped', 'retail_vehicle_delivered',
      'dealer_vehicle_shipped', 'dealer_vehicle_delivered', 'parts_quoted_to_buyer',
    ];
    if (buyerTypes.includes(type)) {
      const be = await findUserEmailByName(data?.buyer);
      if (be) recipients.add(be.toLowerCase());
    }

    const partsBuyerVendorTypes = ['part_received', 'all_parts_received', 'part_rejected', 'part_backorder'];
    if (partsBuyerVendorTypes.includes(type)) {
      const buyerName = data?.buyer || data?.vehicle?.buyingBroker;
      if (buyerName) {
        const be = await findUserEmailByName(buyerName);
        if (be) recipients.add(be.toLowerCase());
      }
      if (data?.vendor?.email) recipients.add(data.vendor.email.toLowerCase());
      else if (data?.vendor?.name) {
        const ve = await findUserEmailByName(data.vendor.name);
        if (ve) recipients.add(ve.toLowerCase());
      }
    }

    if (type === 'parts_request_to_pm' || type === 'parts_approved_to_pm') {
      const pe = await findUserEmailByName(data?.partsManager);
      if (pe) recipients.add(pe.toLowerCase());
      const loc = data?.vehicle?.location;
      if (loc) {
        const pms = await db.raw(
          `SELECT email FROM users WHERE role = 'parts_manager' AND active = TRUE AND (parts_location = ? OR parts_location = 'Both')`,
          [loc]
        );
        for (const u of pms.rows) if (u.email) recipients.add(u.email.toLowerCase());
      }
    }

    if (type === 'parts_approved_to_vendor') {
      if (data?.vendor?.email) recipients.add(data.vendor.email.toLowerCase());
      else if (data?.vendor?.name) {
        const ve = await findUserEmailByName(data.vendor.name);
        if (ve) recipients.add(ve.toLowerCase());
      }
    }

    if (type === 'recon_approved_for_payment') {
      if (data?.vendor?.email) recipients.add(data.vendor.email.toLowerCase());
      else if (data?.vendor?.name) {
        const ve = await findUserEmailByName(data.vendor.name);
        if (ve) recipients.add(ve.toLowerCase());
      }
      const aps = await db.raw(`SELECT email FROM users WHERE (role = 'ap' OR is_ap = TRUE) AND active = TRUE`);
      for (const u of aps.rows) if (u.email) recipients.add(u.email.toLowerCase());
    }

    if (type === 'recon_disputed') {
      if (data?.vendor?.email) recipients.add(data.vendor.email.toLowerCase());
      else if (data?.vendor?.name) {
        const ve = await findUserEmailByName(data.vendor.name);
        if (ve) recipients.add(ve.toLowerCase());
      }
    }

    if (type === 'vendor_payment_receipt') {
      if (data?.vendor?.email) recipients.add(data.vendor.email.toLowerCase());
      else if (data?.vendor?.name) {
        const ve = await findUserEmailByName(data.vendor.name);
        if (ve) recipients.add(ve.toLowerCase());
      }
      if (data?.vendor?.paymentDeptEmail) recipients.add(data.vendor.paymentDeptEmail.toLowerCase());
    }

    const sellerGetsEmail = [
      'vehicle_grounded', 'transport_inbound_set',
      'buyer_recon_complete', 'buyer_approved_shipping',
      'driveway_outbound_shipped', 'driveway_outbound_delivered',
      'retail_vehicle_shipped', 'retail_vehicle_delivered',
      'dealer_vehicle_shipped', 'dealer_vehicle_delivered',
      'seller_vehicle_sold', 'seller_vehicle_kicked',
    ];
    if (sellerGetsEmail.includes(type)) {
      const sellerName = data?.seller || data?.vehicle?.sellingBroker;
      const se = await findUserEmailByName(sellerName);
      if (se) recipients.add(se.toLowerCase());
    }

    if (type === 'seller_vehicle_kicked' || type === 'seller_vehicle_sold') {
      const be = await findUserEmailByName(data?.buyer);
      if (be) recipients.add(be.toLowerCase());
    }

    if (recipients.size === 0 && fallbackTo) recipients.add(fallbackTo.toLowerCase());
    return Array.from(recipients);
  } catch (e) {
    console.error('[email-send] resolveRecipients error:', e);
    return fallbackTo ? [fallbackTo] : [];
  }
}

// ── POST /api/email/send ───────────────────────────────────────────────────────

router.post('/send', async (req: Request, res: Response) => {
  try {
    const { type, to, data } = req.body as { type?: string; to?: string; data?: any };

    if (!type) return res.status(400).json({ error: 'Missing "type"' });
    const fn = TEMPLATES[type];
    if (!fn) return res.status(400).json({ error: `Unknown email type: ${type}` });

    const d = data || {};

    // For vendor emails: look up buyer contact so templates can render the contact card
    if (type.startsWith('vendor_') && d.vehicle) {
      try {
        const buyerName = (d.buyer || d.vehicle.buyingBroker || '').toString().trim();
        if (buyerName) {
          const parts = buyerName.split(/\s+/);
          let buyerUser: any = null;
          if (parts.length >= 2) {
            const r = await db.raw(
              `SELECT first_name, last_name, phone, email FROM users WHERE active = TRUE AND LOWER(TRIM(first_name)) = LOWER(?) AND LOWER(TRIM(last_name)) = LOWER(?) LIMIT 1`,
              [parts[0], parts.slice(1).join(' ')]
            );
            buyerUser = r.rows[0] ?? null;
          }
          if (!buyerUser) {
            const r2 = await db.raw(
              `SELECT first_name, last_name, phone, email FROM users WHERE active = TRUE AND LOWER(TRIM(first_name)) = LOWER(?) LIMIT 1`,
              [parts[0]]
            );
            buyerUser = r2.rows[0] ?? null;
          }
          d.buyerContact = buyerUser
            ? { name: `${buyerUser.first_name} ${buyerUser.last_name || ''}`.trim(), phone: buyerUser.phone || '', email: buyerUser.email || '', registered: true }
            : { name: buyerName, phone: '', email: '', registered: false };
        }
      } catch (e) { console.error('[email-send] buyer contact lookup failed:', e); }
    }

    let recipients = await resolveRecipients(type, d, to ?? null);

    // Strip non-routable / test email addresses before sending
    const FAKE_TLDS = ['.local', '.test', '.internal', '.example', '.invalid', '.localhost'];
    const filtered = recipients.filter(r => {
      const domain = (r.split('@')[1] || '').toLowerCase();
      return domain.includes('.') && !FAKE_TLDS.some(tld => domain.endsWith(tld));
    });
    if (filtered.length < recipients.length) {
      const skipped = recipients.filter(r => !filtered.includes(r));
      console.log('[email-send] skipping non-routable addresses:', skipped.join(', '));
      recipients = filtered;
    }

    // CC all admins based on per-category settings
    try {
      const ccRow = await db.raw(`SELECT value FROM site_settings WHERE key = 'cc_admins_categories' LIMIT 1`);
      const cats: Record<string, boolean> = ccRow.rows[0]?.value ? JSON.parse(ccRow.rows[0].value) : {};
      const PAYMENT_TYPES = ['recon_approved_for_payment','vendor_payment_receipt','vendor_payment_pending_digest','recon_disputed'];
      const SHIPPING_TYPES = ['vehicle_grounded','transport_inbound_set','shipping_hold','driveway_inbound_pickedup','driveway_outbound_shipped','driveway_outbound_delivered','retail_vehicle_shipped','retail_vehicle_delivered','dealer_vehicle_shipped','dealer_vehicle_delivered'];
      const shouldCc =
        cats.all ||
        (cats.buyer    && type.startsWith('buyer_')) ||
        (cats.seller   && type.startsWith('seller_')) ||
        (cats.vendor   && type.startsWith('vendor_') && !PAYMENT_TYPES.includes(type)) ||
        (cats.payment  && PAYMENT_TYPES.includes(type)) ||
        (cats.shipping && SHIPPING_TYPES.includes(type)) ||
        (cats.parts    && (type.startsWith('parts_') || type.startsWith('part_')));
      if (shouldCc) {
        const admins = await db.raw(`SELECT email FROM users WHERE role = 'admin' AND active = TRUE`);
        for (const u of admins.rows) {
          if (u.email && !recipients.includes(u.email.toLowerCase())) {
            recipients = [...recipients, u.email.toLowerCase()];
          }
        }
      }
    } catch { /* table may not exist yet */ }

    // Determine buyer/seller emails so templates can tag recipient role for personalised wording
    let buyerEmail = '';
    let sellerEmail = '';
    try {
      const buyerName = (d.buyer || d.vehicle?.buyingBroker || '').toString().trim().toLowerCase();
      const sellerName = (d.seller || d.vehicle?.sellingBroker || '').toString().trim().toLowerCase();
      if (buyerName) {
        const be = await findUserEmailByName(buyerName);
        if (be) buyerEmail = be.toLowerCase();
      }
      if (sellerName) {
        const se = await findUserEmailByName(sellerName);
        if (se) sellerEmail = se.toLowerCase();
      }
    } catch (e) { console.error('[email-send] role email lookup failed:', e); }

    // Pre-fetch recipient metadata in one query
    const recipientMeta: Record<string, { name: string; role: string; vendor: string | null }> = {};
    try {
      const metaRows = (await db.raw(
        `SELECT u.email, u.first_name, u.last_name, u.role, v.name AS vendor_name
         FROM users u LEFT JOIN vendors v ON v.id = u.vendor_id
         WHERE u.email = ANY(?) AND u.active = TRUE`,
        [recipients]
      )).rows;
      for (const m of metaRows) {
        recipientMeta[m.email.toLowerCase()] = {
          name: [m.first_name, m.last_name].filter(Boolean).join(' '),
          role: m.role || '',
          vendor: m.vendor_name || null,
        };
      }
    } catch { /* non-fatal */ }

    const results: { to: string; ok: boolean }[] = [];
    for (const r of recipients) {
      d.recipientRole = r === buyerEmail ? 'buyer' : r === sellerEmail ? 'seller' : 'other';
      const rendered = fn(d);
      if (!rendered) continue;
      const emailRes = await sendEmail(r, rendered.subject, rendered.html);
      const rawVehicleId = (d?.vehicle?._dbId || (d?.vehicle?.id != null ? String(d.vehicle.id).replace(/^db_/, '') : '')) || null;
      const rm = recipientMeta[r.toLowerCase()];
      await logEmail(type, r, rawVehicleId, rendered.subject, emailRes.ok ? 'sent' : 'failed', emailRes.ok ? null : (emailRes.error ?? null), rm ? { name: rm.name, role: rm.role, vendor: rm.vendor ?? undefined } : undefined, 'manual', emailRes.messageId, rendered.html);
      results.push({ to: r, ok: emailRes.ok });
    }

    const anyOk = results.some(x => x.ok);
    res.status(anyOk || results.length === 0 ? 200 : 500).json({ ok: anyOk, recipients, results });
  } catch (e: any) {
    console.error('[email-send]', e);
    res.status(500).json({ error: e.message });
  }
});

export default router;
