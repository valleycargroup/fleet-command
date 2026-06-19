import { Router, Request, Response } from 'express';
import db from '../lib/db';
import { sendEmail, logEmail } from '../lib/email';
import { TEMPLATES } from '../lib/email-templates';

const router = Router();

// ── Recipient resolution ───────────────────────────────────────────────────────

async function findUserEmailByName(name: string | null | undefined): Promise<string | null> {
  if (!name || typeof name !== 'string' || !name.trim()) return null;
  const clean = name.trim();
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
    `SELECT email FROM vendors WHERE LOWER(TRIM(name)) = LOWER(?) AND active = TRUE LIMIT 1`,
    [vendorName.trim()]
  );
  return rows.rows[0]?.email ?? null;
}

async function resolveRecipients(type: string, data: any, fallbackTo: string | null): Promise<string[]> {
  try {
    const recipients = new Set<string>();

    if (type.startsWith('vendor_')) {
      const ve = await findVendorEmail(data?.vendor?.name);
      if (ve) recipients.add(ve.toLowerCase());
    }

    const buyerTypes = [
      'buyer_work_complete', 'buyer_recon_complete', 'buyer_bid_submitted',
      'buyer_vendor_declined', 'buyer_approved_shipping', 'transport_inbound_set',
      'shipping_hold', 'vehicle_grounded', 'driveway_outbound_shipped',
      'driveway_outbound_delivered', 'retail_vehicle_shipped', 'retail_vehicle_delivered',
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
    }

    const sellerGetsEmail = ['vehicle_grounded', 'buyer_recon_complete', 'seller_vehicle_sold', 'seller_vehicle_kicked'];
    if (sellerGetsEmail.includes(type)) {
      const se = await findUserEmailByName(data?.seller);
      if (se) recipients.add(se.toLowerCase());
    }

    if (type === 'seller_vehicle_kicked') {
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

    const recipients = await resolveRecipients(type, d, to ?? null);

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

    const results: { to: string; ok: boolean }[] = [];
    for (const r of recipients) {
      d.recipientRole = r === buyerEmail ? 'buyer' : r === sellerEmail ? 'seller' : 'other';
      const rendered = fn(d);
      if (!rendered) continue;
      const emailRes = await sendEmail(r, rendered.subject, rendered.html);
      await logEmail(type, r, d?.vehicle?.id ?? null, rendered.subject, emailRes.ok ? 'sent' : 'failed', emailRes.ok ? null : (emailRes.error ?? null));
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
