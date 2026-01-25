---
status: pending
priority: p2
issue_id: '072'
tags: [code-review, infrastructure, cleanup, postgresql-migration]
dependencies: []
---

# Dockerfile.worker Contains SQLite References

## Problem Statement

The `Dockerfile.worker` still contains SQLite-related dependencies and configurations that should be removed after the PostgreSQL migration. This includes packages for better-sqlite3 compilation and SQLite data directory creation.

**Why it matters:**

- Larger Docker image than necessary
- Confusing for developers (appears SQLite is still used)
- Build time wasted on unnecessary compilation (python3, make, g++)
- Dead code in infrastructure
- Incomplete migration cleanup

## Findings

**Location:** `Dockerfile.worker`

**Evidence:**

```dockerfile
# SQLite compilation dependencies - no longer needed
RUN apk add python3 make g++ (for better-sqlite3)

# SQLite data directory - no longer needed
RUN mkdir -p /app/data
```

**Context:**

The project has migrated from SQLite to PostgreSQL (see `drizzle.config.ts` and schema changes). The worker Dockerfile still references the old SQLite infrastructure.

**Related Migration:**

- `docs/plans/2026-01-25-postgresql-pgvector-migration.md`
- Migration scripts in `scripts/`
- Deleted SQLite drizzle migrations

**Source:** Infrastructure code review

## Proposed Solutions

### Solution 1: Remove SQLite Dependencies (Recommended)

Remove all SQLite-related lines from Dockerfile.worker.

**Pros:**

- Smaller Docker image
- Faster builds
- Clear infrastructure intent
- Completes PostgreSQL migration

**Cons:**

- None

**Effort:** Small (15-30 minutes)
**Risk:** Low

**Implementation:**

```dockerfile
# Remove these lines:
# RUN apk add python3 make g++  # SQLite compilation
# RUN mkdir -p /app/data         # SQLite data directory

# Verify PostgreSQL client is included instead:
RUN apk add postgresql-client
```

### Solution 2: Conditional Build (Not Recommended)

Keep SQLite dependencies but make them conditional.

**Pros:**

- Could support both databases

**Cons:**

- Over-engineered
- Migration is complete, no need for SQLite
- Adds complexity

**Effort:** Medium
**Risk:** Low

**Not Recommended** - SQLite support is no longer needed.

## Recommended Action

_(To be filled during triage)_

## Technical Details

**Affected Files:**

- `Dockerfile.worker`

**Dependencies to Remove:**

| Package | Purpose              | Status                                   |
| ------- | -------------------- | ---------------------------------------- |
| python3 | better-sqlite3 build | Remove                                   |
| make    | Native module build  | Remove (unless needed for other modules) |
| g++     | Native module build  | Remove (unless needed for other modules) |

**Verify Before Removal:**

1. Check if any other native modules need build tools
2. Confirm PostgreSQL client is available
3. Test worker container builds successfully
4. Test worker functionality after changes

## Acceptance Criteria

- [ ] SQLite compilation packages removed from Dockerfile.worker
- [ ] `/app/data` directory creation removed
- [ ] Docker image builds successfully
- [ ] Worker container runs correctly
- [ ] Docker image size reduced
- [ ] No SQLite references in any Dockerfile
- [ ] PostgreSQL client available in container

## Work Log

**2026-01-25**: Todo created from infrastructure code review findings

## Resources

- PostgreSQL migration plan: `docs/plans/2026-01-25-postgresql-pgvector-migration.md`
- Alpine package reference: https://pkgs.alpinelinux.org/packages
- Docker best practices for image size
