/**
 * Rate Limiting Configuration
 *
 * Implements rate limiting using Upstash Redis for API endpoints.
 * Prevents brute force attacks and API abuse.
 */

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

/**
 * Redis client for rate limiting
 * Falls back to in-memory if UPSTASH_REDIS_REST_URL is not configured
 */
let redis: Redis | null = null;
let ratelimit: Ratelimit | null = null;

// Initialize Redis if environment variables are provided
if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });

  ratelimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, '60 s'), // 10 requests per 60 seconds
    analytics: true,
    prefix: 'ratelimit',
  });
}

/**
 * In-memory rate limiter for development/fallback
 */
class InMemoryRatelimit {
  private requests: Map<string, number[]> = new Map();

  constructor(
    private tokens: number,
    private window: number
  ) {}

  async limit(identifier: string) {
    const now = Date.now();
    const userRequests = this.requests.get(identifier) || [];

    // Filter out old requests outside the window
    const validRequests = userRequests.filter((time) => now - time < this.window * 1000);

    if (validRequests.length >= this.tokens) {
      return {
        success: false,
        limit: this.tokens,
        remaining: 0,
        reset: validRequests[0] + this.window * 1000,
      };
    }

    validRequests.push(now);
    this.requests.set(identifier, validRequests);

    return {
      success: true,
      limit: this.tokens,
      remaining: this.tokens - validRequests.length,
      reset: now + this.window * 1000,
    };
  }
}

const inMemoryRatelimit = new InMemoryRatelimit(10, 60); // 10 requests per 60 seconds

/**
 * Rate limiter instance
 */
export const rateLimit = ratelimit || inMemoryRatelimit;

/**
 * Rate limit configuration for different endpoint types
 */
export const RATE_LIMITS = {
  /** Auth endpoints (login, signup) - stricter limits */
  auth: { requests: 5, window: '60 s' },

  /** API endpoints - standard limits */
  api: { requests: 10, window: '60 s' },

  /** Analysis creation - prevents spam */
  analysis: { requests: 3, window: '60 s' },

  /** Stream endpoints - higher limit for polling */
  stream: { requests: 60, window: '60 s' },
} as const;

/**
 * Check rate limit for an identifier
 *
 * @param identifier - Unique identifier (IP, user ID, etc.)
 * @param limit - Rate limit configuration
 * @returns Rate limit result
 */
export async function checkRateLimit(
  identifier: string,
  limit: { requests: number; window: string } = RATE_LIMITS.api
) {
  const [tokens, window] = limit.window.split(' ');
  const windowMs = parseInt(window) * 1000;

  if (ratelimit) {
    return ratelimit.limit(identifier);
  }

  return inMemoryRatelimit.limit(identifier);
}
