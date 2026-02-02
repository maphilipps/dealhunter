# Deep Scan v2 MVP Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the MVP (Phase 1) of Deep Scan v2 — an end-to-end, chat-based, agent-native pipeline from AI-Interview through Website-Audit to Indication document generation.

**Architecture:** Hybrid two-phase system: (1) AI-Interview via AI SDK `streamText` + `useChat` for real-time chat, (2) BullMQ background pipeline with autonomous Orchestrator Agent using `generateText` + tools. Checkpoint system enables Human-in-the-Loop pause/resume. All new code lives in `/lib/deep-scan-v2/` (clean separation from v1).

**Tech Stack:** Next.js 16 (App Router), AI SDK v6 (`ai@^6`, `@ai-sdk/openai@^3`), Drizzle ORM, pgvector (3072-dim), BullMQ, Redis, Zod, React 19.

**Reference Spec:** `SPEC.md` (Deep Scan v2 — Technische Spezifikation)

---

## Task Overview

| #   | Task                             | Description                                                                                                                                                                    |
| --- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Types & Constants                | Shared TypeScript interfaces, Zod schemas, configuration                                                                                                                       |
| 2   | Database Schema                  | New tables: `deepScanV2Runs`, `deepScanV2Documents`, `auditResults`, `knowledgeChunks`, `deepScanV2Conversations` + schema extension for `qualifications` and `backgroundJobs` |
| 3   | BullMQ Queue Setup               | New `deep-scan-v2` queue, job data types, worker entry point                                                                                                                   |
| 4   | Checkpoint System                | Save/restore orchestrator state for Human-in-the-Loop pause/resume                                                                                                             |
| 5   | RAG Foundation                   | Knowledge service (CRUD), chunking, embedding, retrieval with pgvector                                                                                                         |
| 6   | RAG Ingest Pipeline              | Upload → Parse → Chunk → Embed pipeline for DOCX/PDF/MD                                                                                                                        |
| 7   | Audit Module: Tech Detection     | Website tech stack detection (CMS, framework, libraries)                                                                                                                       |
| 8   | Audit Module: Performance        | Core Web Vitals audit (LCP, CLS, TTFB, FID)                                                                                                                                    |
| 9   | Audit Module: Accessibility      | WCAG accessibility audit with violation counting                                                                                                                               |
| 10  | Audit Module: Component Analysis | UI pattern inventory, content types, forms, interactions                                                                                                                       |
| 11  | Expert Agent: CMS Agent          | Generic CMS agent with RAG-based knowledge                                                                                                                                     |
| 12  | Expert Agent: Industry Agent     | Industry + use-case requirements agent                                                                                                                                         |
| 13  | Orchestrator Agent               | Autonomous agent with tools (audit, RAG, askUser, progress)                                                                                                                    |
| 14  | Orchestrator Tools               | askUser, runAudit, RAG query, progress, uncertainty tools                                                                                                                      |
| 15  | Indication Generator             | HTML indication document from orchestrator results                                                                                                                             |
| 16  | Interview Chat API               | `POST /api/v2/deep-scan/chat` — AI SDK `streamText` with `startPipeline` tool                                                                                                  |
| 17  | Pipeline Control APIs            | Start, answer, retry, status, progress SSE endpoints                                                                                                                           |
| 18  | Results APIs                     | Audit results, documents list, download, public share-link                                                                                                                     |
| 19  | Knowledge Management APIs        | Upload, search, delete endpoints                                                                                                                                               |
| 20  | Chat UI Component                | React `useChat` component for interview + pipeline progress                                                                                                                    |
| 21  | Audit In-App View                | Dashboard component for audit results visualization                                                                                                                            |
| 22  | Deep Scan Page                   | Full page: `/qualifications/[id]/deep-scan/` with chat + progress + results                                                                                                    |
| 23  | Worker Process                   | Standalone Node.js worker for `deep-scan-v2` queue                                                                                                                             |
| 24  | Integration Testing              | End-to-end flow verification                                                                                                                                                   |

---

## Task 1: Types & Constants

**Files:**

- Create: `lib/deep-scan-v2/types.ts`
- Create: `lib/deep-scan-v2/constants.ts`

**Step 1: Create shared types file**

```typescript
// lib/deep-scan-v2/types.ts
import { z } from 'zod';

// ====== Run Status ======
export const deepScanV2StatusEnum = [
  'pending',
  'running',
  'audit_complete',
  'generating',
  'waiting_for_user',
  'review',
  'completed',
  'failed',
] as const;

export type DeepScanV2Status = (typeof deepScanV2StatusEnum)[number];

// ====== Document Types ======
export const documentTypeEnum = ['indication', 'calculation', 'presentation', 'proposal'] as const;
export type DocumentType = (typeof documentTypeEnum)[number];

export const documentFormatEnum = ['html', 'xlsx', 'pptx', 'docx'] as const;
export type DocumentFormat = (typeof documentFormatEnum)[number];

// ====== Interview Results ======
export const interviewResultsSchema = z.object({
  goal: z.string(),
  cmsPreference: z.string().optional(),
  budgetRange: z.string().optional(),
  specialRequirements: z.string().optional(),
  tonality: z.enum(['formal', 'balanced', 'casual']).optional(),
});

export type InterviewResults = z.infer<typeof interviewResultsSchema>;

// ====== Orchestrator Checkpoint ======
export interface OrchestratorCheckpoint {
  runId: string;
  phase: string;
  completedAgents: string[];
  agentResults: Record<string, unknown>;
  conversationHistory: Array<{
    role: 'assistant' | 'user';
    content: string;
  }>;
  collectedAnswers: Record<string, string>;
  pendingQuestion: {
    question: string;
    context: string;
    options?: string[];
    defaultAnswer?: string;
  } | null;
}

// ====== Progress Events (SSE) ======
export interface ProgressEvent {
  type:
    | 'phase_start'
    | 'agent_start'
    | 'agent_complete'
    | 'document_ready'
    | 'question'
    | 'answer_received'
    | 'complete'
    | 'error';
  phase: string;
  agent?: string;
  progress: number;
  message: string;
  confidence?: number;
  documentId?: string;
  question?: {
    text: string;
    options?: string[];
    context?: string;
  };
  timestamp: string;
}

// ====== BullMQ Job Types ======
export interface DeepScanV2JobData {
  runId: string;
  qualificationId: string;
  websiteUrl: string;
  userId: string;
  targetCmsIds: string[];
  interviewResults?: InterviewResults;
  checkpointId?: string;
  userAnswer?: string;
  forceReset?: boolean;
}

export interface DeepScanV2JobResult {
  success: boolean;
  phase: 'audit' | 'analysis' | 'generation' | 'waiting_for_user' | 'complete';
  completedAgents: string[];
  failedAgents: string[];
  generatedDocuments: string[];
  checkpointId?: string;
  error?: string;
}

// ====== Audit Types ======
export interface ComponentAnalysis {
  components: Array<{
    name: string;
    category: 'layout' | 'navigation' | 'content' | 'form' | 'interactive' | 'media';
    occurrences: number;
    complexity: 'simple' | 'medium' | 'complex';
    description: string;
    migrationNotes: string;
  }>;
  contentTypes: Array<{
    name: string;
    count: number;
    fields: string[];
    hasCustomLogic: boolean;
  }>;
  forms: Array<{
    name: string;
    fields: number;
    hasValidation: boolean;
    hasFileUpload: boolean;
    submitsTo: string;
  }>;
  interactions: Array<{
    name: string;
    type: 'search' | 'filter' | 'sort' | 'pagination' | 'animation' | 'realtime' | 'other';
    complexity: 'simple' | 'medium' | 'complex';
  }>;
}

// ====== Indication Document ======
export const indicationDocumentSchema = z.object({
  executiveSummary: z.string(),
  currentState: z.object({
    techStack: z.object({
      cms: z.string().nullable(),
      framework: z.string().nullable(),
      libraries: z.array(z.string()),
      cdn: z.string().nullable(),
    }),
    contentVolume: z.object({
      pageCount: z.number(),
      contentTypes: z.number(),
      estimatedWords: z.number().optional(),
    }),
    componentCount: z.number(),
  }),
  recommendation: z.object({
    targetCms: z.string(),
    reasoning: z.string(),
    alternatives: z.array(
      z.object({
        cms: z.string(),
        reasoning: z.string(),
      })
    ),
  }),
  scopeEstimate: z.object({
    phases: z.array(
      z.object({
        name: z.string(),
        effort: z.string(),
        confidence: z.number(),
      })
    ),
    totalRange: z.object({
      min: z.number(),
      max: z.number(),
      unit: z.literal('PT'),
    }),
    riskFactors: z.array(z.string()),
  }),
  nextSteps: z.array(z.string()),
  flags: z.array(
    z.object({
      area: z.string(),
      message: z.string(),
      severity: z.enum(['info', 'warning', 'critical']),
    })
  ),
});

export type IndicationDocument = z.infer<typeof indicationDocumentSchema>;

// ====== RAG Types ======
export interface KnowledgeChunkMetadata {
  cms: string | null;
  industry: string | null;
  documentType: string | null;
  confidence: number;
  businessUnit: string | null;
}

export interface KnowledgeChunk {
  id: string;
  content: string;
  tokenCount: number;
  sourceType: string;
  sourceFileName: string | null;
  metadata: KnowledgeChunkMetadata;
  similarity?: number;
}
```

