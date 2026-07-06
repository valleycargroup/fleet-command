-- Migration 009: Add payment details and email notification preferences to vendors
-- payment_info stores method-specific details (check payable-to, ACH, Zelle)
-- email_prefs stores which contacts get CC'd on which email types

ALTER TABLE vendors
  ADD COLUMN IF NOT EXISTS payment_info JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS email_prefs  JSONB DEFAULT '{}';
