import { vi, describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';

vi.mock('../lib/db', () => ({
  default: { raw: vi.fn() },
}));

import app from '../app';
import db from '../lib/db';
import { hashPassword, verifyPassword, generateToken } from '../lib/auth';

// ── Utility unit tests ────────────────────────────────────────────────────────

describe('hashPassword / verifyPassword', () => {
  it('produces a bcrypt hash', async () => {
    const hash = await hashPassword('TestPass1');
    expect(hash).toMatch(/^\$2/);
  });

  it('validates the correct password', async () => {
    const hash = await hashPassword('TestPass1');
    expect(await verifyPassword('TestPass1', hash)).toBe(true);
  });

  it('rejects a wrong password', async () => {
    const hash = await hashPassword('TestPass1');
    expect(await verifyPassword('WrongPass1', hash)).toBe(false);
  });
});

describe('generateToken', () => {
  it('returns a 64-char hex string', () => {
    const token = generateToken();
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  it('generates unique tokens', () => {
    expect(generateToken()).not.toBe(generateToken());
  });
});

// ── Auth route tests ──────────────────────────────────────────────────────────

describe('GET /health', () => {
  it('returns ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});

describe('POST /api/auth/login', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 400 when fields are missing', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'test@test.com' });
    expect(res.status).toBe(400);
  });

  it('returns 401 for unknown user', async () => {
    (db.raw as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ rows: [] });
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@test.com', password: 'TestPass1' });
    expect(res.status).toBe(401);
  });

  it('returns 401 for wrong password', async () => {
    const hash = await hashPassword('CorrectPass1');
    (db.raw as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      rows: [{ id: 1, email: 'user@test.com', password_hash: hash, active: true }],
    });
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'user@test.com', password: 'WrongPass1' });
    expect(res.status).toBe(401);
  });

  it('returns 200 with token on valid login', async () => {
    const hash = await hashPassword('CorrectPass1');
    (db.raw as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ rows: [{ id: 1, email: 'user@test.com', password_hash: hash, active: true, role: 'admin', must_change_password: false }] })
      .mockResolvedValueOnce({ rows: [] }); // INSERT session
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'user@test.com', password: 'CorrectPass1' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
  });
});

describe('POST /api/auth/forgot-password', () => {
  beforeEach(() => vi.clearAllMocks());

  it('always returns ok for unknown email (prevents user enumeration)', async () => {
    (db.raw as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ rows: [] });
    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'nobody@test.com' });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('returns 400 when email is missing', async () => {
    const res = await request(app).post('/api/auth/forgot-password').send({});
    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/reset-password', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 400 when token or password is missing', async () => {
    const res = await request(app).post('/api/auth/reset-password').send({ token: 'abc' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when password is too short', async () => {
    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: 'abc', new_password: 'short' });
    expect(res.status).toBe(400);
  });

  it('returns 401 for invalid/expired token', async () => {
    (db.raw as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ rows: [] });
    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: 'badtoken', new_password: 'ValidPass1' });
    expect(res.status).toBe(401);
  });
});
