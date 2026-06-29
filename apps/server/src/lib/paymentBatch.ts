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
import { isBusinessDay, nextBusinessDay } from './scheduler';

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
  vin8: string;
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

export async function buildVendorPaymentQueue(): Promise<VendorBatch[]> {
  // Load all vehicles with recon data
  const vehicles = (await db.raw(
    `SELECT id, year, make, model, trim, vin, vin8, color, miles, location,
            status, sold_to, sale_date, recon_data
     FROM vehicles
     WHERE recon_data IS NOT NULL AND status != 'delivered'`
  )).rows;

  // Load all vendors for payment terms lookup (by name)
  const vendorRows = (await db.raw(
    `SELECT v.name, v.payment_terms, v.cutoff_day, v.cutoff_time, v.delivery_method,
            u.email AS contact_email
     FROM vendors v
     LEFT JOIN users u ON v.primary_user_id = u.id
     WHERE v.active = TRUE`
  )).rows;

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

      // Find vendor email from selected bid
      const selectedVendor = (task.vendors || []).find((x: any) => x.selected);
      const vendorEmail = vendorMeta?.contact_email || selectedVendor?.email || null;

      const job: PendingJob = {
        vehicleId:     v.id,
        year:          v.year,
        make:          v.make,
        model:         v.model,
        trim:          v.trim || '',
        vin8:          v.vin8 || (v.vin || '').slice(-8),
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
    const vendorEmail    = meta?.contact_email   || jobs[0]?.vendorEmail || null;

    // Sold vehicles sort to top within each vendor batch
    const sorted = [...jobs].sort((a, b) => {
      const aSold = a.status === 'sold' ? 0 : 1;
      const bSold = b.status === 'sold' ? 0 : 1;
      return aSold - bSold;
    });

    const isDue =
      paymentTerms === 'completion' ||
      isWeeklyCutoffDue(cutoffDay, cutoffTime, now);

    const isSoldPriority = jobs.some(j => j.status === 'sold');

    const total      = jobs.reduce((s, j) => s + j.lockedTotal, 0);
    const totalWS    = jobs.reduce((s, j) => s + j.lockedWS, 0);
    const totalRetail = jobs.reduce((s, j) => s + j.lockedRetail, 0);

    return {
      vendorName, vendorEmail, paymentTerms, cutoffDay, cutoffTime,
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

async function sendVendorDigestEmail(batch: VendorBatch): Promise<void> {
  if (!batch.vendorEmail) {
    console.warn(`[paymentBatch] no email for vendor "${batch.vendorName}" — skipping`);
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

  const result = await sendEmail(batch.vendorEmail, rendered.subject, rendered.html);
  await logEmail(
    'vendor_payment_pending_digest',
    batch.vendorEmail,
    null,
    rendered.subject,
    result.ok ? 'sent' : 'failed',
    result.ok ? null : (result.error || null)
  );

  console.log(`[paymentBatch] digest sent to "${batch.vendorName}" <${batch.vendorEmail}> — ${batch.jobs.length} job(s)`);
}

// ── Scheduler entry points ────────────────────────────────────────────────────

export async function runVendorDigest(): Promise<void> {
  if (!isBusinessDay()) return;

  const queue = await buildVendorPaymentQueue();
  const due   = queue.filter(b => b.isDue && b.jobs.length > 0);

  console.log(`[paymentBatch] ${due.length} vendor(s) due for digest (${queue.length} total with pending work)`);

  for (const batch of due) {
    await sendVendorDigestEmail(batch);
  }
}

export async function runRolloverCheck(): Promise<void> {
  // On Monday (or first business day after a holiday), check if any
  // weekly vendors had a cutoff that fell on the weekend/holiday.
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (isBusinessDay(yesterday)) return; // yesterday was a business day — no rollover needed

  console.log('[paymentBatch] rollover-check: yesterday was non-business day, re-running weekly digest');
  await runVendorDigest();
}
