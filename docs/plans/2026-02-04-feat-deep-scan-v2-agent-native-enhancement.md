---
title: Deep Scan v2 - Agent-Native Enhancement
type: feat
date: 2026-02-04
status: deepened
depends_on: docs/plans/2026-01-30-deep-scan-v2-mvp.md
deepened_at: 2026-02-04T18:30:00Z
research_agents_used: 14
---

## Enhancement Summary (from /deepen-plan)

**Key Findings from Research Agents:**

### Agent-Native Parity (Score: 8/13)

- ✅ Accessible: trigger, status, results, answer, list, documents, audit data, progress
- ❌ Missing: download, share link, retry, cancel, activity log query, RAG upload/search/delete

### Critical Security Issues

1. **No Agent Authentication** - Need API key mechanism for machine-to-machine auth
2. **Unsafe JSON.parse** - All `JSON.parse()` calls need Zod validation wrappers
3. **Missing Input Sanitization** - No XSS/injection protection on user answers
4. **No Rate Limiting** - Agents could DOS the system

### Performance Issues

1. **N+1 Queries** - list and formatter need JOINs
2. **Missing Indexes** - Need compound index on `(run_id, event_type, timestamp)`
3. **Unbounded Logging** - Activity log needs batching (100-500 per insert)
4. **No Circuit Breaker** - Polling helper lacks failure protection

### Architecture Simplifications (53% LOC reduction possible)

1. **Delete A3 (Polling Helper)** - Use SSE/webhooks instead, or rely on agent's native polling
2. **Auto-generate A10 (MCP Tools)** - Generate from A1 tool definitions, don't duplicate
3. **Merge Activity Log** - Use JSONB column on runs table instead of separate table

### New Tasks Required (A11-A15)

- **A11**: `scan.deepscan.cancel` tool
- **A12**: `scan.deepscan.delete` tool
- **A13**: `scan.deepscan.retry` tool
- **A14**: `scan.deepscan.activity` tool (query activity log)
- **A15**: Agent authentication middleware

---

# Deep Scan v2 - Agent-Native Enhancement

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enhance Deep Scan v2 to be truly agent-native - where any action a user can take, an agent can also take, and anything a user can see, an agent can see.

**Context:** Der bestehende Deep Scan v2 MVP Plan (`2026-01-30-deep-scan-v2-mvp.md`) fokussiert auf die Human-Centric Chat-Experience. Dieser Plan ergänzt ihn um die agent-native Layer, die für echte Agentic AI erforderlich ist.

**Principle:** "Agents are first-class citizens" - Jede Capability muss sowohl über UI als auch über strukturierte API/Tools zugänglich sein.

---

## Kritische Gaps aus SpecFlow-Analyse

| Priority        | Gap                           | Impact                                                       |
| --------------- | ----------------------------- | ------------------------------------------------------------ |
| 🔴 Critical     | Keine Agent-Authentifizierung | Agents können nicht sicher auf API zugreifen                 |
| 🔴 Critical     | Kein Agent Trigger Endpoint   | Agents müssen Chat simulieren                                |
| 🔴 Critical     | Keine Tool-Registrierung      | Agents finden Deep Scan nicht über `/api/agent/capabilities` |
| 🟠 Important    | Checkpoint Timeout undefined  | Runs hängen ewig in `waiting_for_user`                       |
| 🟠 Important    | Keine Answer Provenance       | Keine Audit-Trail für Agent-Antworten                        |
| 🟠 Important    | Partial Failure undefined     | Unklar ob Pipeline bei Agent-Fehler stoppt                   |
| 🟡 Nice-to-have | Kein strukturiertes Logging   | Debugging schwierig                                          |

---

## Task Overview

| #   | Task                        | Description                                                 | Priority | Status     |
| --- | --------------------------- | ----------------------------------------------------------- | -------- | ---------- |
| A1  | Agent Tool Registry         | Deep Scan Tools in `lib/agent-tools/` registrieren          | 🔴       | ✅ DONE    |
| A2  | Agent Trigger Endpoint      | `POST /api/v2/deep-scan/trigger` für programmatischen Start | 🔴       | ✅ DONE    |
| A3  | ~~Agent Polling Helper~~    | ~~Utility für Agents zum Status-Polling mit Backoff~~       | ⚫       | **DELETE** |
| A4  | Checkpoint Timeout Handler  | Auto-Fail nach 24h mit Notification                         | 🟠       | TODO       |
| A5  | Answer Provenance Tracking  | `answeredBy` Feld für Agent vs Human                        | 🟠       | TODO       |
| A6  | Partial Failure Mode        | Best-Effort-Flag für Orchestrator                           | 🟠       | TODO       |
| A7  | Structured Observability    | Activity Log als JSONB-Spalte (nicht separate Tabelle)      | 🟡       | ✅ DONE    |
| A8  | Agent-Native Results Format | Strukturierte JSON-Response für alle Ergebnisse             | 🔴       | ✅ DONE    |
| A9  | List Runs Endpoint          | `GET /api/v2/deep-scan` mit Filtering                       | 🔴       | ✅ DONE    |
| A10 | ~~MCP Tool Definitions~~    | ~~MCP-kompatible Tool Schemas für externen Zugriff~~        | ⚫       | **AUTO**   |
| A11 | Cancel Tool                 | `scan.deepscan.cancel` zum Abbrechen laufender Scans        | 🔴       | ✅ DONE    |
| A12 | Delete Tool                 | `scan.deepscan.delete` zum Löschen von Runs                 | 🟠       | ✅ DONE    |
| A13 | Retry Tool                  | `scan.deepscan.retry` zum Neustarten fehlgeschlagener Runs  | 🟠       | ✅ DONE    |
| A14 | Activity Query Tool         | `scan.deepscan.activity` zum Abfragen des Activity Logs     | 🟡       | ✅ DONE    |
| A15 | Agent Auth Middleware       | API-Key basierte Authentifizierung für Agents               | 🔴       | ✅ DONE    |

**Legende:**

- **DELETE** = Task entfernen (nicht agent-native, Agents pollen selbst)
- **AUTO** = Wird aus A1 Tool-Definitionen auto-generiert
- **SIMPLIFY** = Vereinfachte Implementierung
- **NEW** = Neue Tasks für volle Agent-Native Parity

---

## Task A1: Agent Tool Registry

**Files:**

- Create: `lib/agent-tools/tools/deep-scan.ts`
- Modify: `lib/agent-tools/index.ts`

**Step 1: Create Deep Scan Tool Definitions**