**Step 2: Create constants file**

```typescript
// lib/deep-scan-v2/constants.ts

// ====== Queue Name ======
export const DEEP_SCAN_V2_QUEUE = 'deep-scan-v2' as const;

// ====== Agent Names ======
export const AGENT_NAMES = {
  ORCHESTRATOR: 'orchestrator',
  AUDIT_WEBSITE: 'audit-website',
  AUDIT_COMPONENTS: 'audit-components',
  CMS: 'cms-agent',
  INDUSTRY: 'industry-agent',
  QUALITY: 'quality-agent',
} as const;

// ====== Phases ======
export const PHASES = {
  INTERVIEW: 'interview',
  AUDIT: 'audit',
  ANALYSIS: 'analysis',
  GENERATION: 'generation',
  REVIEW: 'review',
} as const;

// ====== System Prompts ======
export const INTERVIEW_SYSTEM_PROMPT = `Du bist ein erfahrener Berater bei adesso, der ein kurzes Interview führt, um einen Deep Scan (Website-Analyse + Angebotsindikation) vorzubereiten.

Dein Ziel:
1. Verstehe das Projektziel des Kunden (Migration, Redesign, Neubau?)
2. Kläre CMS-Präferenzen oder -Einschränkungen
3. Erfrage grobe Budget-Vorstellungen (optional)
4. Identifiziere besondere Anforderungen (Barrierefreiheit, Multi-Language, E-Commerce etc.)
5. Frage nach dem gewünschten Tonfall der Dokumente (formal/ausgewogen/locker)

Regeln:
- Stelle maximal 3-5 Fragen, nicht mehr
- Fasse nach jeder Antwort kurz zusammen was du verstanden hast
- Wenn du genug Informationen hast, fasse zusammen und starte die Pipeline mit dem startPipeline-Tool
- Antworte auf Deutsch
- Sei professionell aber nahbar
- Wenn der User ungeduldig ist oder keine Details liefern will, starte trotzdem mit den vorhandenen Informationen`;

export const ORCHESTRATOR_SYSTEM_PROMPT = `Du bist der Deep Scan v2 Orchestrator bei adesso. Du steuerst autonom eine Pipeline zur Analyse von Kundenwebsites und zur Generierung von Verkaufsdokumenten.

Deine Aufgaben:
1. Führe ein Website-Audit durch (Tech Stack, Performance, Accessibility, Komponenten)
2. Analysiere die Ergebnisse mit spezialisierten Agents (CMS, Industry)
3. Generiere eine Indikation (erste Einschätzung) als HTML-Dokument

Prinzipien:
- "Best-Effort + Flags": Liefere immer ein Ergebnis, markiere unsichere Bereiche
- Frage den User nur bei wirklich kritischen Unsicherheiten (askUser-Tool)
- Melde Fortschritt regelmäßig (reportProgress-Tool)
- Markiere niedrige Confidence mit flagUncertainty-Tool

Ablauf:
1. Starte Website-Audit (runAudit)
2. Frage CMS-Wissen ab (queryCmsKnowledge)
3. Frage Branchen-Wissen ab (queryIndustryKnowledge)
4. Bei Unsicherheit: flagUncertainty oder askUser
5. Generiere Indikation (generateIndication)
6. Melde Fertigstellung`;

// ====== Share Link Config ======
export const SHARE_LINK_EXPIRY_DAYS = 30;
export const SHARE_LINK_TOKEN_LENGTH = 32;

// ====== Checkpoint Config ======
export const CHECKPOINT_TIMEOUT_HOURS = 24;

// ====== RAG Config ======
export const RAG_DEFAULTS = {
  topK: 10,
  minConfidence: 30,
  maxChunkTokens: 2000,
  overlapTokens: 100,
  embeddingDimensions: 3072,
} as const;
```

**Step 3: Commit**

```bash
git add lib/deep-scan-v2/types.ts lib/deep-scan-v2/constants.ts
git commit -m "feat(deep-scan-v2): add shared types and constants for MVP"
```

---

## Task 2: Database Schema

**Files:**

- Modify: `lib/db/schema.ts` (add new tables + extend existing)
- Create: `drizzle/0002_deep_scan_v2.sql` (migration file, generated by Drizzle)

**Step 1: Add new tables to schema.ts**

Add the following tables at the bottom of `lib/db/schema.ts` (before the relations section):

**`deepScanV2Runs`** — Pipeline Runs:

```typescript
export const deepScanV2Runs = pgTable(
  'deep_scan_v2_runs',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    qualificationId: text('qualification_id')
      .notNull()
      .references(() => qualifications.id),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),

    // Status
    status: text('status', {
      enum: [
        'pending',
        'running',
        'audit_complete',
        'generating',
        'waiting_for_user',
        'review',
        'completed',
        'failed',
      ],
    })
      .notNull()
      .default('pending'),

    // Snapshot
    runNumber: integer('run_number').notNull().default(1),
    snapshotData: text('snapshot_data'), // JSON: full orchestrator state

    // CMS Context
    targetCmsIds: text('target_cms_ids'), // JSON array
    selectedCmsId: text('selected_cms_id').references(() => technologies.id),

    // Progress
    currentPhase: text('current_phase'),
    progress: integer('progress').notNull().default(0),
    currentStep: text('current_step'),

    // Agent Tracking
    completedAgents: text('completed_agents'), // JSON array
    failedAgents: text('failed_agents'), // JSON array
    agentConfidences: text('agent_confidences'), // JSON object

    // Timing
    startedAt: timestamp('started_at'),
    completedAt: timestamp('completed_at'),
    createdAt: timestamp('created_at').$defaultFn(() => new Date()),
    updatedAt: timestamp('updated_at').$defaultFn(() => new Date()),
  },
  table => ({
    qualificationIdx: index('dsv2_runs_qualification_idx').on(table.qualificationId),
    statusIdx: index('dsv2_runs_status_idx').on(table.status),
    userIdx: index('dsv2_runs_user_idx').on(table.userId),
  })
);
```

