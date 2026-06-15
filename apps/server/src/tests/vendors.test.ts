import { vi, describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';

vi.mock('../lib/db', () => ({ default: { raw: vi.fn() } }));

import app from '../app';
import db from '../lib/db';

const adminUser = { id: 1, email: 'admin@test.com', role: 'admin', is_buyer: true, is_seller: true };
const mockDb = db.raw as ReturnType<typeof vi.fn>;
const mockAuth = () => mockDb.mockResolvedValueOnce({ rows: [adminUser] });
const authHeader = { Authorization: 'Bearer validtoken' };

beforeEach(() => vi.clearAllMocks());

// ── GET /api/vendors ──────────────────────────────────────────────────────────

describe('GET /api/vendors', () => {
  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/vendors');
    expect(res.status).toBe(401);
  });

  it('returns vendor list for authenticated user', async () => {
    mockAuth();
    mockDb.mockResolvedValueOnce({ rows: [{ id: 1, name: 'Acme Paint', payment_terms: 'weekly' }] });
    const res = await request(app).get('/api/vendors').set(authHeader);
    expect(res.status).toBe(200);
    expect(res.body.vendors).toHaveLength(1);
    expect(res.body.vendors[0].name).toBe('Acme Paint');
  });
});

// ── POST /api/vendors ─────────────────────────────────────────────────────────

describe('POST /api/vendors', () => {
  it('returns 401 without token', async () => {
    const res = await request(app).post('/api/vendors').send({ name: 'Test' });
    expect(res.status).toBe(401);
  });

  it('returns 400 when name is missing', async () => {
    mockAuth();
    const res = await request(app).post('/api/vendors').set(authHeader).send({ categories: ['paint'] });
    expect(res.status).toBe(400);
  });

  it('creates a new vendor with default payment terms', async () => {
    mockAuth();
    mockDb.mockResolvedValueOnce({ rows: [] });              // name uniqueness check
    mockDb.mockResolvedValueOnce({ rows: [{ id: 5 }] });    // INSERT
    const res = await request(app).post('/api/vendors').set(authHeader)
      .send({ name: 'Acme Paint', categories: ['paint'] });
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(5);
    const insertCall = mockDb.mock.calls.find((c: any[]) => String(c[0]).includes('INSERT'));
    expect(insertCall[1]).toContain('weekly');
    expect(insertCall[1]).toContain('Friday');
    expect(insertCall[1]).toContain('USPS Mail');
  });

  it('saves custom payment terms on create', async () => {
    mockAuth();
    mockDb.mockResolvedValueOnce({ rows: [] });
    mockDb.mockResolvedValueOnce({ rows: [{ id: 6 }] });
    const res = await request(app).post('/api/vendors').set(authHeader)
      .send({ name: 'Fast Paint', categories: ['paint'], payment_terms: 'completion', delivery_method: 'FedEx/UPS' });
    expect(res.status).toBe(200);
    const insertCall = mockDb.mock.calls.find((c: any[]) => String(c[0]).includes('INSERT'));
    expect(insertCall[1]).toContain('completion');
    expect(insertCall[1]).toContain('FedEx/UPS');
  });

  it('updates existing vendor if name already exists', async () => {
    mockAuth();
    mockDb.mockResolvedValueOnce({ rows: [{ id: 3, email: 'existing@test.com', active: true }] }); // existing
    mockDb.mockResolvedValueOnce({ rows: [] }); // UPDATE
    const res = await request(app).post('/api/vendors').set(authHeader)
      .send({ name: 'Acme Paint', categories: ['paint'] });
    expect(res.status).toBe(200);
    expect(res.body.updated).toBe(true);
  });
});

// ── PUT /api/vendors/:id ──────────────────────────────────────────────────────

describe('PUT /api/vendors/:id', () => {
  it('returns 401 without token', async () => {
    const res = await request(app).put('/api/vendors/1').send({ name: 'New Name' });
    expect(res.status).toBe(401);
  });

  it('returns 400 when no fields provided', async () => {
    mockAuth();
    const res = await request(app).put('/api/vendors/1').set(authHeader).send({});
    expect(res.status).toBe(400);
  });

  it('updates payment terms fields', async () => {
    mockAuth();
    mockDb.mockResolvedValueOnce({ rows: [] });   // UPDATE vendors
    mockDb.mockResolvedValueOnce({ rows: [{ name: 'Acme', email: 'a@test.com', contact_name: 'Bob', phone: '555', categories: '[]' }] }); // re-fetch for user sync
    const res = await request(app).put('/api/vendors/1').set(authHeader)
      .send({ payment_terms: 'completion', cutoff_day: 'Monday', delivery_method: 'FedEx/UPS' });
    expect(res.status).toBe(200);
    const updateCall = mockDb.mock.calls.find((c: any[]) => String(c[0]).includes('UPDATE vendors'));
    expect(updateCall[1]).toContain('completion');
    expect(updateCall[1]).toContain('Monday');
    expect(updateCall[1]).toContain('FedEx/UPS');
  });
});

// ── DELETE /api/vendors/:id ───────────────────────────────────────────────────

describe('DELETE /api/vendors/:id', () => {
  it('returns 401 without token', async () => {
    const res = await request(app).delete('/api/vendors/1');
    expect(res.status).toBe(401);
  });

  it('soft-deletes the vendor', async () => {
    mockAuth();
    mockDb.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).delete('/api/vendors/1').set(authHeader);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});
