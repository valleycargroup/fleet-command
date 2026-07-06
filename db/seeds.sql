-- Fleet Command — Seed Data
-- Default reference data inserted on first setup

INSERT INTO auctions (name) VALUES
  ('Manheim Express Phoenix'),
  ('Manheim Express Dallas'),
  ('ADESA Dallas'),
  ('ACV Auctions'),
  ('Openlane')
ON CONFLICT DO NOTHING;

-- No default admin user seeded.
-- On first run with an empty users table, use POST /api/auth/setup to create the admin account.
