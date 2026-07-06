-- Migration: add fields needed to send vehicles to the Auction app and import from CRM
-- Run this against existing databases (new installs get these via schema.sql)
ALTER TABLE vehicles
  ADD COLUMN IF NOT EXISTS zip_code      TEXT,
  ADD COLUMN IF NOT EXISTS fuel_type     TEXT,
  ADD COLUMN IF NOT EXISTS transmission  TEXT,
  ADD COLUMN IF NOT EXISTS driveline     TEXT,
  ADD COLUMN IF NOT EXISTS drive         TEXT,
  ADD COLUMN IF NOT EXISTS motor_trailer TEXT;