```typescript
// lib/agent-tools/tools/deep-scan.ts
import { z } from 'zod';
import { createId } from '@paralleldrive/cuid2';
import { eq } from 'drizzle-orm';

import { db } from '@/lib/db';
import {
  deepScanV2Runs,
  auditResultsV2,
  deepScanV2Documents,
  qualifications,
} from '@/lib/db/schema';
import { addDeepScanV2Job } from '@/lib/bullmq/queues';
import type { AgentTool } from '../types';

// ====== Input Schemas ======
const triggerInputSchema = z.object({
  qualificationId: z.string().describe('ID of the pre-qualification to analyze'),
  interviewResults: z
    .object({
      goal: z.string().describe('Primary project goal (e.g., "CMS Migration", "Website Relaunch")'),
      cmsPreference: z.string().optional().describe('Preferred CMS if known'),
      budgetRange: z.string().optional().describe('Budget range indication'),
      specialRequirements: z
        .string()
        .optional()
        .describe('Special requirements like accessibility, multi-language'),
      tonality: z.enum(['formal', 'balanced', 'casual']).optional().describe('Document tonality'),
    })
    .optional()
    .describe('Pre-filled interview results to skip interview phase'),
  skipInterview: z
    .boolean()
    .default(true)
    .describe('Skip chat interview (default: true for agent calls)'),
});

const statusInputSchema = z.object({
  runId: z.string().describe('ID of the Deep Scan run to check'),
  includeCheckpoint: z
    .boolean()
    .default(false)
    .describe('Include pending question details if waiting'),
});

const resultsInputSchema = z.object({
  runId: z.string().describe('ID of the completed Deep Scan run'),
  sections: z
    .array(
      z.enum([
        'techStack',
        'performance',
        'accessibility',
        'architecture',
        'componentLibrary',
        'migrationComplexity',
        'documents',
      ])
    )
    .optional()
    .describe('Specific sections to return (all if omitted)'),
});

const answerInputSchema = z.object({
  runId: z.string().describe('ID of the Deep Scan run waiting for answer'),
  answer: z.string().describe('Answer to the pending question'),
  reasoning: z.string().optional().describe('Agent reasoning for the answer (for audit trail)'),
});

const listInputSchema = z.object({
  qualificationId: z.string().optional().describe('Filter by qualification'),
  status: z.enum(['pending', 'running', 'completed', 'failed', 'waiting_for_user']).optional(),
  limit: z.number().min(1).max(100).default(20),
  offset: z.number().min(0).default(0),
});

// ====== Tool Implementations ======

export const deepScanTriggerTool: AgentTool = {
  name: 'scan.deepscan.trigger',
  description:
    'Trigger a Deep Scan analysis for a pre-qualification. Returns runId for status tracking. Agents should use skipInterview=true with pre-filled interviewResults.',
  inputSchema: triggerInputSchema,
  category: 'scan',
  execute: async (input, context) => {
    const parsed = triggerInputSchema.parse(input);

    // Verify qualification exists and agent has access
    const [qual] = await db
      .select()
      .from(qualifications)
      .where(eq(qualifications.id, parsed.qualificationId))
      .limit(1);

    if (!qual) {
      return { success: false, error: 'Qualification not found' };
    }

    if (!qual.websiteUrl) {
      return { success: false, error: 'Qualification has no website URL' };
    }

    // Create run
    const runId = createId();
    await db.insert(deepScanV2Runs).values({
      id: runId,
      qualificationId: parsed.qualificationId,
      userId: context.userId,
      status: 'pending',
      snapshotData: parsed.interviewResults
        ? JSON.stringify({
            interviewResults: parsed.interviewResults,
            skipInterview: parsed.skipInterview,
          })
        : null,
    });

    // Enqueue job
    await addDeepScanV2Job({
      runId,
      qualificationId: parsed.qualificationId,
      websiteUrl: qual.websiteUrl,
      userId: context.userId,
      targetCmsIds: [], // Will be determined by BU
      interviewResults: parsed.interviewResults,
    });

    return {
      success: true,
      runId,
      message: `Deep Scan triggered for ${qual.websiteUrl}. Use scan.deepscan.status to track progress.`,
    };
  },
};

export const deepScanStatusTool: AgentTool = {
  name: 'scan.deepscan.status',
  description:
    'Check the status of a Deep Scan run. Returns current phase, progress percentage, and pending question if waiting for user input.',
  inputSchema: statusInputSchema,
  category: 'scan',
  execute: async (input, context) => {
    const parsed = statusInputSchema.parse(input);

    const [run] = await db
      .select()
      .from(deepScanV2Runs)
      .where(eq(deepScanV2Runs.id, parsed.runId))
      .limit(1);

    if (!run) {
      return { success: false, error: 'Run not found' };
    }

    const result: Record<string, unknown> = {
      success: true,
      runId: run.id,
      status: run.status,
      progress: run.progress,
      currentPhase: run.currentPhase,
      currentStep: run.currentStep,
      completedAgents: run.completedAgents ? JSON.parse(run.completedAgents) : [],
      failedAgents: run.failedAgents ? JSON.parse(run.failedAgents) : [],
      startedAt: run.startedAt?.toISOString(),
      completedAt: run.completedAt?.toISOString(),
    };

    // Include checkpoint question if waiting and requested
    if (run.status === 'waiting_for_user' && parsed.includeCheckpoint && run.snapshotData) {
      try {
        const snapshot = JSON.parse(run.snapshotData);
        if (snapshot.pendingQuestion) {
          result.pendingQuestion = snapshot.pendingQuestion;
        }
      } catch {
        // Ignore parse errors
      }
    }

    return result;
  },
};

export const deepScanResultsTool: AgentTool = {
  name: 'scan.deepscan.results',
  description:
    'Get the results of a completed Deep Scan. Returns structured audit data and generated documents.',
  inputSchema: resultsInputSchema,
  category: 'scan',
  execute: async (input, context) => {
    const parsed = resultsInputSchema.parse(input);

    const [run] = await db
      .select()
      .from(deepScanV2Runs)
      .where(eq(deepScanV2Runs.id, parsed.runId))
      .limit(1);

    if (!run) {
      return { success: false, error: 'Run not found' };
    }

    if (run.status !== 'completed') {
      return {
        success: false,
        error: `Run is not completed (status: ${run.status})`,
        currentStatus: run.status,
      };
    }

    // Get audit results
    const [audit] = await db
      .select()
      .from(auditResultsV2)
      .where(eq(auditResultsV2.runId, parsed.runId))
      .limit(1);

    // Get documents
    const documents = await db
      .select({
        id: deepScanV2Documents.id,
        documentType: deepScanV2Documents.documentType,
        format: deepScanV2Documents.format,
        cmsVariant: deepScanV2Documents.cmsVariant,
        confidence: deepScanV2Documents.confidence,
        fileName: deepScanV2Documents.fileName,
        generatedAt: deepScanV2Documents.generatedAt,
      })
      .from(deepScanV2Documents)
      .where(eq(deepScanV2Documents.runId, parsed.runId));

    const sections = parsed.sections ?? [
      'techStack',
      'performance',
      'accessibility',
      'architecture',
      'componentLibrary',
      'migrationComplexity',
      'documents',
    ];

    const result: Record<string, unknown> = {
      success: true,
      runId: parsed.runId,
      qualificationId: run.qualificationId,
      completedAt: run.completedAt?.toISOString(),
    };

    if (audit) {
      if (sections.includes('techStack') && audit.techStack) {
        result.techStack = JSON.parse(audit.techStack);
      }
      if (sections.includes('performance') && audit.performance) {
        result.performance = JSON.parse(audit.performance);
        result.performanceScore = audit.performanceScore;
      }
      if (sections.includes('accessibility') && audit.accessibility) {
        result.accessibility = JSON.parse(audit.accessibility);
        result.accessibilityScore = audit.accessibilityScore;
      }
      if (sections.includes('architecture') && audit.architecture) {
        result.architecture = JSON.parse(audit.architecture);
      }
      if (sections.includes('componentLibrary') && audit.componentLibrary) {
        result.componentLibrary = JSON.parse(audit.componentLibrary);
      }
      if (sections.includes('migrationComplexity')) {
        result.migrationComplexity = audit.migrationComplexity;
        result.complexityScore = audit.complexityScore;
      }
    }

    if (sections.includes('documents')) {
      result.documents = documents;
    }

    return result;
  },
};

export const deepScanAnswerTool: AgentTool = {
  name: 'scan.deepscan.answer',
  description:
    'Answer a pending question for a Deep Scan run that is waiting for user input. Agents can answer programmatically based on context.',
  inputSchema: answerInputSchema,
  category: 'scan',
  execute: async (input, context) => {
    const parsed = answerInputSchema.parse(input);

    const [run] = await db
      .select()
      .from(deepScanV2Runs)
      .where(eq(deepScanV2Runs.id, parsed.runId))
      .limit(1);

    if (!run) {
      return { success: false, error: 'Run not found' };
    }

    if (run.status !== 'waiting_for_user') {
      return {
        success: false,
        error: `Run is not waiting for answer (status: ${run.status})`,
      };
    }

    // Enqueue resume job with answer and provenance
    await addDeepScanV2Job({
      runId: parsed.runId,
      qualificationId: run.qualificationId,
      websiteUrl: '', // Will be loaded from checkpoint
      userId: context.userId,
      targetCmsIds: [],
      checkpointId: parsed.runId,
      userAnswer: parsed.answer,
      answerProvenance: {
        source: 'agent',
        agentId: context.agentId,
        reasoning: parsed.reasoning,
        timestamp: new Date().toISOString(),
      },
    });

    return {
      success: true,
      message: 'Answer submitted. Pipeline will resume.',
      runId: parsed.runId,
    };
  },
};

export const deepScanListTool: AgentTool = {
  name: 'scan.deepscan.list',
  description: 'List Deep Scan runs with optional filtering by qualification or status.',
  inputSchema: listInputSchema,
  category: 'scan',
  execute: async (input, context) => {
    const parsed = listInputSchema.parse(input);

    let query = db
      .select({
        runId: deepScanV2Runs.id,
        qualificationId: deepScanV2Runs.qualificationId,
        status: deepScanV2Runs.status,
        progress: deepScanV2Runs.progress,
        currentPhase: deepScanV2Runs.currentPhase,
        startedAt: deepScanV2Runs.startedAt,
        completedAt: deepScanV2Runs.completedAt,
      })
      .from(deepScanV2Runs)
      .orderBy(deepScanV2Runs.createdAt)
      .limit(parsed.limit)
      .offset(parsed.offset);

    // Apply filters dynamically
    const conditions = [];
    if (parsed.qualificationId) {
      conditions.push(eq(deepScanV2Runs.qualificationId, parsed.qualificationId));
    }
    if (parsed.status) {
      conditions.push(eq(deepScanV2Runs.status, parsed.status));
    }

    // Note: In real implementation, use and() for multiple conditions
    const runs = await query;

    return {
      success: true,
      runs: runs.map(r => ({
        ...r,
        startedAt: r.startedAt?.toISOString(),
        completedAt: r.completedAt?.toISOString(),
      })),
      pagination: {
        limit: parsed.limit,
        offset: parsed.offset,
        hasMore: runs.length === parsed.limit,
      },
    };
  },
};

// Export all tools
export const deepScanTools = [
  deepScanTriggerTool,
  deepScanStatusTool,
  deepScanResultsTool,
  deepScanAnswerTool,
  deepScanListTool,
];
```

