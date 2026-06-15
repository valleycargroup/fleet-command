-- Fleet Command — PostgreSQL Schema
-- Converted from Cloudflare D1 (SQLite)

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  first_name    TEXT NOT NULL,
  last_name     TEXT NOT NULL DEFAULT '',
  phone         TEXT,
  role          TEXT NOT NULL DEFAULT 'admin',
  is_buyer      BOOLEAN DEFAULT FALSE,
  is_seller     BOOLEAN DEFAULT FALSE,
  is_ap         BOOLEAN DEFAULT FALSE,
  location      TEXT DEFAULT 'Both',
  vendor_tag    TEXT,
  vendor_categories    JSONB,
  parts_location       TEXT,
  auction_assignments  JSONB,
  recon_categories     JSONB,
  recon_customized     BOOLEAN DEFAULT FALSE,
  must_change_password BOOLEAN DEFAULT TRUE,
  active        BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sessions (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token      TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vehicles (
  id            SERIAL PRIMARY KEY,
  vin           TEXT,
  stock_number  TEXT UNIQUE,
  year          INTEGER,
  make          TEXT,
  model         TEXT,
  trim          TEXT,
  color         TEXT,
  miles         INTEGER,
  location      TEXT,
  source        TEXT,
  origin        TEXT,
  buyer         TEXT,
  seller        TEXT,
  sold_to       TEXT,
  sale_date     DATE,
  enter_date    DATE,
  purchase_date DATE,
  grounded_date DATE,
  status        TEXT DEFAULT 'active',
  kicked        BOOLEAN DEFAULT FALSE,
  notes         TEXT,
  recon_data    JSONB DEFAULT '{}',
  transport_data JSONB DEFAULT '{}',
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vendors (
  id              SERIAL PRIMARY KEY,
  name            TEXT NOT NULL,
  location        TEXT,
  categories      JSONB DEFAULT '[]',
  contact_name    TEXT,
  email           TEXT,
  phone           TEXT,
  office_phone    TEXT,
  payment_terms   TEXT DEFAULT 'weekly',
  cutoff_day      TEXT DEFAULT 'Friday',
  cutoff_time     TEXT DEFAULT '5 PM',
  delivery_method TEXT DEFAULT 'USPS Mail',
  active          BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS auctions (
  id         SERIAL PRIMARY KEY,
  name       TEXT NOT NULL,
  active     BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS recon_tasks (
  id             SERIAL PRIMARY KEY,
  vehicle_id     INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  category       TEXT NOT NULL,
  vendor_id      INTEGER REFERENCES vendors(id),
  vendor_name    TEXT,
  status         TEXT DEFAULT 'assigned',
  bid_amount     NUMERIC(10,2),
  approved_amount NUMERIC(10,2),
  cost_type      TEXT,
  line_items     JSONB DEFAULT '[]',
  date_assigned  TIMESTAMPTZ,
  date_approved  TIMESTAMPTZ,
  date_started   TIMESTAMPTZ,
  date_completed TIMESTAMPTZ,
  eta_done       TEXT,
  notes          TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS transport (
  id               SERIAL PRIMARY KEY,
  vehicle_id       INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  direction        TEXT NOT NULL,
  company          TEXT,
  phone            TEXT,
  email            TEXT,
  cost             NUMERIC(10,2),
  origin           TEXT,
  destination      TEXT,
  eta              TEXT,
  picked_up_date   TIMESTAMPTZ,
  delivered_date   TIMESTAMPTZ,
  transport_type   TEXT,
  status           TEXT DEFAULT 'pending',
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS email_log (
  id          SERIAL PRIMARY KEY,
  email_type  TEXT NOT NULL,
  recipient   TEXT NOT NULL,
  vehicle_id  INTEGER REFERENCES vehicles(id),
  subject     TEXT,
  status      TEXT DEFAULT 'sent',
  error       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS parts_requests (
  id             SERIAL PRIMARY KEY,
  vehicle_id     INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  recon_task_id  INTEGER REFERENCES recon_tasks(id),
  description    TEXT NOT NULL,
  vendor_name    TEXT,
  category       TEXT,
  status         TEXT DEFAULT 'requested',
  supplier       TEXT,
  cost           NUMERIC(10,2),
  tracking_number TEXT,
  eta            TEXT,
  ordered_date   TIMESTAMPTZ,
  received_date  TIMESTAMPTZ,
  requested_by   TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS arb_claims (
  id            SERIAL PRIMARY KEY,
  vehicle_id    INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  auction       TEXT,
  claim_type    TEXT,
  status        TEXT DEFAULT 'filed',
  amount        NUMERIC(10,2),
  filed_date    TIMESTAMPTZ,
  resolved_date TIMESTAMPTZ,
  resolution    TEXT,
  notes         TEXT,
  filed_by      TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_sessions_token       ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id     ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at  ON sessions(expires_at);

CREATE INDEX IF NOT EXISTS idx_recon_tasks_vehicle_id   ON recon_tasks(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_transport_vehicle_id     ON transport(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_email_log_vehicle_id     ON email_log(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_parts_requests_vehicle_id ON parts_requests(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_arb_claims_vehicle_id    ON arb_claims(vehicle_id);

CREATE INDEX IF NOT EXISTS idx_vehicles_status      ON vehicles(status);
CREATE INDEX IF NOT EXISTS idx_vehicles_location    ON vehicles(location);
CREATE INDEX IF NOT EXISTS idx_vehicles_buyer       ON vehicles(buyer);
CREATE INDEX IF NOT EXISTS idx_vehicles_purchase_date ON vehicles(purchase_date);
