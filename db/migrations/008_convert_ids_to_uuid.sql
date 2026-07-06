-- Migration 008: Convert all primary keys and foreign keys from INTEGER to UUID
-- Safe to run against existing dev data — all rows are preserved.
-- Idempotent: skips automatically if IDs are already UUID.

BEGIN;

DO $MIGRATION$
DECLARE
  v_id_type text;
  r         RECORD;
BEGIN

  -- ── Guard: skip if already converted ───────────────────────────────────────
  SELECT udt_name INTO v_id_type
  FROM information_schema.columns
  WHERE table_name = 'users' AND column_name = 'id';

  IF v_id_type IS NULL OR v_id_type = 'uuid' THEN
    RAISE NOTICE 'Migration 008: IDs are already UUID — skipping.';
    RETURN;
  END IF;

  RAISE NOTICE 'Migration 008: Converting INTEGER PKs/FKs to UUID — this may take a moment...';

  -- ── Step 1: Add temporary UUID PK columns ──────────────────────────────────
  ALTER TABLE users          ADD COLUMN _new_id UUID DEFAULT gen_random_uuid();
  ALTER TABLE sessions       ADD COLUMN _new_id UUID DEFAULT gen_random_uuid();
  ALTER TABLE vehicles       ADD COLUMN _new_id UUID DEFAULT gen_random_uuid();
  ALTER TABLE vendors        ADD COLUMN _new_id UUID DEFAULT gen_random_uuid();
  ALTER TABLE auctions       ADD COLUMN _new_id UUID DEFAULT gen_random_uuid();
  ALTER TABLE recon_tasks    ADD COLUMN _new_id UUID DEFAULT gen_random_uuid();
  ALTER TABLE transport      ADD COLUMN _new_id UUID DEFAULT gen_random_uuid();
  ALTER TABLE email_log      ADD COLUMN _new_id UUID DEFAULT gen_random_uuid();
  ALTER TABLE parts_requests ADD COLUMN _new_id UUID DEFAULT gen_random_uuid();
  ALTER TABLE arb_claims     ADD COLUMN _new_id UUID DEFAULT gen_random_uuid();
  ALTER TABLE dealers        ADD COLUMN _new_id UUID DEFAULT gen_random_uuid();

  -- ── Step 2: Add temporary UUID FK columns ──────────────────────────────────
  ALTER TABLE sessions       ADD COLUMN _new_user_id          UUID;
  ALTER TABLE vehicles       ADD COLUMN _new_cr_assigned_to   UUID;
  ALTER TABLE vendors        ADD COLUMN _new_primary_user_id  UUID;
  ALTER TABLE users          ADD COLUMN _new_vendor_id        UUID;
  ALTER TABLE recon_tasks    ADD COLUMN _new_vehicle_id       UUID;
  ALTER TABLE recon_tasks    ADD COLUMN _new_vendor_fk        UUID;
  ALTER TABLE transport      ADD COLUMN _new_vehicle_id       UUID;
  ALTER TABLE email_log      ADD COLUMN _new_vehicle_id       UUID;
  ALTER TABLE parts_requests ADD COLUMN _new_vehicle_id       UUID;
  ALTER TABLE parts_requests ADD COLUMN _new_recon_task_id    UUID;
  ALTER TABLE arb_claims     ADD COLUMN _new_vehicle_id       UUID;

  -- ── Step 3: Populate FK UUID columns via JOIN on old integer IDs ───────────
  UPDATE sessions      s SET _new_user_id         = u._new_id FROM users       u WHERE s.user_id        = u.id;
  UPDATE vehicles      v SET _new_cr_assigned_to  = u._new_id FROM users       u WHERE v.cr_assigned_to  = u.id;
  UPDATE vendors       v SET _new_primary_user_id = u._new_id FROM users       u WHERE v.primary_user_id = u.id;
  UPDATE users         u SET _new_vendor_id       = v._new_id FROM vendors     v WHERE u.vendor_id       = v.id;
  UPDATE recon_tasks  rt SET _new_vehicle_id      = v._new_id FROM vehicles    v WHERE rt.vehicle_id     = v.id;
  UPDATE recon_tasks  rt SET _new_vendor_fk       = v._new_id FROM vendors     v WHERE rt.vendor_id      = v.id;
  UPDATE transport     t SET _new_vehicle_id      = v._new_id FROM vehicles    v WHERE t.vehicle_id      = v.id;
  UPDATE email_log     e SET _new_vehicle_id      = v._new_id FROM vehicles    v WHERE e.vehicle_id      = v.id;
  UPDATE parts_requests p SET _new_vehicle_id     = v._new_id FROM vehicles    v WHERE p.vehicle_id      = v.id;
  UPDATE parts_requests p SET _new_recon_task_id  = rt2._new_id FROM recon_tasks rt2 WHERE p.recon_task_id = rt2.id;
  UPDATE arb_claims    a SET _new_vehicle_id      = v._new_id FROM vehicles    v WHERE a.vehicle_id      = v.id;

  -- ── Step 4: Drop all FK constraints (discovered dynamically) ───────────────
  FOR r IN
    SELECT conname, conrelid::regclass AS tbl
    FROM pg_constraint
    WHERE contype = 'f'
      AND conrelid::regclass::text = ANY(ARRAY[
        'sessions','vehicles','vendors','users','recon_tasks',
        'transport','email_log','parts_requests','arb_claims'
      ])
  LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT IF EXISTS %I', r.tbl, r.conname);
  END LOOP;

  -- ── Step 5: Drop PK constraints ────────────────────────────────────────────
  ALTER TABLE users          DROP CONSTRAINT IF EXISTS users_pkey;
  ALTER TABLE sessions       DROP CONSTRAINT IF EXISTS sessions_pkey;
  ALTER TABLE vehicles       DROP CONSTRAINT IF EXISTS vehicles_pkey;
  ALTER TABLE vendors        DROP CONSTRAINT IF EXISTS vendors_pkey;
  ALTER TABLE auctions       DROP CONSTRAINT IF EXISTS auctions_pkey;
  ALTER TABLE recon_tasks    DROP CONSTRAINT IF EXISTS recon_tasks_pkey;
  ALTER TABLE transport      DROP CONSTRAINT IF EXISTS transport_pkey;
  ALTER TABLE email_log      DROP CONSTRAINT IF EXISTS email_log_pkey;
  ALTER TABLE parts_requests DROP CONSTRAINT IF EXISTS parts_requests_pkey;
  ALTER TABLE arb_claims     DROP CONSTRAINT IF EXISTS arb_claims_pkey;
  ALTER TABLE dealers        DROP CONSTRAINT IF EXISTS dealers_pkey;

  -- ── Step 6: Drop old integer PK and FK columns ─────────────────────────────
  ALTER TABLE users          DROP COLUMN id,        DROP COLUMN vendor_id;
  ALTER TABLE sessions       DROP COLUMN id,        DROP COLUMN user_id;
  ALTER TABLE vehicles       DROP COLUMN id,        DROP COLUMN cr_assigned_to;
  ALTER TABLE vendors        DROP COLUMN id,        DROP COLUMN primary_user_id;
  ALTER TABLE auctions       DROP COLUMN id;
  ALTER TABLE recon_tasks    DROP COLUMN id,        DROP COLUMN vehicle_id, DROP COLUMN vendor_id;
  ALTER TABLE transport      DROP COLUMN id,        DROP COLUMN vehicle_id;
  ALTER TABLE email_log      DROP COLUMN id,        DROP COLUMN vehicle_id;
  ALTER TABLE parts_requests DROP COLUMN id,        DROP COLUMN vehicle_id, DROP COLUMN recon_task_id;
  ALTER TABLE arb_claims     DROP COLUMN id,        DROP COLUMN vehicle_id;
  ALTER TABLE dealers        DROP COLUMN id;

  -- ── Step 7: Rename temporary columns to final names ────────────────────────
  ALTER TABLE users          RENAME COLUMN _new_id TO id;
  ALTER TABLE users          RENAME COLUMN _new_vendor_id TO vendor_id;
  ALTER TABLE sessions       RENAME COLUMN _new_id TO id;
  ALTER TABLE sessions       RENAME COLUMN _new_user_id TO user_id;
  ALTER TABLE vehicles       RENAME COLUMN _new_id TO id;
  ALTER TABLE vehicles       RENAME COLUMN _new_cr_assigned_to TO cr_assigned_to;
  ALTER TABLE vendors        RENAME COLUMN _new_id TO id;
  ALTER TABLE vendors        RENAME COLUMN _new_primary_user_id TO primary_user_id;
  ALTER TABLE auctions       RENAME COLUMN _new_id TO id;
  ALTER TABLE recon_tasks    RENAME COLUMN _new_id TO id;
  ALTER TABLE recon_tasks    RENAME COLUMN _new_vehicle_id TO vehicle_id;
  ALTER TABLE recon_tasks    RENAME COLUMN _new_vendor_fk TO vendor_id;
  ALTER TABLE transport      RENAME COLUMN _new_id TO id;
  ALTER TABLE transport      RENAME COLUMN _new_vehicle_id TO vehicle_id;
  ALTER TABLE email_log      RENAME COLUMN _new_id TO id;
  ALTER TABLE email_log      RENAME COLUMN _new_vehicle_id TO vehicle_id;
  ALTER TABLE parts_requests RENAME COLUMN _new_id TO id;
  ALTER TABLE parts_requests RENAME COLUMN _new_vehicle_id TO vehicle_id;
  ALTER TABLE parts_requests RENAME COLUMN _new_recon_task_id TO recon_task_id;
  ALTER TABLE arb_claims     RENAME COLUMN _new_id TO id;
  ALTER TABLE arb_claims     RENAME COLUMN _new_vehicle_id TO vehicle_id;
  ALTER TABLE dealers        RENAME COLUMN _new_id TO id;

  -- ── Step 8: Set DEFAULT gen_random_uuid() on all new id columns ─────────────
  ALTER TABLE users          ALTER COLUMN id SET DEFAULT gen_random_uuid();
  ALTER TABLE sessions       ALTER COLUMN id SET DEFAULT gen_random_uuid();
  ALTER TABLE vehicles       ALTER COLUMN id SET DEFAULT gen_random_uuid();
  ALTER TABLE vendors        ALTER COLUMN id SET DEFAULT gen_random_uuid();
  ALTER TABLE auctions       ALTER COLUMN id SET DEFAULT gen_random_uuid();
  ALTER TABLE recon_tasks    ALTER COLUMN id SET DEFAULT gen_random_uuid();
  ALTER TABLE transport      ALTER COLUMN id SET DEFAULT gen_random_uuid();
  ALTER TABLE email_log      ALTER COLUMN id SET DEFAULT gen_random_uuid();
  ALTER TABLE parts_requests ALTER COLUMN id SET DEFAULT gen_random_uuid();
  ALTER TABLE arb_claims     ALTER COLUMN id SET DEFAULT gen_random_uuid();
  ALTER TABLE dealers        ALTER COLUMN id SET DEFAULT gen_random_uuid();

  -- ── Step 9: Add PK constraints on new UUID id columns ─────────────────────
  ALTER TABLE users          ADD PRIMARY KEY (id);
  ALTER TABLE sessions       ADD PRIMARY KEY (id);
  ALTER TABLE vehicles       ADD PRIMARY KEY (id);
  ALTER TABLE vendors        ADD PRIMARY KEY (id);
  ALTER TABLE auctions       ADD PRIMARY KEY (id);
  ALTER TABLE recon_tasks    ADD PRIMARY KEY (id);
  ALTER TABLE transport      ADD PRIMARY KEY (id);
  ALTER TABLE email_log      ADD PRIMARY KEY (id);
  ALTER TABLE parts_requests ADD PRIMARY KEY (id);
  ALTER TABLE arb_claims     ADD PRIMARY KEY (id);
  ALTER TABLE dealers        ADD PRIMARY KEY (id);

  -- ── Step 10: Re-add FK constraints ────────────────────────────────────────
  ALTER TABLE sessions
    ADD CONSTRAINT sessions_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

  ALTER TABLE vendors
    ADD CONSTRAINT vendors_primary_user_id_fkey
    FOREIGN KEY (primary_user_id) REFERENCES users(id) ON DELETE SET NULL;

  ALTER TABLE users
    ADD CONSTRAINT fk_users_vendor_id
    FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE SET NULL;

  ALTER TABLE vehicles
    ADD CONSTRAINT vehicles_cr_assigned_to_fkey
    FOREIGN KEY (cr_assigned_to) REFERENCES users(id) ON DELETE SET NULL;

  ALTER TABLE recon_tasks
    ADD CONSTRAINT recon_tasks_vehicle_id_fkey
    FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE;

  ALTER TABLE recon_tasks
    ADD CONSTRAINT recon_tasks_vendor_id_fkey
    FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE SET NULL;

  ALTER TABLE transport
    ADD CONSTRAINT transport_vehicle_id_fkey
    FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE;

  ALTER TABLE email_log
    ADD CONSTRAINT email_log_vehicle_id_fkey
    FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE SET NULL;

  ALTER TABLE parts_requests
    ADD CONSTRAINT parts_requests_vehicle_id_fkey
    FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE;

  ALTER TABLE parts_requests
    ADD CONSTRAINT parts_requests_recon_task_id_fkey
    FOREIGN KEY (recon_task_id) REFERENCES recon_tasks(id) ON DELETE SET NULL;

  ALTER TABLE arb_claims
    ADD CONSTRAINT arb_claims_vehicle_id_fkey
    FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE;

  -- ── Step 11: Recreate indexes ──────────────────────────────────────────────
  CREATE INDEX IF NOT EXISTS idx_sessions_user_id          ON sessions(user_id);
  CREATE INDEX IF NOT EXISTS idx_users_vendor_id           ON users(vendor_id);
  CREATE INDEX IF NOT EXISTS idx_vendors_primary_user_id   ON vendors(primary_user_id);
  CREATE INDEX IF NOT EXISTS idx_vehicles_cr_assigned_to   ON vehicles(cr_assigned_to);
  CREATE INDEX IF NOT EXISTS idx_recon_tasks_vehicle_id    ON recon_tasks(vehicle_id);
  CREATE INDEX IF NOT EXISTS idx_transport_vehicle_id      ON transport(vehicle_id);
  CREATE INDEX IF NOT EXISTS idx_email_log_vehicle_id      ON email_log(vehicle_id);
  CREATE INDEX IF NOT EXISTS idx_parts_requests_vehicle_id ON parts_requests(vehicle_id);
  CREATE INDEX IF NOT EXISTS idx_arb_claims_vehicle_id     ON arb_claims(vehicle_id);

  RAISE NOTICE 'Migration 008: Complete — all IDs converted to UUID.';

END $MIGRATION$;

COMMIT;
