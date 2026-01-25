---
status: pending
priority: p3
issue_id: '073'
tags: [code-review, observability, logging, debugging]
dependencies: []
---

# Missing Structured Logging

## Problem Statement

The codebase uses `console.log` throughout without structured logging, correlation IDs for request tracing, or metrics collection. This makes debugging production issues difficult and limits observability.

**Why it matters:**

- Difficult to trace requests across services
- No correlation between related log entries
- Unstructured logs hard to search and analyze
- Missing metrics for monitoring and alerting
- Production debugging is guesswork
- No log levels for filtering

## Findings

**Location:** Throughout codebase

**Evidence:**

```typescript
// Current approach - unstructured console.log
console.log('Starting deep scan for qualification', qualificationId);
console.log('Error:', error);
console.log('Processing complete');

// Missing structured context:
// - Request ID
// - User ID
// - Timestamp
// - Log level
// - Service name
// - Trace ID
```

**Impact Areas:**

| Area            | Issue                  |
| --------------- | ---------------------- |
| API Routes      | No request correlation |
| Background Jobs | No job ID tracking     |
| AI Agents       | No execution trace     |
| Database        | No query timing        |
| External APIs   | No response logging    |

**Current State:**

- No logging library configured
- No log aggregation setup
- No correlation ID propagation
- No metrics collection
- No alerting infrastructure

**Source:** Observability code review

## Proposed Solutions

### Solution 1: Pino Structured Logging (Recommended)

Implement Pino logger with structured JSON output and correlation IDs.

**Pros:**

- Fast JSON logging
- Built-in log levels
- Easy integration with log aggregation
- Request context propagation
- Wide ecosystem support

**Cons:**

- Requires consistent adoption
- Initial setup effort

**Effort:** Medium (1-2 weeks for full adoption)
**Risk:** Low

**Implementation:**

```typescript
// lib/logger.ts
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: label => ({ level: label }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

// Create child logger with context
export function createLogger(context: Record<string, unknown>) {
  return logger.child(context);
}

// Usage in API route
import { createLogger } from '@/lib/logger';
import { nanoid } from 'nanoid';

export async function GET(request: Request) {
  const requestId = nanoid();
  const log = createLogger({
    requestId,
    service: 'qualification-api',
    path: '/api/qualifications/[id]',
  });

  log.info({ qualificationId }, 'Fetching qualification');

  try {
    const result = await fetchQualification(qualificationId);
    log.info({ resultCount: result.length }, 'Qualification fetched');
    return Response.json(result);
  } catch (error) {
    log.error({ error, qualificationId }, 'Failed to fetch qualification');
    throw error;
  }
}
```

### Solution 2: Winston Logger

Use Winston for flexible logging with multiple transports.

**Pros:**

- Flexible transport system
- Multiple output formats
- Popular in Node.js ecosystem

**Cons:**

- Slower than Pino
- More complex configuration

**Effort:** Medium (1-2 weeks)
**Risk:** Low

### Solution 3: OpenTelemetry Integration

Full observability with traces, metrics, and logs.

**Pros:**

- Complete observability solution
- Distributed tracing
- Metrics built-in
- Vendor-agnostic

**Cons:**

- Significant setup complexity
- Higher overhead
- Steeper learning curve

**Effort:** Large (3-4 weeks)
**Risk:** Medium

**Consider for future** - Start with Solution 1, evolve to this.

## Recommended Action

_(To be filled during triage)_

## Technical Details

**Implementation Plan:**

1. Add Pino dependency
2. Create logger utility with context support
3. Add request ID middleware
4. Update API routes incrementally
5. Update background jobs
6. Add log aggregation integration
7. Configure alerting

**Log Format:**

```json
{
  "level": "info",
  "time": "2026-01-25T12:00:00.000Z",
  "requestId": "abc123",
  "service": "deep-scan-worker",
  "jobId": "job_xyz",
  "qualificationId": "qual_456",
  "msg": "Starting expert analysis",
  "duration": 1234
}
```

**Correlation ID Flow:**

```
Request → API Route → Background Job → AI Agent
   ↓          ↓              ↓             ↓
requestId  requestId     requestId    requestId
```

## Acceptance Criteria

- [ ] Pino logger configured and available
- [ ] Request ID middleware for API routes
- [ ] All console.log replaced with structured logging
- [ ] Log levels used appropriately (error, warn, info, debug)
- [ ] Background jobs include job context
- [ ] AI agent calls include trace context
- [ ] Documentation for logging standards
- [ ] Log aggregation configured (if applicable)

## Work Log

**2026-01-25**: Todo created from observability code review findings

## Resources

- Pino documentation: https://getpino.io/
- Structured logging best practices
- OpenTelemetry: https://opentelemetry.io/
- Request correlation patterns