**Step 2: Register in Index**

```typescript
// lib/agent-tools/index.ts
// Add to imports:
import { deepScanTools } from './tools/deep-scan';

// Add to allTools array:
export const allTools: AgentTool[] = [
  ...quickScanTools,
  ...deepScanTools, // NEW
  ...extractionTools,
  // ... other tools
];
```

**Step 3: Commit**

```bash
git add lib/agent-tools/tools/deep-scan.ts lib/agent-tools/index.ts
git commit -m "feat(deep-scan-v2): add agent tool registry with trigger, status, results, answer, list tools"
```

---

## Task A2: Agent Trigger Endpoint

**Files:**

- Create: `app/api/v2/deep-scan/trigger/route.ts`

**Step 1: Create REST endpoint**

```typescript
// app/api/v2/deep-scan/trigger/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createId } from '@paralleldrive/cuid2';
import { eq } from 'drizzle-orm';

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import {
  deepScanV2Runs,
  qualifications,
  users,
  technologies,
  backgroundJobs,
} from '@/lib/db/schema';
import { addDeepScanV2Job } from '@/lib/bullmq/queues';

const triggerSchema = z.object({
  qualificationId: z.string(),
  interviewResults: z
    .object({
      goal: z.string(),
      cmsPreference: z.string().optional(),
      budgetRange: z.string().optional(),
      specialRequirements: z.string().optional(),
      tonality: z.enum(['formal', 'balanced', 'casual']).optional(),
    })
    .optional(),
  targetCmsIds: z.array(z.string()).optional(),
  forceReset: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = triggerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        error: 'Validation error',
        details: parsed.error.issues,
      },
      { status: 400 }
    );
  }

  const { qualificationId, interviewResults, targetCmsIds, forceReset } = parsed.data;

  // Verify qualification exists
  const [qual] = await db
    .select()
    .from(qualifications)
    .where(eq(qualifications.id, qualificationId))
    .limit(1);

  if (!qual) {
    return NextResponse.json({ success: false, error: 'Qualification not found' }, { status: 404 });
  }

  if (!qual.websiteUrl) {
    return NextResponse.json(
      {
        success: false,
        error: 'Qualification has no website URL',
      },
      { status: 400 }
    );
  }

  // Verify user access (admin or same BU)
  const [currentUser] = await db.select().from(users).where(eq(users.id, session.user.id)).limit(1);

  if (!currentUser) {
    return NextResponse.json({ success: false, error: 'User not found' }, { status: 401 });
  }

  if (currentUser.role !== 'admin' && currentUser.businessUnitId !== qual.businessUnitId) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  // Check for existing running scan (unless forceReset)
  if (!forceReset) {
    const [existingRun] = await db
      .select()
      .from(deepScanV2Runs)
      .where(eq(deepScanV2Runs.qualificationId, qualificationId))
      .orderBy(deepScanV2Runs.createdAt)
      .limit(1);

    if (
      existingRun &&
      ['pending', 'running', 'waiting_for_user'].includes(existingRun.status ?? '')
    ) {
      return NextResponse.json(
        {
          success: false,
          error: 'A Deep Scan is already in progress',
          existingRunId: existingRun.id,
          existingStatus: existingRun.status,
        },
        { status: 409 }
      );
    }
  }

  // Get BU technologies for CMS context
  const buTechnologies = targetCmsIds?.length
    ? await db.select().from(technologies).where(eq(technologies.id, targetCmsIds[0])) // Simplified
    : await db
        .select()
        .from(technologies)
        .where(eq(technologies.businessUnitId, qual.businessUnitId));

  // Create run
  const runId = createId();
  const jobId = createId();

  await db.insert(deepScanV2Runs).values({
    id: runId,
    qualificationId,
    userId: session.user.id,
    status: 'pending',
    targetCmsIds: JSON.stringify(buTechnologies.map(t => t.id)),
    snapshotData: interviewResults
      ? JSON.stringify({ interviewResults, skipInterview: true })
      : null,
  });

  await db.insert(backgroundJobs).values({
    id: jobId,
    jobType: 'deep-scan-v2',
    status: 'pending',
    userId: session.user.id,
    qualificationId,
    progress: 0,
    currentStep: 'Deep Scan gestartet...',
  });

  // Enqueue BullMQ job
  await addDeepScanV2Job(
    {
      runId,
      qualificationId,
      websiteUrl: qual.websiteUrl,
      userId: session.user.id,
      targetCmsIds: buTechnologies.map(t => t.id),
      interviewResults,
      forceReset,
    },
    jobId
  );

  return NextResponse.json({
    success: true,
    runId,
    jobId,
    message: `Deep Scan triggered for ${qual.websiteUrl}`,
    statusEndpoint: `/api/v2/deep-scan/${runId}`,
    resultsEndpoint: `/api/v2/deep-scan/${runId}/audit`,
  });
}
```

**Step 2: Commit**

```bash
git add app/api/v2/deep-scan/trigger/route.ts
git commit -m "feat(deep-scan-v2): add agent trigger endpoint POST /api/v2/deep-scan/trigger"
```

---

## Task A3: Agent Polling Helper

**Files:**

- Create: `lib/deep-scan-v2/agent-helpers.ts`

**Step 1: Create polling utility**

```typescript
// lib/deep-scan-v2/agent-helpers.ts
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { deepScanV2Runs } from '@/lib/db/schema';

export interface PollOptions {
  runId: string;
  maxAttempts?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  onProgress?: (status: string, progress: number) => void;
}

export interface PollResult {
  success: boolean;
  finalStatus: string;
  progress: number;
  completedAt?: string;
  error?: string;
}

/**
 * Poll a Deep Scan run until completion or failure.
 * Uses exponential backoff starting at 2s, maxing at 30s.
 *
 * @example
 * const result = await pollDeepScanUntilComplete({
 *   runId: 'abc123',
 *   maxAttempts: 60, // ~15 minutes with backoff
 *   onProgress: (status, progress) => console.log(`${status}: ${progress}%`),
 * });
 */
export async function pollDeepScanUntilComplete(options: PollOptions): Promise<PollResult> {
  const {
    runId,
    maxAttempts = 120,
    initialDelayMs = 2000,
    maxDelayMs = 30000,
    onProgress,
  } = options;

  let attempts = 0;
  let delay = initialDelayMs;

  while (attempts < maxAttempts) {
    const [run] = await db
      .select()
      .from(deepScanV2Runs)
      .where(eq(deepScanV2Runs.id, runId))
      .limit(1);

    if (!run) {
      return { success: false, finalStatus: 'not_found', progress: 0, error: 'Run not found' };
    }

    onProgress?.(run.status ?? 'unknown', run.progress ?? 0);

    // Terminal states
    if (run.status === 'completed') {
      return {
        success: true,
        finalStatus: 'completed',
        progress: 100,
        completedAt: run.completedAt?.toISOString(),
      };
    }

    if (run.status === 'failed') {
      return {
        success: false,
        finalStatus: 'failed',
        progress: run.progress ?? 0,
        error: 'Pipeline failed',
      };
    }

    if (run.status === 'waiting_for_user') {
      return {
        success: false,
        finalStatus: 'waiting_for_user',
        progress: run.progress ?? 0,
        error: 'Pipeline waiting for user input - use scan.deepscan.answer to continue',
      };
    }

    // Wait with exponential backoff
    await new Promise(resolve => setTimeout(resolve, delay));
    delay = Math.min(delay * 1.5, maxDelayMs);
    attempts++;
  }

  return {
    success: false,
    finalStatus: 'timeout',
    progress: 0,
    error: `Polling timed out after ${maxAttempts} attempts`,
  };
}

/**
 * Get the most recent completed run for a qualification.
 */
export async function getLatestCompletedRun(qualificationId: string) {
  const [run] = await db
    .select()
    .from(deepScanV2Runs)
    .where(eq(deepScanV2Runs.qualificationId, qualificationId))
    .orderBy(deepScanV2Runs.completedAt)
    .limit(1);

  return run?.status === 'completed' ? run : null;
}
```

