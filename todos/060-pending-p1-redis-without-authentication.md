---
status: pending
priority: p1
issue_id: '060'
tags: [code-review, security, redis, authentication, infrastructure]
dependencies: []
---

# Redis Without Authentication Exposed on Network

## Problem Statement

Redis is configured in docker-compose.yml without password authentication and exposed on port 6379. Anyone on the network can connect to Redis, read/write data, and manipulate job queues. This creates serious security and data integrity risks.

**Why it matters:**

- Unauthenticated access to Redis allows data theft
- Job queue manipulation can disrupt application functionality
- Attackers can inject malicious jobs or delete pending work
- Redis can be used as pivot point for further attacks
- Potential for data exfiltration through pub/sub channels
- Ransomware attacks commonly target exposed Redis instances

## Findings

**Location:** `docker-compose.yml`

**Evidence:**

```yaml
services:
  redis:
    image: redis:7-alpine
    ports:
      - '6379:6379' # Exposed without authentication
    # No requirepass or ACL configuration
    # No command override to require auth
```

**Source:** Code review - Security findings

**Risk Level:** P1 Critical - Unauthenticated service exposed on network

## Proposed Solutions

### Solution 1: Enable Redis Password Authentication (Recommended)

Configure Redis with requirepass and update all clients.

**Pros:**

- Simple to implement
- Minimal changes required
- Built-in Redis feature

**Cons:**

- Password stored in environment/secrets
- All clients need password configuration

**Effort:** Small (2-3 hours)
**Risk:** Low

**Implementation:**

```yaml
# docker-compose.yml
services:
  redis:
    image: redis:7-alpine
    command: redis-server --requirepass ${REDIS_PASSWORD}
    ports:
      - '127.0.0.1:6379:6379' # Bind to localhost only
    environment:
      - REDIS_PASSWORD=${REDIS_PASSWORD}
```

```typescript
// lib/bullmq/connection.ts
import { Redis } from 'ioredis';

const redisPassword = process.env.REDIS_PASSWORD;
if (!redisPassword) {
  throw new Error('REDIS_PASSWORD environment variable is required');
}

export const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: redisPassword,
  maxRetriesPerRequest: null,
});
```

### Solution 2: Redis ACL with User-based Authentication

Use Redis 6+ ACL system for fine-grained access control.

**Pros:**

- Multiple users with different permissions
- Principle of least privilege
- Audit capabilities

**Cons:**

- More complex configuration
- Requires Redis 6+
- Need to manage multiple credentials

**Effort:** Medium (4-6 hours)
**Risk:** Low

**Implementation:**

```yaml
# docker-compose.yml
services:
  redis:
    image: redis:7-alpine
    command: >
      redis-server
      --aclfile /etc/redis/users.acl
    volumes:
      - ./redis/users.acl:/etc/redis/users.acl:ro
```

```
# redis/users.acl
user default off
user bullmq_worker on >${REDIS_WORKER_PASSWORD} ~bull:* +@all
user app on >${REDIS_APP_PASSWORD} ~* +@read +@write -@admin
```

### Solution 3: Network Isolation Only (Not Recommended Alone)

Remove port exposure and use Docker network only.

**Pros:**

- No external access possible
- Simple configuration

**Cons:**

- Does not protect against container compromise
- No authentication audit trail
- Insufficient defense in depth

**Effort:** Small (1 hour)
**Risk:** Medium - should be combined with authentication

## Recommended Action

_(To be filled during triage)_

## Technical Details

**Affected Files:**

- `docker-compose.yml`
- `lib/bullmq/*.ts` (all Redis connection code)
- `.env.example`
- Worker configuration files

**Affected Components:**

- Redis service configuration
- BullMQ worker connections
- Job queue infrastructure
- Any component using Redis for caching

**Database Changes:**
None required.

**Dependencies:**

- ioredis client library (already used)
- Environment variable configuration

## Acceptance Criteria

- [ ] Redis requires authentication for all connections
- [ ] Redis password stored securely (env variable, not in code)
- [ ] Port 6379 bound to localhost only (127.0.0.1:6379:6379)
- [ ] All BullMQ workers configured with authentication
- [ ] Application fails fast if Redis password not configured
- [ ] .env.example updated with REDIS_PASSWORD placeholder
- [ ] Documentation updated with Redis security configuration
- [ ] Connection tested and verified working with authentication

## Work Log

**2026-01-25**: Todo created from code review security findings

## Resources

- Redis Security: https://redis.io/docs/management/security/
- Redis ACL: https://redis.io/docs/management/security/acl/
- BullMQ Connection: https://docs.bullmq.io/guide/connections
