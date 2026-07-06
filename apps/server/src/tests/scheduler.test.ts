import { describe, it, expect } from 'vitest';
import { isBusinessDay, nextBusinessDay } from '../lib/scheduler';

// All test dates use 20:00 UTC = 13:00 Phoenix (UTC-7, no DST in Arizona).
// This keeps the calendar day identical in both UTC and Phoenix.

const d = (iso: string) => new Date(iso);

// ── isBusinessDay ─────────────────────────────────────────────────────────────

describe('isBusinessDay', () => {
  it('returns false for Saturday', () => {
    expect(isBusinessDay(d('2026-01-03T20:00:00Z'))).toBe(false);
  });

  it('returns false for Sunday', () => {
    expect(isBusinessDay(d('2026-01-04T20:00:00Z'))).toBe(false);
  });

  it('returns true for Monday (normal week)', () => {
    expect(isBusinessDay(d('2026-01-05T20:00:00Z'))).toBe(true);
  });

  it('returns true for Friday (non-holiday)', () => {
    expect(isBusinessDay(d('2026-01-02T20:00:00Z'))).toBe(true);
  });

  it('returns true for a normal Wednesday', () => {
    expect(isBusinessDay(d('2026-06-03T20:00:00Z'))).toBe(true);
  });

  it('returns false for New Year\'s Day (Jan 1 — Thursday in 2026)', () => {
    expect(isBusinessDay(d('2026-01-01T20:00:00Z'))).toBe(false);
  });

  it('returns false for Veterans Day (Nov 11 — Wednesday in 2026)', () => {
    expect(isBusinessDay(d('2026-11-11T20:00:00Z'))).toBe(false);
  });

  it('returns false for Christmas (Dec 25 — Friday in 2026)', () => {
    expect(isBusinessDay(d('2026-12-25T20:00:00Z'))).toBe(false);
  });

  it('returns true for Nov 10 (day before Veterans Day)', () => {
    expect(isBusinessDay(d('2026-11-10T20:00:00Z'))).toBe(true);
  });

  it('returns true for Dec 24 (day before Christmas)', () => {
    expect(isBusinessDay(d('2026-12-24T20:00:00Z'))).toBe(true);
  });
});

// ── nextBusinessDay ───────────────────────────────────────────────────────────

describe('nextBusinessDay', () => {
  it('result is always a business day', () => {
    const inputs = [
      '2026-01-02T20:00:00Z', // Friday
      '2026-01-03T20:00:00Z', // Saturday
      '2026-01-04T20:00:00Z', // Sunday
      '2026-11-10T20:00:00Z', // Tuesday before Veterans Day
    ];
    for (const iso of inputs) {
      expect(isBusinessDay(nextBusinessDay(d(iso)))).toBe(true);
    }
  });

  it('result is strictly after the input', () => {
    const inputs = [
      '2026-01-02T20:00:00Z',
      '2026-01-05T20:00:00Z',
      '2026-11-10T20:00:00Z',
    ];
    for (const iso of inputs) {
      const from = d(iso);
      expect(nextBusinessDay(from).getTime()).toBeGreaterThan(from.getTime());
    }
  });

  it('Saturday → Monday (skips Sunday)', () => {
    const result = nextBusinessDay(d('2026-01-03T20:00:00Z')); // Sat Jan 3
    const day = result.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'America/Phoenix' });
    expect(day).toBe('Monday');
  });

  it('Sunday → Monday', () => {
    const result = nextBusinessDay(d('2026-01-04T20:00:00Z')); // Sun Jan 4
    const day = result.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'America/Phoenix' });
    expect(day).toBe('Monday');
  });

  it('Friday → Monday (skips weekend)', () => {
    const result = nextBusinessDay(d('2026-01-02T20:00:00Z')); // Fri Jan 2
    const day = result.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'America/Phoenix' });
    expect(day).toBe('Monday');
  });

  it('Tuesday before Veterans Day → Thursday (skips Wednesday holiday)', () => {
    // Nov 10 (Tue) → Nov 11 (Wed, Veterans Day, holiday) → Nov 12 (Thu)
    const result = nextBusinessDay(d('2026-11-10T20:00:00Z'));
    const date = result.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', timeZone: 'America/Phoenix' });
    expect(date).toBe('11/12');
  });

  it('Friday before Christmas → Monday (skips Christmas + weekend)', () => {
    // Dec 24 (Thu) → Dec 25 (Fri, Christmas) → Dec 26 (Sat) → Dec 27 (Sun) → Dec 28 (Mon)
    const result = nextBusinessDay(d('2026-12-24T20:00:00Z'));
    const date = result.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', timeZone: 'America/Phoenix' });
    expect(date).toBe('12/28');
  });
});
