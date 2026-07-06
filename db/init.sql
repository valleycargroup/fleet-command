-- Fleet Command — Database Initialization
-- PostgreSQL schema converted from Cloudflare D1 (SQLite)
-- Runs automatically on first `docker compose up`
-- and via `node createTables.js` for remote databases.
--
-- Pass -v SEED_DATA=1 to psql to also run seed data.

\ir schema.sql

\if :{?SEED_DATA}
  \ir seeds.sql
\endif
