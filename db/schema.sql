-- Fleet Command — PostgreSQL Schema
-- All primary keys use UUID (gen_random_uuid()); no SERIAL integers.

CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
  vendor_id     UUID,                          -- FK added after vendors table (circular ref)
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
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token      TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vendors (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT NOT NULL,
  location         TEXT,
  categories       JSONB DEFAULT '[]',
  office_phone     TEXT,
  payment_terms    TEXT DEFAULT 'weekly',
  cutoff_day       TEXT DEFAULT 'Friday',
  cutoff_time      TEXT DEFAULT '5 PM',
  delivery_method  TEXT DEFAULT 'USPS Mail',
  primary_user_id  UUID REFERENCES users(id) ON DELETE SET NULL,
  active           BOOLEAN DEFAULT TRUE,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Resolve circular FK: users.vendor_id → vendors(id)
-- Guard: only add if the column is already UUID (skipped on old INTEGER schema — migration 008 handles that)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_users_vendor_id')
     AND EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_name = 'users' AND column_name = 'vendor_id' AND udt_name = 'uuid'
     )
  THEN
    ALTER TABLE users ADD CONSTRAINT fk_users_vendor_id
      FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS vehicles (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
  zip_code      TEXT,
  fuel_type     TEXT,
  transmission  TEXT,
  driveline     TEXT,
  drive         TEXT,
  motor_trailer TEXT,
  condition_report JSONB DEFAULT NULL,
  recon_data    JSONB DEFAULT '{}',
  transport_data JSONB DEFAULT '{}',
  photos        JSONB DEFAULT '[]',
  cr_status     VARCHAR(20) DEFAULT NULL,
  cr_assigned_to UUID DEFAULT NULL REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS auctions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  active     BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS recon_tasks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id      UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  category        TEXT NOT NULL,
  vendor_id       UUID REFERENCES vendors(id),
  vendor_name     TEXT,
  status          TEXT DEFAULT 'assigned',
  bid_amount      NUMERIC(10,2),
  approved_amount NUMERIC(10,2),
  cost_type       TEXT,
  line_items      JSONB DEFAULT '[]',
  date_assigned   TIMESTAMPTZ,
  date_approved   TIMESTAMPTZ,
  date_started    TIMESTAMPTZ,
  date_completed  TIMESTAMPTZ,
  eta_done        TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS transport (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id       UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
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
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_type  TEXT NOT NULL,
  recipient   TEXT NOT NULL,
  vehicle_id  UUID REFERENCES vehicles(id),
  subject     TEXT,
  status      TEXT DEFAULT 'sent',
  error       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS parts_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id      UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  recon_task_id   UUID REFERENCES recon_tasks(id),
  description     TEXT NOT NULL,
  vendor_name     TEXT,
  category        TEXT,
  status          TEXT DEFAULT 'requested',
  supplier        TEXT,
  cost            NUMERIC(10,2),
  tracking_number TEXT,
  eta             TEXT,
  ordered_date    TIMESTAMPTZ,
  received_date   TIMESTAMPTZ,
  requested_by    TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS arb_claims (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id    UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
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

CREATE TABLE IF NOT EXISTS dealers (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                   TEXT NOT NULL,
  email                  TEXT,
  phone                  TEXT,
  address                TEXT,
  city                   TEXT,
  state                  TEXT,
  zip_code               TEXT,
  responsible_for_pickup BOOLEAN DEFAULT FALSE,
  auction_id             TEXT UNIQUE,          -- external Auction system ID (TEXT, not UUID)
  active                 BOOLEAN DEFAULT TRUE,
  created_at             TIMESTAMPTZ DEFAULT NOW(),
  updated_at             TIMESTAMPTZ DEFAULT NOW()
);

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_sessions_token          ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id        ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at     ON sessions(expires_at);

CREATE INDEX IF NOT EXISTS idx_users_vendor_id         ON users(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendors_primary_user_id ON vendors(primary_user_id);

CREATE INDEX IF NOT EXISTS idx_vehicles_status         ON vehicles(status);
CREATE INDEX IF NOT EXISTS idx_vehicles_location       ON vehicles(location);
CREATE INDEX IF NOT EXISTS idx_vehicles_buyer          ON vehicles(buyer);
CREATE INDEX IF NOT EXISTS idx_vehicles_purchase_date  ON vehicles(purchase_date);
CREATE INDEX IF NOT EXISTS idx_vehicles_cr_status      ON vehicles(cr_status);
CREATE INDEX IF NOT EXISTS idx_vehicles_cr_assigned_to ON vehicles(cr_assigned_to);

CREATE INDEX IF NOT EXISTS idx_recon_tasks_vehicle_id    ON recon_tasks(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_transport_vehicle_id      ON transport(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_email_log_vehicle_id      ON email_log(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_parts_requests_vehicle_id ON parts_requests(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_arb_claims_vehicle_id     ON arb_claims(vehicle_id);

CREATE INDEX IF NOT EXISTS idx_dealers_name_lower ON dealers(LOWER(name));