**`deepScanV2Documents`** — Generated Documents:

```typescript
export const deepScanV2Documents = pgTable(
  'deep_scan_v2_documents',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    runId: text('run_id')
      .notNull()
      .references(() => deepScanV2Runs.id),
    qualificationId: text('qualification_id')
      .notNull()
      .references(() => qualifications.id),

    // Document Type
    documentType: text('document_type', {
      enum: ['indication', 'calculation', 'presentation', 'proposal'],
    }).notNull(),
    format: text('format', {
      enum: ['html', 'xlsx', 'pptx', 'docx'],
    }).notNull(),

    // CMS Variant
    cmsVariant: text('cms_variant'),
    technologyId: text('technology_id').references(() => technologies.id),

    // Content
    content: text('content'), // HTML for indication
    fileData: text('file_data'), // Base64 for binary files
    fileName: text('file_name'),
    fileSize: integer('file_size'),

    // Quality
    confidence: integer('confidence'),
    flags: text('flags'), // JSON array

    // Timestamps
    generatedAt: timestamp('generated_at'),
    createdAt: timestamp('created_at').$defaultFn(() => new Date()),
  },
  table => ({
    runIdx: index('dsv2_docs_run_idx').on(table.runId),
    qualificationIdx: index('dsv2_docs_qualification_idx').on(table.qualificationId),
    typeIdx: index('dsv2_docs_type_idx').on(table.documentType),
  })
);
```

**`auditResultsV2`** — Website Audit Results:

```typescript
export const auditResultsV2 = pgTable(
  'audit_results_v2',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    runId: text('run_id')
      .notNull()
      .references(() => deepScanV2Runs.id),
    qualificationId: text('qualification_id')
      .notNull()
      .references(() => qualifications.id),

    // Website
    websiteUrl: text('website_url').notNull(),

    // Audit Sections (all JSON)
    techStack: text('tech_stack'),
    performance: text('performance'),
    accessibility: text('accessibility'),
    architecture: text('architecture'),
    hosting: text('hosting'),
    integrations: text('integrations'),
    componentLibrary: text('component_library'),
    screenshots: text('screenshots'),

    // Scores
    performanceScore: integer('performance_score'),
    accessibilityScore: integer('accessibility_score'),
    migrationComplexity: text('migration_complexity', {
      enum: ['low', 'medium', 'high', 'very_high'],
    }),
    complexityScore: integer('complexity_score'),

    // Share Link
    shareToken: text('share_token').unique(),
    shareExpiresAt: timestamp('share_expires_at'),

    // Timing
    startedAt: timestamp('started_at'),
    completedAt: timestamp('completed_at'),
    createdAt: timestamp('created_at').$defaultFn(() => new Date()),
  },
  table => ({
    runIdx: index('audit_v2_run_idx').on(table.runId),
    qualificationIdx: index('audit_v2_qualification_idx').on(table.qualificationId),
    shareTokenIdx: index('audit_v2_share_token_idx').on(table.shareToken),
  })
);
```

**`knowledgeChunks`** — RAG Knowledge Base:

```typescript
export const knowledgeChunks = pgTable(
  'knowledge_chunks',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),

    // Content
    content: text('content').notNull(),
    contentHash: text('content_hash').notNull(),
    tokenCount: integer('token_count').notNull(),

    // Source
    sourceType: text('source_type', {
      enum: ['upload', 'reference', 'baseline', 'template'],
    }).notNull(),
    sourceFileName: text('source_file_name'),
    sourceFileId: text('source_file_id'),

    // Embedding
    embedding: vector3072('embedding'),

    // Metadata (MVP: 5 core fields)
    industry: text('industry'),
    useCase: text('use_case'),
    cms: text('cms'),
    phase: text('phase'),
    documentType: text('document_type'),
    effortRange: text('effort_range'),
    confidence: integer('confidence').notNull().default(50),
    businessUnit: text('business_unit'),

    // Extended metadata (nullable, filled post-MVP)
    customerSize: text('customer_size'),
    projectVolume: text('project_volume'),
    contractType: text('contract_type'),
    region: text('region'),
    competitorContext: text('competitor_context'),
    legalRequirements: text('legal_requirements'),
    accessibilityLevel: text('accessibility_level'),
    hostingModel: text('hosting_model'),

    // Timestamps
    createdAt: timestamp('created_at').$defaultFn(() => new Date()),
    updatedAt: timestamp('updated_at').$defaultFn(() => new Date()),
  },
  table => ({
    contentHashIdx: index('knowledge_chunks_hash_idx').on(table.contentHash),
    cmsIdx: index('knowledge_chunks_cms_idx').on(table.cms),
    industryIdx: index('knowledge_chunks_industry_idx').on(table.industry),
    sourceTypeIdx: index('knowledge_chunks_source_type_idx').on(table.sourceType),
    businessUnitIdx: index('knowledge_chunks_bu_idx').on(table.businessUnit),
  })
);
```

**`deepScanV2Conversations`** — Chat History:

```typescript
export const deepScanV2Conversations = pgTable(
  'deep_scan_v2_conversations',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    runId: text('run_id')
      .notNull()
      .references(() => deepScanV2Runs.id),
    qualificationId: text('qualification_id')
      .notNull()
      .references(() => qualifications.id),

    // Message
    role: text('role', { enum: ['user', 'assistant', 'system'] }).notNull(),
    content: text('content').notNull(),
    messageType: text('message_type', {
      enum: ['interview', 'progress', 'question', 'answer'],
    }).notNull(),

    // Tool Calls
    toolCalls: text('tool_calls'), // JSON
    toolResults: text('tool_results'), // JSON

    // Ordering
    sequenceNumber: integer('sequence_number').notNull(),

    // Timestamps
    createdAt: timestamp('created_at').$defaultFn(() => new Date()),
  },
  table => ({
    runIdx: index('dsv2_conv_run_idx').on(table.runId),
    qualificationIdx: index('dsv2_conv_qualification_idx').on(table.qualificationId),
    sequenceIdx: index('dsv2_conv_sequence_idx').on(table.runId, table.sequenceNumber),
  })
);
```

**Step 2: Extend `backgroundJobs` enum**

In `lib/db/schema.ts`, update the `jobType` enum to include `'deep-scan-v2'`:

```typescript
// Find this line:
jobType: text('job_type', {
  enum: ['qualification', 'deep-analysis', 'deep-scan', 'quick-scan', 'team-notification', 'cleanup', 'visualization'],
}).notNull(),

// Change to:
jobType: text('job_type', {
  enum: ['qualification', 'deep-analysis', 'deep-scan', 'deep-scan-v2', 'quick-scan', 'team-notification', 'cleanup', 'visualization'],
}).notNull(),
```

**Step 3: Add type exports**

