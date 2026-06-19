import { Router, Request, Response } from 'express';
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

router.post('/test-email', async (req: Request, res: Response) => {
  const { type, to } = req.body as { type?: string; to?: string };

  if (!to) return res.status(400).json({ error: 'Missing "to" field' });
  if (!type || !ALL_TYPES.includes(type as any)) {
    return res.status(400).json({ error: `"type" must be one of: ${ALL_TYPES.join(', ')}` });
  }

  // Base templates (welcome / password-reset)
  if (type === 'welcome-user') {
    const { subject, html } = welcomeUserEmail('Test User', to, 'TestPass123!', 'admin', 'PHX');
    const result = await sendEmail(to, subject, html);
    if (!result.ok) return res.status(500).json({ error: result.error || 'Send failed' });
    return res.json({ ok: true, type, to, subject });
  }
  if (type === 'welcome-vendor') {
    const { subject, html } = welcomeVendorEmail('Acme Recon', 'Test Contact', to, 'TestPass123!', ['Paint', 'Detail']);
    const result = await sendEmail(to, subject, html);
    if (!result.ok) return res.status(500).json({ error: result.error || 'Send failed' });
    return res.json({ ok: true, type, to, subject });
  }
  if (type === 'password-reset') {
    const { subject, html } = passwordResetEmail('Test User', 'https://fleetcommandrecon.net/reset?token=test-token');
    const result = await sendEmail(to, subject, html);
    if (!result.ok) return res.status(500).json({ error: result.error || 'Send failed' });
    return res.json({ ok: true, type, to, subject });
  }

  // Event templates
  const fn = EMAIL_TEMPLATES[type];
  if (!fn) return res.status(400).json({ error: `Unknown type: ${type}` });

  const stub = STUB_DATA[type] || {};
  const rendered = fn(stub);
  if (!rendered) return res.status(400).json({ error: 'Template returned null for stub data' });

  const result = await sendEmail(to, rendered.subject, rendered.html);
  if (!result.ok) return res.status(500).json({ error: result.error || 'Send failed' });

  res.json({ ok: true, type, to, subject: rendered.subject });
});

router.get('/test-email/types', (_req: Request, res: Response) => {
  res.json({ types: ALL_TYPES });
});

export default router;
