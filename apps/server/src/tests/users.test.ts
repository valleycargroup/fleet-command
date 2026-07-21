import { vi, describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';

vi.mock('../lib/db', () => ({ default: { raw: vi.fn() } }));

import app from '../app';
import db from '../lib/db';

const adminUser = { id: 1, email: 'admin@test.com', role: 'admin', is_buyer: true, is_seller: true };
const vendorUser = { id: 2, email: 'vendor@test.com', role: 'vendor', is_buyer: false, is_seller: false };
const mockDb = db.raw as ReturnType<typeof vi.fn>;
const mockAuth = (user = adminUser) => mockDb.mockResolvedValueOnce({ rows: [user] });
const authHeader = { Authorization: 'Bearer validtoken' };

beforeEach(() => vi.clearAllMocks());

// ── GET /api/users ────────────────────────────────────────────────────────────

describe('GET /api/users', () => {
  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/users');
    expect(res.status).toBe(401);
  });

  it('returns 403 for vendor role', async () => {
    mockAuth(vendorUser);
    const res = await request(app).get('/api/users').set(authHeader);
    expect(res.status).toBe(403);
  });

  it('returns user list for admin', async () => {
    mockAuth();
    mockDb.mockResolvedValueOnce({ rows: [{ id: 1, email: 'admin@test.com', role: 'admin' }] });
    const res = await request(app).get('/api/users').set(authHeader);
    expect(res.status).toBe(200);
    expect(res.body.users).toHaveLength(1);
  });
});

// ── POST /api/users ───────────────────────────────────────────────────────────

describe('POST /api/users', () => {
  it('returns 401 without token', async () => {
    const res = await request(app).post('/api/users').send({ email: 'a@b.com', phone: '555', first_name: 'Bob' });
    expect(res.status).toBe(401);
  });

  it('returns 400 when required fields are missing', async () => {
    mockAuth();
    const res = await request(app).post('/api/users').set(authHeader).send({ email: 'a@b.com' });
    expect(res.status).toBe(400);
  });

  it('returns 400 for duplicate active email', async () => {
    mockAuth();
    mockDb.mockResolvedValueOnce({ rows: [{ id: 9, active: true }] }); // existing active user
    const res = await request(app).post('/api/users').set(authHeader)
      .send({ email: 'existing@test.com', phone: '5550001', first_name: 'Jane' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/already registered/i);
  });

  it('creates a new user successfully', async () => {
    mockAuth();
    mockDb.mockResolvedValueOnce({ rows: [] });               // email uniqueness check
    mockDb.mockResolvedValueOnce({ rows: [{ id: 10 }] });    // INSERT
    const res = await request(app).post('/api/users').set(authHeader)
      .send({ email: 'new@test.com', phone: '5550002', first_name: 'Jane', role: 'admin' });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});

// ── PUT /api/users/:id ────────────────────────────────────────────────────────

describe('PUT /api/users/:id', () => {
  it('returns 401 without token', async () => {
    const res = await request(app).put('/api/users/2').send({ first_name: 'Bob' });
    expect(res.status).toBe(401);
  });

  it('returns 400 when no fields provided', async () => {
    mockAuth();
    const res = await request(app).put('/api/users/2').set(authHeader).send({});
    expect(res.status).toBe(400);
  });

  // Password complexity is only enforced on self-resets (user updating their own account).
  // Admins setting another user's password bypass validation to allow temporary passwords.
  const selfUser = { id: 2, email: 'user@test.com', role: 'admin', is_buyer: false, is_seller: false };

  it('returns 400 for password shorter than 8 chars (self-reset)', async () => {
    mockAuth(selfUser);
    const res = await request(app).put('/api/users/2').set(authHeader).send({ password: 'Ab1' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/8 characters/i);
  });

  it('returns 400 for password missing uppercase (self-reset)', async () => {
    mockAuth(selfUser);
    const res = await request(app).put('/api/users/2').set(authHeader).send({ password: 'alllower1' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/uppercase/i);
  });

  it('returns 400 for password missing number (self-reset)', async () => {
    mockAuth(selfUser);
    const res = await request(app).put('/api/users/2').set(authHeader).send({ password: 'NoNumbers!' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/number/i);
  });

  it('updates user with a valid password (self-reset)', async () => {
    mockAuth(selfUser);
    mockDb.mockResolvedValueOnce({ rows: [] }); // UPDATE
    const res = await request(app).put('/api/users/2').set(authHeader).send({ password: 'ValidPass1' });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('admin can set any password for another user (no complexity check)', async () => {
    mockAuth(); // admin id:1 updating user id:2
    mockDb.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).put('/api/users/2').set(authHeader).send({ password: 'simple' });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('updates non-password fields', async () => {
    mockAuth();
    mockDb.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).put('/api/users/2').set(authHeader).send({ first_name: 'Bobby', role: 'admin' });
    expect(res.status).toBe(200);
  });
});

// ── DELETE /api/users/:id ─────────────────────────────────────────────────────

describe('DELETE /api/users/:id', () => {
  it('returns 401 without token', async () => {
    const res = await request(app).delete('/api/users/2');
    expect(res.status).toBe(401);
  });

  it('returns 400 when admin tries to delete themselves', async () => {
    mockAuth(); // adminUser has id: 1
    const res = await request(app).delete('/api/users/1').set(authHeader);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/cannot delete yourself/i);
  });

  it('soft-deletes another user', async () => {
    mockAuth();
    mockDb.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).delete('/api/users/2').set(authHeader);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});
