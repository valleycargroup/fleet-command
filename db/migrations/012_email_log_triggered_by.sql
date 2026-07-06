-- Track whether an email was sent by the cron scheduler or triggered manually
ALTER TABLE email_log
  ADD COLUMN IF NOT EXISTS triggered_by TEXT DEFAULT 'manual';
-- 'cron' = automatic scheduled send, 'manual' = user/API triggered
