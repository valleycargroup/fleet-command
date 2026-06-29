-- Dealers: buying dealer registry with pickup responsibility flag

CREATE TABLE IF NOT EXISTS dealers (
  id                     SERIAL PRIMARY KEY,
  name                   TEXT NOT NULL,
  email                  TEXT,
  phone                  TEXT,
  address                TEXT,
  city                   TEXT,
  state                  TEXT,
  zip_code               TEXT,
  responsible_for_pickup BOOLEAN DEFAULT FALSE,
  auction_id             TEXT UNIQUE,   -- UUID from Auction system (for import dedup)
  active                 BOOLEAN DEFAULT TRUE,
  created_at             TIMESTAMPTZ DEFAULT NOW(),
  updated_at             TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dealers_name_lower ON dealers(LOWER(name));
