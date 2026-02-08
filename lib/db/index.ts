import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import * as schema from './schema';

// Require DATABASE_URL - no hardcoded credentials
if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required');
}

// PostgreSQL Connection Pool
// Pool size should accommodate parallel expert execution (14 experts + app connections)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: parseInt(process.env.DB_POOL_SIZE || '50', 10), // Configurable, default 50 for parallel experts
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000, // Increased timeout for high-load scenarios
});

// Handle pool errors
pool.on('error', err => {
  console.error('[DB Pool] Unexpected error on idle client:', err);
});

export const db = drizzle(pool, { schema });

// Graceful shutdown
let shutdownPromise: Promise<void> | null = null;
const shutdown = async () => {
  // Next.js build/dev can trigger multiple shutdown paths; pg.Pool throws if ended twice.
  if (shutdownPromise) return shutdownPromise;
  shutdownPromise = (async () => {
    console.log('[DB] Closing pool...');
    await pool.end();
    console.log('[DB] Pool closed');
  })();
  return shutdownPromise;
};

process.once('SIGTERM', () => void shutdown());
process.once('SIGINT', () => void shutdown());

// Export pool for direct queries (e.g., pgvector operations)
export { pool };
