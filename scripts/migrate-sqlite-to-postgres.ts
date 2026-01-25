#!/usr/bin/env tsx
/**
 * SQLite to PostgreSQL Migration Script
 *
 * Migrates all data from the existing SQLite database to PostgreSQL.
 * Run this script after:
 * 1. Starting the PostgreSQL container (docker compose up -d postgres)
 * 2. Running the Drizzle migration (npx drizzle-kit push)
 *
 * Usage: npx tsx scripts/migrate-sqlite-to-postgres.ts
 */

import Database from 'better-sqlite3';
import { Pool } from 'pg';
import * as readline from 'readline';

// SQLite source database
const SQLITE_PATH = process.env.SQLITE_PATH || './data/local.db';

// PostgreSQL target database - require explicit configuration
if (!process.env.DATABASE_URL) {
  console.error('ERROR: DATABASE_URL environment variable is required');
  console.error('Example: DATABASE_URL=postgresql://user:pass@localhost:5433/db');
  process.exit(1);
}
const POSTGRES_URL = process.env.DATABASE_URL;

// Table order matters for foreign key constraints
const TABLES_IN_ORDER = [
  'business_units',
  'accounts',
  'users',
  'employees',
  'technologies',
  'pre_qualifications',
  'qualifications',
  'references',
  'competitors',
  'competencies',
  'documents',
  'quick_scans',
  'website_audits',
  'deal_embeddings',
  'raw_chunks',
  'baseline_comparisons',
  'cms_match_results',
  'competitor_matches',
  'reference_matches',
  'deep_migration_analyses',
  'subjective_assessments',
  'pt_estimations',
  'qualification_section_data',
  'team_assignments',
  'audit_trails',
  'background_jobs',
  'pitchdecks',
  'pitchdeck_deliverables',
  'pitchdeck_team_members',
];

// Columns that need special handling for type conversion
const TIMESTAMP_COLUMNS = [
  'created_at',
  'updated_at',
  'started_at',
  'completed_at',
  'submission_deadline',
  'last_crawled_at',
  'expiration_date',
  'last_document_added',
  'decision_date',
  'published_date',
  'start_date',
  'end_date',
  'crawled_at',
  'analyzed_at',
  'generated_at',
  'deleted_at',
  'created_timestamp',
  'next_number',
  'last_progress_at',
  'last_checkpoint_at',
];

const BOOLEAN_COLUMNS = [
  'is_strategic',
  'is_active',
  'is_important',
  'has_timeline',
  'has_budget',
  'is_published',
  'client_can_provide_data',
  'has_existing_agency',
  'is_replatforming',
  'is_budget_holder',
  'is_decision_maker',
  'is_key_stakeholder',
  'requires_multilingual',
  'requires_ecommerce',
  'requires_accessibility',
  'is_retryable',
];

// Embedding columns (JSON string -> number[] for pgvector)
const EMBEDDING_COLUMNS = ['embedding', 'description_embedding'];

interface MigrationStats {
  table: string;
  rowsRead: number;
  rowsWritten: number;
  errors: number;
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║        SQLite → PostgreSQL Migration Script                  ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  // Check if SQLite database exists
  const fs = await import('fs');
  if (!fs.existsSync(SQLITE_PATH)) {
    console.error(`❌ SQLite database not found at: ${SQLITE_PATH}`);
    console.log('   Set SQLITE_PATH environment variable to specify the correct path.');
    process.exit(1);
  }

  console.log(`📂 Source SQLite: ${SQLITE_PATH}`);
  console.log(`🐘 Target PostgreSQL: ${POSTGRES_URL.replace(/:[^:@]+@/, ':***@')}\n`);

  // Confirm migration
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const answer = await new Promise<string>(resolve => {
    rl.question('⚠️  This will TRUNCATE all tables in PostgreSQL. Continue? [y/N] ', resolve);
  });
  rl.close();

  if (answer.toLowerCase() !== 'y') {
    console.log('Migration cancelled.');
    process.exit(0);
  }

  // Connect to databases
  console.log('\n🔌 Connecting to databases...');
  const sqlite = new Database(SQLITE_PATH, { readonly: true });
  const pg = new Pool({ connectionString: POSTGRES_URL });

