#!/bin/bash
#
# Database Reset Script
#
# This script:
# 1. Clears all data from all tables (keeps schema)
# 2. Re-seeds test users
#
# Usage: ./scripts/reset-database.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║              Database Reset (Clear All Data)                  ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker and try again."
    exit 1
fi

# Step 1: Clear all data
echo "🗑️  Clearing all data from tables..."
docker compose exec -T postgres psql -U dealhunter -d dealhunter <<EOF
-- Disable foreign key checks temporarily
SET session_replication_role = 'replica';

-- Truncate all tables (keeps schema, removes data)
TRUNCATE TABLE users CASCADE;
TRUNCATE TABLE pre_qualifications CASCADE;
TRUNCATE TABLE qualifications CASCADE;
TRUNCATE TABLE documents CASCADE;
TRUNCATE TABLE background_jobs CASCADE;
TRUNCATE TABLE lead_embeddings CASCADE;
TRUNCATE TABLE deal_embeddings CASCADE;
TRUNCATE TABLE accounts CASCADE;
TRUNCATE TABLE business_units CASCADE;
TRUNCATE TABLE employees CASCADE;
TRUNCATE TABLE technologies CASCADE;
TRUNCATE TABLE competencies CASCADE;
TRUNCATE TABLE competitors CASCADE;
TRUNCATE TABLE references CASCADE;

-- Re-enable foreign key checks
SET session_replication_role = 'origin';

SELECT 'All tables cleared successfully!' AS status;
EOF

echo "   ✓ All data cleared"

# Step 2: Re-seed test users
echo ""
echo "👤 Seeding test users..."
npx tsx scripts/seed-test-users.ts

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                  Database Reset Complete! 🎉                  ║"
echo "╠══════════════════════════════════════════════════════════════╣"
echo "║                                                               ║"
echo "║  Database cleared and re-seeded with:                         ║"
echo "║  - Test users (e2e@test.com, bd@test.com, bl@test.com, etc.)  ║"
echo "║  - Sven Lahann (sven.lahann@adesso.de)                        ║"
echo "║  - Marc Philipps (marc.philipps@adesso.de)                    ║"
echo "║                                                               ║"
echo "║  All users have been created with hashed passwords.           ║"
echo "║                                                               ║"
echo "╚══════════════════════════════════════════════════════════════╝"
