import { vi, describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';

vi.mock('../lib/db', () => ({ default: { raw: vi.fn() } }));
vi.mock('../lib/email', () => ({
  sendEmail: vi.fn().mockResolvedValue({ ok: true }),
  logEmail: vi.fn().mockResolvedValue(undefined),
  APP_URL: 'https://test.example.com',
}));

import app from '../app';
import db from '../lib/db';

const mockDb = db.raw as ReturnType<typeof vi.fn>;

beforeEach(() => vi.clearAllMocks());

// ── POST /api/email/send ──────────────────────────────────────────────────────

describe('POST /api/email/send', () => {
  it('returns 400 when type is missing', async () => {
    const res = await request(app).post('/api/email/send').send({ data: {} });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/missing/i);
  });

  it('returns 400 for unknown email type', async () => {
    const res = await request(app).post('/api/email/send').send({ type: 'not_a_real_type' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/unknown email type/i);
  });

  it('sends vendor_payment_receipt to the vendor email address', async () => {
    // resolveRecipients: type.startsWith('vendor_') → findVendorEmail (returns nothing)
    // then vendor_payment_receipt block: data.vendor.email is present, added directly (no extra DB call)
    mockDb.mockResolvedValueOnce({ rows: [] }); // findVendorEmail by vendor name

    const res = await request(app).post('/api/email/send').send({
      type: 'vendor_payment_receipt',
      data: {
        vendor: { name: 'Acme Paint', email: 'acme@shop.com' },
        checkNumber: '1001',
        checkWrittenDate: '2026-06-20',
        checkMailedDate: '2026-06-20',
        deliveryMethod: 'USPS Mail',
        totalPaid: 750,
        totalWS: 600,
        totalRetail: 150,
        paidBy: 'Jane AP',
        jobs: [],
      },
    });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.recipients).toContain('acme@shop.com');
  });

  it('sends recon_approved_for_payment to vendor + all AP staff', async () => {
    // vendor.email provided directly → no findUserEmailByName call needed
    // one db.raw for the AP team query (role = 'ap' OR is_ap = TRUE)
    mockDb.mockResolvedValueOnce({ rows: [
      { email: 'ap1@dealer.com' },
      { email: 'ap2@dealer.com' },
    ]});

    const res = await request(app).post('/api/email/send').send({
      type: 'recon_approved_for_payment',
      data: {
        vehicle: { id: 1, year: 2021, make: 'Honda', model: 'Civic', vin: 'TESTVIN001' },
        category: 'Detail',
        vendor: { name: 'Acme Detail', email: 'acme@detail.com' },
        total: 200,
        approvedBy: 'Buyer Bob',
      },
    });
    expect(res.status).toBe(200);
    expect(res.body.recipients).toContain('acme@detail.com');
    expect(res.body.recipients).toContain('ap1@dealer.com');
    expect(res.body.recipients).toContain('ap2@dealer.com');
    expect(res.body.results).toHaveLength(3);
  });

  it('returns 200 with empty recipients when no AP staff found', async () => {
    // No vendor in data → skips findUserEmailByName; AP team query returns empty
    mockDb.mockResolvedValueOnce({ rows: [] });

    const res = await request(app).post('/api/email/send').send({
      type: 'recon_approved_for_payment',
      data: { vehicle: { id: 2, year: 2020, make: 'Ford', model: 'F-150' }, category: 'Tires', total: 300 },
    });
    expect(res.status).toBe(200);
    expect(res.body.recipients).toHaveLength(0);
  });

  it('sends vendor_payment_receipt via vendors-table lookup when no direct email', async () => {
    // Call sequence in resolveRecipients for a 2-word vendor name with no data.vendor.email:
    //   1. type.startsWith('vendor_') → findVendorEmail(name) [vendors table] → found
    //   2. vendor_payment_receipt block: data.vendor.email missing → findUserEmailByName(name) [users table]
    //      → first+last query (returns nothing)
    //      → first-only query (returns nothing)
    mockDb.mockResolvedValueOnce({ rows: [{ email: 'found@vendor.com' }] }); // findVendorEmail: hit
    mockDb.mockResolvedValueOnce({ rows: [] }); // findUserEmailByName: first+last query
    mockDb.mockResolvedValueOnce({ rows: [] }); // findUserEmailByName: first-only fallthrough

    const res = await request(app).post('/api/email/send').send({
      type: 'vendor_payment_receipt',
      data: {
        vendor: { name: 'Found Vendor' },
        checkNumber: '2002',
        checkWrittenDate: '2026-06-20',
        checkMailedDate: '2026-06-20',
        deliveryMethod: 'FedEx/UPS',
        totalPaid: 1200,
        totalWS: 1000,
        totalRetail: 200,
        paidBy: 'Bob AP',
        jobs: [],
      },
    });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.recipients).toContain('found@vendor.com');
  });
});
