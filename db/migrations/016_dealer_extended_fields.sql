-- Extend dealers table with additional fields from Auction system

ALTER TABLE dealers
  ADD COLUMN IF NOT EXISTS fax                            TEXT,
  ADD COLUMN IF NOT EXISTS website                        TEXT,
  ADD COLUMN IF NOT EXISTS country                        TEXT,
  ADD COLUMN IF NOT EXISTS working_hours                  TEXT,
  ADD COLUMN IF NOT EXISTS yard_address                   TEXT,
  ADD COLUMN IF NOT EXISTS payment_department_first_name  TEXT,
  ADD COLUMN IF NOT EXISTS payment_department_last_name   TEXT,
  ADD COLUMN IF NOT EXISTS payment_department_email       TEXT,
  ADD COLUMN IF NOT EXISTS payment_department_phone       TEXT;
