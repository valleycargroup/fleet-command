-- Add vendor_id FK to users, backfill from vendor_tag → vendors.name
ALTER TABLE users ADD COLUMN IF NOT EXISTS vendor_id UUID REFERENCES vendors(id) ON DELETE SET NULL;

UPDATE users u
SET vendor_id = v.id
FROM vendors v
WHERE u.role = 'vendor'
  AND u.vendor_tag IS NOT NULL
  AND u.vendor_tag != ''
  AND LOWER(TRIM(u.vendor_tag)) = LOWER(TRIM(v.name))
  AND u.vendor_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_users_vendor_id ON users(vendor_id);
