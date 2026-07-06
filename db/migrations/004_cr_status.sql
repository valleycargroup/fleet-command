-- Add CR workflow columns: status tracking and user assignment
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS cr_status VARCHAR(20) DEFAULT NULL;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS cr_assigned_to UUID DEFAULT NULL REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_vehicles_cr_status ON vehicles(cr_status);
CREATE INDEX IF NOT EXISTS idx_vehicles_cr_assigned_to ON vehicles(cr_assigned_to);
