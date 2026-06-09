-- Fleet Command — Purge test data
-- Wipes all rows in reverse dependency order. Schema is preserved.

BEGIN;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='arb_claims') THEN
    EXECUTE 'TRUNCATE TABLE arb_claims RESTART IDENTITY CASCADE';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='parts_requests') THEN
    EXECUTE 'TRUNCATE TABLE parts_requests RESTART IDENTITY CASCADE';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='email_log') THEN
    EXECUTE 'TRUNCATE TABLE email_log RESTART IDENTITY CASCADE';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='transport') THEN
    EXECUTE 'TRUNCATE TABLE transport RESTART IDENTITY CASCADE';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='recon_tasks') THEN
    EXECUTE 'TRUNCATE TABLE recon_tasks RESTART IDENTITY CASCADE';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='sessions') THEN
    EXECUTE 'TRUNCATE TABLE sessions RESTART IDENTITY CASCADE';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='vehicles') THEN
    EXECUTE 'TRUNCATE TABLE vehicles RESTART IDENTITY CASCADE';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='vendors') THEN
    EXECUTE 'TRUNCATE TABLE vendors RESTART IDENTITY CASCADE';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='auctions') THEN
    EXECUTE 'TRUNCATE TABLE auctions RESTART IDENTITY CASCADE';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='users') THEN
    EXECUTE 'TRUNCATE TABLE users RESTART IDENTITY CASCADE';
  END IF;
END $$;

COMMIT;
