import { Router, Request, Response } from 'express';
import db from '../lib/db';
import { generateToken } from '../lib/auth';
import { sendEmail, welcomeUserEmail, welcomeVendorEmail, passwordResetEmail } from '../lib/email';
import { TEMPLATES as EMAIL_TEMPLATES } from '../lib/email-templates';

const router = Router();

// Base templates that use their own dedicated functions
const BASE_TYPES = ['welcome-user', 'welcome-vendor', 'password-reset'] as const;

// All event-driven templates from email-templates.ts
const EVENT_TYPES = Object.keys(EMAIL_TEMPLATES);

const ALL_TYPES = [...BASE_TYPES, ...EVENT_TYPES];

// Minimal stub data keyed by template type so tests render meaningfully
const STUB_DATA: Record<string, any> = {
  vendor_assigned: {
    vendor: { name: 'Acme Detail' },
    vehicle: { id: 1, year: 2022, make: 'Toyota', model: 'Camry', vin8: 'ABC12345', color: 'White', miles: 30000, location: 'PHX' },
    category: 'Detail',
    categoryKey: 'detail',
    tasks: [{ desc: 'Full detail interior & exterior', isPart: false }],
    buyer: 'Darren Smith',
  },
  vendor_bid_accepted: {
    vendor: { name: 'Acme Detail' },
    vehicle: { id: 1, year: 2022, make: 'Toyota', model: 'Camry', vin8: 'ABC12345', color: 'White', miles: 30000, location: 'PHX' },
    category: 'Detail', categoryKey: 'detail',
    lineItems: [{ desc: 'Full Detail', price: 250, costType: 'ws' }],
    totalApproved: 250,
  },
  vendor_bid_declined: {
    vendor: { name: 'Acme Detail' },
    vehicle: { id: 1, year: 2022, make: 'Toyota', model: 'Camry', vin8: 'ABC12345', color: 'White', miles: 30000, location: 'PHX' },
    reason: 'Price too high',
  },
  vendor_work_canceled: {
    vendor: { name: 'Acme Detail' },
    vehicle: { id: 1, year: 2022, make: 'Toyota', model: 'Camry', vin8: 'ABC12345', color: 'White', miles: 30000, location: 'PHX' },
    lineItems: [{ desc: 'Full Detail', price: 0, costType: 'ws' }],
    totalRemaining: 0,
  },
  vendor_part_approved: {
    vendor: { name: 'Acme Mechanical' },
    vehicle: { id: 1, year: 2022, make: 'Toyota', model: 'Camry', vin8: 'ABC12345', color: 'White', miles: 30000, location: 'PHX' },
    part: { desc: 'Brake Pads Front', price: 120, approvedBy: 'Darren', approvedDate: '2026-06-15' },
    categoryKey: 'mechanical',
  },
  vendor_work_started: {
    vendor: { name: 'Acme Detail' },
    vehicle: { id: 1, year: 2022, make: 'Toyota', model: 'Camry', vin8: 'ABC12345', color: 'White', miles: 30000, location: 'PHX' },
    category: 'Detail', buyer: 'Darren Smith',
    lineItems: [{ desc: 'Full Detail', price: 250, costType: 'ws' }],
    totalApproved: 250, startedDate: '2026-06-15',
  },
  buyer_bid_submitted: {
    vendor: { name: 'Acme Detail' },
    vehicle: { id: 1, year: 2022, make: 'Toyota', model: 'Camry', vin8: 'ABC12345', color: 'White', miles: 30000, location: 'PHX' },
    category: 'Detail', categoryKey: 'detail', buyer: 'Darren Smith',
    lineItems: [{ desc: 'Full Detail', price: 250, costType: 'ws' }],
    totalBid: 250,
  },
  buyer_vendor_declined: {
    vendor: { name: 'Acme Detail' },
    vehicle: { id: 1, year: 2022, make: 'Toyota', model: 'Camry', vin8: 'ABC12345', color: 'White', miles: 30000, location: 'PHX' },
    category: 'Detail', categoryKey: 'detail', buyer: 'Darren Smith',
    reason: 'Vendor declined the job',
  },
  buyer_work_complete: {
    vendor: { name: 'Acme Detail' },
    vehicle: { id: 1, year: 2022, make: 'Toyota', model: 'Camry', vin8: 'ABC12345', color: 'White', miles: 30000, location: 'PHX' },
    category: 'Detail', categoryKey: 'detail', buyer: 'Darren Smith',
    lineItems: [{ desc: 'Full Detail', price: 250, costType: 'ws' }],
    totalCost: 250,
  },
  buyer_recon_complete: {
    vehicle: { id: 1, year: 2022, make: 'Toyota', model: 'Camry', vin8: 'ABC12345', color: 'White', miles: 30000, location: 'PHX', buyingBroker: 'Darren Smith', sellingBroker: 'Mike Jones', soldTo: 'ADESA PHX' },
    buyer: 'Darren Smith', seller: 'Mike Jones',
    reconSummary: [{ icon: '🧽', category: 'Detail', vendor: 'Acme Detail', cost: 250 }],
    totalReconCost: 250,
  },
  buyer_vehicle_kicked: {
    vehicle: { id: 1, year: 2022, make: 'Toyota', model: 'Camry', vin8: 'ABC12345', color: 'White', miles: 30000, location: 'PHX' },
    buyer: 'Darren Smith', kickReason: 'Engine issue', kickedBy: 'ADESA PHX', kickDate: '2026-06-15',
  },
  buyer_approved_shipping: {
    vehicle: { id: 1, year: 2022, make: 'Toyota', model: 'Camry', vin8: 'ABC12345', color: 'White', miles: 30000, location: 'PHX', soldTo: 'Dealer ABC' },
    buyer: 'Darren Smith', dealer: 'Dealer ABC', approvedDate: '2026-06-15',
  },
  shipping_hold: {
    vehicle: { id: 1, year: 2022, make: 'Toyota', model: 'Camry', vin8: 'ABC12345', color: 'White', miles: 30000, location: 'PHX' },
    buyer: 'Darren Smith', reason: 'ARB claim pending', holdBy: 'Darren Smith', holdDate: '2026-06-15',
  },
  vehicle_grounded: {
    vehicle: { id: 1, year: 2022, make: 'Toyota', model: 'Camry', vin8: 'ABC12345', color: 'White', miles: 30000, location: 'PHX', buyingBroker: 'Darren Smith', sellingBroker: 'Mike Jones', soldTo: 'Dealer ABC' },
    buyer: 'Darren Smith', seller: 'Mike Jones', location: 'PHX', groundedDate: '2026-06-15',
  },
  transport_inbound_set: {
    vehicle: { id: 1, year: 2022, make: 'Toyota', model: 'Camry', vin8: 'ABC12345', color: 'White', miles: 30000, location: 'PHX', soldTo: 'Dealer ABC' },
    buyer: 'Darren Smith',
    transport: { company: 'FastHaul', phone: '602-555-0100', email: 'dispatch@fasthaul.com', eta: '2026-06-20', destination: 'PHX Lot', cost: 350 },
  },
  driveway_inbound_pickedup: {
    vehicle: { id: 1, year: 2022, make: 'Toyota', model: 'Camry', vin8: 'ABC12345', color: 'White', miles: 30000, location: 'PHX' },
    buyer: 'Darren Smith', destination: 'PHX Lot', dwCompany: 'DriveAway Co', pickedUpDate: '2026-06-15',
  },
  driveway_outbound_shipped: {
    vehicle: { id: 1, year: 2022, make: 'Toyota', model: 'Camry', vin8: 'ABC12345', color: 'White', miles: 30000, location: 'PHX', soldTo: 'Dealer ABC' },
    buyer: 'Darren Smith', destination: 'Dealer ABC', dealer: 'Dealer ABC',
  },
  driveway_outbound_delivered: {
    vehicle: { id: 1, year: 2022, make: 'Toyota', model: 'Camry', vin8: 'ABC12345', color: 'White', miles: 30000, location: 'PHX', soldTo: 'Dealer ABC' },
    buyer: 'Darren Smith', destination: 'Dealer ABC', deliveredDate: '2026-06-20',
  },
  retail_vehicle_shipped: {
    vehicle: { id: 1, year: 2022, make: 'Toyota', model: 'Camry', vin8: 'ABC12345', color: 'White', miles: 30000, location: 'PHX' },
    buyer: 'Darren Smith', customerName: 'John Customer', customerPhone: '602-555-1234',
    customerEmail: 'john@example.com', deliveryAddress: '123 Main St, Scottsdale AZ',
    pickedUpDate: '2026-06-15', transport: { company: 'FastHaul', eta: '2026-06-20' },
  },
  retail_vehicle_delivered: {
    vehicle: { id: 1, year: 2022, make: 'Toyota', model: 'Camry', vin8: 'ABC12345', color: 'White', miles: 30000, location: 'PHX' },
    buyer: 'Darren Smith', customerName: 'John Customer', deliveryAddress: '123 Main St, Scottsdale AZ',
    deliveredDate: '2026-06-20',
  },
  seller_vehicle_sold: {
    vehicle: { id: 1, year: 2022, make: 'Toyota', model: 'Camry', vin8: 'ABC12345', color: 'White', miles: 30000, location: 'PHX', soldTo: 'Dealer ABC', soldDate: '2026-06-15', buyingBroker: 'Darren Smith', sellingBroker: 'Mike Jones' },
    buyer: 'Darren Smith', seller: 'Mike Jones',
  },
  seller_vehicle_kicked: {
    vehicle: { id: 1, year: 2022, make: 'Toyota', model: 'Camry', vin8: 'ABC12345', color: 'White', miles: 30000, location: 'PHX', buyingBroker: 'Darren Smith', sellingBroker: 'Mike Jones' },
    buyer: 'Darren Smith', seller: 'Mike Jones', kickReason: 'Engine issue', kickedBy: 'Dealer ABC', kickDate: '2026-06-15',
  },
  seller_progress: {
    vehicle: { id: 1, year: 2022, make: 'Toyota', model: 'Camry', vin8: 'ABC12345', color: 'White', miles: 30000, location: 'PHX' },
    seller: 'Mike Jones', statusText: 'In Recon', detail: 'Detail and touch-up in progress',
  },
  dealer_vehicle_shipped: {
    vehicle: { id: 1, year: 2022, make: 'Toyota', model: 'Camry', vin8: 'ABC12345', color: 'White', miles: 30000 },
    dealer: 'Dealer ABC', pickedUpDate: '2026-06-15',
    transport: { company: 'FastHaul', phone: '602-555-0100', eta: '2026-06-20' },
  },
  dealer_vehicle_delivered: {
    vehicle: { id: 1, year: 2022, make: 'Toyota', model: 'Camry', vin8: 'ABC12345', color: 'White', miles: 30000 },
    dealer: 'Dealer ABC', deliveredDate: '2026-06-20',
  },
  parts_request_to_pm: {
    vehicle: { id: 1, year: 2022, make: 'Toyota', model: 'Camry', vin8: 'ABC12345', color: 'White', miles: 30000, location: 'PHX' },
    vendor: { name: 'Acme Mechanical' }, partsManager: 'Parts Team',
    partCount: 2, parts: [{ desc: 'Brake Pads Front' }, { desc: 'Air Filter' }],
  },
  parts_quoted_to_buyer: {
    vehicle: { id: 1, year: 2022, make: 'Toyota', model: 'Camry', vin8: 'ABC12345', color: 'White', miles: 30000, location: 'PHX' },
    buyer: 'Darren Smith', totalQuote: 220,
    parts: [{ desc: 'Brake Pads Front', partPrice: 120, partETA: '2026-06-18' }, { desc: 'Air Filter', partPrice: 100, partETA: '2026-06-17' }],
  },
  parts_approved_to_pm: {
    vehicle: { id: 1, year: 2022, make: 'Toyota', model: 'Camry', vin8: 'ABC12345', color: 'White', miles: 30000, location: 'PHX' },
    partsManager: 'Parts Team',
    parts: [{ desc: 'Brake Pads Front', partPrice: 120, partETA: '2026-06-18' }, { desc: 'Air Filter', partPrice: 100, partETA: '2026-06-17' }],
  },
  parts_approved_to_vendor: {
    vehicle: { id: 1, year: 2022, make: 'Toyota', model: 'Camry', vin8: 'ABC12345', color: 'White', miles: 30000, location: 'PHX' },
    vendor: { name: 'Acme Mechanical' }, categoryKey: 'mechanical',
    parts: [{ desc: 'Brake Pads Front', partETA: '2026-06-18' }, { desc: 'Air Filter', partETA: '2026-06-17' }],
  },
  part_received: {
    vehicle: { id: 1, year: 2022, make: 'Toyota', model: 'Camry', vin8: 'ABC12345', color: 'White', miles: 30000, location: 'PHX' },
    recipient: 'Darren Smith', partDesc: 'Brake Pads Front', partReceivedDate: '2026-06-17',
    receivedCount: 1, totalParts: 2, categoryKey: 'mechanical',
    remainingParts: [{ desc: 'Air Filter', partETA: '2026-06-19' }],
  },
  all_parts_received: {
    vehicle: { id: 1, year: 2022, make: 'Toyota', model: 'Camry', vin8: 'ABC12345', color: 'White', miles: 30000, location: 'PHX' },
    recipient: 'Darren Smith', categoryKey: 'mechanical',
    parts: [{ desc: 'Brake Pads Front', partReceivedDate: '2026-06-17' }, { desc: 'Air Filter', partReceivedDate: '2026-06-19' }],
  },
  part_rejected: {
    vehicle: { id: 1, year: 2022, make: 'Toyota', model: 'Camry', vin8: 'ABC12345', color: 'White', miles: 30000, location: 'PHX' },
    recipient: 'Darren Smith', partDesc: 'Brake Pads Front',
    rejectedReason: 'Wrong part number', rejectedDate: '2026-06-17', categoryKey: 'mechanical',
  },
  part_backorder: {
    vehicle: { id: 1, year: 2022, make: 'Toyota', model: 'Camry', vin8: 'ABC12345', color: 'White', miles: 30000, location: 'PHX' },
    recipient: 'Darren Smith', partDesc: 'Air Filter',
    originalETA: '2026-06-17', newETA: '2026-06-25', categoryKey: 'mechanical',
  },
  recon_approved_for_payment: {
    vehicle: { id: 1, year: 2022, make: 'Toyota', model: 'Camry', vin8: 'ABC12345', color: 'White', miles: 30000, location: 'PHX' },
    vendor: { name: 'Acme Detail' }, category: 'Detail', location: 'PHX', categoryKey: 'detail',
    lineItems: [{ desc: 'Full Detail', price: 250, costType: 'ws' }],
    lockedTotal: 250, lockedWS: 250, lockedRetail: 0,
    approvedBy: 'Darren Smith', approvedDate: '2026-06-15',
  },
  recon_disputed: {
    vehicle: { id: 1, year: 2022, make: 'Toyota', model: 'Camry', vin8: 'ABC12345', color: 'White', miles: 30000, location: 'PHX' },
    vendor: { name: 'Acme Detail' }, category: 'Detail', categoryKey: 'detail',
    reason: 'Interior still dirty in back seat', disputedBy: 'Darren Smith', disputedDate: '2026-06-15',
  },
  vendor_payment_receipt: {
    vendor: { name: 'Acme Detail', email: '' },
    checkNumber: '10042', checkWrittenDate: '2026-06-15', checkMailedDate: '2026-06-15',
    deliveryMethod: 'USPS Mail', totalPaid: 750, paidBy: 'Accounting',
    jobs: [{
      vehicleYear: 2022, vehicleMake: 'Toyota', vehicleModel: 'Camry', vehicleTrim: 'LE',
      vin8: 'ABC12345', categoryIcon: '🧽', categoryLabel: 'Detail', total: 750,
      lineItems: [{ desc: 'Full Detail', price: 750, costType: 'ws' }],
      approvedDate: '2026-06-14', approvedBy: 'Darren Smith',
    }],
  },
};

