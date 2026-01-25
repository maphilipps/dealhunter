import Redis, { type RedisOptions } from 'ioredis';

/**
 * Redis connection configuration for BullMQ
 *
 * This module provides a shared Redis connection for all BullMQ queues and workers.
 * It handles connection pooling and reconnection logic.
 */

/**
 * Redis connection URL from environment
 * Default: redis://localhost:6379
 */
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

/**
 * Parse Redis URL into connection options
 */
function parseRedisUrl(url: string): RedisOptions {
  const parsedUrl = new URL(url);

  return {
    host: parsedUrl.hostname || 'localhost',
    port: parseInt(parsedUrl.port || '6379', 10),
    password: parsedUrl.password || undefined,
    username: parsedUrl.username || undefined,
    db: parsedUrl.pathname ? parseInt(parsedUrl.pathname.slice(1), 10) : 0,
    maxRetriesPerRequest: null, // Required for BullMQ
    enableReadyCheck: false, // Faster startup
    retryStrategy: (times: number) => {
      // Exponential backoff with max 30 seconds
      const delay = Math.min(times * 500, 30000);
      console.log(`[Redis] Reconnecting in ${delay}ms (attempt ${times})`);
      return delay;
    },
  };
}

/**
 * Shared Redis connection for BullMQ
 *
 * Note: BullMQ requires maxRetriesPerRequest to be null
 */
let connection: Redis | null = null;

/**
 * Get or create the shared Redis connection
 */
export function getConnection(): Redis {
  if (!connection) {
    const options = parseRedisUrl(REDIS_URL);
    connection = new Redis(options);

    connection.on('connect', () => {
      console.log('[Redis] Connected to', REDIS_URL.replace(/:[^:@]+@/, ':***@'));
    });

    connection.on('error', err => {
      console.error('[Redis] Connection error:', err.message);
    });

    connection.on('close', () => {
      console.log('[Redis] Connection closed');
    });
  }

  return connection;
}

/**
 * Close the Redis connection
 * Call this on graceful shutdown
 */
export async function closeConnection(): Promise<void> {
  if (connection) {
    await connection.quit();
    connection = null;
    console.log('[Redis] Connection closed gracefully');
  }
}

/**
 * Check if Redis is connected
 */
export function isConnected(): boolean {
  return connection?.status === 'ready';
}

/**
 * Export connection options for creating new connections
 * (used by Worker which needs its own connection)
 */
export function getConnectionOptions(): RedisOptions {
  return parseRedisUrl(REDIS_URL);
}
