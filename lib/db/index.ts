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

export const db = drizzle(pool, { schema });

// Graceful shutdown
process.on('SIGTERM', async () => {
  await pool.end();
});

// Export pool for direct queries (e.g., pgvector operations)
export { pool };
