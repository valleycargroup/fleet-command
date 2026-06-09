-- Fleet Command — Minimal test data
-- One admin, one vendor user, two sample vendors, two vehicles
-- Password for all test users: TestPass1

-- Users (password = SHA-256 of "TestPass1" with salt; generated via createTables.js setup flow)
-- Passwords must be set via the /api/auth/setup or /api/auth endpoint after seeding.
-- Insert with a placeholder hash — run `node createTables.js` then use /api/auth/setup.

INSERT INTO auctions (name) VALUES
  ('Manheim Express Phoenix'),
  ('Manheim Express Dallas'),
  ('ADESA Dallas'),
  ('ACV Auctions'),
  ('Openlane')
ON CONFLICT DO NOTHING;

INSERT INTO vendors (name, location, categories, contact_name, email, phone, active) VALUES
  ('Detail Pro PHX', 'Phoenix, AZ', '["detail"]', 'Juan R.', 'detail@phx.example.com', '602-555-0101', TRUE),
  ('Body Shop Pro PHX', 'Phoenix, AZ', '["bodyshop","pdr"]', 'Tom S.', 'body@phx.example.com', '602-555-0102', TRUE)
ON CONFLICT DO NOTHING;

INSERT INTO vehicles (vin, stock_number, year, make, model, trim, color, miles, location, source, buyer, status, purchase_date, recon_data, transport_data) VALUES
  ('1HGCM82633A004352', 'PHX-001', 2024, 'Toyota', 'Camry', 'SE', 'White', 12500, 'PHX', 'Manheim Express Phoenix', 'Darren', 'active', CURRENT_DATE - 10, '{}', '{}'),
  ('2T1BURHE0JC043821', 'DFW-001', 2023, 'Honda', 'Accord', 'Sport', 'Black', 28400, 'Dallas', 'ADESA Dallas', 'Mike', 'active', CURRENT_DATE - 7, '{}', '{}')
ON CONFLICT DO NOTHING;
