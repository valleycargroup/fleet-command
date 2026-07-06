import { vi, describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';

vi.mock('../lib/db', () => ({ default: { raw: vi.fn() } }));
vi.mock('../lib/paymentBatch', () => ({
  buildVendorPaymentQueue: vi.fn().mockResolvedValue([]),
  runVendorDigest:         vi.fn().mockResolvedValue(undefined),
}));

import app from '../app';
import db from '../lib/db';
import { buildVendorPaymentQueue, runVendorDigest } from '../lib/paymentBatch';

const adminUser  = { id: 1, email: 'admin@test.com',  role: 'admin',  is_buyer: true,  is_seller: true  };
const vendorUser = { id: 2, email: 'vendor@test.com', role: 'vendor', is_buyer: false, is_seller: false };
const buyerUser  = { id: 3, email: 'buyer@test.com',  role: 'buyer',  is_buyer: true,  is_seller: false };

const mockDb       = db.raw as ReturnType<typeof vi.fn>;
const mockBuildQ   = buildVendorPaymentQueue as ReturnType<typeof vi.fn>;
const mockDigest   = runVendorDigest as ReturnType<typeof vi.fn>;
const authHeader   = { Authorization: 'Bearer validtoken' };
const mockAuth     = (user = adminUser) => mockDb.mockResolvedValueOnce({ rows: [user] });
const mockSettings = () => mockDb.mockResolvedValueOnce({ rows: [] }); // returns DEFAULTS

beforeEach(() => vi.clearAllMocks());

// ── GET /api/payments/queue ───────────────────────────────────────────────────

describe('GET /api/payments/queue', () => {
  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/payments/queue');
    expect(res.status).toBe(401);
  });

  it('returns 403 for vendor role', async () => {
    mockAuth(vendorUser);
    const res = await request(app).get('/api/payments/queue').set(authHeader);
    expect(res.status).toBe(403);
  });

  it('returns 200 with queue array for admin', async () => {
    mockAuth(); mockSettings();
    const res = await request(app).get('/api/payments/queue').set(authHeader);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.queue)).toBe(true);
  });

  it('_debug contains required fields', async () => {
    mockAuth(); mockSettings();
    const res = await request(app).get('/api/payments/queue').set(authHeader);
    const d = res.body._debug;
    expect(d).toBeDefined();
    expect(d.serverTime).toMatch(/^\d{4}-\d{2}-\d{2}T/);   // ISO timestamp
    expect(typeof d.serverDay).toBe('string');
    expect(typeof d.serverHour).toBe('number');
    expect(d.timezone).toBe('America/Phoenix');
    expect(d.settings).toMatchObject({
      dailyHours: expect.any(Array),
      weeklyDay:  expect.any(String),
      weeklyHour: expect.any(Number),
    });
  });

  it('passes DB-loaded settings to buildVendorPaymentQueue', async () => {
    mockAuth();
    mockDb.mockResolvedValueOnce({ rows: [
      { key: 'digest_daily_hours', value: '9,13' },
      { key: 'digest_weekly_day',  value: 'Thursday' },
      { key: 'digest_weekly_hour', value: '14' },
    ]});

    await request(app).get('/api/payments/queue').set(authHeader);
    expect(mockBuildQ).toHaveBeenCalledWith(
      expect.objectContaining({ weeklyDay: 'Thursday', weeklyHour: 14, dailyHours: [9, 13] })
    );
  });

  it('returns isDue flags on each queue entry', async () => {
    mockAuth(); mockSettings();
    mockBuildQ.mockResolvedValueOnce([
      { vendorName: 'Acme',  isDue: true,  jobs: [], total: 500 },
      { vendorName: 'Bravo', isDue: false, jobs: [], total: 200 },
    ]);
    const res = await request(app).get('/api/payments/queue').set(authHeader);
    expect(res.body.queue).toHaveLength(2);
    expect(res.body.queue[0].isDue).toBe(true);
    expect(res.body.queue[1].isDue).toBe(false);
  });
});

// ── POST /api/payments/trigger-digest ────────────────────────────────────────

describe('POST /api/payments/trigger-digest', () => {
  it('returns 401 without token', async () => {
    const res = await request(app).post('/api/payments/trigger-digest');
    expect(res.status).toBe(401);
  });

  it('returns 403 for vendor role', async () => {
    mockAuth(vendorUser);
    const res = await request(app).post('/api/payments/trigger-digest').set(authHeader);
    expect(res.status).toBe(403);
  });

  it('returns 403 for buyer role', async () => {
    mockAuth(buyerUser);
    const res = await request(app).post('/api/payments/trigger-digest').set(authHeader);
    expect(res.status).toBe(403);
  });

  it('returns 200 and triggers digest for admin', async () => {
    mockAuth(); mockSettings();
    const res = await request(app).post('/api/payments/trigger-digest').set(authHeader);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(mockDigest).toHaveBeenCalledOnce();
  });

  it('defaults to forceAll=true when no body sent', async () => {
    mockAuth(); mockSettings();
    await request(app).post('/api/payments/trigger-digest').set(authHeader);
    expect(mockDigest).toHaveBeenCalledWith(expect.any(Object), true, 'manual');
  });

  it('passes force:true as forceAll=true', async () => {
    mockAuth(); mockSettings();
    await request(app).post('/api/payments/trigger-digest').set(authHeader).send({ force: true });
    expect(mockDigest).toHaveBeenCalledWith(expect.any(Object), true, 'manual');
  });

  it('passes force:false as forceAll=false (live schedule)', async () => {
    mockAuth(); mockSettings();
    await request(app).post('/api/payments/trigger-digest').set(authHeader).send({ force: false });
    expect(mockDigest).toHaveBeenCalledWith(expect.any(Object), false, 'manual');
  });

  it('passes DB-loaded settings to runVendorDigest', async () => {
    mockAuth();
    mockDb.mockResolvedValueOnce({ rows: [
      { key: 'digest_weekly_day',  value: 'Wednesday' },
      { key: 'digest_weekly_hour', value: '10' },
    ]});
    await request(app).post('/api/payments/trigger-digest').set(authHeader);
    expect(mockDigest).toHaveBeenCalledWith(
      expect.objectContaining({ weeklyDay: 'Wednesday', weeklyHour: 10 }),
      true,
      'manual',
    );
  });
});
