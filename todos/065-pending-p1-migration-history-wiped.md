---
status: pending
priority: p1
issue_id:
tags: [code-review, database, migrations, data-loss, drizzle]
dependencies: []
---

# Migration History Wiped - Data Loss Risk

## Problem Statement

All 16 SQLite migrations have been deleted from the `drizzle/` directory (files 0000-0016). The new journal only has one entry. Running `drizzle-kit push` on production would cause CATASTROPHIC DATA LOSS as Drizzle would attempt to recreate the schema from scratch. There is no rollback procedure documented.

## Findings

- **Source:** code-review
- **Files:**
  - `drizzle/0000_wonderful_young_avengers.sql` - DELETED
  - `drizzle/0001_military_vargas.sql` - DELETED
  - `drizzle/0002_happy_strong_guy.sql` - DELETED
  - ... (16 total migrations deleted)
  - `drizzle/meta/_journal.json` - Only one entry remaining
- **Severity:** P1 - CRITICAL DATA LOSS RISK
- **Impact:** Production deployment could wipe all data

**Evidence from git status:**

```
D drizzle/0000_wonderful_young_avengers.sql
D drizzle/0001_military_vargas.sql
D drizzle/0002_happy_strong_guy.sql
D drizzle/0003_sparkling_tempest.sql
D drizzle/0004_aberrant_sandman.sql
D drizzle/0005_lonely_speed_demon.sql
D drizzle/0006_mysterious_microchip.sql
D drizzle/0007_flat_the_captain.sql
D drizzle/0008_young_payback.sql
D drizzle/0010_same_kulan_gath.sql
D drizzle/0011_eager_toro.sql
D drizzle/0012_flippant_screwball.sql
D drizzle/0013_brave_amphibian.sql
D drizzle/0014_colossal_speedball.sql
D drizzle/0015_amusing_puppet_master.sql
D drizzle/0016_rename_business_lines_to_units.sql
```

## Proposed Solutions

### Solution 1: Restore Migration History (Recommended)

Restore the deleted migration files from git and ensure journal is complete.

```bash
git checkout HEAD -- drizzle/
```

**Pros:** Restores full migration history, safe deployments
**Cons:** None - this is the correct state
**Effort:** Small (15 minutes)
**Risk:** None

### Solution 2: Create Baseline Migration for PostgreSQL

If migrating from SQLite to PostgreSQL, create a new baseline migration that represents the current production schema state.

1. Export current production schema
2. Create new 0000 migration with full schema
3. Mark existing production DB as migrated to 0000
4. Continue with incremental migrations

**Pros:** Clean slate for PostgreSQL
**Cons:** Requires careful production coordination
**Effort:** Medium (2-4 hours)
**Risk:** Medium - requires production DB access

### Solution 3: Document Migration Strategy

If this is intentional for the PostgreSQL migration, document:

- Why migrations were removed
- How to safely deploy to production
- Rollback procedures

**Pros:** At least provides safety documentation
**Cons:** Doesn't fix the underlying risk
**Effort:** Small
**Risk:** High - still dangerous

## Recommended Action

IMMEDIATE: Do NOT run `drizzle-kit push` on any database with existing data.

If SQLite->PostgreSQL migration is in progress:

- Document the migration strategy in `docs/plans/`
- Create a baseline PostgreSQL migration
- Test migration on staging first
- Create backup before any production changes

If this was accidental:

- Restore migration files immediately: `git checkout HEAD -- drizzle/`

## Technical Details

**Affected Files:**

- `drizzle/*.sql` - All migration files
- `drizzle/meta/_journal.json` - Migration journal

**Dangerous Commands:**

```bash
# DO NOT RUN ON PRODUCTION
drizzle-kit push
drizzle-kit migrate
```

**Safe Verification:**

```bash
# Check current migration state
cat drizzle/meta/_journal.json

# Compare with production DB
drizzle-kit diff
```

## Acceptance Criteria

- [ ] Migration history is complete and matches production schema
- [ ] `drizzle/meta/_journal.json` contains all migration entries
- [ ] Rollback procedure is documented
- [ ] CI/CD prevents `drizzle-kit push` without review
- [ ] Production backup procedure documented
- [ ] Staging environment tests migrations first

## Work Log

| Date       | Action                   | Learnings                                         |
| ---------- | ------------------------ | ------------------------------------------------- |
| 2026-01-25 | Created from code review | Migration history deletion is extremely dangerous |

## Resources

- Drizzle Migration Docs: https://orm.drizzle.team/docs/migrations
- Related: docs/plans/2026-01-25-postgresql-pgvector-migration.md
