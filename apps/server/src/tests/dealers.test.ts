import { vi, describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';

vi.mock('../lib/db', () => ({ default: { raw: vi.fn() } }));

import app from '../app';
import db from '../lib/db';

const adminUser  = { id: 1, email: 'admin@test.com',  role: 'admin',       is_buyer: true,  is_seller: true  };
const techUser   = { id: 2, email: 'tech@test.com',   role: 'tech_support', is_buyer: false, is_seller: false };
const vendorUser = { id: 3, email: 'vendor@test.com', role: 'vendor',       is_buyer: false, is_seller: false };
const buyerUser  = { id: 4, email: 'buyer@test.com',  role: 'buyer',        is_buyer: true,  is_seller: false };

const mockDb   = db.raw as ReturnType<typeof vi.fn>;
const authHdr  = { Authorization: 'Bearer validtoken' };
const mockAuth = (user = adminUser) => mockDb.mockResolvedValueOnce({ rows: [user] });

beforeEach(() => vi.clearAllMocks());

// ── GET /api/dealers ──────────────────────────────────────────────────────────

describe('GET /api/dealers', () => {
  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/dealers');
    expect(res.status).toBe(401);
  });

  it('returns dealer list for admin', async () => {
    mockAuth();
    mockDb.mockResolvedValueOnce({ rows: [
      { id: 1, name: 'Premier Auto Group', email: 'premier@dealer.com', phone: '555-1000',
        address: '100 Main St', city: 'Phoenix', state: 'AZ', zip_code: '85001',
        responsible_for_pickup: false, auction_id: null, created_at: new Date().toISOString() },
    ]});
    const res = await request(app).get('/api/dealers').set(authHdr);
    expect(res.status).toBe(200);
    expect(res.body.dealers).toHaveLength(1);
    expect(res.body.dealers[0].name).toBe('Premier Auto Group');
  });

  it('returns dealer list for buyer role', async () => {
    mockAuth(buyerUser);
    mockDb.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).get('/api/dealers').set(authHdr);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.dealers)).toBe(true);
  });
});

// ── POST /api/dealers ─────────────────────────────────────────────────────────

describe('POST /api/dealers', () => {
  it('returns 401 without token', async () => {
    const res = await request(app).post('/api/dealers').send({ name: 'Test' });
    expect(res.status).toBe(401);
  });

  it('returns 403 for vendor role', async () => {
    mockAuth(vendorUser);
    const res = await request(app).post('/api/dealers').set(authHdr).send({ name: 'Test' });
    expect(res.status).toBe(403);
  });

  it('returns 403 for buyer role', async () => {
    mockAuth(buyerUser);
    const res = await request(app).post('/api/dealers').set(authHdr).send({ name: 'Test' });
    expect(res.status).toBe(403);
  });

  it('returns 400 when name is missing', async () => {
    mockAuth();
    const res = await request(app).post('/api/dealers').set(authHdr).send({ email: 'test@dealer.com' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/name/i);
  });

  it('creates dealer for admin', async () => {
    mockAuth();
    mockDb.mockResolvedValueOnce({ rows: [{ id: 5, name: 'New Dealer', email: 'new@dealer.com' }] });
    const res = await request(app).post('/api/dealers').set(authHdr)
      .send({ name: 'New Dealer', email: 'new@dealer.com', phone: '555-9999', city: 'Dallas', state: 'TX' });
    expect(res.status).toBe(200);
    expect(res.body.dealer.name).toBe('New Dealer');
    expect(res.body.dealer.id).toBe(5);
  });

  it('creates dealer for tech_support role (§18)', async () => {
    mockAuth(techUser);
    mockDb.mockResolvedValueOnce({ rows: [{ id: 6, name: 'Tech Dealer' }] });
    const res = await request(app).post('/api/dealers').set(authHdr).send({ name: 'Tech Dealer' });
    expect(res.status).toBe(200);
    expect(res.body.dealer).toBeDefined();
  });
});

// ── PUT /api/dealers/:id ──────────────────────────────────────────────────────

describe('PUT /api/dealers/:id', () => {
  it('returns 401 without token', async () => {
    const res = await request(app).put('/api/dealers/1').send({ name: 'X' });
    expect(res.status).toBe(401);
  });

  it('returns 403 for vendor role', async () => {
    mockAuth(vendorUser);
    const res = await request(app).put('/api/dealers/1').set(authHdr).send({ name: 'X' });
    expect(res.status).toBe(403);
  });

  it('updates dealer for admin', async () => {
    mockAuth();
    mockDb.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).put('/api/dealers/1').set(authHdr)
      .send({ name: 'Updated Dealer', email: 'updated@dealer.com', phone: '555-0001',
              city: 'Phoenix', state: 'AZ', zip_code: '85001', responsible_for_pickup: true });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('updates dealer for tech_support role (§18)', async () => {
    mockAuth(techUser);
    mockDb.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).put('/api/dealers/1').set(authHdr).send({ name: 'Tech Updated' });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});

// ── DELETE /api/dealers/:id ───────────────────────────────────────────────────

describe('DELETE /api/dealers/:id', () => {
  it('returns 401 without token', async () => {
    const res = await request(app).delete('/api/dealers/1');
    expect(res.status).toBe(401);
  });

  it('returns 403 for vendor role', async () => {
    mockAuth(vendorUser);
    const res = await request(app).delete('/api/dealers/1').set(authHdr);
    expect(res.status).toBe(403);
  });

  it('soft-deletes dealer for admin', async () => {
    mockAuth();
    mockDb.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).delete('/api/dealers/1').set(authHdr);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);

    const deleteCall = mockDb.mock.calls.find((c: any[]) =>
      String(c[0]).includes('UPDATE dealers SET active = FALSE'));
    expect(deleteCall).toBeDefined();
    expect(deleteCall![1]).toContain('1');
  });

  it('soft-deletes dealer for tech_support role (§18)', async () => {
    mockAuth(techUser);
    mockDb.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).delete('/api/dealers/1').set(authHdr);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});