```typescript
export type DeepScanV2Run = typeof deepScanV2Runs.$inferSelect;
export type NewDeepScanV2Run = typeof deepScanV2Runs.$inferInsert;
export type DeepScanV2Document = typeof deepScanV2Documents.$inferSelect;
export type NewDeepScanV2Document = typeof deepScanV2Documents.$inferInsert;
export type AuditResultV2 = typeof auditResultsV2.$inferSelect;
export type NewAuditResultV2 = typeof auditResultsV2.$inferInsert;
export type KnowledgeChunkRow = typeof knowledgeChunks.$inferSelect;
export type NewKnowledgeChunkRow = typeof knowledgeChunks.$inferInsert;
export type DeepScanV2Conversation = typeof deepScanV2Conversations.$inferSelect;
export type NewDeepScanV2Conversation = typeof deepScanV2Conversations.$inferInsert;
```

**Step 4: Generate and run migration**

Run: `npx drizzle-kit generate`
Run: `npx drizzle-kit push`
Expected: Migration file created in `drizzle/` directory, tables created in DB.

**Step 5: Commit**

```bash
git add lib/db/schema.ts drizzle/
git commit -m "feat(deep-scan-v2): add database schema for v2 runs, documents, audit, knowledge chunks, conversations"
```

---

## Task 3: BullMQ Queue Setup

**Files:**

- Modify: `lib/bullmq/queues.ts` (add `DEEP_SCAN_V2` queue + helpers)
- Create: `workers/deep-scan-v2.ts` (worker entry point)

**Step 1: Add queue to `lib/bullmq/queues.ts`**

Add to `QUEUE_NAMES`:

```typescript
export const QUEUE_NAMES = {
  DEEP_SCAN: 'deep-scan',
  DEEP_SCAN_V2: 'deep-scan-v2', // NEW
  PREQUAL_PROCESSING: 'prequal-processing',
  QUICK_SCAN: 'quick-scan',
  VISUALIZATION: 'visualization',
} as const;
```

Add queue, events, and job helper functions following the exact pattern of the existing `deepScanQueue`. Use `DeepScanV2JobData` and `DeepScanV2JobResult` from `lib/deep-scan-v2/types.ts`.

Queue config:

- `attempts: 3` with custom backoff (1min, 5min, 15min)
- `removeOnComplete: { age: 24*60*60, count: 100 }`
- `removeOnFail: { age: 7*24*60*60, count: 500 }`

**Step 2: Create worker entry point**

```typescript
// workers/deep-scan-v2.ts
import { Worker } from 'bullmq';

import { getConnection } from '@/lib/bullmq/connection';
import { QUEUE_NAMES } from '@/lib/bullmq/queues';
import type { DeepScanV2JobData, DeepScanV2JobResult } from '@/lib/deep-scan-v2/types';

const CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY ?? '2', 10);

const worker = new Worker<DeepScanV2JobData, DeepScanV2JobResult>(
  QUEUE_NAMES.DEEP_SCAN_V2,
  async job => {
    const { processDeepScanV2Job } = await import('@/lib/deep-scan-v2/processor');
    return processDeepScanV2Job(job);
  },
  {
    connection: getConnection(),
    concurrency: CONCURRENCY,
    settings: {
      backoffStrategy: (attemptsMade: number) => {
        const delays = [60_000, 300_000, 900_000];
        return delays[attemptsMade - 1] ?? delays[delays.length - 1];
      },
    },
  }
);

worker.on('ready', () => console.log('[Worker:deep-scan-v2] Ready'));
worker.on('completed', (job, result) =>
  console.log(`[Worker:deep-scan-v2] Job ${job.id} completed: ${result.phase}`)
);
worker.on('failed', (job, err) =>
  console.error(`[Worker:deep-scan-v2] Job ${job?.id} failed:`, err.message)
);
worker.on('stalled', jobId => console.warn(`[Worker:deep-scan-v2] Job ${jobId} stalled`));

process.on('SIGINT', async () => {
  await worker.close();
  process.exit(0);
});
process.on('SIGTERM', async () => {
  await worker.close();
  process.exit(0);
});

console.log('[Worker:deep-scan-v2] Worker started');
```

**Step 3: Create placeholder processor**

```typescript
// lib/deep-scan-v2/processor.ts
import type { Job } from 'bullmq';
import type { DeepScanV2JobData, DeepScanV2JobResult } from './types';

export async function processDeepScanV2Job(
  job: Job<DeepScanV2JobData, DeepScanV2JobResult>
): Promise<DeepScanV2JobResult> {
  console.log(`[DeepScanV2] Processing job ${job.id} for run ${job.data.runId}`);

  // TODO: Wire up orchestrator in Task 13
  return {
    success: true,
    phase: 'complete',
    completedAgents: [],
    failedAgents: [],
    generatedDocuments: [],
  };
}
```

**Step 4: Add npm script to package.json**

In `package.json` scripts section, add:

```json
"worker:deep-scan-v2": "tsx workers/deep-scan-v2.ts"
```

**Step 5: Commit**

```bash
git add lib/bullmq/queues.ts workers/deep-scan-v2.ts lib/deep-scan-v2/processor.ts package.json
git commit -m "feat(deep-scan-v2): add BullMQ queue, worker, and placeholder processor"
```

---

## Task 4: Checkpoint System

**Files:**

- Create: `lib/deep-scan-v2/checkpoints.ts`

**Step 1: Implement checkpoint save/restore**

```typescript
// lib/deep-scan-v2/checkpoints.ts
import { eq } from 'drizzle-orm';

import { db } from '@/lib/db';
import { deepScanV2Runs } from '@/lib/db/schema';
import type { OrchestratorCheckpoint, DeepScanV2Status } from './types';

export async function saveCheckpoint(
  runId: string,
  checkpoint: OrchestratorCheckpoint
): Promise<void> {
  await db
    .update(deepScanV2Runs)
    .set({
      snapshotData: JSON.stringify(checkpoint),
      currentPhase: checkpoint.phase,
      completedAgents: JSON.stringify(checkpoint.completedAgents),
      status: checkpoint.pendingQuestion ? 'waiting_for_user' : 'running',
      updatedAt: new Date(),
    })
    .where(eq(deepScanV2Runs.id, runId));
}

export async function loadCheckpoint(runId: string): Promise<OrchestratorCheckpoint | null> {
  const [run] = await db
    .select({
      snapshotData: deepScanV2Runs.snapshotData,
    })
    .from(deepScanV2Runs)
    .where(eq(deepScanV2Runs.id, runId))
    .limit(1);

  if (!run?.snapshotData) return null;

  return JSON.parse(run.snapshotData) as OrchestratorCheckpoint;
}

export async function updateRunStatus(
  runId: string,
  status: DeepScanV2Status,
  extra?: {
    progress?: number;
    currentStep?: string;
    error?: string;
    completedAt?: Date;
  }
): Promise<void> {
  await db
    .update(deepScanV2Runs)
    .set({
      status,
      ...(extra?.progress !== undefined && { progress: extra.progress }),
      ...(extra?.currentStep && { currentStep: extra.currentStep }),
      ...(extra?.completedAt && { completedAt: extra.completedAt }),
      updatedAt: new Date(),
    })
    .where(eq(deepScanV2Runs.id, runId));
}

export async function markAgentComplete(
  runId: string,
  agentName: string,
  confidence: number
): Promise<void> {
  const [run] = await db
    .select({
      completedAgents: deepScanV2Runs.completedAgents,
      agentConfidences: deepScanV2Runs.agentConfidences,
    })
    .from(deepScanV2Runs)
    .where(eq(deepScanV2Runs.id, runId))
    .limit(1);

  const completed: string[] = run?.completedAgents ? JSON.parse(run.completedAgents) : [];
  const confidences: Record<string, number> = run?.agentConfidences
    ? JSON.parse(run.agentConfidences)
    : {};

  if (!completed.includes(agentName)) {
    completed.push(agentName);
  }
  confidences[agentName] = confidence;

  await db
    .update(deepScanV2Runs)
    .set({
      completedAgents: JSON.stringify(completed),
      agentConfidences: JSON.stringify(confidences),
      updatedAt: new Date(),
    })
    .where(eq(deepScanV2Runs.id, runId));
}

export async function markAgentFailed(runId: string, agentName: string): Promise<void> {
  const [run] = await db
    .select({
      failedAgents: deepScanV2Runs.failedAgents,
    })
    .from(deepScanV2Runs)
    .where(eq(deepScanV2Runs.id, runId))
    .limit(1);

  const failed: string[] = run?.failedAgents ? JSON.parse(run.failedAgents) : [];
  if (!failed.includes(agentName)) {
    failed.push(agentName);
  }

  await db
    .update(deepScanV2Runs)
    .set({
      failedAgents: JSON.stringify(failed),
      updatedAt: new Date(),
    })
    .where(eq(deepScanV2Runs.id, runId));
}
```