  try {
    // Test PostgreSQL connection
    await pg.query('SELECT 1');
    console.log('   ✓ PostgreSQL connected');

    // Ensure pgvector extension exists
    await pg.query('CREATE EXTENSION IF NOT EXISTS vector');
    console.log('   ✓ pgvector extension ready\n');

    const stats: MigrationStats[] = [];

    // Migrate each table
    for (const table of TABLES_IN_ORDER) {
      const tableStat = await migrateTable(sqlite, pg, table);
      stats.push(tableStat);
    }

    // Print summary
    console.log('\n╔══════════════════════════════════════════════════════════════╗');
    console.log('║                    Migration Summary                          ║');
    console.log('╠══════════════════════════════════════════════════════════════╣');

    let totalRead = 0;
    let totalWritten = 0;
    let totalErrors = 0;

    for (const stat of stats) {
      const status = stat.errors > 0 ? '⚠️' : '✓';
      console.log(
        `║ ${status} ${stat.table.padEnd(30)} ${String(stat.rowsWritten).padStart(6)} / ${String(stat.rowsRead).padStart(6)} ║`
      );
      totalRead += stat.rowsRead;
      totalWritten += stat.rowsWritten;
      totalErrors += stat.errors;
    }

    console.log('╠══════════════════════════════════════════════════════════════╣');
    console.log(
      `║   TOTAL: ${String(totalWritten).padStart(6)} rows migrated, ${String(totalErrors).padStart(4)} errors            ║`
    );
    console.log('╚══════════════════════════════════════════════════════════════╝');

    if (totalErrors > 0) {
      console.log('\n⚠️  Some errors occurred during migration. Check the logs above.');
    } else {
      console.log('\n✅ Migration completed successfully!');
    }
  } finally {
    sqlite.close();
    await pg.end();
  }
}

async function migrateTable(
  sqlite: Database.Database,
  pg: Pool,
  table: string
): Promise<MigrationStats> {
  const stats: MigrationStats = {
    table,
    rowsRead: 0,
    rowsWritten: 0,
    errors: 0,
  };

  // Convert snake_case to snake_case (already correct for Drizzle)
  const pgTable = table;

  try {
    // Check if table exists in SQLite
    const tableExists = sqlite
      .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`)
      .get(table);

    if (!tableExists) {
      console.log(`⏭️  Skipping ${table} (not in SQLite)`);
      return stats;
    }

    // Get all rows from SQLite
    const rows = sqlite.prepare(`SELECT * FROM ${table}`).all() as Record<string, unknown>[];
    stats.rowsRead = rows.length;

    if (rows.length === 0) {
      console.log(`📭 ${table}: 0 rows (empty)`);
      return stats;
    }

    // Truncate PostgreSQL table
    await pg.query(`TRUNCATE TABLE ${pgTable} CASCADE`);

    // Get columns from first row
    const columns = Object.keys(rows[0]);

    // Build insert query
    const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
    const insertQuery = `INSERT INTO ${pgTable} (${columns.join(', ')}) VALUES (${placeholders})`;

    // Insert rows in batches
    const BATCH_SIZE = 100;
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);

      for (const row of batch) {
        try {
          const values = columns.map(col => convertValue(col, row[col]));
          await pg.query(insertQuery, values);
          stats.rowsWritten++;
        } catch (error) {
          stats.errors++;
          if (stats.errors <= 3) {
            console.error(`   Error in ${table}: ${(error as Error).message}`);
          }
        }
      }
    }

    const status = stats.errors > 0 ? '⚠️' : '✓';
    console.log(`${status} ${table}: ${stats.rowsWritten}/${stats.rowsRead} rows`);
  } catch (error) {
    console.error(`❌ Failed to migrate ${table}: ${(error as Error).message}`);
    stats.errors++;
  }

  return stats;
}

function convertValue(column: string, value: unknown): unknown {
  if (value === null || value === undefined) {
    return null;
  }

  // Handle timestamps (SQLite stores as integers)
  if (TIMESTAMP_COLUMNS.includes(column) && typeof value === 'number') {
    return new Date(value);
  }

  // Handle booleans (SQLite stores as 0/1)
  if (BOOLEAN_COLUMNS.includes(column) && typeof value === 'number') {
    return value === 1;
  }

  // Handle embeddings (JSON string -> number[] for pgvector)
  if (EMBEDDING_COLUMNS.includes(column) && typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        // Format for pgvector: [1.0,2.0,3.0,...]
        return `[${parsed.join(',')}]`;
      }
    } catch {
      return null;
    }
  }

  return value;
}

main().catch(error => {
  console.error('Migration failed:', error);
  process.exit(1);
});
