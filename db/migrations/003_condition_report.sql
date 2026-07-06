-- Migration 003: Add structured condition_report column
-- Stores the JSON condition report matching the Auction app's CR schema,
-- separate from recon_data so it can be sent directly to the Auction endpoint.

ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS condition_report JSONB DEFAULT NULL;