**Step 2: Commit**

```bash
git add lib/deep-scan-v2/agent-helpers.ts
git commit -m "feat(deep-scan-v2): add agent polling helper with exponential backoff"
```

---

## Task A4: Checkpoint Timeout Handler

**Files:**

- Modify: `lib/deep-scan-v2/constants.ts`
- Create: `lib/deep-scan-v2/checkpoint-timeout.ts`
- Modify: `workers/deep-scan-v2.ts` (add scheduled job)

**Step 1: Add timeout constants**

```typescript
// In lib/deep-scan-v2/constants.ts, add:
export const CHECKPOINT_TIMEOUT_HOURS = 24;
export const CHECKPOINT_TIMEOUT_MS = CHECKPOINT_TIMEOUT_HOURS * 60 * 60 * 1000;
```

**Step 2: Create timeout handler**

```typescript
// lib/deep-scan-v2/checkpoint-timeout.ts
import { eq, and, lt, isNotNull } from 'drizzle-orm';
import { db } from '@/lib/db';
import { deepScanV2Runs } from '@/lib/db/schema';
import { CHECKPOINT_TIMEOUT_MS } from './constants';

/**
 * Find and fail runs that have been waiting_for_user longer than the timeout.
 * Should be called periodically (e.g., every hour via cron).
 */
export async function expireStaleCheckpoints(): Promise<{
  expiredCount: number;
  runIds: string[];
}> {
  const cutoff = new Date(Date.now() - CHECKPOINT_TIMEOUT_MS);

  // Find stale runs
  const staleRuns = await db
    .select({ id: deepScanV2Runs.id, qualificationId: deepScanV2Runs.qualificationId })
    .from(deepScanV2Runs)
    .where(
      and(eq(deepScanV2Runs.status, 'waiting_for_user'), lt(deepScanV2Runs.updatedAt, cutoff))
    );

  if (staleRuns.length === 0) {
    return { expiredCount: 0, runIds: [] };
  }

  const runIds = staleRuns.map(r => r.id);

  // Update status to failed
  for (const run of staleRuns) {
    await db
      .update(deepScanV2Runs)
      .set({
        status: 'failed',
        updatedAt: new Date(),
        // Store error in snapshot
        snapshotData: JSON.stringify({
          error: `Checkpoint expired after ${CHECKPOINT_TIMEOUT_MS / 3600000} hours without user response`,
          expiredAt: new Date().toISOString(),
        }),
      })
      .where(eq(deepScanV2Runs.id, run.id));

    // TODO: Send notification to user about expired scan
    console.log(`[Checkpoint] Expired run ${run.id} for qualification ${run.qualificationId}`);
  }

  return { expiredCount: runIds.length, runIds };
}
```

**Step 3: Add cron job (in worker or separate scheduler)**

```typescript
// Add to workers/deep-scan-v2.ts or create workers/checkpoint-cleanup.ts
import { CronJob } from 'cron';
import { expireStaleCheckpoints } from '@/lib/deep-scan-v2/checkpoint-timeout';

// Run every hour
const checkpointCleanupJob = new CronJob('0 * * * *', async () => {
  console.log('[Cron] Running checkpoint cleanup...');
  const result = await expireStaleCheckpoints();
  if (result.expiredCount > 0) {
    console.log(`[Cron] Expired ${result.expiredCount} checkpoints: ${result.runIds.join(', ')}`);
  }
});

checkpointCleanupJob.start();
```

**Step 4: Commit**

```bash
git add lib/deep-scan-v2/constants.ts lib/deep-scan-v2/checkpoint-timeout.ts
git commit -m "feat(deep-scan-v2): add checkpoint timeout handler (24h auto-expiry)"
```

---

## Task A5: Answer Provenance Tracking

**Files:**

- Modify: `lib/deep-scan-v2/types.ts`
- Modify: `lib/deep-scan-v2/checkpoints.ts`

**Step 1: Extend types**

```typescript
// In lib/deep-scan-v2/types.ts, add:

export interface AnswerProvenance {
  source: 'human' | 'agent';
  userId?: string;
  agentId?: string;
  reasoning?: string;
  timestamp: string;
}

export interface CollectedAnswer {
  questionId: string;
  question: string;
  answer: string;
  provenance: AnswerProvenance;
}

// Update OrchestratorCheckpoint:
export interface OrchestratorCheckpoint {
  runId: string;
  phase: string;
  completedAgents: string[];
  agentResults: Record<string, unknown>;
  conversationHistory: Array<{
    role: 'assistant' | 'user';
    content: string;
  }>;
  collectedAnswers: CollectedAnswer[]; // Changed from Record<string, string>
  pendingQuestion: {
    id: string; // Add ID for tracking
    question: string;
    context: string;
    options?: string[];
    defaultAnswer?: string;
  } | null;
}
```

**Step 2: Update checkpoint save to include provenance**

```typescript
// In lib/deep-scan-v2/checkpoints.ts, add:

export async function saveAnswer(
  runId: string,
  answer: string,
  provenance: AnswerProvenance
): Promise<void> {
  const checkpoint = await loadCheckpoint(runId);
  if (!checkpoint?.pendingQuestion) {
    throw new Error('No pending question to answer');
  }

  const collectedAnswer: CollectedAnswer = {
    questionId: checkpoint.pendingQuestion.id,
    question: checkpoint.pendingQuestion.question,
    answer,
    provenance,
  };

  checkpoint.collectedAnswers.push(collectedAnswer);
  checkpoint.pendingQuestion = null;

  // Add to conversation history
  checkpoint.conversationHistory.push({
    role: 'user',
    content: answer,
  });

  await saveCheckpoint(runId, checkpoint);
}
```

**Step 3: Commit**

```bash
git add lib/deep-scan-v2/types.ts lib/deep-scan-v2/checkpoints.ts
git commit -m "feat(deep-scan-v2): add answer provenance tracking (human vs agent)"
```

---

## Task A6: Partial Failure Mode

**Files:**

- Modify: `lib/deep-scan-v2/types.ts`
- Modify: `lib/deep-scan-v2/orchestrator.ts` (once created)

**Step 1: Add best-effort flag to job data**

```typescript
// In lib/deep-scan-v2/types.ts, update DeepScanV2JobData:

export interface DeepScanV2JobData {
  runId: string;
  qualificationId: string;
  websiteUrl: string;
  userId: string;
  targetCmsIds: string[];
  interviewResults?: InterviewResults;
  checkpointId?: string;
  userAnswer?: string;
  answerProvenance?: AnswerProvenance;
  forceReset?: boolean;

  // NEW: Best-effort mode
  continueOnAgentFailure?: boolean; // Default: true
  failureThreshold?: number; // Max failed agents before aborting (default: 2)
}
```

**Step 2: Document orchestrator behavior**

The orchestrator (Task 13 in MVP plan) should:

1. When `continueOnAgentFailure: true` (default):
   - Mark failed agent in `failedAgents` array
   - Continue with other agents
   - Generate indication with warnings for missing data
   - Lower confidence score proportionally

2. When `continueOnAgentFailure: false`:
   - First agent failure aborts pipeline
   - Status set to `failed`
   - Error message includes which agent failed

3. When `failureThreshold` exceeded:
   - Abort pipeline regardless of `continueOnAgentFailure`
   - Status set to `failed`
   - Error: "Too many agent failures (N of M)"

**Step 3: Commit**

```bash
git add lib/deep-scan-v2/types.ts
git commit -m "feat(deep-scan-v2): add partial failure mode with continueOnAgentFailure flag"
```

---

## Task A7: Structured Observability

**Files:**

- Create: `lib/deep-scan-v2/activity-log.ts`
- Modify: `lib/db/schema.ts` (add activity log table)

