---
status: pending
priority: p2
issue_id: '071'
tags: [code-review, architecture, infrastructure, tech-debt]
dependencies: []
---

# Hybrid Job Queue Systems (Inngest + BullMQ)

## Problem Statement

The codebase currently uses two different job queue systems: Inngest (in 34 files for deep-analysis, team-notification) and BullMQ (introduced for deep-scan). This creates doubled infrastructure complexity and indicates an incomplete migration.

**Why it matters:**

- Two systems to maintain, monitor, and debug
- Doubled infrastructure costs (both need separate workers, dashboards)
- Inconsistent patterns for background job handling
- Developer confusion about which system to use for new features
- Partial migration state increases technical debt

## Findings

**Location:** Multiple files across the codebase

**Evidence:**

Inngest usage (34 files):

- Deep analysis workflows
- Team notification handlers
- Legacy background jobs

BullMQ usage (new):

- `lib/bullmq/` directory
- `workers/` directory
- `Dockerfile.worker`
- Deep scan processing

**Migration Status:**

| System  | Use Case           | Status          |
| ------- | ------------------ | --------------- |
| Inngest | Deep analysis      | Active (legacy) |
| Inngest | Team notifications | Active (legacy) |
| BullMQ  | Deep scan          | Active (new)    |

**Infrastructure Impact:**

- Inngest: Cloud-hosted, webhook-based
- BullMQ: Self-hosted, Redis-based
- Both need: monitoring, error tracking, scaling

**Source:** Architecture code review

## Proposed Solutions

### Solution 1: Complete BullMQ Migration (Recommended)

Migrate all Inngest jobs to BullMQ for unified job queue infrastructure.

**Pros:**

- Single system to maintain
- Full control over job processing
- Better visibility into job state
- Unified monitoring and alerting
- Cost reduction (no Inngest subscription)

**Cons:**

- Migration effort required
- Need to ensure feature parity
- Redis infrastructure dependency

**Effort:** Large (2-3 weeks)
**Risk:** Medium

**Implementation Steps:**

1. Audit all Inngest functions
2. Create BullMQ equivalents
3. Test in staging environment
4. Gradual rollover with feature flags
5. Remove Inngest dependencies
6. Clean up infrastructure

### Solution 2: Complete Inngest Migration

Move deep-scan from BullMQ back to Inngest.

**Pros:**

- Inngest handles scaling automatically
- Less infrastructure to manage
- Built-in monitoring dashboard

**Cons:**

- Less control over processing
- Potential cost increase at scale
- Webhook latency

**Effort:** Medium (1 week)
**Risk:** Low

**Not Recommended** - BullMQ provides more control needed for deep-scan workloads.

### Solution 3: Maintain Both Systems

Accept the hybrid approach and document usage patterns.

**Pros:**

- No migration risk
- Use best tool for each job type

**Cons:**

- Ongoing complexity
- Developer confusion
- Doubled infrastructure costs
- Technical debt accumulates

**Effort:** Small (documentation only)
**Risk:** Low (immediate), High (long-term)

**Not Recommended** - Kicks the can down the road.

## Recommended Action

_(To be filled during triage)_

## Technical Details

**Affected Files:**

Inngest files to migrate:

- `lib/inngest/` directory
- All `inngest.createFunction` usages
- Webhook handlers in `app/api/inngest/`

BullMQ infrastructure:

- `lib/bullmq/`
- `workers/`
- `Dockerfile.worker`

**Migration Checklist:**

- [ ] deep-analysis functions
- [ ] team-notification functions
- [ ] webhook handlers
- [ ] retry logic
- [ ] error handling
- [ ] monitoring integration

## Acceptance Criteria

- [ ] Single job queue system in use
- [ ] All background jobs working correctly
- [ ] Monitoring and alerting configured
- [ ] Documentation updated
- [ ] Old system completely removed
- [ ] No Inngest dependencies in package.json
- [ ] Infrastructure costs reduced

## Work Log

**2026-01-25**: Todo created from architecture code review findings

## Resources

- Inngest documentation: https://www.inngest.com/docs
- BullMQ documentation: https://docs.bullmq.io/
- Redis best practices for job queues
