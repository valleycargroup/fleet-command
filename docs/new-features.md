# Fleet Command — New Features Guide

Seven feature sets were added on the `feature/fleet-enhancements` branch.
This document explains what each one does and how to use it day-to-day.

---

## 1. Scheduled Vendor Payment Digests

### What changed
Vendor payment emails now send automatically — no manual trigger required.
The server runs an internal cron scheduler (no OS cron or AWS services needed)
that fires the digest on a weekday-only schedule.

### Schedule
| Time (AZ) | What happens |
|---|---|
| 8 AM, 12 PM, 5 PM — Mon–Fri | Each vendor with pending, approved work receives a digest email listing their jobs |
| 8 AM Mon (rollover check) | Catches any digest that was skipped over a weekend or holiday |

Vendors with no pending work receive nothing.

### The digest email
- Lists every vehicle awaiting payment, grouped by vendor
- **Sold vehicles appear at the top** of the vendor's list so work tied to a buyer-waiting sale is settled first
- Each vehicle row shows the job type, recon category, W/S vs. retail flag, and a direct link to the vehicle
- Payment terms (weekly cutoff vs. immediate) are respected — a vendor on weekly terms will only receive the digest when their cutoff day/time has passed for the week

### Manual trigger (admins)
If you need to send the digest immediately without waiting for the schedule:

```
POST /api/payments/trigger-digest
Authorization: Bearer <token>
```

Returns a count of how many vendors were emailed.

### View the payment queue
The **Payment Queue** tab (visible to Admins and AP staff) shows every pending vendor job in the current batch — same data that goes into the digest email.

---

## 2. Vehicle Sort Priority

### What changed
The Inventory table now sorts automatically by urgency. Vehicles no longer appear in flat chronological order.

### Sort order (top to bottom)
| Priority | State | Secondary sort |
|---|---|---|
| 1 | Kicked + returned after delivery | Most recently kicked first |
| 2 | Kicked + not yet resold | Most recently kicked first |
| 3 | Sold + recon still in progress | Oldest sale date first (buyer waiting longest) |
| 4 | Sold + recon complete (ready to ship) | Oldest sale date first |
| 5 | Active + past-due recon (ETA missed) | Oldest purchase date first |
| 6 | Active + on ground | Oldest purchase date first |
| 7 | Active + inbound | Soonest ETA first |

Kicked vehicles that have been returned after delivery are pulled back onto the main Inventory tab (removed from Delivered).

You can still click any column header to sort by that column — the priority sort is the default only.

---

## 3. Clickable URLs in Task Notes

### What changed
Any URL you type into a task description or vehicle note is now automatically rendered as a clickable link. No formatting required.

### How to use
Just paste a link anywhere in a task description or note field:

```
Approved by dealer — see email thread https://mail.google.com/...
Photo reference https://photos.app.goo.gl/...
```

The URL becomes a blue underlined link that opens in a new tab. Works on all existing data — no re-entry needed.

---

## 4. Email Audit Fixes

### What changed
Six email triggers that were broken or missing were fixed:

| Trigger | What was wrong | Fix |
|---|---|---|
| Driveway inbound — Picked Up | No email fired when checkbox was ticked | Now fires `driveway_inbound_pickedup` |
| Hold Shipping button | No email fired when buyer unapproved | Now fires `shipping_hold` with reason and date |
| `seller_vehicle_sold` | Buyer broker was not notified | Buyer now receives a copy |
| `driveway_inbound_pickedup` | Buying broker was not in the recipient list | Added to `buyerTypes` |
| Vehicle deep-links in emails | All templates that mention a vehicle now include a **View Vehicle →** button | Fixed across all templates |
| Null vehicle ID | `vLink()` would generate a broken URL if the vehicle had no ID | Now falls back to the app root URL |

### Vehicle deep-link button
Every email that references a specific vehicle now includes a teal **View Vehicle →** button at the bottom. Clicking it opens Fleet Command directly to that vehicle's detail view.

---

## 5. Seller Broker Email Notifications

### What changed
Previously, most event emails only went to the **buying broker**. Now the **selling broker** also receives notifications for events that affect them.

### Events that now reach the seller broker
- Vehicle grounded
- Transport inbound set
- Buyer recon complete
- Buyer approved shipping
- Driveway outbound shipped / delivered
- Retail vehicle shipped / delivered
- Dealer vehicle shipped / delivered
- Vehicle sold (seller confirmation)
- Vehicle kicked (seller notification)

### Personalised greeting
Each recipient now gets the right name in the greeting. Buyer brokers see their name; seller brokers see theirs. When buyer and seller are the same person, one email is sent (not two).

### No client changes needed
Seller emails are resolved automatically server-side from the `sellingBroker` field on the vehicle. No changes are needed to existing fireEmail calls.

---

## 6. Dealer Management

### What changed
Fleet Command now has a dedicated dealer registry. Dealers are separate from the general sold-to text field — they're stored records you can manage and import.

### Key field: Responsible for Pickup
Each dealer has a **Responsible for Pickup** flag. When this is enabled for a dealer and a vehicle's "Sold To" name matches that dealer, a blue badge appears on the vehicle detail card:

> 🚗 Dealer Responsible for Pickup

This makes it immediately clear who is arranging the outbound pickup.

---

### Dealers tab (Admin only)

Navigate to **Dealers** in the top tab bar (visible to admins only).

#### Add a dealer manually
1. Click **+ Add Dealer**
2. Fill in name, phone, email, address, city, state, zip
3. Check **Dealer picks up vehicle** if they handle their own pickup
4. Click **Add Dealer**

#### Edit a dealer
Click **Edit** on any row, change the fields, click **Save Changes**.

#### Toggle pickup responsibility quickly
Click the **Yes / No** button in the Pickup Responsible column directly in the table — no need to open the edit modal.

#### Remove a dealer
Click **Remove** — this soft-deletes the dealer (they won't appear in the list, but the record is kept for history).

---

### Import from Auction

Click **Import from Auction** to pull the full dealership list from the Auction system automatically.

- New dealers are added
- Existing dealers (matched by Auction ID) are updated with the latest name, phone, email, and address
- The import reports how many were new vs. updated
- Pickup responsibility is **not overwritten** on import — once you set it in Fleet Command, it stays

Run the import whenever you want to sync the dealer list. It is safe to run multiple times.

---

### Searching dealers

The global search bar (top right of the tab bar) filters the dealer list by name, city, or state while you're on the Dealers tab.

---

## Reverting a Feature

Each feature is a single git commit. To undo one without affecting others:

```bash
git log --oneline feature/fleet-enhancements   # find the sha
git revert <sha>                                # creates a safe undo commit
```

| Commit message | Feature |
|---|---|
| `phase-1: scheduler infrastructure` | Cron scheduler |
| `phase-2: vendor payment notification system` | Payment digest email |
| `phase-3: vehicle sort & kickback priority` | Inventory sort order |
| `phase-4: task URL rendering` | Clickable links in notes |
| `phase-5: email audit & vehicle links` | Email trigger fixes + deep-links |
| `phase-6: broker/seller email logic` | Seller broker notifications |
| `phase-7: dealer management` | Dealers tab + pickup flag + import |
