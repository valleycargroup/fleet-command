# Fleet Command Enhancement Phases

Each phase is a self-contained git commit on the `feature/fleet-enhancements` branch.
To revert any phase: `git revert <commit-sha>` — it will not affect other phases.

---

## Phase 1 — Scheduler Infrastructure
**Branch commit:** `phase-1: scheduler infrastructure`
**Status:** ✅ Complete

### What it does
Adds a process-based cron scheduler using `node-cron`. No OS-level cron or AWS
services required — it runs inside the Node.js process, so it works identically
on local Docker and EC2.

### Files changed
| File | Change |
|---|---|
| `apps/server/src/lib/scheduler.ts` | New — cron job registry, business-day helpers |
| `apps/server/src/lib/paymentBatch.ts` | New — stub (Phase 2 fills this in) |
| `apps/server/src/server.ts` | `startScheduler()` called after server starts |
| `apps/server/package.json` | Added `node-cron`, `@types/node-cron` |

### Scheduled jobs
| Job | Expression | Purpose |
|---|---|---|
| `vendor-digest` | `0 8,12,17 * * 1-5` | Vendor pending-work email (3× weekday) |
| `rollover-check` | `0 8 * * 1-5` | Catch missed weekend/holiday sends |

### Configuration
Set `TZ=America/Phoenix` in `.env` to control the cron timezone.
Scheduler is automatically disabled in `NODE_ENV=test`.

### To revert
```bash
git revert <phase-1-sha>
# Then remove node-cron from package.json manually if desired
```

---

## Phase 2 — Vendor Payment Notification System
**Status:** 🔜 Pending

### What it will do
- Query all vehicles for approved-but-unpaid recon tasks
- Group by vendor, apply payment terms (daily / weekly cutoff)
- Sort sold vehicles to top of each vendor batch
- Send digest email to each vendor with pending work
- Skip vendors with no pending work (no empty emails)
- `GET /api/payments/queue` — admin endpoint to view current batch status

### Files to be changed
| File | Change |
|---|---|
| `apps/server/src/lib/paymentBatch.ts` | Full implementation (replaces stub) |
| `apps/server/src/lib/email-templates.ts` | New `vendor_payment_pending_digest` template |
| `apps/server/src/routes/payments.ts` | New route file |
| `apps/server/src/routes/index.ts` | Mount payments route |

---

## Phase 3 — Vehicle Sort & Kickback Priority
**Status:** 🔜 Pending

### What it will do
Update `VehicleTable.tsx` sort order to:

| Priority | State |
|---|---|
| 1 | Kicked + Delivered (returned after delivery) |
| 2 | Kicked + Not Yet Resold |
| 3 | Sold + Active/Incomplete Recon (oldest sale date first) |
| 4 | Sold + No Pending Recon |
| 5 | Active + Past-Due Recon |
| 6 | Active + Incomplete Recon — On Ground |
| 7 | Active + Incomplete Recon — Inbound |
| Delivered tab | Delivered (non-kicked) — as today |

Kicked + Delivered vehicles are pulled back to the main tab (removed from Delivered tab).

### Files to be changed
| File | Change |
|---|---|
| `apps/client/src/components/VehicleTable.tsx` | Updated sort comparator |

---

## Phase 4 — Task URL Rendering
**Status:** 🔜 Pending

### What it will do
- Auto-detect `http://` and `https://` URLs in task descriptions and notes
- Render as clickable `<a>` tags opening in a new tab
- Works on existing stored data — no migration needed

### Files to be changed
| File | Change |
|---|---|
| `apps/client/src/lib/utils.ts` | New `linkifyText()` utility |
| Task description/notes render components | Apply `linkifyText()` |

---

## Phase 5 — Email Audit & Vehicle Links
**Status:** 🔜 Pending

### What it will do
- Audit all `sendEmail` / `fireEmail` calls server and client side
- Fix any broken trigger conditions
- Add vehicle deep-link to all email templates that reference a vehicle
- Gracefully handle deleted/missing vehicles (text only, no broken link)

---

## Phase 6 — Broker / Seller Email Logic
**Status:** 🔜 Pending

### What it will do
- Send event emails to both buyer broker and seller broker
- Sellers who don't buy still receive their seller-side notifications
- Deduplicates when buyer === seller (one email, not two)

---

## Phase 7 — Dealer Management
**Status:** 🔜 Pending

### What it will do
- Add `responsible_for_pickup BOOLEAN DEFAULT FALSE` to dealers table
- Migration file for existing databases
- Import dealers from Auction system via existing integration API
- UI: checkbox on dealer form, flag visible on vehicle records

---

## Reverting a Phase

Each phase is a single git commit. To revert:

```bash
# List commits on this branch
git log --oneline feature/fleet-enhancements

# Revert a specific phase (creates a new revert commit, safe)
git revert <sha>

# To revert multiple phases in order (newest first)
git revert <sha-3> <sha-2> <sha-1>
```