// GET /api/dev/users — list all active users for the dev switcher
router.get('/users', async (_req: Request, res: Response) => {
  if (process.env.NODE_ENV === 'production') return res.status(404).json({ error: 'Not Found' });
  try {
    const users = (await db.raw(
      `SELECT u.id, u.email, u.first_name, u.last_name, u.role, u.is_buyer, u.is_seller, u.is_ap, u.vendor_tag,
              v.name AS vendor_name
       FROM users u
       LEFT JOIN vendors v ON v.id = u.vendor_id
       WHERE u.active = TRUE ORDER BY u.role, u.first_name`
    )).rows;
    res.json({ users });
  } catch (e: any) {
    console.error('[dev/users]', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/dev/switch-user — instant session swap for QA testing (non-production only)
router.post('/switch-user', async (req: Request, res: Response) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ error: 'Not Found' });
  }
  const { email } = req.body as { email?: string };
  if (!email) return res.status(400).json({ error: 'Missing email' });

  try {
    const user = (await db.raw(
      'SELECT * FROM users WHERE email = ? AND active = TRUE',
      [email.toLowerCase().trim()]
    )).rows[0];

    if (!user) return res.status(404).json({ error: 'User not found' });

    const token = generateToken();
    const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await db.raw(
      'INSERT INTO sessions (user_id, token, expires_at) VALUES (?, ?, ?)',
      [user.id, token, expires]
    );

    res.json({
      ok: true, token,
      user: {
        id: user.id, email: user.email,
        first_name: user.first_name, last_name: user.last_name,
        role: user.role, is_buyer: user.is_buyer, is_seller: user.is_seller,
        is_ap: user.is_ap, location: user.location,
        vendor_tag: user.vendor_tag, vendor_id: user.vendor_id ?? null,
        must_change_password: user.must_change_password,
      },
    });
  } catch (e: any) {
    console.error('[dev/switch-user]', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/test-email', async (req: Request, res: Response) => {
  const { type, to, preview = true } = req.body as { type?: string; to?: string; preview?: boolean };

  if (!to) return res.status(400).json({ error: 'Missing "to" field' });
  if (!type || !ALL_TYPES.includes(type as any)) {
    return res.status(400).json({ error: `"type" must be one of: ${ALL_TYPES.join(', ')}` });
  }

  let subject: string;
  let html: string;

  // Base templates (welcome / password-reset)
  if (type === 'welcome-user') {
    ({ subject, html } = welcomeUserEmail('Test User', to, 'TestPass123!', 'admin', 'PHX'));
  } else if (type === 'welcome-vendor') {
    ({ subject, html } = welcomeVendorEmail('Acme Recon', 'Test Contact', to, 'TestPass123!', ['Paint', 'Detail']));
  } else if (type === 'password-reset') {
    ({ subject, html } = passwordResetEmail('Test User', 'https://fleetcommandrecon.net/reset?token=test-token'));
  } else {
    // Event templates
    const fn = EMAIL_TEMPLATES[type];
    if (!fn) return res.status(400).json({ error: `Unknown type: ${type}` });
    const stub = { ...(STUB_DATA[type] || {}), ...(req.body.data || {}) };
    const rendered = fn(stub);
    if (!rendered) return res.status(400).json({ error: 'Template returned null for stub data' });
    ({ subject, html } = rendered);
  }

  if (preview) {
    return res.set('Content-Type', 'text/html').send(html);
  }

  const result = await sendEmail(to, subject, html);
  if (!result.ok) return res.status(500).json({ error: result.error || 'Send failed' });
  res.json({ ok: true, type, to, subject });
});

router.get('/test-email/types', (_req: Request, res: Response) => {
  res.json({ types: ALL_TYPES });
});

export default router;
