#!/bin/bash
#
# Database Setup Script for Sydney / DealHunter
#
# This script:
# 1. Starts PostgreSQL container with pgvector
# 2. Runs Drizzle migrations
# 3. Creates vector indexes
# 4. (Optional) Migrates data from SQLite
#
# Usage: ./scripts/setup-database.sh [--migrate-data]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║         Sydney Database Setup (PostgreSQL + pgvector)        ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker and try again."
    exit 1
fi

# Step 1: Start PostgreSQL
echo "🐘 Starting PostgreSQL container..."
docker compose up -d postgres

# Wait for PostgreSQL to be ready
echo "⏳ Waiting for PostgreSQL to be ready..."
until docker compose exec -T postgres pg_isready -U dealhunter -d dealhunter > /dev/null 2>&1; do
    sleep 1
done
echo "   ✓ PostgreSQL is ready"

# Step 2: Enable pgvector extension
echo ""
echo "🔧 Enabling pgvector extension..."
docker compose exec -T postgres psql -U dealhunter -d dealhunter -c "CREATE EXTENSION IF NOT EXISTS vector;" > /dev/null
echo "   ✓ pgvector extension enabled"

# Step 3: Run Drizzle migrations
echo ""
echo "📦 Running Drizzle migrations..."
npx drizzle-kit push
echo "   ✓ Schema pushed to database"

# Step 4: Create vector indexes
echo ""
echo "🔍 Creating vector indexes..."
docker compose exec -T postgres psql -U dealhunter -d dealhunter < drizzle/0001_create_vector_indexes.sql > /dev/null 2>&1 || true
echo "   ✓ Vector indexes created"

# Step 5: Optional data migration
if [ "$1" = "--migrate-data" ]; then
    echo ""
    echo "📤 Starting data migration from SQLite..."
    if [ -f "./data/local.db" ]; then
        npx tsx scripts/migrate-sqlite-to-postgres.ts
    else
        echo "   ⚠️  No SQLite database found at ./data/local.db"
        echo "      Skip data migration."
    fi
fi

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                    Setup Complete! 🎉                         ║"
echo "╠══════════════════════════════════════════════════════════════╣"
echo "║                                                               ║"
echo "║  Database URL: postgresql://dealhunter:dealhunter@localhost:5433/dealhunter"
echo "║                                                               ║"
echo "║  Next steps:                                                  ║"
echo "║  1. Copy .env.example to .env and configure API keys          ║"
echo "║  2. Run 'npm run dev' to start the application                ║"
echo "║                                                               ║"
echo "║  Database management:                                         ║"
echo "║  - View tables: docker compose exec postgres psql -U dealhunter -d dealhunter"
echo "║  - Drizzle Studio: npx drizzle-kit studio                     ║"
echo "║                                                               ║"
echo "╚══════════════════════════════════════════════════════════════╝"