**Step 1: Add activity log table**

```typescript
// In lib/db/schema.ts, add:

export const deepScanV2ActivityLogs = pgTable(
  'deep_scan_v2_activity_logs',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    runId: text('run_id')
      .notNull()
      .references(() => deepScanV2Runs.id),

    // Event Type
    eventType: text('event_type', {
      enum: [
        'run_started',
        'phase_started',
        'phase_completed',
        'agent_started',
        'agent_completed',
        'agent_failed',
        'tool_called',
        'tool_result',
        'question_asked',
        'answer_received',
        'checkpoint_saved',
        'checkpoint_loaded',
        'document_generated',
        'run_completed',
        'run_failed',
      ],
    }).notNull(),

    // Context
    phase: text('phase'),
    agentName: text('agent_name'),
    toolName: text('tool_name'),

    // Details
    message: text('message').notNull(),
    metadata: text('metadata'), // JSON
    durationMs: integer('duration_ms'),
    confidence: integer('confidence'),

    // Timing
    timestamp: timestamp('timestamp').$defaultFn(() => new Date()),
  },
  table => ({
    runIdx: index('dsv2_activity_run_idx').on(table.runId),
    typeIdx: index('dsv2_activity_type_idx').on(table.eventType),
    timestampIdx: index('dsv2_activity_ts_idx').on(table.timestamp),
  })
);
```

**Step 2: Create activity logger**

```typescript
// lib/deep-scan-v2/activity-log.ts
import { createId } from '@paralleldrive/cuid2';
import { db } from '@/lib/db';
import { deepScanV2ActivityLogs } from '@/lib/db/schema';

export type ActivityEventType = (typeof deepScanV2ActivityLogs.$inferInsert)['eventType'];

interface LogActivityParams {
  runId: string;
  eventType: ActivityEventType;
  message: string;
  phase?: string;
  agentName?: string;
  toolName?: string;
  metadata?: Record<string, unknown>;
  durationMs?: number;
  confidence?: number;
}

export async function logActivity(params: LogActivityParams): Promise<void> {
  await db.insert(deepScanV2ActivityLogs).values({
    id: createId(),
    runId: params.runId,
    eventType: params.eventType,
    message: params.message,
    phase: params.phase ?? null,
    agentName: params.agentName ?? null,
    toolName: params.toolName ?? null,
    metadata: params.metadata ? JSON.stringify(params.metadata) : null,
    durationMs: params.durationMs ?? null,
    confidence: params.confidence ?? null,
  });
}

export async function getActivityLog(runId: string, limit = 100) {
  return db
    .select()
    .from(deepScanV2ActivityLogs)
    .where(eq(deepScanV2ActivityLogs.runId, runId))
    .orderBy(deepScanV2ActivityLogs.timestamp)
    .limit(limit);
}

// Convenience wrappers
export const activity = {
  runStarted: (runId: string, websiteUrl: string) =>
    logActivity({
      runId,
      eventType: 'run_started',
      message: `Started Deep Scan for ${websiteUrl}`,
    }),

  agentStarted: (runId: string, agentName: string, phase: string) =>
    logActivity({
      runId,
      eventType: 'agent_started',
      message: `Starting ${agentName}`,
      agentName,
      phase,
    }),

  agentCompleted: (runId: string, agentName: string, durationMs: number, confidence?: number) =>
    logActivity({
      runId,
      eventType: 'agent_completed',
      message: `Completed ${agentName}`,
      agentName,
      durationMs,
      confidence,
    }),

  agentFailed: (runId: string, agentName: string, error: string) =>
    logActivity({
      runId,
      eventType: 'agent_failed',
      message: `Failed: ${error}`,
      agentName,
      metadata: { error },
    }),

  toolCalled: (runId: string, toolName: string, input: Record<string, unknown>) =>
    logActivity({
      runId,
      eventType: 'tool_called',
      message: `Calling ${toolName}`,
      toolName,
      metadata: { input },
    }),

  documentGenerated: (runId: string, docType: string, docId: string) =>
    logActivity({
      runId,
      eventType: 'document_generated',
      message: `Generated ${docType}`,
      metadata: { docId, docType },
    }),
};
```

**Step 3: Commit**

```bash
git add lib/db/schema.ts lib/deep-scan-v2/activity-log.ts
git commit -m "feat(deep-scan-v2): add structured activity logging for observability"
```

---

## Task A8: Agent-Native Results Format

**Files:**

- Create: `lib/deep-scan-v2/results-formatter.ts`

**Step 1: Create standardized result formatter**

```typescript
// lib/deep-scan-v2/results-formatter.ts
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  deepScanV2Runs,
  auditResultsV2,
  deepScanV2Documents,
  qualifications,
} from '@/lib/db/schema';

/**
 * Standardized result format for agent consumption.
 * All fields are typed and documented for predictable parsing.
 */
export interface DeepScanAgentResult {
  // Meta
  runId: string;
  qualificationId: string;
  status: 'completed' | 'partial' | 'failed';
  completedAt: string;
  confidence: number; // 0-100, aggregate

  // Website Info
  website: {
    url: string;
    customerName: string | null;
    industry: string | null;
  };

  // Audit Results
  audit: {
    techStack: {
      cms: string | null;
      cmsVersion: string | null;
      framework: string | null;
      libraries: string[];
      cdn: string | null;
      analytics: string[];
    } | null;

    performance: {
      score: number; // 0-100
      lcp: number; // ms
      cls: number;
      fid: number; // ms
      ttfb: number; // ms
    } | null;

    accessibility: {
      score: number; // 0-100
      violationCount: number;
      criticalCount: number;
      wcagLevel: 'A' | 'AA' | 'AAA' | 'unknown';
    } | null;

    migrationComplexity: {
      level: 'low' | 'medium' | 'high' | 'very_high';
      score: number; // 0-100
      factors: string[];
    } | null;

    components: {
      count: number;
      categories: Record<string, number>;
      contentTypes: number;
      forms: number;
    } | null;
  };

  // Generated Documents
  documents: Array<{
    id: string;
    type: string;
    format: string;
    downloadUrl: string;
    confidence: number;
  }>;

  // Warnings and Flags
  warnings: Array<{
    area: string;
    message: string;
    severity: 'info' | 'warning' | 'critical';
  }>;

  // Failed Agents (if partial)
  failedAgents: string[];
}

export async function formatResultsForAgent(runId: string): Promise<DeepScanAgentResult | null> {
  const [run] = await db.select().from(deepScanV2Runs).where(eq(deepScanV2Runs.id, runId)).limit(1);

  if (!run || !['completed', 'failed'].includes(run.status ?? '')) {
    return null;
  }

  const [qual] = await db
    .select()
    .from(qualifications)
    .where(eq(qualifications.id, run.qualificationId))
    .limit(1);

  const [audit] = await db
    .select()
    .from(auditResultsV2)
    .where(eq(auditResultsV2.runId, runId))
    .limit(1);

  const documents = await db
    .select()
    .from(deepScanV2Documents)
    .where(eq(deepScanV2Documents.runId, runId));

  const failedAgents: string[] = run.failedAgents ? JSON.parse(run.failedAgents) : [];
  const status =
    run.status === 'completed' ? (failedAgents.length > 0 ? 'partial' : 'completed') : 'failed';

  // Calculate aggregate confidence
  const confidences: Record<string, number> = run.agentConfidences
    ? JSON.parse(run.agentConfidences)
    : {};
  const avgConfidence =
    Object.values(confidences).length > 0
      ? Math.round(
          Object.values(confidences).reduce((a, b) => a + b, 0) / Object.values(confidences).length
        )
      : 50;

  // Parse audit sections
  const techStack = audit?.techStack ? JSON.parse(audit.techStack) : null;
  const performance = audit?.performance ? JSON.parse(audit.performance) : null;
  const accessibility = audit?.accessibility ? JSON.parse(audit.accessibility) : null;
  const componentLibrary = audit?.componentLibrary ? JSON.parse(audit.componentLibrary) : null;

  return {
    runId,
    qualificationId: run.qualificationId,
    status,
    completedAt: run.completedAt?.toISOString() ?? new Date().toISOString(),
    confidence: avgConfidence,

    website: {
      url: qual?.websiteUrl ?? '',
      customerName: qual?.customerName ?? null,
      industry: qual?.industry ?? null,
    },

    audit: {
      techStack: techStack
        ? {
            cms: techStack.cms ?? null,
            cmsVersion: techStack.cmsVersion ?? null,
            framework: techStack.framework ?? null,
            libraries: techStack.libraries ?? [],
            cdn: techStack.cdn ?? null,
            analytics: techStack.analytics ?? [],
          }
        : null,

      performance: performance
        ? {
            score: audit?.performanceScore ?? 0,
            lcp: performance.lcp ?? 0,
            cls: performance.cls ?? 0,
            fid: performance.fid ?? 0,
            ttfb: performance.ttfb ?? 0,
          }
        : null,

      accessibility: accessibility
        ? {
            score: audit?.accessibilityScore ?? 0,
            violationCount: accessibility.totalViolations ?? 0,
            criticalCount: accessibility.criticalViolations ?? 0,
            wcagLevel: accessibility.wcagLevel ?? 'unknown',
          }
        : null,

      migrationComplexity: audit?.migrationComplexity
        ? {
            level: audit.migrationComplexity as 'low' | 'medium' | 'high' | 'very_high',
            score: audit.complexityScore ?? 50,
            factors: [], // TODO: Extract from audit data
          }
        : null,

      components: componentLibrary
        ? {
            count: componentLibrary.totalComponents ?? 0,
            categories: componentLibrary.categories ?? {},
            contentTypes: componentLibrary.contentTypes ?? 0,
            forms: componentLibrary.forms ?? 0,
          }
        : null,
    },

    documents: documents.map(d => ({
      id: d.id,
      type: d.documentType,
      format: d.format,
      downloadUrl: `/api/v2/deep-scan/${runId}/documents/${d.id}/download`,
      confidence: d.confidence ?? 50,
    })),

    warnings: [], // TODO: Extract from flags
    failedAgents,
  };
}
```

