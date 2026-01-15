-- Rollback for Migration 0002: Add RBAC Enums and Token Version
--
-- This rollback reverts:
-- 1. tokenVersion column removal
-- 2. user_role_enum type conversion back to varchar(50)
-- 3. Index removal
--
-- ⚠️  WARNING: This rollback will:
-- - Remove all tokenVersion values (sessions will remain valid)
-- - Convert enum back to varchar
--
-- Use this ONLY if migration 0002 causes critical issues.
-- For non-critical issues, consider creating a new migration instead.

BEGIN;

-- ============================================
-- Step 1: Add back old varchar column
-- ============================================
-- Create new varchar column to hold role data
ALTER TABLE users ADD COLUMN role_old varchar(50);

-- Copy data from enum to varchar
UPDATE users SET role_old = role::text;

-- ============================================
-- Step 2: Drop enum column and tokenVersion
-- ============================================
-- Drop the enum column
ALTER TABLE users DROP COLUMN role;

-- Drop the tokenVersion column
ALTER TABLE users DROP COLUMN token_version;

-- ============================================
-- Step 3: Drop enum type
-- ============================================
-- First, we need to drop the enum type
-- Note: This will succeed only if no columns are using the type
DROP TYPE IF EXISTS user_role_enum;

-- ============================================
-- Step 4: Drop index
-- ============================================
-- Drop the tokenVersion index (if it exists)
DROP INDEX IF EXISTS idx_users_token_version;

-- ============================================
-- Step 5: Restore old column
-- ============================================
-- Rename the old column back to 'role'
ALTER TABLE users RENAME COLUMN role_old TO role;

-- Add NOT NULL constraint (since all users should have a role)
ALTER TABLE users ALTER COLUMN role SET NOT NULL;

-- Add default value
ALTER TABLE users ALTER COLUMN role SET DEFAULT 'bd_manager';

COMMIT;

-- ============================================
-- Rollback Complete
-- ============================================
-- Post-rollback verification:
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'users';
-- The 'role' column should be varchar(50) again
-- The 'token_version' column should be gone
-- The 'user_role_enum' type should be gone
