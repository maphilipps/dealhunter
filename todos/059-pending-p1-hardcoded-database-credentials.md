---
status: pending
priority: p1
issue_id: '059'
tags: [code-review, security, credentials, secrets-management, owasp-a05]
dependencies: []
---

# Hardcoded Database Credentials in Source Code

## Problem Statement

Database credentials are hardcoded as fallback values in the source code and exposed in docker-compose.yml. These credentials are committed to version control, making them accessible to anyone with repository access and creating a significant security risk.

**Why it matters:**

- Credentials exposed in version control history (even if removed later)
- OWASP A05:2021 - Security Misconfiguration
- Attackers with repo access can connect to production database
- Violates security best practices and compliance requirements
- Docker Compose exposes same credentials, indicating they may be used in production

## Findings

**Location 1:** `lib/db/index.ts`

**Evidence:**

```typescript
// Hardcoded fallback credentials in source code
const connectionString =
  process.env.DATABASE_URL || 'postgresql://dealhunter:dealhunter@localhost:5433/dealhunter';
```

**Location 2:** `docker-compose.yml`

**Evidence:**

```yaml
services:
  postgres:
    environment:
      POSTGRES_USER: dealhunter
      POSTGRES_PASSWORD: dealhunter
      POSTGRES_DB: dealhunter
    ports:
      - '5433:5432' # Exposed to host
```

**Source:** Code review - Security findings

**Risk Level:** P1 Critical - OWASP A05:2021 Security Misconfiguration

## Proposed Solutions

### Solution 1: Remove Fallbacks, Require Environment Variables (Recommended)

Remove all hardcoded credentials and require DATABASE_URL to be set.

**Pros:**

- Forces proper secret management
- No credentials in source code
- Clear failure mode if not configured

**Cons:**

- Requires updating all development environments
- Need to document setup process

**Effort:** Small (1-2 hours)
**Risk:** Low

**Implementation:**

```typescript
// lib/db/index.ts
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    'DATABASE_URL environment variable is required. ' + 'See .env.example for setup instructions.'
  );
}

export const db = drizzle(connectionString);
```

```yaml
# docker-compose.yml - use environment file
services:
  postgres:
    env_file:
      - .env.local
    # Or use Docker secrets for production
```

### Solution 2: Use Docker Secrets for Sensitive Data

Use Docker secrets mechanism for production deployments.

**Pros:**

- Industry standard for container secrets
- Secrets not exposed in environment variables
- Works with orchestration tools (Swarm, K8s)

**Cons:**

- More complex setup
- Requires Docker Swarm or Kubernetes
- Different pattern for local development

**Effort:** Medium (3-4 hours)
**Risk:** Low

### Solution 3: External Secret Management (HashiCorp Vault, AWS Secrets Manager)

Integrate with a dedicated secrets management solution.

**Pros:**

- Enterprise-grade security
- Audit logging
- Secret rotation support
- Dynamic credentials possible

**Cons:**

- Additional infrastructure required
- More complex setup and maintenance
- May be overkill for current stage

**Effort:** Large (1-2 days)
**Risk:** Medium

## Recommended Action

_(To be filled during triage)_

## Technical Details

**Affected Files:**

- `lib/db/index.ts`
- `docker-compose.yml`
- `.env.example` (needs update with clear instructions)

**Affected Components:**

- Database connection module
- Docker Compose development setup
- CI/CD pipelines

**Database Changes:**
None required.

**Dependencies:**

- Environment variable configuration
- Secret management solution (optional)

## Acceptance Criteria

- [ ] No hardcoded credentials in source code
- [ ] Application fails fast with clear error if DATABASE_URL not set
- [ ] docker-compose.yml uses env_file or Docker secrets
- [ ] .env.example contains placeholder values only (no real credentials)
- [ ] Documentation updated with setup instructions
- [ ] CI/CD pipelines inject credentials securely
- [ ] Git history audit performed (credentials may need rotation)
- [ ] All existing credentials rotated to new values

## Work Log

**2026-01-25**: Todo created from code review security findings

## Resources

- OWASP A05:2021 Security Misconfiguration: https://owasp.org/Top10/A05_2021-Security_Misconfiguration/
- 12 Factor App - Config: https://12factor.net/config
- Docker Secrets: https://docs.docker.com/engine/swarm/secrets/
