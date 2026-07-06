# Fleet Command — Launch & Seed Guide

## Test Credentials

All test accounts share the same password: **`password123`**

| Role | Email | Notes |
|------|-------|-------|
| Admin | `michael.alanw@gmail.com` | Receives real system emails |
| TechSupport | `techsupport@fleettest.local` | §7 CR assignee, §18 TechSupport role |
| Buyer | `buyer@fleettest.local` | PHX buyer — approves bids on PHX vehicles |
| Buyer + Seller | `buyerseller@fleettest.local` | Dallas — approves bids on DFW-001 |
| Seller / Broker | `sales@rfdprint.com` | Receives real broker emails (§16) |
| AP | `ap@fleettest.local` | Sees Payment Queue tab (§9) |
| Vendor A | `vendor@fleettest.local` | Detail Pro PHX — primary contact (§27) |
| Vendor B | `vendor2@fleettest.local` | Detail Pro PHX — swap primary test (§23/§27) |
| Vendor C | `vendor3@fleettest.local` | Touch Up Pro — no primary set (§27 "no primary" card) |

**Real emails:** `michael.alanw@gmail.com` and `sales@rfdprint.com` will receive actual SendGrid emails when triggered. All `@fleettest.local` addresses are fake and safe.

---

## Seeded Test Data

| Stock # | Vehicle | Location | Status | Key test uses |
|---------|---------|----------|--------|---------------|
| PHX-001 | 2024 Ford F-150 XLT | PHX | Active | §1 Login, §2 Search "FORD", §3 Edit, §7 CR assign (none set), §16 Broker email, §28 WebSocket |
| PHX-002 | 2023 Toyota Camry SE | PHX | Active | **All 5 recon states, all Detail Pro PHX** — §4 full workflow, §5 Vendor portal (submit bid → approve → start → complete), §13 URL in notes, §14 Priority (interior=3) |
| PHX-003 | 2024 Jeep Grand Cherokee | PHX | Active | §6 Set outbound transport then mark delivered, §16 Broker email (seller=rfdprint, buyer approved) |
| PHX-004 | 2022 Honda Accord Sport | PHX | Delivered | §2 Delivered tab |
| PHX-005 | 2023 BMW 3 Series 330i | PHX | Active | §4 Mark as Started (detail=approved), §7 CR assigned to TechSupport (change status), §10 Photos |
| PHX-006 | 2025 Chevy Equinox LT | PHX | Active | §3 Delete vehicle, §6 Transport from scratch (empty) |
| DFW-001 | 2023 Ram 1500 Big Horn | Dallas | Active | §2 Dallas filter, §4 Approve bid (Phoenix Recon Group), §5 Vendor isolation (vendor@fleettest.local cannot see this) |
| DFW-002 | 2024 GMC Sierra SLE | Dallas | Active | §2 Dallas filter, §6 Mark inbound as delivered |

**PHX-002 recon detail** (all tasks assigned to Detail Pro PHX, `vendor@fleettest.local`):

| Category | State | What to test |
|----------|-------|-------------|
| detail | assigned, no bid | Vendor submits bid |
| bodyshop | bid submitted ($900), awaiting approval | Buyer approves bid; pre-seeded note with URLs (§13) |
| touchup | approved | Vendor marks as Started |
| pdr | started | Vendor marks as Complete |
| interior | complete, priority=3 | See complete state; priority dropdown (§14) |

Vendors seeded: **Detail Pro PHX** (Alex + Maria linked, payment email set, primary=Alex), **Body Shop Pro PHX** (no users — §24), **Touch Up Pro PHX** (Jordan linked, no primary — §27), **Phoenix Recon Group** (no users — DFW-001 tasks only).

Dealers seeded: Premier Auto Group (Scottsdale), DFW Direct Motors (Dallas), Valley Star Dealership (Mesa).

---

## Launch Locally (Docker)

### First time / after a clean clone

```powershell
# From project root — this also auto-detects your LAN IP for CRM integration
npm run dev
```

That runs `dev-start.ps1` which starts all three containers (db, server, client).

| Service | URL |
|---------|-----|
| App (React) | http://localhost:4002 |
| API (Express) | http://localhost:5002 |
| DB | localhost:5434 (postgres) |

### Wipe and re-seed for a clean test run

```powershell
# From project root:
node createTestData.js --plan
```

> **Note:** `createTestData.js` calls `psql` via Docker if it's not installed locally. The containers must be running first (`npm run dev`).

### If `createTestData.js` fails to connect

Run the SQL directly inside the db container:

```powershell
# Copy files in, then run:
docker cp db/test-data-purge.sql fleet-command-db-1:/tmp/purge.sql
docker cp db/test-data.plan.sql  fleet-command-db-1:/tmp/plan.sql
docker exec fleet-command-db-1 sh -c "psql -U fleetuser -d fleet_command -f /tmp/purge.sql && psql -U fleetuser -d fleet_command -f /tmp/plan.sql"
```

### Useful Docker commands

```powershell
# Start / stop
npm run dev                          # start all containers (detached)
npm run dev:logs                     # start with streaming logs
docker compose down                  # stop all containers

# View logs
docker compose logs -f server        # server logs live
docker compose logs -f client        # client logs live

# Restart a single service
docker compose restart server

# Open a DB shell
docker exec -it fleet-command-db-1 psql -U fleetuser -d fleet_command

# Rebuild after package.json changes
docker compose up -d --build server
```

---

## Launch on Dev (EC2)

The dev environment uses the same Docker stack but runs on the EC2 instance. The client is built and served via S3/CloudFront; the server runs in Docker behind the ALB.

### SSH into the server

```bash
ssh -i ~/.ssh/fleet-command.pem ec2-user@<EC2_IP>
cd /opt/fleet-command   # or wherever the repo is deployed
```

### Start / restart

```bash
docker compose -f docker-compose.dev.yml up -d
docker compose -f docker-compose.dev.yml logs -f server
```

### Seed the dev database

```bash
# Inside the EC2 instance:
node createTestData.js --plan
```

Or directly via the db container (same pattern as local):

```bash
docker cp db/test-data-purge.sql fleet-command-db-1:/tmp/purge.sql
docker cp db/test-data.plan.sql  fleet-command-db-1:/tmp/plan.sql
docker exec fleet-command-db-1 sh -c "psql -U fleetuser -d fleet_command -f /tmp/purge.sql && psql -U fleetuser -d fleet_command -f /tmp/plan.sql"
```

### Re-deploy after code changes

```bash
git pull origin feature/fleet-enhancements
docker compose -f docker-compose.dev.yml up -d --build server
```

The client (React/Vite) is a static build uploaded to S3 — rebuild + upload steps depend on your CI/CD pipeline.

---

## Adding More Test Users

Edit `db/test-data.plan.sql` and add a row to the users `INSERT`. Use any `@fleettest.local` email. The `password_hash` value is the same bcrypt hash (all test users share `Fleet2024!`):

```
$2a$12$fuRLukrylVnqyXL94k5aBO/BuNHlyl6.MhFDUuHgdXGRE7SZf.ehO
```

Then re-run:

```powershell
node createTestData.js --plan
```

To generate a hash for a **different** password, run inside the db container's server container:

```powershell
docker exec fleet-command-server-1 node -e "const b=require('/usr/src/app/node_modules/bcryptjs'); b.hash('YourPassword',12).then(h=>console.log(h));"
```
