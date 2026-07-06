INSERT INTO site_settings (key, value)
VALUES ('email_body_retention_days', '30')
ON CONFLICT (key) DO NOTHING;
