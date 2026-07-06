-- Migration: add payment terms columns to vendors table
-- Run this against existing databases (new installs get these via schema.sql)
ALTER TABLE vendors
  ADD COLUMN IF NOT EXISTS payment_terms   TEXT DEFAULT 'weekly',
  ADD COLUMN IF NOT EXISTS cutoff_day      TEXT DEFAULT 'Friday',
  ADD COLUMN IF NOT EXISTS cutoff_time     TEXT DEFAULT '5 PM',
  ADD COLUMN IF NOT EXISTS delivery_method TEXT DEFAULT 'USPS Mail';
