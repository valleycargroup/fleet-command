-- Dealers: buying dealer registry with pickup responsibility flag

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
  auction_id             TEXT UNIQUE,   -- external Auction system ID (TEXT, not UUID)
  active                 BOOLEAN DEFAULT TRUE,
  created_at             TIMESTAMPTZ DEFAULT NOW(),
  updated_at             TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dealers_name_lower ON dealers(LOWER(name));
