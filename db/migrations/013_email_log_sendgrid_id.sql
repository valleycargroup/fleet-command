ALTER TABLE email_log ADD COLUMN IF NOT EXISTS sendgrid_message_id TEXT;
