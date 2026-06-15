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
