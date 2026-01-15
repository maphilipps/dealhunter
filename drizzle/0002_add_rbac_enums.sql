-- Migration 0002: Add RBAC Enums and Token Version
--
-- This migration adds:
-- 1. PostgreSQL enum type for user roles (type-safe)
-- 2. tokenVersion field for session invalidation
-- 3. Index on tokenVersion for performance
--
-- IMPORTANT: Run validation script before this migration:
--   bun run db:validate:roles
--
-- Rollback procedure: See /drizzle/rollback/0002_add_rbac_enums.sql

-- ============================================
-- Step 1: Pre-migration validation
-- ============================================
-- Abort migration if any users have invalid role values
DO $$
DECLARE
  invalid_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO invalid_count
  FROM users
  WHERE role NOT IN ('admin', 'bereichsleiter', 'bd_manager');

  IF invalid_count > 0 THEN
    RAISE EXCEPTION 'Migration aborted: % users have invalid role values. Run validation script to identify affected users.', invalid_count;
  END IF;

  RAISE NOTICE 'Pre-migration validation passed: All role values are valid';
END $$;

-- ============================================
-- Step 2: Create enum type
-- ============================================
CREATE TYPE user_role_enum AS ENUM ('admin', 'bereichsleiter', 'bd_manager');

-- ============================================
-- Step 3: Add new columns
-- ============================================
-- Add new enum column (temporarily named role_new)
ALTER TABLE users ADD COLUMN role_new user_role_enum NOT NULL DEFAULT 'bd_manager';

-- Add tokenVersion column
ALTER TABLE users ADD COLUMN token_version INTEGER NOT NULL DEFAULT 0;

-- ============================================
-- Step 4: Migrate data
-- ============================================
-- Copy role data from varchar to enum
UPDATE users SET role_new = role::text::user_role_enum;

-- ============================================
-- Step 5: Verification
-- ============================================
DO $$
DECLARE
  migration_count INTEGER;
BEGIN
  -- Verify no data was lost during migration
  SELECT COUNT(*) INTO migration_count
  FROM users
  WHERE role::text != role_new::text;

  IF migration_count > 0 THEN
    RAISE EXCEPTION 'Migration verification failed: % roles do not match between old and new columns', migration_count;
  END IF;

  RAISE NOTICE 'Migration verification passed: All roles migrated successfully';
END $$;

-- ============================================
-- Step 6: Replace old column
-- ============================================
-- Drop old varchar column
ALTER TABLE users DROP COLUMN role;

-- Rename new column to role
ALTER TABLE users RENAME COLUMN role_new TO role;

-- ============================================
-- Step 7: Create index on tokenVersion
-- ============================================
-- This index improves performance when checking for token invalidation
CREATE INDEX idx_users_token_version ON users(token_version);

-- ============================================
-- Migration Complete
-- ============================================
-- Post-migration verification (optional):
-- SELECT role, COUNT(*) FROM users GROUP BY role;
-- SELECT token_version, COUNT(*) FROM users GROUP BY token_version;
