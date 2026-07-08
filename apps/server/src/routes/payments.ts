/**
 * Payments Route — Phase 2
 *
 * GET  /api/payments/queue  — admin: full vendor payment queue with due status
 * POST /api/payments/trigger-digest — admin: manually trigger vendor digest now
 *
 * To revert this phase: remove this file and the mount from routes/index.ts.
 */

import { Router, Request, Response } from 'express';
import db from '../lib/db';
import { requireAuth } from '../lib/auth';
import { buildVendorPaymentQueue, runVendorDigest, runVendorWorkReminder } from '../lib/paymentBatch';
import { DigestSettings } from '../lib/scheduler';

async function loadSettings(): Promise<DigestSettings> {
  try {
    const rows = (await db.raw(`SELECT key, value FROM site_settings WHERE key IN ('digest_daily_hours','digest_weekly_day','digest_weekly_hour','work_reminder_hours','payment_emails_enabled','work_reminders_enabled','daily_emails_enabled','weekly_emails_enabled')`)).rows;
    const map: Record<string, string> = {};
    for (const r of rows) map[r.key] = r.value;
    return {
      dailyHours:           map['digest_daily_hours']  ? map['digest_daily_hours'].split(',').map((h: string) => parseInt(h.trim(), 10)) : [8, 12, 17],
      weeklyDay:            map['digest_weekly_day']   || 'Friday',
      weeklyHour:           map['digest_weekly_hour']  ? parseInt(map['digest_weekly_hour'], 10) : 17,
      workReminderHours:    map['work_reminder_hours'] ? map['work_reminder_hours'].split(',').map((h: string) => parseInt(h.trim(), 10)) : [8, 12, 17],
      paymentEmailsEnabled: map['payment_emails_enabled'] !== 'false',
      workRemindersEnabled:  map['work_reminders_enabled']  !== 'false',
      dailyEmailsEnabled:   map['daily_emails_enabled']   !== 'false',
      weeklyEmailsEnabled:  map['weekly_emails_enabled']  !== 'false',
    };
  } catch { return { dailyHours: [8, 12, 17], weeklyDay: 'Friday', weeklyHour: 17, workReminderHours: [8, 12, 17], paymentEmailsEnabled: true, workRemindersEnabled: true, dailyEmailsEnabled: true, weeklyEmailsEnabled: true }; }
}

const router = Router();

// GET /api/payments/queue
router.get('/queue', async (req: Request, res: Response) => {
  try {
    const user = await requireAuth(req, res);
    if (!user) return;
    if (user.role === 'vendor') return res.status(403).json({ error: 'Forbidden' });

    const settings = await loadSettings();
    const queue = await buildVendorPaymentQueue(settings);
    const now = new Date();
    const TZ = process.env.TZ || 'America/Phoenix';
    res.json({
      queue,
      _debug: {
        serverTime: now.toISOString(),
        serverDay: now.toLocaleDateString('en-US', { weekday: 'long', timeZone: TZ }),
        serverHour: parseInt(now.toLocaleTimeString('en-US', { hour: 'numeric', hour12: false, timeZone: TZ }), 10),
        timezone: TZ,
        settings,
        note: 'isDue=true only when serverDay===settings.weeklyDay AND serverHour===settings.weeklyHour (exact match)'
      }
    });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/payments/trigger-digest  (admin manual trigger)
router.post('/trigger-digest', async (req: Request, res: Response) => {
  try {
    const user = await requireAuth(req, res);
    if (!user) return;
    if (!['admin','tech support','tech_support','techsupport'].includes(user.role?.toLowerCase())) return res.status(403).json({ error: 'Admin only' });

    const forceAll = req.body?.force !== false; // default true; pass force:false to respect live schedule
    const settings = await loadSettings();
    await runVendorDigest(settings, forceAll, 'manual');
    res.json({ ok: true, forceAll, message: forceAll ? 'Digest triggered (all vendors)' : 'Digest triggered (schedule-gated)' });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/payments/trigger-work-reminder  (admin manual trigger)
router.post('/trigger-work-reminder', async (req: Request, res: Response) => {
  try {
    const user = await requireAuth(req, res);
    if (!user) return;
    if (!['admin','tech support','tech_support','techsupport'].includes(user.role?.toLowerCase())) return res.status(403).json({ error: 'Admin only' });

    const settings = await loadSettings();
    await runVendorWorkReminder(settings, true); // forceAll=true: ignore schedule
    res.json({ ok: true, message: 'Work reminder triggered (all vendors with pending tasks)' });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