**Step 2: Commit**

```bash
git add lib/deep-scan-v2/checkpoints.ts
git commit -m "feat(deep-scan-v2): add checkpoint system for human-in-the-loop pause/resume"
```

---

## Task 5: RAG Foundation

**Files:**

- Create: `lib/deep-scan-v2/rag/retrieval.ts`
- Create: `lib/deep-scan-v2/rag/knowledge-service.ts`

**Step 1: Knowledge service (CRUD)**

```typescript
// lib/deep-scan-v2/rag/knowledge-service.ts
import { createHash } from 'crypto';
import { eq } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';

import { db } from '@/lib/db';
import { knowledgeChunks } from '@/lib/db/schema';
import { generateEmbeddings } from '@/lib/ai/embedding-config';
import type { KnowledgeChunkMetadata } from '../types';

export async function upsertKnowledgeChunk(params: {
  content: string;
  tokenCount: number;
  sourceType: 'upload' | 'reference' | 'baseline' | 'template';
  sourceFileName?: string;
  sourceFileId?: string;
  metadata: Partial<KnowledgeChunkMetadata>;
}): Promise<string> {
  const contentHash = createHash('sha256').update(params.content).digest('hex');

  // Check for duplicate
  const [existing] = await db
    .select({ id: knowledgeChunks.id })
    .from(knowledgeChunks)
    .where(eq(knowledgeChunks.contentHash, contentHash))
    .limit(1);

  if (existing) return existing.id;

  // Generate embedding
  const embeddings = await generateEmbeddings([params.content]);
  const embedding = embeddings?.[0] ?? null;

  const id = createId();
  await db.insert(knowledgeChunks).values({
    id,
    content: params.content,
    contentHash,
    tokenCount: params.tokenCount,
    sourceType: params.sourceType,
    sourceFileName: params.sourceFileName ?? null,
    sourceFileId: params.sourceFileId ?? null,
    embedding,
    cms: params.metadata.cms ?? null,
    industry: params.metadata.industry ?? null,
    documentType: params.metadata.documentType ?? null,
    confidence: params.metadata.confidence ?? 50,
    businessUnit: params.metadata.businessUnit ?? null,
  });

  return id;
}

export async function deleteKnowledgeChunk(id: string): Promise<void> {
  await db.delete(knowledgeChunks).where(eq(knowledgeChunks.id, id));
}
```

**Step 2: Retrieval service**

```typescript
// lib/deep-scan-v2/rag/retrieval.ts
import { sql, and, eq, gte } from 'drizzle-orm';

import { db } from '@/lib/db';
import { knowledgeChunks } from '@/lib/db/schema';
import { generateQueryEmbedding } from '@/lib/ai/embedding-config';
import type { KnowledgeChunk, KnowledgeChunkMetadata } from '../types';
import { RAG_DEFAULTS } from '../constants';

export async function queryKnowledge(params: {
  query: string;
  filters?: Partial<KnowledgeChunkMetadata>;
  topK?: number;
  minConfidence?: number;
}): Promise<KnowledgeChunk[]> {
  const topK = params.topK ?? RAG_DEFAULTS.topK;
  const minConfidence = params.minConfidence ?? RAG_DEFAULTS.minConfidence;

  const queryEmbedding = await generateQueryEmbedding(params.query);
  if (!queryEmbedding) {
    console.warn('[RAG] Embedding generation failed, returning empty results');
    return [];
  }

  const embeddingStr = `[${queryEmbedding.join(',')}]`;

  // Build filter conditions
  const conditions = [gte(knowledgeChunks.confidence, minConfidence)];

  if (params.filters?.cms) {
    conditions.push(eq(knowledgeChunks.cms, params.filters.cms));
  }
  if (params.filters?.industry) {
    conditions.push(eq(knowledgeChunks.industry, params.filters.industry));
  }
  if (params.filters?.documentType) {
    conditions.push(eq(knowledgeChunks.documentType, params.filters.documentType));
  }
  if (params.filters?.businessUnit) {
    conditions.push(eq(knowledgeChunks.businessUnit, params.filters.businessUnit));
  }

  const results = await db.execute(sql`
    SELECT
      id, content, token_count, source_type, source_file_name,
      cms, industry, document_type, confidence, business_unit,
      1 - (embedding <=> ${embeddingStr}::vector) AS similarity
    FROM knowledge_chunks
    WHERE embedding IS NOT NULL
      AND confidence >= ${minConfidence}
      ${params.filters?.cms ? sql`AND cms = ${params.filters.cms}` : sql``}
      ${params.filters?.industry ? sql`AND industry = ${params.filters.industry}` : sql``}
      ${params.filters?.documentType ? sql`AND document_type = ${params.filters.documentType}` : sql``}
      ${params.filters?.businessUnit ? sql`AND business_unit = ${params.filters.businessUnit}` : sql``}
    ORDER BY embedding <=> ${embeddingStr}::vector
    LIMIT ${topK}
  `);

  return (results.rows as any[]).map(row => ({
    id: row.id,
    content: row.content,
    tokenCount: row.token_count,
    sourceType: row.source_type,
    sourceFileName: row.source_file_name,
    metadata: {
      cms: row.cms,
      industry: row.industry,
      documentType: row.document_type,
      confidence: row.confidence,
      businessUnit: row.business_unit,
    },
    similarity: row.similarity,
  }));
}
```

**Step 3: Commit**

```bash
git add lib/deep-scan-v2/rag/
git commit -m "feat(deep-scan-v2): add RAG knowledge service and semantic retrieval"
```

---

## Task 6: RAG Ingest Pipeline

**Files:**

- Create: `lib/deep-scan-v2/rag/chunking.ts`
- Create: `lib/deep-scan-v2/rag/ingest-pipeline.ts`

**Step 1: Semantic chunking**

