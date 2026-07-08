/**
 * Payment Batch — Phase 2
 *
 * Identifies vendors with approved-but-unpaid recon work and sends
 * digest emails according to each vendor's payment_terms schedule.
 *
 * To revert this phase: replace this file with the Phase 1 stub version
 * and remove the payments route from routes/index.ts.
 */

import db from './db';
import { sendEmail, logEmail, APP_URL } from './email';
import { TEMPLATES } from './email-templates';
import { isBusinessDay, nextBusinessDay, DigestSettings } from './scheduler';

const DEFAULT_SETTINGS: DigestSettings = { dailyHours: [8, 12, 17], weeklyDay: 'Friday', weeklyHour: 17, workReminderHours: [8, 12, 17], paymentEmailsEnabled: true, workRemindersEnabled: true, dailyEmailsEnabled: true, weeklyEmailsEnabled: true };

// Recon category keys — must match client-side VCAT constant
const VCAT_KEYS = [
  'detail','touchup','bodyshop','pdr','tires','wheels',
  'interior','mechanical','windshield','electronics',
  'oemdealer','blackwidow','cr','auction','parts',
];

const DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PendingJob {
  vehicleId: number;
  year: number;
  make: string;
  model: string;
  trim: string;
  vin: string;
  color: string;
  miles: number;
  location: string;
  status: string;
  soldTo: string | null;
  soldDate: string | null;
  categoryKey: string;
  categoryLabel: string;
  categoryIcon: string;
  lockedTotal: number;
  lockedWS: number;
  lockedRetail: number;
  approvedBy: string;
  approvedDate: string;
  vendorEmail: string | null;
}

