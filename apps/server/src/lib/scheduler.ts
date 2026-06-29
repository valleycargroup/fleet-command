/**
 * Scheduler — Phase 1
 *
 * Uses node-cron (process-based, no OS cron required).
 * Works identically on local Docker and EC2.
 * Timezone is set via TZ env var (default: America/Phoenix).
 *
 * To revert this phase: delete this file and remove the import from server.ts.
 *
 * Jobs registered here:
 *   - Vendor pending-work digest  → 8am, 12pm, 5pm Mon–Fri
 *   - Weekend/holiday rollover check → 8am Mon–Fri (catches Friday jobs that
 *     fell on a weekend or holiday and weren't sent)
 */

import cron from 'node-cron';

const TZ = process.env.TZ || 'America/Phoenix';

// ── US Federal Holidays (MM-DD, year-independent) ────────────────────────────
const FEDERAL_HOLIDAYS = new Set([
  '01-01', // New Year's Day
  '07-04', // Independence Day
  '11-11', // Veterans Day
  '12-25', // Christmas Day
]);

export function isBusinessDay(date: Date = new Date()): boolean {
  const day = date.getDay(); // 0=Sun, 6=Sat
  if (day === 0 || day === 6) return false;
  const mmdd = String(date.getMonth() + 1).padStart(2, '0') + '-' +
               String(date.getDate()).padStart(2, '0');
  return !FEDERAL_HOLIDAYS.has(mmdd);
}

export function nextBusinessDay(from: Date = new Date()): Date {
  const d = new Date(from);
  d.setDate(d.getDate() + 1);
  while (!isBusinessDay(d)) d.setDate(d.getDate() + 1);
  return d;
}

// ── Job registry ─────────────────────────────────────────────────────────────
type JobFn = () => void | Promise<void>;
const jobs: { name: string; expression: string; fn: JobFn }[] = [];

function register(name: string, expression: string, fn: JobFn) {
  jobs.push({ name, expression, fn });
}

// ── Job: vendor pending-work digest (3× weekday) ─────────────────────────────
register(
  'vendor-digest',
  '0 8,12,17 * * 1-5',
  async () => {
    if (!isBusinessDay()) {
      console.log('[scheduler] vendor-digest skipped — not a business day');
      return;
    }
    console.log('[scheduler] vendor-digest running');
    try {
      const { runVendorDigest } = await import('./paymentBatch');
      await runVendorDigest();
    } catch (e) {
      console.error('[scheduler] vendor-digest failed:', e);
    }
  }
);

// ── Job: weekend/holiday rollover check (8am Mon–Fri) ────────────────────────
register(
  'rollover-check',
  '0 8 * * 1-5',
  async () => {
    console.log('[scheduler] rollover-check running');
    try {
      const { runRolloverCheck } = await import('./paymentBatch');
      await runRolloverCheck();
    } catch (e) {
      console.error('[scheduler] rollover-check failed:', e);
    }
  }
);

// ── Start all registered jobs ─────────────────────────────────────────────────
export function startScheduler() {
  if (process.env.NODE_ENV === 'test') {
    console.log('[scheduler] skipped in test environment');
    return;
  }

  jobs.forEach(({ name, expression, fn }) => {
    cron.schedule(expression, fn, { timezone: TZ });
    console.log(`[scheduler] registered "${name}" → ${expression} (${TZ})`);
  });

  console.log(`[scheduler] started — ${jobs.length} job(s) active`);
}