```typescript
// lib/deep-scan-v2/rag/chunking.ts
import { RAG_DEFAULTS } from '../constants';

export interface TextChunk {
  content: string;
  tokenCount: number;
  sectionTitle?: string;
}

// Rough token estimation: ~4 chars per token
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function chunkMarkdown(text: string): TextChunk[] {
  const chunks: TextChunk[] = [];
  const sections = text.split(/^(#{1,3}\s.+)$/gm);

  let currentTitle: string | undefined;
  let currentContent = '';

  for (const section of sections) {
    if (/^#{1,3}\s/.test(section.trim())) {
      // Flush previous section if it has content
      if (currentContent.trim()) {
        chunks.push(...splitByTokenLimit(currentContent.trim(), currentTitle));
      }
      currentTitle = section.trim().replace(/^#{1,3}\s/, '');
      currentContent = '';
    } else {
      currentContent += section;
    }
  }

  // Flush remaining
  if (currentContent.trim()) {
    chunks.push(...splitByTokenLimit(currentContent.trim(), currentTitle));
  }

  return chunks;
}

function splitByTokenLimit(text: string, title?: string): TextChunk[] {
  const maxTokens = RAG_DEFAULTS.maxChunkTokens;
  const tokens = estimateTokens(text);

  if (tokens <= maxTokens) {
    return [{ content: text, tokenCount: tokens, sectionTitle: title }];
  }

  // Split by paragraphs
  const paragraphs = text.split(/\n\n+/);
  const result: TextChunk[] = [];
  let buffer = '';

  for (const para of paragraphs) {
    const combined = buffer ? `${buffer}\n\n${para}` : para;
    if (estimateTokens(combined) > maxTokens && buffer) {
      result.push({
        content: buffer,
        tokenCount: estimateTokens(buffer),
        sectionTitle: title,
      });
      buffer = para;
    } else {
      buffer = combined;
    }
  }

  if (buffer.trim()) {
    result.push({
      content: buffer,
      tokenCount: estimateTokens(buffer),
      sectionTitle: title,
    });
  }

  return result;
}

export function chunkPlainText(text: string): TextChunk[] {
  return splitByTokenLimit(text);
}
```

**Step 2: Ingest pipeline**

```typescript
// lib/deep-scan-v2/rag/ingest-pipeline.ts
import { chunkMarkdown, chunkPlainText } from './chunking';
import { upsertKnowledgeChunk } from './knowledge-service';
import type { KnowledgeChunkMetadata } from '../types';

export async function ingestDocument(params: {
  content: string;
  fileName: string;
  fileId?: string;
  sourceType: 'upload' | 'reference' | 'baseline' | 'template';
  metadata?: Partial<KnowledgeChunkMetadata>;
}): Promise<{ chunkCount: number; chunkIds: string[] }> {
  const isMarkdown = params.fileName.endsWith('.md');
  const chunks = isMarkdown ? chunkMarkdown(params.content) : chunkPlainText(params.content);

  const chunkIds: string[] = [];

  for (const chunk of chunks) {
    const id = await upsertKnowledgeChunk({
      content: chunk.content,
      tokenCount: chunk.tokenCount,
      sourceType: params.sourceType,
      sourceFileName: params.fileName,
      sourceFileId: params.fileId,
      metadata: params.metadata ?? {},
    });
    chunkIds.push(id);
  }

  return { chunkCount: chunkIds.length, chunkIds };
}
```

**Step 3: Commit**

```bash
git add lib/deep-scan-v2/rag/chunking.ts lib/deep-scan-v2/rag/ingest-pipeline.ts
git commit -m "feat(deep-scan-v2): add RAG ingest pipeline with semantic chunking"
```

---

## Task 7–10: Audit Module

**Files:**

- Create: `lib/deep-scan-v2/audit/tech-detector.ts`
- Create: `lib/deep-scan-v2/audit/performance-auditor.ts`
- Create: `lib/deep-scan-v2/audit/a11y-auditor.ts`
- Create: `lib/deep-scan-v2/audit/component-analyzer.ts`
- Create: `lib/deep-scan-v2/audit/index.ts`

These modules reuse patterns from the existing `lib/deep-scan/scraper/` and `lib/deep-scan/experts/` code. Each module:

1. Takes a website URL as input
2. Fetches and parses the website HTML (using `cheerio`, existing in project)
3. Uses AI SDK `generateObject` with a Zod schema for structured analysis
4. Returns typed results stored in the `auditResultsV2` table

**Implementation approach:**

- `tech-detector.ts`: Fetch HTML, analyze `<meta>` tags, scripts, headers for CMS/framework detection. Use `getModel('fast')` for quick AI analysis of detected tech stack.
- `performance-auditor.ts`: Use Google PageSpeed Insights API (public endpoint, no key needed for basic usage) or fallback to AI estimation from HTML analysis. Return Core Web Vitals scores.
- `a11y-auditor.ts`: Parse HTML with cheerio, check for common WCAG violations (missing alt text, contrast issues, heading hierarchy, ARIA attributes). Use `getModel('default')` for AI analysis.
- `component-analyzer.ts`: AI-powered analysis of page structure to identify UI components, content types, forms, and interactions. Use `getModel('quality')` with `ComponentAnalysis` schema.
- `index.ts`: Barrel export + `runFullAudit()` function that orchestrates all modules, stores results in `auditResultsV2`.

**Step N: Commit after each module**

```bash
git add lib/deep-scan-v2/audit/
git commit -m "feat(deep-scan-v2): add website audit modules (tech, performance, a11y, components)"
```

---

## Task 11–12: Expert Agents

**Files:**

- Create: `lib/deep-scan-v2/agents/cms-agent.ts`
- Create: `lib/deep-scan-v2/agents/industry-agent.ts`

Each agent follows this pattern:

1. Query RAG for domain-specific knowledge
2. Combine with audit results and context
3. Use `generateObject` with structured schema
4. Return typed results with confidence scores

**CMS Agent:**

```typescript
// lib/deep-scan-v2/agents/cms-agent.ts
import { generateObject } from 'ai';
import { z } from 'zod';
import { getModel } from '@/lib/ai/model-config';
import { queryKnowledge } from '../rag/retrieval';

const cmsAnalysisSchema = z.object({
  recommendedCms: z.string(),
  reasoning: z.string(),
  migrationComplexity: z.enum(['low', 'medium', 'high', 'very_high']),
  migrationStrategy: z.string(),
  alternatives: z.array(
    z.object({
      cms: z.string(),
      reasoning: z.string(),
      fit: z.number().min(0).max(100),
    })
  ),
  confidence: z.number().min(0).max(100),
});

export type CmsAnalysisResult = z.infer<typeof cmsAnalysisSchema>;

export async function runCmsAgent(params: {
  auditResults: Record<string, unknown>;
  targetCmsIds: string[];
  industry: string | null;
  websiteUrl: string;
}): Promise<CmsAnalysisResult> {
  // Query RAG for CMS knowledge
  const cmsKnowledge = await queryKnowledge({
    query: `CMS migration ${params.industry ?? ''} website relaunch`,
    filters: { documentType: 'baseline' },
    topK: 15,
  });

  const ragContext =
    cmsKnowledge.length > 0
      ? `\n\nRAG-Wissen:\n${cmsKnowledge.map(c => c.content).join('\n---\n')}`
      : '\n\n(Kein RAG-Wissen verfügbar — Analyse basiert auf allgemeinem Wissen)';

  const { object } = await generateObject({
    model: getModel('quality'),
    schema: cmsAnalysisSchema,
    system: `Du bist ein CMS-Experte bei adesso. Analysiere die Website und empfehle das optimale CMS.`,
    prompt: `Website: ${params.websiteUrl}\n\nAudit-Ergebnisse:\n${JSON.stringify(params.auditResults, null, 2)}${ragContext}`,
  });

  return object;
}
```

