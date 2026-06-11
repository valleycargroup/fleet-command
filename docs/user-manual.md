# Fleet Command — User Manual

**Valley Car Group | Vehicle Reconditioning Platform**

---

## Table of Contents

1. [What is Fleet Command?](#1-what-is-fleet-command)
2. [Logging In](#2-logging-in)
3. [User Roles at a Glance](#3-user-roles-at-a-glance)
4. [The Dashboard](#4-the-dashboard)
5. [Adding a Vehicle](#5-adding-a-vehicle)
6. [Vehicle Detail — What You'll See](#6-vehicle-detail--what-youll-see)
7. [Recon Workflow — Step by Step](#7-recon-workflow--step-by-step)
8. [Transport (Inbound & Outbound)](#8-transport-inbound--outbound)
9. [Parts Requests](#9-parts-requests)
10. [ARB Claims](#10-arb-claims)
11. [The Vendor Portal](#11-the-vendor-portal)
12. [Admin Tools](#12-admin-tools)
13. [Reports](#13-reports)
14. [CSV Import](#14-csv-import)
15. [Quick Reference — Statuses & Badges](#15-quick-reference--statuses--badges)

---

## 1. What is Fleet Command?

Fleet Command is the internal tool Valley Car Group uses to track every vehicle from the moment it's purchased through to final delivery. It replaces spreadsheets and phone tag with a single place where buyers, vendors, parts managers, and the admin team can all see what's happening with every car in real time.

It covers:
- Buying and grounding vehicles
- Assigning reconditioning work to vendors
- Reviewing and approving bids
- Ordering and tracking parts
- Managing inbound and outbound transport
- Marking vehicles sold and delivered

Locations: **PHX** and **Dallas**

---

## 2. Logging In

Go to your Fleet Command URL (e.g. `https://dev.fleetcommandrecon.net` for dev or `https://fleetcommandrecon.net` for production).

You'll see a login screen. Enter your **email address** and **password**, then click **Sign In**.

> If you've forgotten your password or don't have an account, contact your administrator.

**First-time admin login (initial setup only):**
- Email: `admin@fleetcommand.local`
- Password: `FleetAdmin1!`
- Change this password immediately after first login.

---

## 3. User Roles at a Glance

| Role | Who it's for | What they can do |
|---|---|---|
| **Admin** | Management / IT | Everything — full access to all vehicles, users, vendors, reports, and settings |
| **Buyer** | Vehicle buyers / reconditioning managers | Add vehicles, assign recon, approve bids, approve shipping, mark sold |
| **Seller** | Selling-side team | View vehicle status, track transport, delivery details |
| **Vendor** | External service providers | View only their assigned jobs, submit bids, upload photos, mark work complete |
| **Parts Manager** | Parts department | View and action all parts requests — approve, order, track, and mark installed |
| **AP** | Accounts payable | View completed recon costs and invoicing data |

Your role is set by an Admin when your account is created. If you need a different access level, contact your administrator.

---

## 4. The Dashboard

After logging in, you land on the main dashboard. This is your live list of all active vehicles.

### Filters and Search

At the top of the list you'll find:

- **Search bar** — search by VIN, stock number, year, make, model, or buyer name
- **Location filter** — PHX / Dallas / All
- **Status filter** — Active, In Recon, Sold, Delivered, All
- **Kicked filter** — toggle to show only vehicles that have been kicked back for additional recon

### Vehicle Cards

Each vehicle shows:
- Year / Make / Model / Trim
- Last 8 of VIN and stock number
- Miles, color, and location (PHX or Dallas)
- Purchase date and buying broker
- Current status badge
- Recon progress (categories completed vs. total assigned)
- Any active priority flags (e.g. **KICKED**, **READY TO SHIP**)

Click any vehicle to open the **Vehicle Detail** panel.

### Status Badges

| Badge | Meaning |
|---|---|
| Active | Just purchased, not yet in recon |
| In Recon | Recon work assigned or underway |
| Ready to Ship | All recon complete, awaiting buyer approval to ship |
| Sold | Sold to a dealer or retail customer |
| In Transit | Vehicle picked up, on its way to buyer |
| Delivered | Vehicle received at destination |
| **KICKED** (red) | Vehicle was returned — needs more work before resale |

---

## 5. Adding a Vehicle

**Who can do this:** Admin, Buyer

From the dashboard, click the **+ Add Vehicle** button (top right).

Fill in the required fields:

| Field | Notes |
|---|---|
| Purchase Date | Date the vehicle was bought |
| Source | Where it came from (Manheim Phoenix, ADESA Dallas, Copart, IAAI, OVE, ACV Auctions, Private Seller, Driveway, Trade-In, etc.) |
| Year / Make / Model / Trim | Vehicle details |
| Miles | Odometer reading at purchase |
| Color | Exterior color |
| Location | PHX or Dallas |
| Buying Broker | Team member who purchased the vehicle |
| VIN (last 8) | Last 8 characters of the VIN |
| Stock # | Optional internal stock number |

Click **Save** to add the vehicle. It will appear in the dashboard with **Active** status.

### Bulk Import

If you're adding many vehicles at once, use the **CSV Import** feature in the Admin menu. See [Section 14](#14-csv-import).

---

## 6. Vehicle Detail — What You'll See

Clicking a vehicle opens the detail panel, which is organized into tabs:

| Tab | Contents |
|---|---|
| **Overview** | Core vehicle info, purchase details, status summary |
| **Recon** | All recon categories — assign vendors, view bids, track progress |
| **Transport** | Inbound carrier details, outbound shipping setup |
| **Parts** | All parts requests linked to recon tasks on this vehicle |
| **ARB** | Arbitration / warranty claim if applicable |
| **History** | Full activity log — every status change, bid, approval, and note |

---

## 7. Recon Workflow — Step by Step

### Step 1 — Assign Recon Categories (Buyer)

Open the vehicle, go to the **Recon** tab. You'll see all 15 categories:

> Detail · Touch Up · Body Shop · PDR · Tires · Wheels · Interior · Mechanical · Windshield · Radio/Screens/Moonroofs · OEM Dealer · Black Widow Pics · Condition Report · Send to Auction · Parts

Toggle on each category that needs work. For each one, select which vendor(s) to assign. Vendors are filtered by category and location (PHX vs. Dallas).

Click **Save Assignments** when done. Assigned vendors will receive an email notification.

> **No Recon Needed:** If the vehicle is ready to go without any work, check the "No Recon Needed" option. The vehicle skips directly to ready-to-sell status.

---

### Step 2 — Vendor Submits Bid

The assigned vendor logs in and sees the vehicle under their portal. They add line items:

- Description of the work
- Price for each item
- Mark any items that **require a part**
- Cost type: **WS** (wholesale — internal cost) or **Retail** (passed to customer)

When done, the vendor clicks **Submit Bid**. The bid is locked and sent for buyer review.

---

### Step 3 — Buyer Reviews and Approves Bid

Back in the vehicle's Recon tab, the buyer sees the submitted bid. For each line item they can:

- **Accept** the line item
- **Decline** it (with a note)

Once all items are reviewed, click **Approve Bid** to authorize the vendor to start work. The vendor will be notified.

> Declined items are removed from the scope. The vendor can resubmit if needed.

---

### Step 4 — Work in Progress

Once a bid is approved, the status moves to **Started**. The vendor works on the vehicle and can:

- Upload **before/after photos**
- Flag items as complete
- Note an **estimated completion date**

---

### Step 5 — Vendor Marks Complete

When all work in their category is done, the vendor clicks **Mark Complete** and uploads final photos. The task status moves to **Complete**.

---

### Step 6 — All Categories Complete → Ready to Ship

When every assigned recon category shows **Complete**, the vehicle is automatically flagged as **Ready to Ship**. The buyer receives a notification.

The buyer reviews the completed work and clicks **Approve Shipping** to authorize outbound transport.

---

### Kicked Vehicles

If a dealer receives the vehicle and rejects it (failed inspection, undisclosed damage, etc.), the vehicle is **Kicked**. A kick reason is logged and the vehicle returns to active status with a red **KICKED** badge.

The kick history is visible under the vehicle's History tab. The vehicle then goes through another round of recon before being resold.

---

## 8. Transport (Inbound & Outbound)

Open the vehicle's **Transport** tab to manage shipping.

### Inbound Transport

Track the vehicle coming from the auction/source to your lot.

| Field | Notes |
|---|---|
| Transport Company | Carrier name |
| Phone / Email | Carrier contact |
| Destination | PHX or Dallas |
| ETA | Expected arrival date |
| Cost | Transport cost |
| Delivered | Check when vehicle arrives on lot |
| Date Delivered | Actual delivery date |

**Driveway purchases** have additional fields for the pickup clearance date and the driveway transport company.

---

### Outbound Transport

Set up when the vehicle is ready to ship to the buyer.

**Wholesale (dealer):**

| Field | Notes |
|---|---|
| Destination | Dealer name / company |
| Transport Company | Carrier |
| Cost | Transport cost |
| ETA | Expected delivery to dealer |
| Ready Date | Date vehicle was ready to go |
| Picked Up | Check when carrier collects it |
| Date Picked Up | Actual pickup date |
| Delivered | Check when dealer receives it |
| Date Delivered | Actual delivery date |

**Retail (end customer):**

Retail deliveries have all the above plus:

| Field | Notes |
|---|---|
| Customer Name | Buyer's full name |
| Customer Phone | Buyer's phone number |
| Customer Email | Buyer's email address |
| Delivery Address | Full delivery address |
| Customer Charge | Amount charged to customer for delivery |
| Shipping From | Origin location (PHX / Dallas) |

---

## 9. Parts Requests

When a vendor flags a line item as requiring a part, it appears in the **Parts** section.

### Parts Manager Workflow

Go to the **Parts** view (accessible from the main nav). You'll see all open parts requests across all vehicles.

Each request shows:
- Vehicle info (year/make/model)
- Part description
- Vendor it's assigned to
- Current status

| Status | What it means |
|---|---|
| Pending | Waiting for Parts Manager review |
| Approved | Parts Manager approved the order |
| Ordered | Part has been ordered from supplier |
| Arrived | Part received in shop |
| Installed | Part installed on the vehicle |

**To action a part:**

1. Click the part request
2. Click **Approve** — logs your name and today's date
3. Once ordered, click **Mark Ordered** — enter the order date
4. When it arrives, click **Mark Arrived**
5. Once the vendor installs it, click **Mark Installed**

Work on a recon category won't be marked complete until all required parts are installed.

---

## 10. ARB Claims

**ARB (Arbitration)** applies when a vehicle you purchased turns out to have undisclosed problems that the seller/auction is liable for.

Open the vehicle's **ARB** tab to log a claim:

| Field | Notes |
|---|---|
| Auction / Source | Where the vehicle was purchased |
| Claim Reason | Description of the issue |
| Claim Amount | Dollar amount being claimed |
| Status | Open → Submitted → Resolved |
| Resolution | Notes on outcome |

ARB claims are tracked for reporting and accounting purposes.

---

## 11. The Vendor Portal

Vendors log in to the same URL but see a different view — only their assigned vehicles and tasks.

### What vendors see

- A list of vehicles they've been assigned to
- The specific recon category they're responsible for
- Vehicle details (year/make/model, VIN, location)
- Any notes from the buyer

### Submitting a bid

1. Click the assigned vehicle
2. Go to your assigned category
3. Click **Add Line Item** for each piece of work
4. Enter a description and price
5. Check **Requires Part** if a part needs to be ordered first
6. Select cost type (WS or Retail)
7. Click **Submit Bid** when all items are entered

Once submitted, the bid is locked — you can't edit it. The buyer will review and approve or decline items.

### Uploading photos

At any point you can add photos under the **Photos** section of your task. This includes before photos when you start and completion photos when you finish.

Click **Upload Photos**, select your images, and they'll attach to the job.

### Marking work complete

When all work is done and photos are uploaded, click **Mark Complete**. The buyer will be notified.

---

## 12. Admin Tools

**Admin only.** Accessible from the top navigation menu.

### User Management

Add, edit, and deactivate team members.

- **Add User:** Name, email, password, role, location
- **Edit User:** Change role, reset password, update contact info
- **Deactivate:** Removes login access without deleting history

### Vendor Management

Manage the vendor directory.

- **Add Vendor:** Name, email, phone, categories they handle, locations they cover
- **Edit / Deactivate:** Update details or remove a vendor from the active list

Categories a vendor can cover: Detail, Touch Up, Body Shop, PDR, Tires, Wheels, Interior, Mechanical, Windshield, Electronics, OEM Dealer, Black Widow Photos, Condition Report, Auction, Parts

### Auction Management

Configure and manage auction sources. Used in the source dropdown when adding vehicles.

---

## 13. Reports

**Admin and Buyer access.** Accessible from the main navigation.

Reports let you analyze recon performance, costs, and turnaround times.

### Available report views

| Report | What it shows |
|---|---|
| **Recon Summary** | Total vehicles, average recon cost, average days in recon |
| **By Vendor** | Cost and completion time per vendor, by category |
| **By Location** | PHX vs. Dallas breakdown — volume, costs, cycle time |
| **By Category** | Which recon types are costing the most / taking the longest |
| **By Broker** | Volume and recon cost per buying broker |
| **Kicked Vehicles** | History of kicked vehicles — reason, dealer, dates |
| **Parts** | Parts spend by vendor, category, and date range |
| **Transport Costs** | Inbound and outbound shipping costs |

### Filters

Most reports can be filtered by:
- **Date range** (purchase date or completion date)
- **Location** (PHX, Dallas, or Both)
- **Buyer / Broker**

### Exporting

Reports can be exported to CSV for use in Excel.

---

## 14. CSV Import

**Admin only.** Use this to bulk-add vehicles from an auction export or spreadsheet.

### How to import

1. From the Admin menu, click **CSV Import**
2. Download the **template** if you haven't already
3. Fill in your vehicles in the template
4. Upload the completed CSV file
5. Review the preview — check for any validation errors
6. Click **Confirm Import**

### Required columns

| Column | Format |
|---|---|
| purchase_date | MM/DD/YYYY |
| year | 4-digit year |
| make | Text |
| model | Text |
| trim | Text |
| miles | Number |
| color | Text |
| location | PHX or Dallas |
| source | Must match an available source |
| buying_broker | Must match an existing user |
| vin8 | Last 8 characters of VIN |

Optional columns: `stock_number`, `selling_broker`, `notes`

> Rows with missing required fields or invalid values will be flagged and skipped. Correct the errors and re-upload.

---

## 15. Quick Reference — Statuses & Badges

### Vehicle Status

| Status | Description |
|---|---|
| Active | Purchased, no recon assigned yet |
| In Recon | Recon categories assigned or work underway |
| Sold | Marked as sold to a dealer or customer |
| In Transit | Outbound carrier has the vehicle |
| Delivered | Vehicle confirmed received at destination |

### Recon Category Status

| Status | Description |
|---|---|
| N/A | This category was not selected for this vehicle |
| Assigned | Vendor assigned, bid not yet submitted |
| Bid Submitted | Vendor has submitted their bid, awaiting buyer review |
| Approved | Bid approved by buyer, vendor cleared to start |
| Started | Vendor has begun work |
| Parts Pending | Work is waiting on a part to arrive |
| Complete | Work finished and marked complete by vendor |

### Priority Flags (Dashboard Badges)

| Flag | Meaning |
|---|---|
| KICKED | Vehicle was rejected, needs re-work |
| READY TO SHIP | All recon done, waiting on buyer shipping approval |
| PARTS PENDING | One or more parts are blocking completion |
| IN TRANSIT | Outbound carrier has picked up the vehicle |

---

## Need Help?

Contact your system administrator for:
- Password resets
- New user accounts
- Role changes
- Technical issues

---

*Fleet Command — Valley Car Group*
*Document version: 1.0*
