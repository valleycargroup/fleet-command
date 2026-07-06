ALTER TABLE email_log
  ADD COLUMN IF NOT EXISTS recipient_name   TEXT,
  ADD COLUMN IF NOT EXISTS recipient_role   TEXT,
  ADD COLUMN IF NOT EXISTS recipient_vendor TEXT;
