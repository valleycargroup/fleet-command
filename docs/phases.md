# Fleet Command Enhancement Phases

Each phase is a self-contained git commit on the `feature/fleet-enhancements` branch.
To revert any phase: `git revert <commit-sha>` — it will not affect other phases.

---

## Phase 1 — Scheduler Infrastructure
**Commit:** `f961877`  
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

---

## Phase 2 — Vendor Payment Notification System
**Commit:** `ac61b40`  
**Status:** ✅ Complete

### What it does
- `buildVendorPaymentQueue()` queries all vehicles/recon_data, groups approved-unpaid jobs by vendor, applies payment terms (completion vs. weekly cutoff)
- Sold vehicles sorted to top of each vendor batch (buyer waiting)
- `isWeeklyCutoffDue()` respects each vendor's `cutoff_day` + `cutoff_time`
- `runVendorDigest()` sends digest only to vendors with pending work (no empty emails)
- `runRolloverCheck()` re-runs digest after weekend/holiday gaps

### Files changed
| File | Change |
|---|---|
| `apps/server/src/lib/paymentBatch.ts` | Full implementation (replaces Phase 1 stub) |
| `apps/server/src/lib/email-templates.ts` | New `vendor_payment_pending_digest` template |
| `apps/server/src/routes/payments.ts` | New route — queue view + manual trigger |
| `apps/server/src/routes/index.ts` | Mount `/api/payments` |

### API endpoints added
- `GET /api/payments/queue` — view full pending batch (admin/buyer)
- `POST /api/payments/trigger-digest` — manual send trigger (admin)

---

## Phase 3 — Vehicle Sort & Kickback Priority
**Commit:** `44e1c30`  
**Status:** ✅ Complete

### What it does
Replaces the flat chronological sort in `VehicleTable.tsx` with a 7-tier urgency sort:

| Tier | State | Secondary sort |
|---|---|---|
| 1 | Kicked + Delivered (returned) | Most recently kicked first |
| 2 | Kicked + Not Yet Resold | Most recently kicked first |
| 3 | Sold + Active/Incomplete Recon | Oldest sale date first |
| 4 | Sold + No Pending Recon | Oldest sale date first |
| 5 | Active + Past-Due Recon | Oldest purchase date first |
| 6 | Active — On Ground | Oldest purchase date first |
| 7 | Active — Inbound | Soonest ETA first |

Kicked+Delivered vehicles are pulled back to the main Inventory tab.

### Files changed
| File | Change |
|---|---|
| `apps/client/src/components/VehicleTable.tsx` | New `sortVehicles()` + updated `getPriority()` |

---

## Phase 4 — Task URL Rendering
**Commit:** `a607f25`  
**Status:** ✅ Complete

### What it does
Auto-detects `http://` and `https://` URLs in task descriptions and vehicle notes
and renders them as clickable `<a>` tags opening in a new tab. Works on existing
stored data — no migration needed.

### Files changed
| File | Change |
|---|---|
| `apps/client/src/lib/utils.ts` | New `linkifyText()` utility |
| Various task/note render sites | Apply `linkifyText()` |

---

## Phase 5 — Email Audit & Vehicle Links
**Commit:** `5288212`  
**Status:** ✅ Complete

### What it does
Comprehensive audit of all 36 email templates and 30+ client-side `fireEmail`
calls. Six specific issues fixed:

| Issue | Fix |
|---|---|
| Driveway inbound Picked Up — no email | Fires `driveway_inbound_pickedup` |
| Hold Shipping — no email | Fires `shipping_hold` with reason/date |
| `seller_vehicle_sold` buyer not notified | Buyer added to recipients |
| `driveway_inbound_pickedup` not in `buyerTypes` | Added |
| Templates missing vehicle deep-link | `View Vehicle →` CTA added to all |
| `vLink()` crashes on null vehicle ID | Falls back to app root URL |

### Files changed
| File | Change |
|---|---|
| `apps/server/src/lib/email-templates.ts` | `vLink()` null guard; CTAs on `dealer_vehicle_shipped`, `dealer_vehicle_delivered` |
| `apps/server/src/routes/email-send.ts` | `driveway_inbound_pickedup` in `buyerTypes`; `seller_vehicle_sold` buyer block |
| `apps/client/src/components/VehicleDetail.tsx` | `fireEmail` calls for driveway Picked Up and Hold Shipping |

---

## Phase 6 — Broker / Seller Email Logic
**Commit:** `61e09f9`  
**Status:** ✅ Complete

### What it does
- Seller broker now receives a copy of 12 event types (previously buyer-only)
- `greet()` helper picks the right name per recipient (buyer sees buyer name, seller sees seller name)
- Deduplication: buyer === seller → one email, not two (existing `Set<string>` handles this automatically)
- Seller name resolved server-side from `data.seller` or `vehicle.sellingBroker` — no client changes needed

### Files changed
| File | Change |
|---|---|
| `apps/server/src/lib/email-templates.ts` | New `greet()` helper; `${greet(d)}` in 8 transport/delivery templates |
| `apps/server/src/routes/email-send.ts` | Expanded `sellerGetsEmail` list (12 types); seller name fallback |

---

## Phase 7 — Dealer Management
**Commit:** `8c887a8`  
**Status:** ✅ Complete

### What it does
- New `dealers` table with `responsible_for_pickup` boolean and `auction_id` for import dedup
- Full CRUD API: `GET/POST /api/dealers`, `PUT/DELETE /api/dealers/:id`
- One-click import from Auction system via `POST /api/dealers/import-from-auction` — upserts on `auction_id`, preserves pickup responsibility flag
- Auction app gets `GET /api/integrations/fleet-command/dealerships` endpoint (secured by existing `fleetCommandApiKeyMiddleware`)
- Client: dealers loaded on app start via Zustand; **Dealers** tab (admin only) with table, add/edit modal, quick toggle, import button
- VehicleDetail: "Dealer Responsible for Pickup" badge when sold-to name matches a registered dealer

### Files changed
| File | Change |
|---|---|
| `db/migrations/007_dealers.sql` | New dealers table + lowercase name index |
| `apps/server/src/routes/dealers.ts` | New route file — full CRUD + import |
| `apps/server/src/routes/index.ts` | Mount `/api/dealers` |
| `apps/client/src/lib/store.ts` | `dealers` state, `fetchDealers` action, `loadData` parallel fetch |
| `apps/client/src/pages/DealersPage.tsx` | New page |
| `apps/client/src/App.tsx` | Import + Dealers tab |
| `apps/client/src/components/VehicleDetail.tsx` | Pickup badge in sold-to section |
| `d:\websites\auction\…\integrations.route.ts` | `GET /fleet-command/dealerships` (separate repo commit `f4ad639`) |

---

## Reverting a Phase

Each phase is a single git commit. To revert:

```bash
# List commits on this branch
git log --oneline feature/fleet-enhancements

# Revert a specific phase (creates a new revert commit, safe)
git revert <sha>

# To revert multiple phases in order (newest first)
git revert <sha-7> <sha-6> ... <sha-1>
```