**Step 2: Commit**

```bash
git add lib/deep-scan-v2/results-formatter.ts
git commit -m "feat(deep-scan-v2): add agent-native results formatter with typed interface"
```

---

## Task A9: List Runs Endpoint

**Files:**

- Create: `app/api/v2/deep-scan/route.ts`

**Step 1: Create list endpoint**

```typescript
// app/api/v2/deep-scan/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { eq, and, desc } from 'drizzle-orm';

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { deepScanV2Runs, users, qualifications } from '@/lib/db/schema';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const qualificationId = searchParams.get('qualificationId');
  const status = searchParams.get('status');
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '20', 10), 100);
  const offset = parseInt(searchParams.get('offset') ?? '0', 10);

  // Get user for BU filtering
  const [currentUser] = await db.select().from(users).where(eq(users.id, session.user.id)).limit(1);

  if (!currentUser) {
    return NextResponse.json({ success: false, error: 'User not found' }, { status: 401 });
  }

  // Build query with filters
  let query = db
    .select({
      runId: deepScanV2Runs.id,
      qualificationId: deepScanV2Runs.qualificationId,
      status: deepScanV2Runs.status,
      progress: deepScanV2Runs.progress,
      currentPhase: deepScanV2Runs.currentPhase,
      startedAt: deepScanV2Runs.startedAt,
      completedAt: deepScanV2Runs.completedAt,
      createdAt: deepScanV2Runs.createdAt,
    })
    .from(deepScanV2Runs)
    .innerJoin(qualifications, eq(deepScanV2Runs.qualificationId, qualifications.id))
    .orderBy(desc(deepScanV2Runs.createdAt))
    .limit(limit)
    .offset(offset);

  // Filter by qualification if provided
  if (qualificationId) {
    query = query.where(eq(deepScanV2Runs.qualificationId, qualificationId));
  }

  // Filter by status if provided
  if (status) {
    query = query.where(eq(deepScanV2Runs.status, status));
  }

  // Non-admins can only see their BU's runs
  if (currentUser.role !== 'admin' && currentUser.businessUnitId) {
    query = query.where(eq(qualifications.businessUnitId, currentUser.businessUnitId));
  }

  const runs = await query;

  return NextResponse.json({
    success: true,
    runs: runs.map(r => ({
      ...r,
      startedAt: r.startedAt?.toISOString() ?? null,
      completedAt: r.completedAt?.toISOString() ?? null,
      createdAt: r.createdAt?.toISOString() ?? null,
    })),
    pagination: {
      limit,
      offset,
      hasMore: runs.length === limit,
    },
  });
}
```

**Step 2: Commit**

```bash
git add app/api/v2/deep-scan/route.ts
git commit -m "feat(deep-scan-v2): add list runs endpoint GET /api/v2/deep-scan"
```

---

## Task A10: MCP Tool Definitions

**Files:**

- Create: `lib/deep-scan-v2/mcp-tools.ts`

**Step 1: Create MCP-compatible tool schemas**

```typescript
// lib/deep-scan-v2/mcp-tools.ts
/**
 * MCP (Model Context Protocol) tool definitions for Deep Scan v2.
 * These can be exposed via an MCP server for external agent access.
 */

export const mcpToolDefinitions = {
  'deepscan.trigger': {
    name: 'deepscan.trigger',
    description:
      'Trigger a Deep Scan website analysis for a pre-qualification. Returns a runId for tracking.',
    inputSchema: {
      type: 'object',
      properties: {
        qualificationId: {
          type: 'string',
          description: 'ID of the pre-qualification to analyze',
        },
        goal: {
          type: 'string',
          description: 'Project goal (e.g., "CMS Migration", "Website Relaunch")',
        },
        cmsPreference: {
          type: 'string',
          description: 'Preferred CMS if known (e.g., "Drupal", "TYPO3")',
        },
        specialRequirements: {
          type: 'string',
          description: 'Special requirements (e.g., "WCAG 2.1 AA compliance required")',
        },
      },
      required: ['qualificationId', 'goal'],
    },
  },

  'deepscan.status': {
    name: 'deepscan.status',
    description: 'Check the status of a Deep Scan run. Returns progress and any pending questions.',
    inputSchema: {
      type: 'object',
      properties: {
        runId: {
          type: 'string',
          description: 'ID of the Deep Scan run',
        },
      },
      required: ['runId'],
    },
  },

  'deepscan.results': {
    name: 'deepscan.results',
    description:
      'Get the results of a completed Deep Scan including tech stack, performance, accessibility, and documents.',
    inputSchema: {
      type: 'object',
      properties: {
        runId: {
          type: 'string',
          description: 'ID of the completed Deep Scan run',
        },
        sections: {
          type: 'array',
          items: {
            type: 'string',
            enum: [
              'techStack',
              'performance',
              'accessibility',
              'migrationComplexity',
              'components',
              'documents',
            ],
          },
          description: 'Specific sections to return (all if omitted)',
        },
      },
      required: ['runId'],
    },
  },

  'deepscan.answer': {
    name: 'deepscan.answer',
    description: 'Answer a pending question for a Deep Scan that is waiting for user input.',
    inputSchema: {
      type: 'object',
      properties: {
        runId: {
          type: 'string',
          description: 'ID of the Deep Scan run waiting for answer',
        },
        answer: {
          type: 'string',
          description: 'Answer to the pending question',
        },
        reasoning: {
          type: 'string',
          description: 'Reasoning for the answer (for audit trail)',
        },
      },
      required: ['runId', 'answer'],
    },
  },

  'deepscan.list': {
    name: 'deepscan.list',
    description: 'List Deep Scan runs with optional filtering.',
    inputSchema: {
      type: 'object',
      properties: {
        qualificationId: {
          type: 'string',
          description: 'Filter by qualification ID',
        },
        status: {
          type: 'string',
          enum: ['pending', 'running', 'completed', 'failed', 'waiting_for_user'],
          description: 'Filter by status',
        },
        limit: {
          type: 'number',
          description: 'Maximum results (default 20, max 100)',
        },
      },
    },
  },
};

/**
 * Example MCP server endpoint handler.
 * This would be called by an MCP client (e.g., Claude Desktop).
 */
export async function handleMcpToolCall(
  toolName: string,
  input: Record<string, unknown>,
  context: { userId: string; agentId?: string }
) {
  // Import the actual tool implementations
  const { deepScanTools } = await import('@/lib/agent-tools/tools/deep-scan');

  const tool = deepScanTools.find(t => t.name === `scan.${toolName.replace('.', '.')}`);
  if (!tool) {
    throw new Error(`Unknown tool: ${toolName}`);
  }

  return tool.execute(input, context);
}
```

**Step 2: Commit**

