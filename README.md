# Fleet Command

Recon management platform for high-volume dealer groups. Tracks vehicles, vendors, bids, transport, and payments from purchase to delivery.

---

## Stack

| Layer | Tech |
|---|---|
| Frontend | React 18, Vite, Zustand, Tailwind |
| Backend | Node.js, Express, TypeScript |
| Database | PostgreSQL 16 |
| Email | SendGrid |
| Storage | AWS S3 + CloudFront |
| Infra | Docker, AWS EC2, RDS, CloudFormation |

---

## Local development

### Prerequisites
- Docker Desktop
- Node.js 20+

### Start

```bash
# Standard
docker compose up --build

# With debugger on port 9231
docker compose -f docker-compose.yml -f docker-compose.debug.yml up --build
```

The server restarts automatically on file changes via `ts-node-dev`.

### Environment

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

Required for email to work: set `SENDGRID_API_KEY` to a valid SendGrid key.

### Dev tools

#### Test emails

In development (`NODE_ENV !== production`), trigger any template against a real address via the dev endpoint (uses stub data):

```bash
curl -X POST http://localhost:3001/api/dev/test-email \
  -H "Content-Type: application/json" \
  -d '{"type": "welcome-user", "to": "you@example.com"}'
```

List all available types:

```bash
curl http://localhost:3001/api/dev/test-email/types
```

Available types: `welcome-user`, `welcome-vendor`, `password-reset`, `vendor_assigned`, `vendor_bid_accepted`, `vendor_bid_declined`, `vendor_work_canceled`, `vendor_part_approved`, `vendor_work_started`, `buyer_bid_submitted`, `buyer_vendor_declined`, `buyer_work_complete`, `buyer_recon_complete`, `buyer_vehicle_kicked`, `buyer_approved_shipping`, `shipping_hold`, `vehicle_grounded`, `transport_inbound_set`, `driveway_inbound_pickedup`, `driveway_outbound_shipped`, `driveway_outbound_delivered`, `retail_vehicle_shipped`, `retail_vehicle_delivered`, `seller_vehicle_sold`, `seller_vehicle_kicked`, `seller_progress`, `dealer_vehicle_shipped`, `dealer_vehicle_delivered`, `parts_request_to_pm`, `parts_quoted_to_buyer`, `parts_approved_to_pm`, `parts_approved_to_vendor`, `part_received`, `all_parts_received`, `part_rejected`, `part_backorder`, `recon_approved_for_payment`, `recon_disputed`, `vendor_payment_receipt`.

`SENDGRID_API_KEY` must be set in `.env` for sends to go through. The `/api/dev` routes are not mounted in production.

#### Email send endpoint

All event-driven emails go through `POST /api/email/send`. Recipients are resolved automatically from the database based on email type and the data payload:

```bash
curl -X POST http://localhost:3001/api/email/send \
  -H "Content-Type: application/json" \
  -d '{"type": "buyer_work_complete", "to": "fallback@example.com", "data": {...}}'
```

The `to` field is only used as a fallback if no recipients can be resolved from the database. The frontend's `fireEmail` function calls this endpoint automatically.

### Database

On first `docker compose up` the database is initialised automatically from `db/schema.sql`.

To apply the schema manually against a remote database:

```bash
node createTables.js
```

To apply migrations to an existing database, run the SQL files in `db/migrations/` in order.

---

## Testing

Tests live in `apps/server/src/tests/` and use [Vitest](https://vitest.dev/) + [Supertest](https://github.com/ladjs/supertest).

### Run all tests

```bash
npm test
```

### Run a specific test file

```bash
npm run test:auth      # auth utilities + login/forgot/reset routes
npm run test:vendors   # vendor CRUD + payment terms
npm run test:users     # user CRUD + role checks + password rules
```

### Watch mode (re-runs on file changes)

```bash
npm run test:watch
```

### Run from the server package directly

```bash
cd apps/server
npm test                        # all tests
npm test -- auth                # auth only
npm test -- vendors             # vendors only
npm test -- users               # users only
```

### Test coverage

| File | Tests | What's covered |
|---|---|---|
| `auth.test.ts` | 15 | hashPassword, verifyPassword, generateToken, login, forgot-password, reset-password |
| `vendors.test.ts` | 12 | GET/POST/PUT/DELETE vendors, payment terms persistence |
| `users.test.ts` | 17 | GET/POST/PUT/DELETE users, role-based access, password complexity, self-delete prevention |

---

## Project structure

```
fleet-command/
├── apps/
│   ├── client/          # React frontend (Vite)
│   │   └── src/
│   │       ├── components/
│   │       ├── pages/
│   │       └── lib/         # store, utils, constants
│   └── server/          # Express API (TypeScript)
│       └── src/
│           ├── routes/
│           ├── lib/         # auth, db, email, storage
│           └── tests/
├── db/
│   ├── schema.sql       # table definitions
│   ├── seeds.sql        # seed data
│   └── migrations/      # ALTER TABLE scripts for existing databases
├── docs/                # additional documentation
├── .env.example         # environment variable reference
├── docker-compose.yml
└── createTables.js      # apply schema to a remote database
```

---

## Docs

- [User Manual](docs/user-manual.md)
- [Global State](docs/global-state.md)