**Industry Agent** follows same pattern, querying for industry-specific requirements.

**Step N: Commit**

```bash
git add lib/deep-scan-v2/agents/
git commit -m "feat(deep-scan-v2): add CMS and Industry expert agents"
```

---

## Task 13–14: Orchestrator Agent & Tools

**Files:**

- Create: `lib/deep-scan-v2/orchestrator.ts`
- Create: `lib/deep-scan-v2/tools/ask-user.ts`
- Create: `lib/deep-scan-v2/tools/audit-tool.ts`
- Create: `lib/deep-scan-v2/tools/rag-query-tool.ts`
- Create: `lib/deep-scan-v2/tools/progress-tool.ts`
- Create: `lib/deep-scan-v2/tools/uncertainty-tool.ts`
- Create: `lib/deep-scan-v2/tools/generation-tools.ts`

The Orchestrator is the core AI agent that controls the entire pipeline using `generateText` with tools and `maxSteps: 50`.

**Key tool: `askUser`**

- Saves checkpoint to DB with pending question
- Throws a special `AskUserInterrupt` error to signal the BullMQ job to stop gracefully
- Job result contains `phase: 'waiting_for_user'` and `checkpointId`
- When user answers, a new job is enqueued with the checkpoint ID

**Key tool: `reportProgress`**

- Updates `deepScanV2Runs.progress` and `currentStep`
- Emits SSE event via Redis pub/sub (consumed by progress API)

**Key tool: `runAudit`**

- Delegates to the audit module (Task 7–10)
- Returns structured audit results

**Orchestrator flow:**

1. Load checkpoint (if resuming from askUser)
2. Run audit via `runAudit` tool
3. Run CMS analysis via `queryCmsKnowledge` tool
4. Run industry analysis via `queryIndustryKnowledge` tool
5. Flag uncertainties with `flagUncertainty`
6. Ask user if confidence is low (optional, via `askUser`)
7. Generate indication via `generateIndication`
8. Report completion

**Step N: Commit**

```bash
git add lib/deep-scan-v2/orchestrator.ts lib/deep-scan-v2/tools/
git commit -m "feat(deep-scan-v2): add orchestrator agent with tools for autonomous pipeline execution"
```

---

## Task 15: Indication Generator

**Files:**

- Create: `lib/deep-scan-v2/generators/indication-generator.ts`

Uses `generateObject` with `indicationDocumentSchema` to create structured HTML indication. Takes audit results + CMS analysis + industry analysis as input. Stores result in `deepScanV2Documents` table.

**Step N: Commit**

```bash
git add lib/deep-scan-v2/generators/indication-generator.ts
git commit -m "feat(deep-scan-v2): add indication document generator"
```

---

## Task 16: Interview Chat API

**Files:**

- Create: `app/api/v2/deep-scan/chat/route.ts`

```typescript
// app/api/v2/deep-scan/chat/route.ts
import { streamText } from 'ai';
import { z } from 'zod';
import { createId } from '@paralleldrive/cuid2';
import { eq, and, inArray } from 'drizzle-orm';
import { NextRequest } from 'next/server';

import { auth } from '@/lib/auth';
import { getModel } from '@/lib/ai/model-config';
import { db } from '@/lib/db';
import {
  qualifications,
  users,
  deepScanV2Runs,
  backgroundJobs,
  technologies,
} from '@/lib/db/schema';
import { addDeepScanV2Job } from '@/lib/bullmq/queues';
import { INTERVIEW_SYSTEM_PROMPT } from '@/lib/deep-scan-v2/constants';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { messages, qualificationId } = await req.json();

  // Verify access (same pattern as existing deep-scan/start)
  const [lead] = await db
    .select()
    .from(qualifications)
    .where(eq(qualifications.id, qualificationId))
    .limit(1);

  if (!lead) return new Response('Not found', { status: 404 });

  const [currentUser] = await db.select().from(users).where(eq(users.id, session.user.id)).limit(1);

  if (!currentUser) return new Response('Unauthorized', { status: 401 });
  if (currentUser.role !== 'admin' && currentUser.businessUnitId !== lead.businessUnitId) {
    return new Response('Forbidden', { status: 403 });
  }

  // Get BU technologies for CMS context
  const buTechnologies = await db
    .select()
    .from(technologies)
    .where(eq(technologies.businessUnitId, lead.businessUnitId));

  const result = streamText({
    model: getModel('quality'),
    system: `${INTERVIEW_SYSTEM_PROMPT}\n\nKontext:\n- Kunde: ${lead.customerName}\n- Website: ${lead.websiteUrl}\n- Branche: ${lead.industry ?? 'unbekannt'}\n- Verfügbare CMS: ${buTechnologies.map(t => t.name).join(', ')}`,
    messages,
    tools: {
      startPipeline: {
        description: 'Startet die Deep Scan Pipeline mit den gesammelten Interview-Informationen',
        parameters: z.object({
          goal: z.string().describe('Das Hauptziel des Projekts'),
          cmsPreference: z.string().optional().describe('CMS-Präferenz des Kunden'),
          budgetRange: z.string().optional().describe('Budget-Rahmen'),
          specialRequirements: z.string().optional().describe('Besondere Anforderungen'),
          tonality: z
            .enum(['formal', 'balanced', 'casual'])
            .optional()
            .describe('Gewünschter Tonfall'),
        }),
        execute: async params => {
          // Create run record
          const runId = createId();
          await db.insert(deepScanV2Runs).values({
            id: runId,
            qualificationId,
            userId: session.user!.id,
            status: 'pending',
            targetCmsIds: JSON.stringify(buTechnologies.map(t => t.id)),
          });

          // Create background job
          const jobId = createId();
          await db.insert(backgroundJobs).values({
            id: jobId,
            jobType: 'deep-scan-v2',
            status: 'pending',
            userId: session.user!.id,
            qualificationId,
            progress: 0,
            currentStep: 'Pipeline gestartet...',
          });

          // Enqueue BullMQ job
          await addDeepScanV2Job(
            {
              runId,
              qualificationId,
              websiteUrl: lead.websiteUrl!,
              userId: session.user!.id,
              targetCmsIds: buTechnologies.map(t => t.id),
              interviewResults: params,
            },
            jobId
          );

          return { started: true, runId };
        },
      },
    },
    maxSteps: 10,
  });

  return result.toDataStreamResponse();
}
```

**Step N: Commit**

```bash
git add app/api/v2/deep-scan/chat/route.ts
git commit -m "feat(deep-scan-v2): add interview chat API with startPipeline tool"
```

---

## Task 17: Pipeline Control APIs

**Files:**

- Create: `app/api/v2/deep-scan/[runId]/route.ts` (GET status)
- Create: `app/api/v2/deep-scan/[runId]/answer/route.ts` (POST answer)
- Create: `app/api/v2/deep-scan/[runId]/progress/route.ts` (GET SSE stream)
- Create: `app/api/v2/deep-scan/[runId]/retry/route.ts` (POST retry)

Each follows the existing API route patterns:

- Auth check via `auth()`
- Business unit authorization
- JSON responses with `{ success, error, data }`
- Proper HTTP status codes (401, 403, 404, 409, 500)

**Answer endpoint:**