export interface VendorBatch {
  vendorName: string;
  vendorEmail: string | null;
  recipients: string[];        // all addresses to send digest to (deduped)
  paymentTerms: string;
  cutoffDay: string;
  cutoffTime: string;
  deliveryMethod: string;
  isDue: boolean;
  isSoldPriority: boolean;
  jobs: PendingJob[];
  total: number;
  totalWS: number;
  totalRetail: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseCutoffHour(cutoffTime: string): number {
  // e.g. "5 PM" → 17, "9 AM" → 9, "12 PM" → 12
  const m = cutoffTime.match(/(\d+)\s*(AM|PM)/i);
  if (!m) return 17;
  let h = parseInt(m[1], 10);
  if (m[2].toUpperCase() === 'PM' && h !== 12) h += 12;
  if (m[2].toUpperCase() === 'AM' && h === 12) h = 0;
  return h;
}

function isWeeklyCutoffDue(cutoffDay: string, cutoffTime: string, now: Date): boolean {
  const todayName = DAY_NAMES[now.getDay()];
  if (todayName !== cutoffDay) return false;
  const cutoffHour = parseCutoffHour(cutoffTime);
  return now.getHours() >= cutoffHour;
}

const CATEGORY_META: Record<string, { label: string; icon: string }> = {
  detail:      { label: 'Detail',                  icon: '🧽' },
  touchup:     { label: 'Touch Up',                icon: '🖌️' },
  bodyshop:    { label: 'Body Shop',               icon: '🔧' },
  pdr:         { label: 'PDR',                     icon: '🔨' },
  tires:       { label: 'Tires',                   icon: '🛞' },
  wheels:      { label: 'Wheels',                  icon: '⚙️' },
  interior:    { label: 'Interior',                icon: '💺' },
  mechanical:  { label: 'Mechanical',              icon: '🏎️' },
  windshield:  { label: 'Windshield',              icon: '🪟' },
  electronics: { label: 'Radio/Screens/Moonroofs', icon: '📻' },
  oemdealer:   { label: 'OEM Dealer',              icon: '🏭' },
  blackwidow:  { label: 'Black Widow Pics',        icon: '📸' },
  cr:          { label: 'Condition Report',        icon: '📋' },
  auction:     { label: 'Send to Auction',         icon: '🔨' },
  parts:       { label: 'Parts',                   icon: '📦' },
};

// ── Core: build payment queue from DB ────────────────────────────────────────

export async function buildVendorPaymentQueue(settings: DigestSettings = DEFAULT_SETTINGS, forceAll = false): Promise<VendorBatch[]> {
  // Load all vehicles with recon data
  const vehicles = (await db.raw(
    `SELECT id, year, make, model, trim, vin, color, miles, location,
            status, sold_to, sale_date, recon_data
     FROM vehicles
     WHERE recon_data IS NOT NULL AND status != 'delivered'`
  )).rows;

  // Load all vendors with payment terms, primary email, prefs, and all linked user emails
  const vendorRows = (await db.raw(
    `SELECT v.id, v.name, v.payment_terms, v.cutoff_day, v.cutoff_time, v.delivery_method,
            v.email_prefs,
            COALESCE(u.email, (
              SELECT u2.email FROM users u2
              WHERE u2.vendor_id = v.id AND u2.active = TRUE
              ORDER BY u2.id LIMIT 1
            )) AS contact_email
     FROM vendors v
     LEFT JOIN users u ON v.primary_user_id = u.id
     WHERE v.active = TRUE`
  )).rows;

  // For vendors with ccAllOnDigest, load all linked user emails keyed by vendor id
  const allLinkedEmails: Record<string, string[]> = {};
  const digestVendorIds = vendorRows
    .filter((vr: any) => vr.email_prefs?.ccAllOnDigest)
    .map((vr: any) => vr.id);
  if (digestVendorIds.length > 0) {
    const linkedRows = (await db.raw(
      `SELECT vendor_id, email FROM users WHERE vendor_id = ANY(?) AND active = TRUE AND email IS NOT NULL`,
      [digestVendorIds]
    )).rows;
    for (const r of linkedRows) {
      if (!allLinkedEmails[r.vendor_id]) allLinkedEmails[r.vendor_id] = [];
      allLinkedEmails[r.vendor_id].push(r.email.toLowerCase());
    }
  }

  const vendorMap: Record<string, typeof vendorRows[0]> = {};
  vendorRows.forEach((vr: any) => {
    vendorMap[vr.name?.toLowerCase()?.trim()] = vr;
  });

  // Group pending jobs by vendor name
  const groups: Record<string, { jobs: PendingJob[]; meta: typeof vendorRows[0] | null }> = {};

  for (const v of vehicles) {
    let recon: Record<string, any> = {};
    try { recon = typeof v.recon_data === 'string' ? JSON.parse(v.recon_data) : v.recon_data; }
    catch { continue; }

    for (const key of VCAT_KEYS) {
      const task = recon[key];
      if (!task) continue;
      if (!task.needed) continue;
      if (task.status !== 'complete') continue;
      if (!task.approvedForPayment) continue;
      if (task.paid) continue;

      const vendorName: string = task.lockedVendorName || 'Unknown Vendor';
      const vendorKey = vendorName.toLowerCase().trim();
      const vendorMeta = vendorMap[vendorKey] || null;

      // Find vendor email: primary user (or any linked user via COALESCE) > selected bid entry
      const selectedVendor = (task.vendors || []).find((x: any) => x.selected);
      const vendorEmail = vendorMeta?.contact_email || selectedVendor?.email || null;

      const job: PendingJob = {
        vehicleId:     v.id,
        year:          v.year,
        make:          v.make,
        model:         v.model,
        trim:          v.trim || '',
        vin:           v.vin || '',
        color:         v.color || '',
        miles:         v.miles || 0,
        location:      v.location || '',
        status:        v.status || '',
        soldTo:        v.sold_to || null,
        soldDate:      v.sale_date || null,
        categoryKey:   key,
        categoryLabel: CATEGORY_META[key]?.label || key,
        categoryIcon:  CATEGORY_META[key]?.icon || '🔧',
        lockedTotal:   task.lockedTotal || 0,
        lockedWS:      task.lockedWS || 0,
        lockedRetail:  task.lockedRetail || 0,
        approvedBy:    task.approvedBy || '',
        approvedDate:  task.approvedPaymentDate || '',
        vendorEmail,
      };

      if (!groups[vendorName]) {
        groups[vendorName] = { jobs: [], meta: vendorMeta };
      }
      groups[vendorName].jobs.push(job);
    }
  }

  const now = new Date();

  return Object.entries(groups).map(([vendorName, { jobs, meta }]) => {
    const paymentTerms   = meta?.payment_terms   || 'weekly';
    const cutoffDay      = meta?.cutoff_day      || 'Friday';
    const cutoffTime     = meta?.cutoff_time     || '5 PM';
    const deliveryMethod = meta?.delivery_method || 'USPS Mail';
    const vendorEmail    = meta?.contact_email || jobs[0]?.vendorEmail || null;

    // Sold vehicles sort to top within each vendor batch
    const sorted = [...jobs].sort((a, b) => {
      const aSold = a.status === 'sold' ? 0 : 1;
      const bSold = b.status === 'sold' ? 0 : 1;
      return aSold - bSold;
    });

    const TZ = process.env.TZ || 'America/Phoenix';
    const nowDay  = now.toLocaleDateString('en-US', { weekday: 'long', timeZone: TZ });
    const nowHour = parseInt(now.toLocaleTimeString('en-US', { hour: 'numeric', hour12: false, timeZone: TZ }), 10);
    const isDue = forceAll ||
      (paymentTerms === 'completion' && settings.dailyEmailsEnabled  && settings.dailyHours.includes(nowHour)) ||
      (paymentTerms === 'weekly'     && settings.weeklyEmailsEnabled && nowDay === settings.weeklyDay && nowHour === settings.weeklyHour);

    // Build recipient list
    const prefs: Record<string, any> = meta?.email_prefs || {};
    const recipientSet = new Set<string>();
    // Primary contact (via primary_user_id or first linked user)
    if (vendorEmail) recipientSet.add(vendorEmail.toLowerCase());
    // Payment department email always receives the digest (stored in email_prefs)
    if (prefs.paymentDeptEmail) recipientSet.add(prefs.paymentDeptEmail.toLowerCase());
    // All linked users if ccAllOnDigest flag is set
    if (prefs.ccAllOnDigest && meta?.id && allLinkedEmails[meta.id]) {
      for (const e of allLinkedEmails[meta.id]) recipientSet.add(e);
    }
    // Fallback: if still no recipients, try first linked user
    if (recipientSet.size === 0 && meta?.id && allLinkedEmails[meta.id]?.[0]) {
      recipientSet.add(allLinkedEmails[meta.id][0]);
    }

    const isSoldPriority = jobs.some(j => j.status === 'sold');
    const total      = jobs.reduce((s, j) => s + j.lockedTotal, 0);
    const totalWS    = jobs.reduce((s, j) => s + j.lockedWS, 0);
    const totalRetail = jobs.reduce((s, j) => s + j.lockedRetail, 0);

    return {
      vendorName, vendorEmail, recipients: Array.from(recipientSet),
      paymentTerms, cutoffDay, cutoffTime,
      deliveryMethod, isDue, isSoldPriority,
      jobs: sorted, total, totalWS, totalRetail,
    };
  })
  // Sort: sold-priority vendors first, then by total descending
  .sort((a, b) => {
    if (a.isSoldPriority && !b.isSoldPriority) return -1;
    if (!a.isSoldPriority && b.isSoldPriority) return 1;
    return b.total - a.total;
  });
}

// ── Send digest to a single vendor ───────────────────────────────────────────

async function sendVendorDigestEmail(batch: VendorBatch, triggeredBy: 'cron' | 'manual' = 'cron'): Promise<void> {
  if (!batch.recipients.length) {
    console.warn(`[paymentBatch] no recipients for vendor "${batch.vendorName}" — skipping`);
    return;
  }

  const fn = TEMPLATES['vendor_payment_pending_digest'];
  if (!fn) {
    console.warn('[paymentBatch] vendor_payment_pending_digest template not found');
    return;
  }

  const rendered = fn({
    vendorName:     batch.vendorName,
    paymentTerms:   batch.paymentTerms,
    jobs:           batch.jobs,
    total:          batch.total,
    totalWS:        batch.totalWS,
    totalRetail:    batch.totalRetail,
    isSoldPriority: batch.isSoldPriority,
    appUrl:         APP_URL,
  });
  if (!rendered) return;

  // Build final recipient list — include admin CC if payment category is enabled
  const allRecipients = new Set<string>(batch.recipients.map(r => r.toLowerCase()));
  try {
    const ccRow = await db.raw(`SELECT value FROM site_settings WHERE key = 'cc_admins_categories' LIMIT 1`);
    const cats: Record<string, boolean> = ccRow.rows[0]?.value ? JSON.parse(ccRow.rows[0].value) : {};
    if (cats.all || cats.payment) {
      const admins = (await db.raw(`SELECT email FROM users WHERE role = 'admin' AND active = TRUE`)).rows;
      for (const u of admins) if (u.email) allRecipients.add(u.email.toLowerCase());
    }
  } catch { /* ignore */ }

  // Batch-lookup recipient metadata for the email log (name, role, vendor)
  type RecipMeta = { name: string; role: string; vendor: string | null };
  const recipMeta: Record<string, RecipMeta> = {};
  try {
    const metaRows = (await db.raw(
      `SELECT u.email, u.first_name, u.last_name, u.role, v.name AS vendor_name
       FROM users u LEFT JOIN vendors v ON v.id = u.vendor_id
       WHERE LOWER(u.email) = ANY(?) AND u.active = TRUE`,
      [Array.from(allRecipients)]
    )).rows;
    for (const m of metaRows) {
      recipMeta[m.email.toLowerCase()] = {
        name: [m.first_name, m.last_name].filter(Boolean).join(' '),
        role: m.role || '',
        vendor: m.vendor_name || null,
      };
    }
  } catch { /* ignore */ }

  for (const recipient of Array.from(allRecipients)) {
    const result = await sendEmail(recipient, rendered.subject, rendered.html);
    const meta = recipMeta[recipient];
    await logEmail(
      'vendor_payment_pending_digest', recipient, null, rendered.subject,
      result.ok ? 'sent' : 'failed',
      result.ok ? null : (result.error || null),
      meta ? { name: meta.name || undefined, role: meta.role || undefined, vendor: meta.vendor || undefined } : undefined,
      triggeredBy,
      result.messageId,
      rendered.html
    );
  }

  console.log(`[paymentBatch] digest sent to "${batch.vendorName}" (${allRecipients.size} recipient(s)) — ${batch.jobs.length} job(s)`);
}

// ── Scheduler entry points ────────────────────────────────────────────────────

export async function runVendorDigest(settings: DigestSettings = DEFAULT_SETTINGS, forceAll = false, triggeredBy: 'cron' | 'manual' = 'cron'): Promise<void> {
  if (!forceAll && !isBusinessDay()) return;

  const queue = await buildVendorPaymentQueue(settings, forceAll);
  const due   = queue.filter(b => b.isDue && b.jobs.length > 0);

  console.log(`[paymentBatch] ${due.length} vendor(s) due for digest (${queue.length} total with pending work)`);

  for (const batch of due) {
    await sendVendorDigestEmail(batch, triggeredBy);
  }
}

export async function runRolloverCheck(settings: DigestSettings = DEFAULT_SETTINGS): Promise<void> {
  // On Monday (or first business day after a holiday), check if any
  // weekly vendors had a cutoff that fell on the weekend/holiday.
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (isBusinessDay(yesterday)) return; // yesterday was a business day — no rollover needed

  console.log('[paymentBatch] rollover-check: yesterday was non-business day, re-running weekly digest');
  await runVendorDigest(settings, true, 'cron'); // forceAll=true: rollover sends regardless of current hour
}

// ── Vendor work reminder ──────────────────────────────────────────────────────
// Separate from the payment digest. Finds vendors with assigned-but-incomplete
// recon tasks and sends a reminder showing what still needs to be done.

interface PendingWorkTask {
  categoryKey: string;
  categoryLabel: string;
  categoryIcon: string;
  taskStatus: string;
  workItems: string[];
}

interface PendingWorkVehicle {
  vehicleId: number;
  year: number;
  make: string;
  model: string;
  trim: string;
  vin: string;
  color: string;
  miles: number;
  location: string;
  vehicleStatus: string;
  soldTo: string | null;
  tasks: PendingWorkTask[];
}

export async function runVendorWorkReminder(settings: DigestSettings = DEFAULT_SETTINGS, forceAll = false): Promise<void> {
  if (!forceAll && !isBusinessDay()) return;

  const TZ = process.env.TZ || 'America/Phoenix';
  const nowHour = parseInt(new Date().toLocaleTimeString('en-US', { hour: 'numeric', hour12: false, timeZone: TZ }), 10);
  if (!forceAll && !settings.workReminderHours.includes(nowHour)) return;

  const vehicles = (await db.raw(
    `SELECT id, year, make, model, trim, vin, color, miles, location, status, sold_to, recon_data
     FROM vehicles WHERE recon_data IS NOT NULL AND status != 'delivered'`
  )).rows;

  const vendorRows = (await db.raw(
    `SELECT v.id, v.name, v.email_prefs,
            COALESCE(u.email, (
              SELECT u2.email FROM users u2
              WHERE u2.vendor_id = v.id AND u2.active = TRUE ORDER BY u2.id LIMIT 1
            )) AS contact_email
     FROM vendors v
     LEFT JOIN users u ON v.primary_user_id = u.id
     WHERE v.active = TRUE`
  )).rows;

  const vendorMap: Record<string, typeof vendorRows[0]> = {};
  vendorRows.forEach((vr: any) => { vendorMap[vr.name?.toLowerCase()?.trim()] = vr; });

  // Load all linked user emails for vendors with ccAllOnDigest
  const allLinkedEmails: Record<string, string[]> = {};
  const reminderVendorIds = vendorRows.filter((vr: any) => vr.email_prefs?.ccAllOnDigest).map((vr: any) => vr.id);
  if (reminderVendorIds.length > 0) {
    const linked = (await db.raw(
      `SELECT vendor_id, email FROM users WHERE vendor_id = ANY(?) AND active = TRUE AND email IS NOT NULL`,
      [reminderVendorIds]
    )).rows;
    for (const r of linked) {
      if (!allLinkedEmails[r.vendor_id]) allLinkedEmails[r.vendor_id] = [];
      allLinkedEmails[r.vendor_id].push(r.email.toLowerCase());
    }
  }

  // Group pending (incomplete) tasks by vendor
  const groups: Record<string, { vehicles: Map<number, PendingWorkVehicle>; meta: any }> = {};

  for (const v of vehicles) {
    let recon: Record<string, any> = {};
    try { recon = typeof v.recon_data === 'string' ? JSON.parse(v.recon_data) : v.recon_data; } catch { continue; }

    for (const key of VCAT_KEYS) {
      const task = recon[key];
      if (!task || !task.needed) continue;
      if (task.status === 'complete') continue;

      // Resolve vendor: locked name → accepted bid (selected) → assigned-but-not-yet-accepted (first entry)
      const selectedVendor = (task.vendors || []).find((x: any) => x.selected);
      const assignedVendor = (task.vendors || [])[0]; // at 'assigned'/'estimated' there's exactly one
      const effectiveVendorName: string = task.lockedVendorName || selectedVendor?.name || assignedVendor?.name || '';
      if (!effectiveVendorName) continue;

      const vendorName: string = effectiveVendorName;
      const vendorKey = vendorName.toLowerCase().trim();
      const meta = vendorMap[vendorKey] || null;

      if (!groups[vendorName]) groups[vendorName] = { vehicles: new Map(), meta };

      const existing = groups[vendorName].vehicles.get(v.id);
      const taskEntry: PendingWorkTask = {
        categoryKey: key,
        categoryLabel: CATEGORY_META[key]?.label || key,
        categoryIcon: CATEGORY_META[key]?.icon || '🔧',
        taskStatus: task.status || 'assigned',
        workItems: (task.workTasks || []).map((w: any) => w.desc || '').filter(Boolean),
      };

      if (existing) {
        existing.tasks.push(taskEntry);
      } else {
        groups[vendorName].vehicles.set(v.id, {
          vehicleId: v.id,
          year: v.year,
          make: v.make,
          model: v.model,
          trim: v.trim || '',
          vin: v.vin,
          color: v.color || '',
          miles: Number(v.miles) || 0,
          location: v.location || '',
          vehicleStatus: v.status,
          soldTo: v.sold_to || null,
          tasks: [taskEntry],
        });
      }
    }
  }

  const fn = TEMPLATES['vendor_work_reminder'];
  if (!fn) { console.warn('[paymentBatch] vendor_work_reminder template not found'); return; }

  let sent = 0;
  for (const [vendorName, { vehicles: vMap, meta }] of Object.entries(groups)) {
    const vehicleList = Array.from(vMap.values());
    // Sold vehicles first
    vehicleList.sort((a, b) => (a.vehicleStatus === 'sold' ? 0 : 1) - (b.vehicleStatus === 'sold' ? 0 : 1));

    const taskCount = vehicleList.reduce((sum, v) => sum + v.tasks.length, 0);

    const prefs: Record<string, any> = meta?.email_prefs || {};
    const recipientSet = new Set<string>();
    if (meta?.contact_email) recipientSet.add(meta.contact_email.toLowerCase());
    if (prefs.ccAllOnDigest && meta?.id && allLinkedEmails[meta.id]) {
      for (const e of allLinkedEmails[meta.id]) recipientSet.add(e);
    }

    if (recipientSet.size === 0) {
      console.warn(`[paymentBatch] work-reminder: no recipients for "${vendorName}" — skipping`);
      continue;
    }

    const rendered = fn({ vendorName, vehicles: vehicleList, taskCount, appUrl: APP_URL });
    if (!rendered) continue;

    for (const recipient of Array.from(recipientSet)) {
      const result = await sendEmail(recipient, rendered.subject, rendered.html);
      await logEmail(
        'vendor_work_reminder', recipient, null, rendered.subject,
        result.ok ? 'sent' : 'failed',
        result.ok ? null : (result.error || null),
        { vendor: vendorName },
        'cron',
        result.messageId,
        rendered.html
      );
    }

    console.log(`[paymentBatch] work-reminder sent to "${vendorName}" — ${taskCount} task(s) on ${vehicleList.length} vehicle(s)`);
    sent++;
  }

  console.log(`[paymentBatch] work-reminder: ${sent} vendor(s) notified`);
}
