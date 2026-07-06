-- Migration 010: Site settings table for global configuration
CREATE TABLE IF NOT EXISTS site_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO site_settings (key, value)
  VALUES ('cc_admins_on_all_emails', 'false')
  ON CONFLICT (key) DO NOTHING;