1. Load checkpoint for runId
2. Verify status is `waiting_for_user`
3. Update checkpoint with user answer
4. Enqueue new BullMQ job with checkpoint resume

**Progress SSE:**

- Uses Redis pub/sub channel `deep-scan-v2:${runId}:progress`
- Returns `ReadableStream` with SSE format
- Falls back to polling `deepScanV2Runs` status on each tick

**Step N: Commit**

```bash
git add app/api/v2/deep-scan/
git commit -m "feat(deep-scan-v2): add pipeline control APIs (status, answer, progress SSE, retry)"
```

---

## Task 18: Results APIs

**Files:**

- Create: `app/api/v2/deep-scan/[runId]/audit/route.ts`
- Create: `app/api/v2/deep-scan/[runId]/documents/route.ts`
- Create: `app/api/v2/deep-scan/[runId]/documents/[docId]/download/route.ts`
- Create: `app/api/v2/audit/share/[token]/route.ts` (public, no auth)

**Share link:** No auth required. Queries `auditResultsV2` by `shareToken`, checks `shareExpiresAt`. Returns read-only audit data.

**Step N: Commit**

```bash
git add app/api/v2/deep-scan/ app/api/v2/audit/
git commit -m "feat(deep-scan-v2): add results APIs (audit, documents, download, share link)"
```

---

## Task 19: Knowledge Management APIs

**Files:**

- Create: `app/api/v2/knowledge/upload/route.ts`
- Create: `app/api/v2/knowledge/search/route.ts`
- Create: `app/api/v2/knowledge/[chunkId]/route.ts`

Upload endpoint:

- Admin-only (role check)
- Accepts `multipart/form-data` with file + metadata
- Passes to `ingestDocument()` from Task 6
- Returns chunk count + IDs

Search endpoint:

- Accepts `query` + optional `filters` as query params
- Delegates to `queryKnowledge()` from Task 5

Delete endpoint:

- Admin-only
- Deletes single chunk by ID

**Step N: Commit**

```bash
git add app/api/v2/knowledge/
git commit -m "feat(deep-scan-v2): add knowledge management APIs (upload, search, delete)"
```

---

## Task 20: Chat UI Component

**Files:**

- Create: `components/deep-scan-v2/chat.tsx`
- Create: `components/deep-scan-v2/progress-indicator.tsx`
- Create: `components/deep-scan-v2/pipeline-status.tsx`

Uses AI SDK `useChat` hook pointing to `/api/v2/deep-scan/chat`. The component handles:

1. **Interview phase:** Chat messages with AI, displaying streaming responses
2. **Pipeline phase:** After `startPipeline` tool call, switch to progress view
3. **Question phase:** Display checkpoint question with input/options
4. **Results phase:** Show completed documents with download links

Key React patterns from the existing codebase:

- Client components with `'use client'` directive
- `useChat` from `ai/react` for streaming
- Tailwind CSS classes for styling
- SWR for polling pipeline status

**Step N: Commit**

```bash
git add components/deep-scan-v2/
git commit -m "feat(deep-scan-v2): add chat UI, progress indicator, and pipeline status components"
```

---

## Task 21: Audit In-App View

**Files:**

- Create: `components/deep-scan-v2/audit-view.tsx`
- Create: `components/deep-scan-v2/audit-sections/tech-stack.tsx`
- Create: `components/deep-scan-v2/audit-sections/performance.tsx`
- Create: `components/deep-scan-v2/audit-sections/accessibility.tsx`
- Create: `components/deep-scan-v2/audit-sections/components.tsx`

Dashboard-style component that displays audit results in sections. Each section is a card with:

- Section title + score badge
- Key metrics as data points
- Expandable details

Follows existing dashboard patterns from `app/(dashboard)/qualifications/`.

**Step N: Commit**

```bash
git add components/deep-scan-v2/audit-view.tsx components/deep-scan-v2/audit-sections/
git commit -m "feat(deep-scan-v2): add audit in-app view with section components"
```

---

## Task 22: Deep Scan Page

**Files:**

- Create: `app/(dashboard)/qualifications/[id]/deep-scan-v2/page.tsx`
- Create: `app/(dashboard)/qualifications/[id]/deep-scan-v2/layout.tsx`

Main page that composes:

1. Chat component (left panel or top)
2. Audit results (tabbed view)
3. Document list with download buttons
4. Share link button

Layout includes auth check and qualification data fetching.

**Step N: Commit**

```bash
git add app/\(dashboard\)/qualifications/\[id\]/deep-scan-v2/
git commit -m "feat(deep-scan-v2): add deep scan v2 page with chat, audit, and document views"
```

---

## Task 23: Wire Up Worker Process

**Files:**

- Modify: `lib/deep-scan-v2/processor.ts` (replace placeholder with real orchestrator)
- Modify: `workers/deep-scan-v2.ts` (verify worker can start)

Wire the placeholder processor from Task 3 to call the orchestrator from Task 13. Handle:

- Normal completion
- `AskUserInterrupt` (checkpoint saved, return `waiting_for_user`)
- Errors (mark run as failed, save error message)

**Step N: Commit**

```bash
git add lib/deep-scan-v2/processor.ts workers/deep-scan-v2.ts
git commit -m "feat(deep-scan-v2): wire orchestrator into BullMQ processor"
```

---

## Task 24: Integration Testing

**Files:**

- Create: `lib/deep-scan-v2/__tests__/orchestrator.test.ts`
- Create: `lib/deep-scan-v2/__tests__/checkpoint.test.ts`
- Create: `lib/deep-scan-v2/__tests__/rag-retrieval.test.ts`

Verify:

1. Orchestrator runs through full pipeline (mock AI calls)
2. Checkpoint save/load roundtrip works
3. RAG query returns relevant chunks
4. Interview chat creates run + enqueues job
5. Answer endpoint resumes from checkpoint

**Step N: Commit**

```bash
git add lib/deep-scan-v2/__tests__/
git commit -m "test(deep-scan-v2): add integration tests for orchestrator, checkpoints, and RAG"
```

---

## Dependencies Between Tasks

```
Task 1 (Types) ──────────────┬──► Task 2 (Schema)
                              │
                              ├──► Task 3 (Queue) ──► Task 23 (Wire Worker)
                              │
                              ├──► Task 4 (Checkpoint)
                              │
                              ├──► Task 5 (RAG) ──► Task 6 (Ingest)
                              │                 └──► Task 19 (Knowledge APIs)
                              │
                              ├──► Tasks 7-10 (Audit) ──► Task 21 (Audit View)
                              │                        └──► Task 18 (Results APIs)
                              │
                              ├──► Tasks 11-12 (Agents)
                              │
                              └──► Tasks 13-14 (Orchestrator) ──► Task 15 (Indication)
                                                              └──► Task 16 (Chat API)
                                                              └──► Task 17 (Control APIs)
                                                              └──► Task 23 (Wire Worker)

Task 16 (Chat API) ──► Task 20 (Chat UI) ──► Task 22 (Page)
Task 17 (Control APIs) ──────────────────────► Task 22 (Page)
Task 18 (Results APIs) ──────────────────────► Task 22 (Page)

All Tasks ──► Task 24 (Integration Testing)
```

**Critical Path:** Task 1 → Task 2 → Tasks 3+4+5 (parallel) → Tasks 7-12 (parallel) → Tasks 13-14 → Task 15 → Tasks 16-18 (parallel) → Tasks 20-22 → Task 23 → Task 24