```bash
git add lib/deep-scan-v2/mcp-tools.ts
git commit -m "feat(deep-scan-v2): add MCP tool definitions for external agent access"
```

---

## Dependency Graph

```
Task A1 (Tool Registry) ────────────────────┐
                                              │
Task A2 (Trigger Endpoint) ─────────────────┼──► Task A10 (MCP Tools)
                                              │
Task A3 (Polling Helper) ──────────────────┤
                                              │
Task A8 (Results Format) ──────────────────┤
                                              │
Task A9 (List Endpoint) ───────────────────┘

Task A4 (Checkpoint Timeout) ──► [Standalone]

Task A5 (Answer Provenance) ──► Task A1 (uses in answer tool)

Task A6 (Partial Failure) ──► MVP Task 13 (Orchestrator)

Task A7 (Activity Log) ──► MVP Task 13 (Orchestrator)
```

**Critical Path:** A1 → A2 → A8 → A9 → A10

---

## Integration with MVP Plan

Dieser Plan ergänzt den MVP Plan (`2026-01-30-deep-scan-v2-mvp.md`):

| MVP Task               | This Plan Enhancement                    |
| ---------------------- | ---------------------------------------- |
| Task 3 (Queue)         | A2 adds trigger endpoint                 |
| Task 4 (Checkpoint)    | A4 adds timeout, A5 adds provenance      |
| Task 13 (Orchestrator) | A6 adds partial failure, A7 adds logging |
| Task 14 (Tools)        | A1 registers in agent registry           |
| Task 17 (Control APIs) | A3, A8, A9 add agent-native access       |
| Task 18 (Results APIs) | A8 standardizes format                   |

**Empfohlene Reihenfolge:**

1. Zuerst MVP Tasks 1-6 (Foundation)
2. Dann Tasks A1, A2, A3 (Agent Layer)
3. Parallel zu MVP Tasks 7-14
4. Tasks A4, A5, A6, A7 (Quality & Observability)
5. Tasks A8, A9, A10 (Polish)
6. MVP Tasks 15-24 (UI & Integration)

---

## Acceptance Criteria

### Agent-Native Requirements (Must Pass)

- [ ] Ein Agent kann einen Deep Scan triggern via `scan.deepscan.trigger` Tool
- [ ] Ein Agent kann den Status pollen via `scan.deepscan.status` Tool
- [ ] Ein Agent kann Ergebnisse lesen via `scan.deepscan.results` Tool
- [ ] Ein Agent kann Fragen beantworten via `scan.deepscan.answer` Tool
- [ ] Ein Agent kann Runs listen via `scan.deepscan.list` Tool
- [ ] Alle Tools sind via `/api/agent/capabilities` discoverable
- [ ] Answer Provenance unterscheidet Agent vs Human
- [ ] Checkpoint Timeout nach 24h führt zu auto-fail
- [ ] Activity Log erfasst alle wesentlichen Events

### API Contract

- [ ] `POST /api/v2/deep-scan/trigger` akzeptiert `qualificationId` + optional `interviewResults`
- [ ] `GET /api/v2/deep-scan` listet Runs mit Pagination
- [ ] `GET /api/v2/deep-scan/[runId]` gibt Status mit Progress zurück
- [ ] `POST /api/v2/deep-scan/[runId]/answer` akzeptiert Answer + Provenance
- [ ] Alle Responses haben konsistentes Format: `{ success, error?, data? }`

### Observability

- [ ] Activity Log hat Events für: run*started, agent*\_, tool\__, question*\*, document*_, run\_\_
- [ ] Jeder Event hat timestamp, runId, und relevante Metadata
- [ ] Activity Log ist via API abrufbar für Debugging

---

## References

- MVP Plan: `docs/plans/2026-01-30-deep-scan-v2-mvp.md`
- QuickScan Tools Pattern: `lib/agent-tools/quick-scan-tools.ts`
- Pitch Orchestrator: `lib/pitch/orchestrator.ts`
- Expert Agents Pattern: `lib/agents/expert-agents/orchestrator.ts`
- Agent Capabilities API: `app/api/agent/capabilities/route.ts`

---

## Task A11: Cancel Tool (NEW)

**Files:**

- Modify: `lib/agent-tools/tools/deep-scan.ts`

**Step 1: Add cancel tool to registry**

```typescript
// Add to lib/agent-tools/tools/deep-scan.ts

const cancelInputSchema = z.object({
  runId: z.string().describe('ID of the Deep Scan run to cancel'),
  reason: z.string().optional().describe('Reason for cancellation (for audit trail)'),
});

export const deepScanCancelTool: AgentTool = {
  name: 'scan.deepscan.cancel',
  description: 'Cancel a running or pending Deep Scan. Cannot cancel completed/failed runs.',
  inputSchema: cancelInputSchema,
  category: 'scan',
  execute: async (input, context) => {
    const parsed = cancelInputSchema.parse(input);

    const [run] = await db
      .select()
      .from(deepScanV2Runs)
      .where(eq(deepScanV2Runs.id, parsed.runId))
      .limit(1);

    if (!run) {
      return { success: false, error: 'Run not found' };
    }

    if (!['pending', 'running', 'waiting_for_user'].includes(run.status ?? '')) {
      return {
        success: false,
        error: `Cannot cancel run with status: ${run.status}`,
      };
    }

    // Update status to cancelled
    await db
      .update(deepScanV2Runs)
      .set({
        status: 'cancelled',
        updatedAt: new Date(),
        snapshotData: JSON.stringify({
          ...JSON.parse(run.snapshotData ?? '{}'),
          cancelledAt: new Date().toISOString(),
          cancelledBy: context.agentId ?? context.userId,
          cancelReason: parsed.reason,
        }),
      })
      .where(eq(deepScanV2Runs.id, parsed.runId));

    // Cancel BullMQ job if running
    // TODO: Implement job cancellation via BullMQ

    return {
      success: true,
      message: `Run ${parsed.runId} cancelled`,
      previousStatus: run.status,
    };
  },
};
```

**Step 2: Add 'cancelled' status to schema**

```typescript
// In lib/db/schema.ts, update deepScanV2Runs status enum:
status: text('status', {
  enum: ['pending', 'running', 'completed', 'failed', 'waiting_for_user', 'cancelled'],
}).$default(() => 'pending'),
```

---

## Task A12: Delete Tool (NEW)

**Files:**

- Modify: `lib/agent-tools/tools/deep-scan.ts`

**Step 1: Add delete tool**

```typescript
const deleteInputSchema = z.object({
  runId: z.string().describe('ID of the Deep Scan run to delete'),
  deleteDocuments: z.boolean().default(true).describe('Also delete generated documents'),
});

export const deepScanDeleteTool: AgentTool = {
  name: 'scan.deepscan.delete',
  description: 'Permanently delete a Deep Scan run and optionally its documents. Cannot undo.',
  inputSchema: deleteInputSchema,
  category: 'scan',
  execute: async (input, context) => {
    const parsed = deleteInputSchema.parse(input);

    const [run] = await db
      .select()
      .from(deepScanV2Runs)
      .where(eq(deepScanV2Runs.id, parsed.runId))
      .limit(1);

    if (!run) {
      return { success: false, error: 'Run not found' };
    }

    // Don't allow deleting running scans
    if (['pending', 'running'].includes(run.status ?? '')) {
      return {
        success: false,
        error: 'Cannot delete running scan. Cancel it first.',
      };
    }

    // Delete in order: documents → audit → activity → run
    if (parsed.deleteDocuments) {
      await db.delete(deepScanV2Documents).where(eq(deepScanV2Documents.runId, parsed.runId));
    }

    await db.delete(auditResultsV2).where(eq(auditResultsV2.runId, parsed.runId));
    await db.delete(deepScanV2ActivityLogs).where(eq(deepScanV2ActivityLogs.runId, parsed.runId));
    await db.delete(deepScanV2Runs).where(eq(deepScanV2Runs.id, parsed.runId));

    return {
      success: true,
      message: `Run ${parsed.runId} deleted`,
      documentsDeleted: parsed.deleteDocuments,
    };
  },
};
```

---

## Task A13: Retry Tool (NEW)

**Files:**

- Modify: `lib/agent-tools/tools/deep-scan.ts`

**Step 1: Add retry tool**

