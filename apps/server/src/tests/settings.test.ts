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

// ── GET /api/settings ─────────────────────────────────────────────────────────

describe('GET /api/settings', () => {
  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/settings');
    expect(res.status).toBe(401);
  });

  it('returns all settings plus server_timezone for admin', async () => {
    mockAuth();
    mockDb.mockResolvedValueOnce({ rows: [
      { key: 'digest_weekly_day',  value: 'Friday' },
      { key: 'digest_weekly_hour', value: '15' },
      { key: 'digest_daily_hours', value: '9,13' },
    ]});
    const res = await request(app).get('/api/settings').set(authHdr);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data.digest_weekly_day).toBe('Friday');
    expect(res.body.data.digest_weekly_hour).toBe('15');
    expect(typeof res.body.data.server_timezone).toBe('string');
    expect(res.body.data.server_timezone.length).toBeGreaterThan(0);
  });

  it('server_timezone is always present even with no rows', async () => {
    mockAuth();
    mockDb.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).get('/api/settings').set(authHdr);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('server_timezone');
  });

  it('returns settings for vendor role (read is unrestricted)', async () => {
    mockAuth(vendorUser);
    mockDb.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).get('/api/settings').set(authHdr);
    expect(res.status).toBe(200);
  });

  it('returns settings for buyer role', async () => {
    mockAuth(buyerUser);
    mockDb.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).get('/api/settings').set(authHdr);
    expect(res.status).toBe(200);
  });
});

// ── PUT /api/settings/:key ────────────────────────────────────────────────────

describe('PUT /api/settings/:key', () => {
  it('returns 401 without token', async () => {
    const res = await request(app).put('/api/settings/digest_weekly_day').send({ value: 'Monday' });
    expect(res.status).toBe(401);
  });

  it('returns 403 for vendor role', async () => {
    mockAuth(vendorUser);
    const res = await request(app).put('/api/settings/digest_weekly_day').set(authHdr).send({ value: 'Monday' });
    expect(res.status).toBe(403);
  });

  it('returns 403 for buyer role', async () => {
    mockAuth(buyerUser);
    const res = await request(app).put('/api/settings/digest_weekly_day').set(authHdr).send({ value: 'Monday' });
    expect(res.status).toBe(403);
  });

  it('upserts setting for admin', async () => {
    mockAuth();
    mockDb.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).put('/api/settings/digest_weekly_day').set(authHdr).send({ value: 'Wednesday' });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);

    const upsertCall = mockDb.mock.calls.find((c: any[]) =>
      String(c[0]).includes('INSERT INTO site_settings'));
    expect(upsertCall).toBeDefined();
    expect(upsertCall![1]).toContain('digest_weekly_day');
    expect(upsertCall![1]).toContain('Wednesday');
  });

  it('upserts setting for tech_support role (§18)', async () => {
    mockAuth(techUser);
    mockDb.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).put('/api/settings/digest_weekly_hour').set(authHdr).send({ value: '10' });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('coerces numeric value to string in upsert', async () => {
    mockAuth();
    mockDb.mockResolvedValueOnce({ rows: [] });
    await request(app).put('/api/settings/digest_weekly_hour').set(authHdr).send({ value: 14 });

    const upsertCall = mockDb.mock.calls.find((c: any[]) =>
      String(c[0]).includes('INSERT INTO site_settings'));
    expect(upsertCall).toBeDefined();
    expect(upsertCall![1]).toContain('14'); // String(14) = '14'
  });
});
