import { vi, describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';

vi.mock('../lib/db', () => ({ default: { raw: vi.fn() } }));
vi.mock('../lib/storage', () => ({ deleteFromStorage: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../lib/auctionExport', () => ({ sendVehicleToAuction: vi.fn() }));
vi.mock('../lib/crmImport', () => ({
  fetchCrmVehicle: vi.fn(),
  crmVehicleToDraft: vi.fn(),
  crmImportFieldsToFleetRow: vi.fn(),
  driveToDriveline: vi.fn().mockReturnValue(null),
}));

import app from '../app';
import db from '../lib/db';

const adminUser = { id: 1, email: 'admin@test.com', role: 'admin', is_buyer: true, is_seller: true };
const vendorUser = { id: 5, email: 'bob@paint.com', role: 'vendor', first_name: 'Bob', last_name: 'Smith', is_buyer: false, is_seller: false };
const mockDb = db.raw as ReturnType<typeof vi.fn>;
const mockAuth = (user = adminUser) => mockDb.mockResolvedValueOnce({ rows: [user] });
const authHeader = { Authorization: 'Bearer validtoken' };

beforeEach(() => vi.clearAllMocks());

// ── GET /api/vehicles ─────────────────────────────────────────────────────────

describe('GET /api/vehicles', () => {
  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/vehicles');
    expect(res.status).toBe(401);
  });

  it('returns vehicle list', async () => {
    mockAuth();
    mockDb.mockResolvedValueOnce({ rows: [{ id: 1, vin: 'ABC123', make: 'Toyota', model: 'Camry', year: 2020 }] });
    const res = await request(app).get('/api/vehicles').set(authHeader);
    expect(res.status).toBe(200);
    expect(res.body.vehicles).toHaveLength(1);
    expect(res.body.vehicles[0].vin).toBe('ABC123');
  });
});

// ── POST /api/vehicles ────────────────────────────────────────────────────────

describe('POST /api/vehicles', () => {
  it('returns 401 without token', async () => {
    const res = await request(app).post('/api/vehicles').send({ vin: 'TEST001' });
    expect(res.status).toBe(401);
  });

  it('returns 409 when VIN already exists', async () => {
    mockAuth();
    mockDb.mockResolvedValueOnce({ rows: [{ id: 99 }] }); // existing VIN
    const res = await request(app).post('/api/vehicles').set(authHeader)
      .send({ vin: 'DUPVIN12345678', make: 'Toyota', model: 'Camry', year: 2020 });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/already exists/i);
  });

  it('creates a vehicle successfully', async () => {
    mockAuth();
    mockDb.mockResolvedValueOnce({ rows: [] });             // VIN uniqueness check
    mockDb.mockResolvedValueOnce({ rows: [{ id: 42 }] });  // INSERT RETURNING id
    const res = await request(app).post('/api/vehicles').set(authHeader)
      .send({ vin: 'NEWVIN001', make: 'Honda', model: 'Civic', year: 2021, miles: 5000, location: 'PHX', color: 'White' });
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(42);
    expect(res.body.ok).toBe(true);
  });

  it('creates a vehicle without a VIN (skips uniqueness check)', async () => {
    mockAuth();
    mockDb.mockResolvedValueOnce({ rows: [{ id: 43 }] }); // INSERT
    const res = await request(app).post('/api/vehicles').set(authHeader)
      .send({ make: 'Ford', model: 'F-150', year: 2022, miles: 0, location: 'Dallas' });
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(43);
  });
});

// ── PUT /api/vehicles/:id ─────────────────────────────────────────────────────

describe('PUT /api/vehicles/:id', () => {
  it('returns 401 without token', async () => {
    const res = await request(app).put('/api/vehicles/1').send({ make: 'Honda' });
    expect(res.status).toBe(401);
  });

  it('returns 400 when no allowed fields are provided', async () => {
    mockAuth();
    const res = await request(app).put('/api/vehicles/1').set(authHeader).send({ fakeField: 'value' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/no fields/i);
  });

  it('updates allowed vehicle fields', async () => {
    mockAuth();
    mockDb.mockResolvedValueOnce({ rows: [] }); // UPDATE
    const res = await request(app).put('/api/vehicles/1').set(authHeader)
      .send({ miles: 10000, color: 'Blue', status: 'active' });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('allows vendor to update recon_data', async () => {
    mockAuth(vendorUser);
    mockDb.mockResolvedValueOnce({ rows: [] }); // UPDATE
    const res = await request(app).put('/api/vehicles/1').set(authHeader)
      .send({ recon_data: { detail: { status: 'started' } } });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('returns 403 when vendor tries to update non-recon fields', async () => {
    mockAuth(vendorUser);
    const res = await request(app).put('/api/vehicles/1').set(authHeader)
      .send({ miles: 99999 });
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/recon data/i);
  });
});

// ── DELETE /api/vehicles/:id ──────────────────────────────────────────────────

describe('DELETE /api/vehicles/:id', () => {
  it('returns 401 without token', async () => {
    const res = await request(app).delete('/api/vehicles/1');
    expect(res.status).toBe(401);
  });

  it('returns 403 for vendor role', async () => {
    mockAuth(vendorUser);
    const res = await request(app).delete('/api/vehicles/1').set(authHeader);
    expect(res.status).toBe(403);
  });

  it('deletes vehicle and issues storage cleanup', async () => {
    const { deleteFromStorage } = await import('../lib/storage');
    mockAuth();
    mockDb.mockResolvedValueOnce({ rows: [{ photos: [{ key: 'images/car.jpg' }], recon_data: {} }] }); // SELECT
    mockDb.mockResolvedValueOnce({ rows: [] }); // DELETE
    const res = await request(app).delete('/api/vehicles/1').set(authHeader);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(deleteFromStorage).toHaveBeenCalledWith('images/car.jpg');
  });

  it('deletes vehicle with no photos gracefully', async () => {
    mockAuth();
    mockDb.mockResolvedValueOnce({ rows: [{ photos: [], recon_data: {} }] });
    mockDb.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).delete('/api/vehicles/1').set(authHeader);
    expect(res.status).toBe(200);
  });
});

// ── POST /api/vehicles/:id/vendor-bid ────────────────────────────────────────

describe('POST /api/vehicles/:id/vendor-bid', () => {
  it('returns 401 without token', async () => {
    const res = await request(app).post('/api/vehicles/1/vendor-bid')
      .send({ categoryKey: 'paint', vendorUpdates: {} });
    expect(res.status).toBe(401);
  });

  it('returns 400 when categoryKey is missing', async () => {
    mockAuth(vendorUser);
    const res = await request(app).post('/api/vehicles/1/vendor-bid').set(authHeader)
      .send({ vendorUpdates: { estimate: 500 } });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/categoryKey/i);
  });

  it('returns 404 when vehicle not found', async () => {
    mockAuth(vendorUser);
    mockDb.mockResolvedValueOnce({ rows: [] }); // SELECT vehicle → empty
    const res = await request(app).post('/api/vehicles/99/vendor-bid').set(authHeader)
      .send({ categoryKey: 'paint', vendorUpdates: { estimate: 500 } });
    expect(res.status).toBe(404);
  });

  it('returns 403 when vendor is not assigned to the recon task', async () => {
    mockAuth(vendorUser);
    const reconData = {
      paint: { status: 'assigned', vendors: [{ id: 'vn_2', name: 'Other Shop', email: 'other@shop.com', lineItems: [] }] },
    };
    mockDb.mockResolvedValueOnce({ rows: [{ recon_data: reconData }] });
    const res = await request(app).post('/api/vehicles/1/vendor-bid').set(authHeader)
      .send({ categoryKey: 'paint', vendorUpdates: { estimate: 500 } });
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/not assigned/i);
  });

  it('allows assigned vendor to submit bid matched by email', async () => {
    mockAuth(vendorUser);
    const reconData = {
      paint: {
        status: 'assigned',
        vendors: [{ id: 'vn_1', name: 'Bob Smith', email: 'bob@paint.com', lineItems: [], estimate: 0 }],
      },
    };
    mockDb.mockResolvedValueOnce({ rows: [{ recon_data: reconData }] }); // SELECT
    mockDb.mockResolvedValueOnce({ rows: [] }); // UPDATE
    const res = await request(app).post('/api/vehicles/1/vendor-bid').set(authHeader)
      .send({ categoryKey: 'paint', vendorUpdates: { estimate: 500, lineItems: [{ desc: 'Full repaint', price: 500 }] } });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('allows vendor matched by full name when no email on task', async () => {
    mockAuth(vendorUser);
    const reconData = {
      detail: {
        status: 'assigned',
        vendors: [{ id: 'vn_1', name: 'Bob Smith', email: '', lineItems: [] }],
      },
    };
    mockDb.mockResolvedValueOnce({ rows: [{ recon_data: reconData }] });
    mockDb.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).post('/api/vehicles/1/vendor-bid').set(authHeader)
      .send({ categoryKey: 'detail', vendorUpdates: { estimate: 150 } });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('rolls up total estimate across all assigned vendors', async () => {
    mockAuth(vendorUser);
    const reconData = {
      paint: {
        status: 'assigned',
        estimate: 300,
        vendors: [
          { id: 'vn_1', name: 'Bob Smith', email: 'bob@paint.com', lineItems: [], estimate: 300 },
          { id: 'vn_2', name: 'Other Shop', email: 'other@shop.com', lineItems: [], estimate: 200 },
        ],
      },
    };
    mockDb.mockResolvedValueOnce({ rows: [{ recon_data: reconData }] });
    mockDb.mockResolvedValueOnce({ rows: [] });
    await request(app).post('/api/vehicles/1/vendor-bid').set(authHeader)
      .send({ categoryKey: 'paint', vendorUpdates: { estimate: 400 } });

    const updateCall = mockDb.mock.calls.find((c: any[]) => String(c[0]).includes('UPDATE vehicles SET recon_data'));
    expect(updateCall).toBeDefined();
    const savedRecon = JSON.parse(updateCall![1][0]);
    // Bob updated to 400 + Other still at 200 = 600 rolled up
    expect(savedRecon.paint.estimate).toBe(600);
  });
});