```typescript
const retryInputSchema = z.object({
  runId: z.string().describe('ID of the failed Deep Scan run to retry'),
  fromPhase: z.string().optional().describe('Resume from specific phase (default: failed phase)'),
});

export const deepScanRetryTool: AgentTool = {
  name: 'scan.deepscan.retry',
  description: 'Retry a failed Deep Scan from the last checkpoint or a specific phase.',
  inputSchema: retryInputSchema,
  category: 'scan',
  execute: async (input, context) => {
    const parsed = retryInputSchema.parse(input);

    const [run] = await db
      .select()
      .from(deepScanV2Runs)
      .where(eq(deepScanV2Runs.id, parsed.runId))
      .limit(1);

    if (!run) {
      return { success: false, error: 'Run not found' };
    }

    if (run.status !== 'failed' && run.status !== 'cancelled') {
      return {
        success: false,
        error: `Can only retry failed or cancelled runs (current: ${run.status})`,
      };
    }

    // Get qualification for websiteUrl
    const [qual] = await db
      .select()
      .from(qualifications)
      .where(eq(qualifications.id, run.qualificationId))
      .limit(1);

    if (!qual?.websiteUrl) {
      return { success: false, error: 'Qualification not found or has no URL' };
    }

    // Reset run status
    await db
      .update(deepScanV2Runs)
      .set({
        status: 'pending',
        updatedAt: new Date(),
        // Keep checkpoint data for resume
      })
      .where(eq(deepScanV2Runs.id, parsed.runId));

    // Enqueue retry job
    await addDeepScanV2Job({
      runId: parsed.runId,
      qualificationId: run.qualificationId,
      websiteUrl: qual.websiteUrl,
      userId: context.userId,
      targetCmsIds: JSON.parse(run.targetCmsIds ?? '[]'),
      checkpointId: parsed.runId, // Resume from checkpoint
      retryFromPhase: parsed.fromPhase,
    });

    return {
      success: true,
      message: `Retrying run ${parsed.runId}`,
      fromPhase: parsed.fromPhase ?? 'last checkpoint',
    };
  },
};
```

---

## Task A14: Activity Query Tool (NEW)

**Files:**

- Modify: `lib/agent-tools/tools/deep-scan.ts`

**Step 1: Add activity query tool**

```typescript
const activityInputSchema = z.object({
  runId: z.string().describe('ID of the Deep Scan run'),
  eventTypes: z
    .array(z.string())
    .optional()
    .describe('Filter by event types (e.g., agent_started, agent_failed)'),
  limit: z.number().min(1).max(500).default(100),
  since: z.string().optional().describe('ISO timestamp to filter events after'),
});

export const deepScanActivityTool: AgentTool = {
  name: 'scan.deepscan.activity',
  description: 'Query the activity log for a Deep Scan run. Useful for debugging and monitoring.',
  inputSchema: activityInputSchema,
  category: 'scan',
  execute: async (input, context) => {
    const parsed = activityInputSchema.parse(input);

    let query = db
      .select()
      .from(deepScanV2ActivityLogs)
      .where(eq(deepScanV2ActivityLogs.runId, parsed.runId))
      .orderBy(deepScanV2ActivityLogs.timestamp)
      .limit(parsed.limit);

    // Note: Additional filters would need conditional where clauses

    const activities = await query;

    return {
      success: true,
      runId: parsed.runId,
      count: activities.length,
      activities: activities.map(a => ({
        id: a.id,
        eventType: a.eventType,
        message: a.message,
        phase: a.phase,
        agentName: a.agentName,
        toolName: a.toolName,
        durationMs: a.durationMs,
        timestamp: a.timestamp?.toISOString(),
      })),
    };
  },
};
```

---

## Task A15: Agent Auth Middleware (NEW)

**Files:**

- Create: `lib/auth/agent-auth.ts`
- Modify: `app/api/v2/deep-scan/trigger/route.ts`

**Step 1: Create agent authentication**

```typescript
// lib/auth/agent-auth.ts
import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { apiKeys } from '@/lib/db/schema';

export interface AgentAuthContext {
  userId: string;
  agentId: string;
  keyId: string;
  permissions: string[];
}

/**
 * Authenticate an agent via API key.
 * API keys should be passed in the Authorization header as Bearer token.
 */
export async function authenticateAgent(req: NextRequest): Promise<AgentAuthContext | null> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const apiKey = authHeader.slice(7);
  if (!apiKey) {
    return null;
  }

  // Look up API key (should be hashed in production)
  const [keyRecord] = await db.select().from(apiKeys).where(eq(apiKeys.key, apiKey)).limit(1);

  if (!keyRecord || !keyRecord.isActive) {
    return null;
  }

  // Check expiry
  if (keyRecord.expiresAt && keyRecord.expiresAt < new Date()) {
    return null;
  }

  // Update last used
  await db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, keyRecord.id));

  return {
    userId: keyRecord.userId,
    agentId: keyRecord.agentId ?? `api-key-${keyRecord.id}`,
    keyId: keyRecord.id,
    permissions: JSON.parse(keyRecord.permissions ?? '[]'),
  };
}

/**
 * Check if agent has required permission.
 */
export function hasPermission(context: AgentAuthContext, permission: string): boolean {
  return context.permissions.includes('*') || context.permissions.includes(permission);
}
```

**Step 2: Add API keys table to schema**

```typescript
// In lib/db/schema.ts, add:

export const apiKeys = pgTable('api_keys', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => createId()),
  userId: text('user_id')
    .notNull()
    .references(() => users.id),
  agentId: text('agent_id'), // Optional agent identifier
  name: text('name').notNull(), // Human-readable name
  key: text('key').notNull().unique(), // The actual API key (hash in production!)
  permissions: text('permissions'), // JSON array of permissions
  isActive: boolean('is_active').default(true),
  lastUsedAt: timestamp('last_used_at'),
  expiresAt: timestamp('expires_at'),
  createdAt: timestamp('created_at').$defaultFn(() => new Date()),
});
```

**Step 3: Update trigger endpoint to support agent auth**

```typescript
// In app/api/v2/deep-scan/trigger/route.ts, add at the start:

import { authenticateAgent, hasPermission } from '@/lib/auth/agent-auth';

export async function POST(req: NextRequest) {
  // Try agent auth first, fall back to session
  const agentAuth = await authenticateAgent(req);
  const session = agentAuth ? null : await auth();

  if (!agentAuth && !session?.user?.id) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const userId = agentAuth?.userId ?? session!.user.id;
  const agentId = agentAuth?.agentId;

  // Check permission if agent auth
  if (agentAuth && !hasPermission(agentAuth, 'deepscan:trigger')) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  // ... rest of handler, use userId and agentId for provenance
}
```

---

## Revised Critical Path

```
A15 (Agent Auth) ─────────────────────────────────────┐
                                                       │
A1 (Tool Registry) ────────────────────────────────────┼──► A8 (Results Format)
    ├── A11 (Cancel)                                   │
    ├── A12 (Delete)                                   │
    ├── A13 (Retry)                                    │
    └── A14 (Activity)                                 │
                                                       │
A2 (Trigger Endpoint) ─────────────────────────────────┘

A4 (Checkpoint Timeout) ──► [Standalone]

A5 (Answer Provenance) ──► A1 (uses in answer tool)

A6 (Partial Failure) ──► MVP Task 13 (Orchestrator)

A7 (Activity Log - SIMPLIFIED) ──► JSONB column, not separate table
```

**New Critical Path:** A15 → A1 (with A11-A14) → A2 → A8 → A9

---

## Updated Acceptance Criteria

### Agent-Native Parity (13/13 target)

- [ ] `scan.deepscan.trigger` - Start a scan
- [ ] `scan.deepscan.status` - Check progress
- [ ] `scan.deepscan.results` - Get results
- [ ] `scan.deepscan.answer` - Answer questions
- [ ] `scan.deepscan.list` - List all runs
- [ ] `scan.deepscan.cancel` - Cancel running scan (**NEW**)
- [ ] `scan.deepscan.delete` - Delete a run (**NEW**)
- [ ] `scan.deepscan.retry` - Retry failed scan (**NEW**)
- [ ] `scan.deepscan.activity` - Query activity log (**NEW**)
- [ ] Document download via results
- [ ] Share link generation (future)
- [ ] RAG upload/search (future, separate epic)

### Security Requirements (**NEW**)

- [ ] API key authentication for agents
- [ ] Permission-based access control
- [ ] All JSON.parse() calls use Zod validation
- [ ] Input sanitization on user answers
- [ ] Rate limiting on trigger endpoint
