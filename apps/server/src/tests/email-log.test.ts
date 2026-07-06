import { vi, describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';

vi.mock('../lib/db', () => ({ default: { raw: vi.fn() } }));

import app from '../app';
import db from '../lib/db';

const adminUser  = { id: 1, email: 'admin@test.com',  role: 'admin',        is_buyer: true,  is_seller: true  };
const techUser   = { id: 2, email: 'tech@test.com',   role: 'tech_support', is_buyer: false, is_seller: false };
const buyerUser  = { id: 3, email: 'buyer@test.com',  role: 'buyer',        is_buyer: true,  is_seller: false };
const vendorUser = { id: 4, email: 'vendor@test.com', role: 'vendor',       is_buyer: false, is_seller: false };

const mockDb   = db.raw as ReturnType<typeof vi.fn>;
const authHdr  = { Authorization: 'Bearer validtoken' };
const mockAuth = (user = adminUser) => mockDb.mockResolvedValueOnce({ rows: [user] });

beforeEach(() => vi.clearAllMocks());

// ── GET /api/email-log ────────────────────────────────────────────────────────

describe('GET /api/email-log', () => {
  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/email-log');
    expect(res.status).toBe(401);
  });

  it('returns 403 for vendor role', async () => {
    mockAuth(vendorUser);
    const res = await request(app).get('/api/email-log').set(authHdr);
    expect(res.status).toBe(403);
  });

  it('returns email list for admin', async () => {
    mockAuth();
    mockDb.mockResolvedValueOnce({ rows: [
      { id: 'uuid-1', email_type: 'vendor_payment_receipt', recipient: 'vendor@test.com',
        vehicle_id: '42', subject: 'Payment Sent', status: 'sent', error: null,
        created_at: new Date().toISOString(), recipient_name: 'Test Vendor',
        recipient_role: 'vendor', recipient_vendor: 'Acme Paint',
        triggered_by: 'manual', sendgrid_message_id: null },
    ]});
    const res = await request(app).get('/api/email-log').set(authHdr);
    expect(res.status).toBe(200);
    expect(res.body.emails).toHaveLength(1);
    expect(res.body.emails[0].email_type).toBe('vendor_payment_receipt');
  });

  it('does not include body_html in list response (stored separately)', async () => {
    mockAuth();
    mockDb.mockResolvedValueOnce({ rows: [
      { id: 'uuid-2', email_type: 'recon_approved_for_payment', recipient: 'ap@test.com',
        subject: 'Recon Approved', status: 'sent', created_at: new Date().toISOString() },
    ]});
    const res = await request(app).get('/api/email-log').set(authHdr);
    expect(res.status).toBe(200);
    expect(res.body.emails[0]).not.toHaveProperty('body_html');
  });

  it('returns list for buyer role', async () => {
    mockAuth(buyerUser);
    mockDb.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).get('/api/email-log').set(authHdr);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.emails)).toBe(true);
  });
});

// ── DELETE /api/email-log ─────────────────────────────────────────────────────

describe('DELETE /api/email-log', () => {
  it('returns 401 without token', async () => {
    const res = await request(app).delete('/api/email-log');
    expect(res.status).toBe(401);
  });

  it('returns 403 for vendor role', async () => {
    mockAuth(vendorUser);
    const res = await request(app).delete('/api/email-log').set(authHdr);
    expect(res.status).toBe(403);
  });

  it('returns 403 for buyer role', async () => {
    mockAuth(buyerUser);
    const res = await request(app).delete('/api/email-log').set(authHdr);
    expect(res.status).toBe(403);
  });

  it('purges all rows for admin and returns deleted count', async () => {
    mockAuth();
    mockDb.mockResolvedValueOnce({ rows: [], rowCount: 17 });
    const res = await request(app).delete('/api/email-log').set(authHdr);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.deleted).toBe(17);

    const purgeCall = mockDb.mock.calls.find((c: any[]) =>
      String(c[0]).includes('DELETE FROM email_log'));
    expect(purgeCall).toBeDefined();
  });

  it('purges all rows for tech_support role', async () => {
    mockAuth(techUser);
    mockDb.mockResolvedValueOnce({ rows: [], rowCount: 5 });
    const res = await request(app).delete('/api/email-log').set(authHdr);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.deleted).toBe(5);
  });
});

// ── GET /api/email-log/:id/preview ───────────────────────────────────────────

describe('GET /api/email-log/:id/preview', () => {
  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/email-log/uuid-1/preview');
    expect(res.status).toBe(401);
  });

  it('returns 403 for vendor role', async () => {
    mockAuth(vendorUser);
    const res = await request(app).get('/api/email-log/uuid-1/preview').set(authHdr);
    expect(res.status).toBe(403);
  });

  it('returns 404 when log entry does not exist', async () => {
    mockAuth();
    mockDb.mockResolvedValueOnce({ rows: [] }); // row not found
    const res = await request(app).get('/api/email-log/nonexistent/preview').set(authHdr);
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/not found/i);
  });

  it('returns 404 when log entry has no body_html stored', async () => {
    mockAuth();
    mockDb.mockResolvedValueOnce({ rows: [{ body_html: null, subject: 'Test Email' }] });
    const res = await request(app).get('/api/email-log/uuid-no-html/preview').set(authHdr);
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/no preview/i);
  });

  it('returns subject and html for a log entry with body_html', async () => {
    mockAuth();
    mockDb.mockResolvedValueOnce({ rows: [
      { body_html: '<html><body>Payment receipt</body></html>', subject: 'Payment Sent — Acme Paint' },
    ]});
    const res = await request(app).get('/api/email-log/uuid-1/preview').set(authHdr);
    expect(res.status).toBe(200);
    expect(res.body.subject).toBe('Payment Sent — Acme Paint');
    expect(res.body.html).toContain('Payment receipt');
  });

  it('preview available for buyer role too', async () => {
    mockAuth(buyerUser);
    mockDb.mockResolvedValueOnce({ rows: [
      { body_html: '<p>email</p>', subject: 'Test' },
    ]});
    const res = await request(app).get('/api/email-log/uuid-2/preview').set(authHdr);
    expect(res.status).toBe(200);
  });
});
