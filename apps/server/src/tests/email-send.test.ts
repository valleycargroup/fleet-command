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
    // resolveRecipients call sequence for vendor_payment_receipt with vendor.name + direct vendor.email:
    //   1. vendor prefs fetch (SELECT id, email_prefs FROM vendors WHERE name = ?)
    //   2. findVendorEmail primary join  → empty (no primary_user_id email)
    //   3. findVendorEmail fallback join → empty
    //   vendor_payment_receipt block: vendor.email present → added directly
    //   4. cc_admins_categories check (try-catch)
    //   5. recipientMeta query (try-catch)
    mockDb.mockResolvedValueOnce({ rows: [] }); // vendor prefs
    mockDb.mockResolvedValueOnce({ rows: [] }); // findVendorEmail: primary join (no email)
    mockDb.mockResolvedValueOnce({ rows: [] }); // findVendorEmail: fallback join (no email)
    mockDb.mockResolvedValueOnce({ rows: [] }); // cc_admins_categories
    mockDb.mockResolvedValueOnce({ rows: [] }); // recipientMeta

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
    // resolveRecipients call sequence:
    //   vendor.email provided directly → added without DB lookup
    //   1. AP team query (role='ap' OR is_ap=TRUE)
    //   2. cc_admins_categories check (try-catch)
    //   3. recipientMeta query (try-catch)
    mockDb.mockResolvedValueOnce({ rows: [
      { email: 'ap1@dealer.com' },
      { email: 'ap2@dealer.com' },
    ]});
    mockDb.mockResolvedValueOnce({ rows: [] }); // cc_admins_categories
    mockDb.mockResolvedValueOnce({ rows: [] }); // recipientMeta

    const res = await request(app).post('/api/email/send').send({
      type: 'recon_approved_for_payment',
      data: {
        vehicle: { id: 'db_1', year: 2021, make: 'Honda', model: 'Civic', vin: 'TESTVIN001' },
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
    // No vendor in data → skips vendor block; AP team query returns empty
    //   1. AP team query → empty
    //   (cc_admins and recipientMeta calls fail gracefully via try-catch with undefined)
    mockDb.mockResolvedValueOnce({ rows: [] }); // AP team query

    const res = await request(app).post('/api/email/send').send({
      type: 'recon_approved_for_payment',
      data: { vehicle: { id: 'db_2', year: 2020, make: 'Ford', model: 'F-150' }, category: 'Tires', total: 300 },
    });
    expect(res.status).toBe(200);
    expect(res.body.recipients).toHaveLength(0);
  });

  it('sends vendor_payment_receipt via vendors-table lookup when no direct email', async () => {
    // resolveRecipients call sequence for vendor_payment_receipt with vendor.name, no vendor.email:
    //   1. vendor prefs fetch
    //   2. findVendorEmail primary join → found 'found@vendor.com'  (returns early, no fallback)
    //   vendor_payment_receipt block: no direct email → findUserEmailByName(vendorName)
    //   3. first+last query (returns nothing)
    //   4. first-only fallback (returns nothing)
    //   5. cc_admins_categories
    //   6. recipientMeta
    mockDb.mockResolvedValueOnce({ rows: [] });                              // vendor prefs
    mockDb.mockResolvedValueOnce({ rows: [{ email: 'found@vendor.com' }] }); // findVendorEmail: hit
    mockDb.mockResolvedValueOnce({ rows: [] }); // findUserEmailByName: first+last
    mockDb.mockResolvedValueOnce({ rows: [] }); // findUserEmailByName: first-only
    mockDb.mockResolvedValueOnce({ rows: [] }); // cc_admins_categories
    mockDb.mockResolvedValueOnce({ rows: [] }); // recipientMeta

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
