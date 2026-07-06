/**
 * Scheduler — Phase 1
 *
 * Uses node-cron (process-based, no OS cron required).
 * Works identically on local Docker and EC2.
 * Timezone is set via TZ env var (default: America/Phoenix).
 *
 * Jobs registered here:
 *   - Vendor pending-work digest  → every hour Mon–Fri; settings control who fires
 *   - Weekend/holiday rollover check → 8am Mon–Fri
 *
 * Digest schedule (read from site_settings at runtime — no restart needed):
 *   digest_daily_hours  "8,12,17"   → hours completion-terms vendors are notified
 *   digest_weekly_day   "Friday"    → day of week weekly-terms vendors are notified
 *   digest_weekly_hour  "17"        → hour on that day weekly-terms vendors are notified
 */

import cron from "node-cron";
import db from "./db";

const TZ = process.env.TZ || "America/Phoenix";

export interface DigestSettings {
	dailyHours: number[];
	weeklyDay: string;
	weeklyHour: number;
}

const DEFAULTS: DigestSettings = {
	dailyHours: [8, 12, 17],
	weeklyDay: "Friday",
	weeklyHour: 17,
};

async function getDigestSettings(): Promise<DigestSettings> {
	try {
		const rows = (
			await db.raw(
				`SELECT key, value FROM site_settings WHERE key IN ('digest_daily_hours','digest_weekly_day','digest_weekly_hour')`,
			)
		).rows;
		const map: Record<string, string> = {};
		for (const r of rows) map[r.key] = r.value;

		const dailyHours = map["digest_daily_hours"]
			? map["digest_daily_hours"]
					.split(",")
					.map((h: string) => parseInt(h.trim(), 10))
					.filter((h: number) => !isNaN(h))
			: DEFAULTS.dailyHours;
		const weeklyDay = map["digest_weekly_day"] || DEFAULTS.weeklyDay;
		const weeklyHour = map["digest_weekly_hour"]
			? parseInt(map["digest_weekly_hour"], 10)
			: DEFAULTS.weeklyHour;

		return { dailyHours, weeklyDay, weeklyHour };
	} catch {
		return DEFAULTS;
	}
}

// ── US Federal Holidays (MM-DD, year-independent) ────────────────────────────
const FEDERAL_HOLIDAYS = new Set([
	"01-01", // New Year's Day
	"07-04", // Independence Day
	"11-11", // Veterans Day
	"12-25", // Christmas Day
]);

export function isBusinessDay(date: Date = new Date()): boolean {
	// Use configured timezone so weekend/holiday check matches the server's operating timezone
	const parts = new Intl.DateTimeFormat("en-US", {
		timeZone: TZ,
		weekday: "short",
		month: "2-digit",
		day: "2-digit",
	}).formatToParts(date);
	const weekday = parts.find((p) => p.type === "weekday")?.value; // 'Sat', 'Sun', etc.
	const month = parts.find((p) => p.type === "month")?.value;
	const day = parts.find((p) => p.type === "day")?.value;
	if (weekday === "Sat" || weekday === "Sun") return false;
	const mmdd = `${month}-${day}`;
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

const TICK_LOG_LIMIT = 3; // log first N ticks per job to confirm firing, then go silent

function register(name: string, expression: string, fn: JobFn) {
	let ticks = 0;
	const wrapped: JobFn = async () => {
		ticks++;
		if (ticks <= TICK_LOG_LIMIT) {
			console.log(
				`[scheduler] "${name}" tick #${ticks}${ticks === TICK_LOG_LIMIT ? " (last confirmation log — silent from here unless action taken)" : ""}`,
			);
		}
		await fn();
	};
	jobs.push({ name, expression, fn: wrapped });
}

// ── Job: vendor pending-work digest (every hour — settings decide who fires) ─
register("vendor-digest", "0 * * * 1-5", async () => {
	if (!isBusinessDay()) {
		console.log("[scheduler] vendor-digest skipped — not a business day");
		return;
	}
	const settings = await getDigestSettings();
	const currentHour = new Date().getHours();

	const isDailyRun = settings.dailyHours.includes(currentHour);
	const isWeeklyRun =
		new Date().toLocaleDateString("en-US", {
			weekday: "long",
			timeZone: TZ,
		}) === settings.weeklyDay && currentHour === settings.weeklyHour;

	if (!isDailyRun && !isWeeklyRun) return;

	console.log(
		`[scheduler] vendor-digest running — hour ${currentHour} | daily=${isDailyRun} weekly=${isWeeklyRun}`,
	);
	try {
		const { runVendorDigest } = await import("./paymentBatch");
		await runVendorDigest(settings, false, "cron");
	} catch (e) {
		console.error("[scheduler] vendor-digest failed:", e);
	}
});

// ── Job: weekend/holiday rollover check (8am Mon–Fri) ────────────────────────
register("rollover-check", "0 8 * * 1-5", async () => {
	console.log("[scheduler] rollover-check running");
	try {
		const settings = await getDigestSettings();
		const { runRolloverCheck } = await import("./paymentBatch");
		await runRolloverCheck(settings);
	} catch (e) {
		console.error("[scheduler] rollover-check failed:", e);
	}
});

// ── Job: email body HTML expiry (2am daily) ───────────────────────────────────
register("email-body-expiry", "0 2 * * *", async () => {
	try {
		const row = (
			await db.raw(
				`SELECT value FROM site_settings WHERE key = 'email_body_retention_days' LIMIT 1`,
			)
		).rows[0];
		const days = parseInt(row?.value || "30", 10);
		if (isNaN(days) || days <= 0) return;
		const result = await db.raw(
			`UPDATE email_log SET body_html = NULL WHERE body_html IS NOT NULL AND created_at < NOW() - INTERVAL '${days} days'`,
		);
		const count = result.rowCount ?? 0;
		if (count > 0)
			console.log(
				`[scheduler] email-body-expiry: cleared body_html from ${count} row(s) older than ${days} days`,
			);
	} catch (e) {
		console.error("[scheduler] email-body-expiry failed:", e);
	}
});

// ── Start all registered jobs ─────────────────────────────────────────────────
export function startScheduler() {
	if (process.env.NODE_ENV === "test") {
		console.log("[scheduler] skipped in test environment");
		return;
	}

	jobs.forEach(({ name, expression, fn }) => {
		cron.schedule(expression, fn, { timezone: TZ });
		console.log(`[scheduler] registered "${name}" → ${expression} (${TZ})`);
	});

	console.log(`[scheduler] started — ${jobs.length} job(s) active`);
}
