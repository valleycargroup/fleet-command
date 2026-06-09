-- Fleet Command — Seed Data
-- Default reference data inserted on first setup

INSERT INTO auctions (name) VALUES
  ('Manheim Express Phoenix'),
  ('Manheim Express Dallas'),
  ('ADESA Dallas'),
  ('ACV Auctions'),
  ('Openlane')
ON CONFLICT DO NOTHING;

-- Default admin user — only inserted if no Admin exists yet
-- Default credentials: admin@fleetcommand.local / FleetAdmin1!
-- must_change_password=TRUE forces a password reset on first login
DO $$
DECLARE
  v_salt TEXT := 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4';
  v_pass TEXT := 'FleetAdmin1!';
  v_hash TEXT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM users WHERE role = 'Admin') THEN
    v_hash := encode(sha256((v_salt || v_pass)::bytea), 'hex');
    INSERT INTO users (first_name, last_name, email, password_hash, role, must_change_password, active)
    VALUES ('Admin', 'User', 'admin@fleetcommand.local', v_salt || ':' || v_hash, 'Admin', TRUE, TRUE);
  END IF;
END $$;
