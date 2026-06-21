import { vi, describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';

vi.mock('../lib/db', () => ({ default: { raw: vi.fn() } }));
vi.mock('bcryptjs', () => ({ default: { hash: vi.fn().mockResolvedValue('$2b$hash'), compare: vi.fn() } }));

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

  it('returns vendor list with contact info from JOIN', async () => {
    mockAuth();
    mockDb.mockResolvedValueOnce({ rows: [{
      id: 1, name: 'Acme Paint', payment_terms: 'weekly', office_phone: '555-0100',
      first_name: 'Bob', last_name: 'Smith', contact_email: 'bob@acme.com', contact_phone: '555-0101',
      primary_user_id: 10,
    }] });
    const res = await request(app).get('/api/vendors').set(authHeader);
    expect(res.status).toBe(200);
    expect(res.body.vendors).toHaveLength(1);
    expect(res.body.vendors[0].name).toBe('Acme Paint');
    expect(res.body.vendors[0].contact_name).toBe('Bob Smith');
    expect(res.body.vendors[0].email).toBe('bob@acme.com');
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
    const res = await request(app).post('/api/vendors').set(authHeader).send({ email: 'x@x.com' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when email is missing', async () => {
    mockAuth();
    const res = await request(app).post('/api/vendors').set(authHeader).send({ name: 'Acme' });
    expect(res.status).toBe(400);
  });

  it('creates a new vendor and user with default payment terms', async () => {
    mockAuth();
    mockDb.mockResolvedValueOnce({ rows: [] });              // no existing user
    mockDb.mockResolvedValueOnce({ rows: [{ id: 9 }] });    // INSERT user RETURNING id
    mockDb.mockResolvedValueOnce({ rows: [] });              // no existing vendor by name
    mockDb.mockResolvedValueOnce({ rows: [{ id: 5 }] });    // INSERT vendor RETURNING id
    mockDb.mockResolvedValueOnce({ rows: [] });              // UPDATE user vendor_id

    const res = await request(app).post('/api/vendors').set(authHeader)
      .send({ name: 'Acme Paint', email: 'bob@acme.com', contact_name: 'Bob Smith',
              phone: '555-0101', categories: ['paint'], password: 'Secret1!' });
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(5);

    const insertVendorCall = mockDb.mock.calls.find((c: any[]) => String(c[0]).includes('INSERT INTO vendors'));
    expect(insertVendorCall).toBeDefined();
    const vals = insertVendorCall![1] as any[];
    expect(vals).toContain('weekly');
    expect(vals).toContain('Friday');
    expect(vals).toContain('USPS Mail');
  });

  it('saves custom payment terms', async () => {
    mockAuth();
    mockDb.mockResolvedValueOnce({ rows: [] });
    mockDb.mockResolvedValueOnce({ rows: [{ id: 9 }] });
    mockDb.mockResolvedValueOnce({ rows: [] });
    mockDb.mockResolvedValueOnce({ rows: [{ id: 6 }] });
    mockDb.mockResolvedValueOnce({ rows: [] });

    const res = await request(app).post('/api/vendors').set(authHeader)
      .send({ name: 'Fast Paint', email: 'fast@paint.com', contact_name: 'Jane', phone: '555',
              categories: ['paint'], password: 'Secret1!',
              payment_terms: 'completion', delivery_method: 'FedEx/UPS' });
    expect(res.status).toBe(200);

    const insertVendorCall = mockDb.mock.calls.find((c: any[]) => String(c[0]).includes('INSERT INTO vendors'));
    expect(insertVendorCall).toBeDefined();
    const vals = insertVendorCall![1] as any[];
    expect(vals).toContain('completion');
    expect(vals).toContain('FedEx/UPS');
  });

  it('updates existing vendor if name already exists', async () => {
    mockAuth();
    mockDb.mockResolvedValueOnce({ rows: [{ id: 7, role: 'vendor' }] }); // existing user
    mockDb.mockResolvedValueOnce({ rows: [] });                           // UPDATE user
    mockDb.mockResolvedValueOnce({ rows: [{ id: 3 }] });                 // existing vendor by name
    mockDb.mockResolvedValueOnce({ rows: [] });                           // UPDATE vendor
    mockDb.mockResolvedValueOnce({ rows: [] });                           // UPDATE user vendor_id

    const res = await request(app).post('/api/vendors').set(authHeader)
      .send({ name: 'Acme Paint', email: 'bob@acme.com', contact_name: 'Bob', phone: '555', categories: ['paint'] });
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

  it('returns 404 when vendor not found', async () => {
    mockAuth();
    mockDb.mockResolvedValueOnce({ rows: [] }); // vendor not found
    const res = await request(app).put('/api/vendors/999').set(authHeader).send({ name: 'X' });
    expect(res.status).toBe(404);
  });

  it('updates vendor company fields', async () => {
    mockAuth();
    mockDb.mockResolvedValueOnce({ rows: [{ id: 1, name: 'Acme', primary_user_id: 7 }] }); // fetch vendor
    mockDb.mockResolvedValueOnce({ rows: [] }); // UPDATE vendors
    // no email/contact in body so no user sync

    const res = await request(app).put('/api/vendors/1').set(authHeader)
      .send({ payment_terms: 'completion', cutoff_day: 'Monday', delivery_method: 'FedEx/UPS' });
    expect(res.status).toBe(200);

    const updateCall = mockDb.mock.calls.find((c: any[]) => String(c[0]).includes('UPDATE vendors SET'));
    expect(updateCall).toBeDefined();
    const vals = updateCall![1] as any[];
    expect(vals).toContain('completion');
    expect(vals).toContain('Monday');
    expect(vals).toContain('FedEx/UPS');
  });
});

// ── DELETE /api/vendors/:id ───────────────────────────────────────────────────

describe('DELETE /api/vendors/:id', () => {
  it('returns 401 without token', async () => {
    const res = await request(app).delete('/api/vendors/1');
    expect(res.status).toBe(401);
  });

  it('returns 403 for vendor role', async () => {
    const vendorOnly = { id: 3, email: 'v@test.com', role: 'vendor', is_buyer: false, is_seller: false };
    mockDb.mockResolvedValueOnce({ rows: [vendorOnly] });
    const res = await request(app).delete('/api/vendors/1').set(authHeader);
    expect(res.status).toBe(403);
  });

  it('soft-deletes the vendor and deactivates linked vendor users', async () => {
    mockAuth();
    mockDb.mockResolvedValueOnce({ rows: [] }); // UPDATE vendors SET active = FALSE
    mockDb.mockResolvedValueOnce({ rows: [] }); // UPDATE users SET active = FALSE
    const res = await request(app).delete('/api/vendors/1').set(authHeader);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);

    const vendorDeactivate = mockDb.mock.calls.find((c: any[]) => String(c[0]).includes('UPDATE vendors SET active = FALSE'));
    expect(vendorDeactivate).toBeDefined();
    expect(vendorDeactivate![1]).toContain(1);

    const userDeactivate = mockDb.mock.calls.find((c: any[]) => String(c[0]).includes('UPDATE users SET active = FALSE'));
    expect(userDeactivate).toBeDefined();
  });
});
