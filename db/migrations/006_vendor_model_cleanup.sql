-- Vendor model cleanup: move contact info from vendors to users, add primary_user_id

-- 1. Add primary_user_id FK on vendors
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS primary_user_id UUID REFERENCES users(id) ON DELETE SET NULL;

-- 2. Backfill primary_user_id from existing linked vendor users
UPDATE vendors v
SET primary_user_id = (
  SELECT u.id FROM users u
  WHERE u.vendor_id = v.id AND u.role = 'vendor'
  ORDER BY u.id ASC LIMIT 1
)
WHERE v.primary_user_id IS NULL;

-- 3. Remove contact columns from vendors (now live on users)
ALTER TABLE vendors DROP COLUMN IF EXISTS contact_name;
ALTER TABLE vendors DROP COLUMN IF EXISTS email;
ALTER TABLE vendors DROP COLUMN IF EXISTS phone;

-- 4. Remove vendor_categories from users (accessible via vendor_id FK to vendors.categories)
ALTER TABLE users DROP COLUMN IF EXISTS vendor_categories;

CREATE INDEX IF NOT EXISTS idx_vendors_primary_user_id ON vendors(primary_user_id);
