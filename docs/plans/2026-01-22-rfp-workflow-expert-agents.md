# RFP Workflow Expert Agents Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refaktorierung des RFP-Workflows zu einem Expert-Agent-System, bei dem jeder Aspekt (Timing, Deliverables, TechStack, Legal, etc.) von einem spezialisierten Agenten analysiert und ins RAG gespeichert wird.

**Architecture:**

- Jeder Tab (Details, Timing, Deliverables, Legal, Tech Stack, etc.) erhält einen dedizierten Expert-Agent
- Agents nutzen **RAG für Dokumentanalyse** (nicht Website-Crawling)
- Ergebnisse werden in `rfpEmbeddings` gespeichert mit `agentName`-Filter
- Views lesen aus RAG und visualisieren strukturiert
- Neue CMS-Entscheidungsmatrix-Seite unter Routing

**Tech Stack:** AI SDK generateObject, Drizzle ORM, RAG (rfpEmbeddings), Zod Schemas, ShadCN UI

---

## Current State Analysis

### Problem 1: Legal Agent prüft Website statt Dokumente

- `legal-check-agent.ts` L174-182: Queries RAG mit `agentNameFilter: ['website-analysis']`
- Sollte stattdessen RFP-Dokumentinhalt prüfen (vertragliche Anforderungen)

### Problem 2: Timing wird schlecht erkannt

- `extraction/agent.ts` L184-192: Nur einfache Textextraktion für Timeline
- Keine strukturierte Milestone-Erkennung
- Keine Deadline-Hierarchie (Submission vs. Project vs. Milestones)

### Problem 3: Tech Stack aus RFP-Dokument wird ignoriert

- `tech/page.tsx` zeigt nur QuickScan-Website-Analyse
- Technologie-Anforderungen aus RFP-Dokument werden nicht separat angezeigt

### Problem 4: Übersicht zu unübersichtlich

- `page.tsx` zeigt nur Status, keine Management Summary
- Keine Deliverable-Übersicht, keine Timeline-Highlights

### Problem 5: Keine CMS-Entscheidungsmatrix-Seite

- `routing/` hat nur BL-Routing
- CMS-Evaluation existiert (`cmsEvaluation` in quickScans), aber keine dedizierte View

---

## Architecture: Expert Agent System

```
┌─────────────────────────────────────────────────────────────────┐
│                    RFP Document Upload                          │
│                         (PDF/Email)                             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    RAG Embedding (Raw Text)                     │
│                   (lib/rag/raw-embedding-service.ts)            │
└─────────────────────────────────────────────────────────────────┘
                              │
          ┌───────────────────┼───────────────────┐
          │                   │                   │
          ▼                   ▼                   ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│  Timing Agent   │ │ Deliverables    │ │  TechStack      │
│  (RAG Query)    │ │   Agent         │ │    Agent        │
│                 │ │  (RAG Query)    │ │  (RAG Query)    │
└─────────────────┘ └─────────────────┘ └─────────────────┘
          │                   │                   │
          ▼                   ▼                   ▼
┌─────────────────────────────────────────────────────────────────┐
│               rfpEmbeddings (RAG Storage)                       │
│  agentName: 'timing' | 'deliverables' | 'techstack' | ...      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Views (Read from RAG)                        │
│   /timing  /deliverables  /tech  /legal  /routing/cms-matrix   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Task 1: Shared Expert Agent Infrastructure

**Files:**

- Create: `lib/agents/expert-agents/base.ts`
- Create: `lib/agents/expert-agents/types.ts`

### Step 1: Create types for expert agents

```typescript
// lib/agents/expert-agents/types.ts
import { z } from 'zod';

export interface ExpertAgentInput {
  rfpId: string;
  leadId?: string;
}

export interface ExpertAgentOutput<T> {
  success: boolean;
  data: T | null;
  confidence: number;
  error?: string;
  analyzedAt: string;
}

export const BaseAgentResultSchema = z.object({
  confidence: z.number().min(0).max(100),
  sources: z
    .array(
      z.object({
        chunkIndex: z.number(),
        relevance: z.number(),
        excerpt: z.string().max(200),
      })
    )
    .optional(),
});
```

### Step 2: Create base agent with RAG integration

```typescript
// lib/agents/expert-agents/base.ts
import { queryRawChunks, formatRAGContext } from '@/lib/rag/raw-retrieval-service';
import { generateRawChunkEmbeddings } from '@/lib/rag/raw-embedding-service';
import { db } from '@/lib/db';
import { rfpEmbeddings } from '@/lib/db/schema';

export async function queryRfpDocument(
  rfpId: string,
  query: string,
  maxResults = 10
): Promise<{ context: string; chunks: Array<{ content: string; relevance: number }> }> {
  const chunks = await queryRawChunks(rfpId, query, maxResults);
  const context = formatRAGContext(chunks);
  return {
    context,
    chunks: chunks.map(c => ({ content: c.content, relevance: c.relevance })),
  };
}

export async function storeAgentResult(
  rfpId: string,
  agentName: string,
  content: string,
  metadata: Record<string, unknown>
): Promise<void> {
  const chunks = [
    {
      chunkIndex: 0,
      content,
      tokenCount: Math.ceil(content.length / 4),
      metadata: { type: 'section' as const, startPosition: 0, endPosition: content.length },
    },
  ];
  const withEmbeddings = await generateRawChunkEmbeddings(chunks);

  if (withEmbeddings?.[0]) {
    await db.insert(rfpEmbeddings).values({
      rfpId,
      agentName,
      chunkType: 'analysis',
      chunkIndex: 0,
      content,
      embedding: JSON.stringify(withEmbeddings[0].embedding),
      metadata: JSON.stringify(metadata),
    });
  }
}
```

### Step 3: Commit

```bash
git add lib/agents/expert-agents/
git commit -m "feat(agents): add expert agent base infrastructure"
```

---

## Task 2: Timing Expert Agent

**Files:**

- Create: `lib/agents/expert-agents/timing-agent.ts`
- Create: `lib/agents/expert-agents/timing-schema.ts`
- Test: `lib/agents/expert-agents/__tests__/timing-agent.test.ts`

### Step 1: Create Timing Schema

```typescript
// lib/agents/expert-agents/timing-schema.ts
import { z } from 'zod';

export const MilestoneSchema = z.object({
  name: z.string(),
  date: z.string().optional(), // ISO date or relative like "Q2 2024"
  dateType: z.enum(['exact', 'estimated', 'relative']),
  description: z.string().optional(),
  mandatory: z.boolean().default(true),
  confidence: z.number().min(0).max(100),
});

export const TimingAnalysisSchema = z.object({
  // Submission deadline (most important)
  submissionDeadline: z
    .object({
      date: z.string(),
      time: z.string().optional(),
      timezone: z.string().optional(),
      confidence: z.number(),
      rawText: z.string(),
    })
    .optional(),

  // Project timeline
  projectStart: z.string().optional(),
  projectEnd: z.string().optional(),
  projectDurationMonths: z.number().optional(),

  // Milestones
  milestones: z.array(MilestoneSchema),

  // Q&A / Clarification periods
  clarificationDeadline: z.string().optional(),
  qaSessionDates: z.array(z.string()).optional(),

  // Contract/Award
  awardDate: z.string().optional(),
  contractSigningDate: z.string().optional(),

  // Urgency assessment
  urgencyLevel: z.enum(['critical', 'high', 'medium', 'low']),
  daysUntilSubmission: z.number().optional(),

  // Confidence & Sources
  confidence: z.number().min(0).max(100),
  sources: z
    .array(
      z.object({
        excerpt: z.string(),
        relevance: z.number(),
      })
    )
    .optional(),
});

export type TimingAnalysis = z.infer<typeof TimingAnalysisSchema>;
```

### Step 2: Implement Timing Agent

```typescript
// lib/agents/expert-agents/timing-agent.ts
import { generateStructuredOutput } from '@/lib/ai/config';
import { queryRfpDocument, storeAgentResult } from './base';
import { TimingAnalysisSchema, type TimingAnalysis } from './timing-schema';
import type { ExpertAgentInput, ExpertAgentOutput } from './types';

const TIMING_QUERIES = [
  'submission deadline response due date RFP closing proposal due',
  'project timeline milestones phases schedule go-live launch',
  'Q&A clarification questions vendor briefing',
  'contract award signing kick-off start date',
];

export async function runTimingAgent(
  input: ExpertAgentInput
): Promise<ExpertAgentOutput<TimingAnalysis>> {
  console.error(`[Timing Agent] Starting analysis for RFP ${input.rfpId}`);

  try {
    // Query RAG with timing-specific queries
    const ragResults = await Promise.all(
      TIMING_QUERIES.map(q => queryRfpDocument(input.rfpId, q, 5))
    );

    const combinedContext = ragResults.map(r => r.context).join('\n\n---\n\n');

    const systemPrompt = `Du bist ein Experte für RFP-Analyse mit Fokus auf Zeitplanung und Deadlines.
Analysiere das RFP-Dokument und extrahiere ALLE zeitlichen Informationen.

WICHTIG:
- Submission Deadline ist die wichtigste Information
- Unterscheide zwischen Submission Deadline, Project Start, Milestones
- Berechne daysUntilSubmission basierend auf heute: ${new Date().toISOString().split('T')[0]}
- Bewerte urgencyLevel: critical (<7 Tage), high (<14 Tage), medium (<30 Tage), low (>30 Tage)`;

    const userPrompt = `Extrahiere alle Timing-Informationen aus diesem RFP-Dokument:

${combinedContext}`;

    const result = await generateStructuredOutput({
      model: 'quality',
      schema: TimingAnalysisSchema,
      system: systemPrompt,
      prompt: userPrompt,
      temperature: 0.2,
    });

    // Store in RAG
    const content = formatTimingForRAG(result);
    await storeAgentResult(input.rfpId, 'timing_expert', content, {
      submissionDeadline: result.submissionDeadline?.date,
      urgencyLevel: result.urgencyLevel,
      milestonesCount: result.milestones.length,
      confidence: result.confidence,
    });

    return {
      success: true,
      data: result,
      confidence: result.confidence,
      analyzedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error('[Timing Agent] Error:', error);
    return {
      success: false,
      data: null,
      confidence: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
      analyzedAt: new Date().toISOString(),
    };
  }
}

function formatTimingForRAG(analysis: TimingAnalysis): string {
  const parts: string[] = ['# Timing Analysis\n'];

  if (analysis.submissionDeadline) {
    parts.push(`## Submission Deadline\nDate: ${analysis.submissionDeadline.date}`);
    if (analysis.submissionDeadline.time) parts.push(`Time: ${analysis.submissionDeadline.time}`);
    parts.push(`Raw: "${analysis.submissionDeadline.rawText}"\n`);
  }

  if (analysis.milestones.length > 0) {
    parts.push('## Milestones');
    analysis.milestones.forEach(m => {
      parts.push(`- ${m.name}: ${m.date || 'TBD'} (${m.dateType})`);
    });
  }

  parts.push(`\n## Assessment\nUrgency: ${analysis.urgencyLevel}`);
  if (analysis.daysUntilSubmission !== undefined) {
    parts.push(`Days until submission: ${analysis.daysUntilSubmission}`);
  }

  return parts.join('\n');
}
```

### Step 3: Commit

```bash
git add lib/agents/expert-agents/timing-*
git commit -m "feat(agents): add timing expert agent with milestone extraction"
```

---

## Task 3: Deliverables Expert Agent

**Files:**

- Create: `lib/agents/expert-agents/deliverables-agent.ts`
- Create: `lib/agents/expert-agents/deliverables-schema.ts`

### Step 1: Create Deliverables Schema

```typescript
// lib/agents/expert-agents/deliverables-schema.ts
import { z } from 'zod';

export const DeliverableSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  category: z.enum([
    'proposal_document', // Executive Summary, Technical Proposal
    'commercial', // Pricing, Cost Breakdown
    'legal', // Contracts, NDAs, Certificates
    'technical', // Architecture Docs, Diagrams
    'reference', // Case Studies, References
    'administrative', // Company Profile, Team CVs
    'presentation', // Demo, Pitch Deck
  ]),
  format: z.string().optional(), // PDF, Word, etc.
  pageLimit: z.number().optional(),
  mandatory: z.boolean(),
  deadline: z.string().optional(), // If different from main deadline
  submissionMethod: z.enum(['email', 'portal', 'physical', 'unknown']).optional(),
  copies: z.number().optional(),
  confidence: z.number().min(0).max(100),
  rawText: z.string(),
});

export const DeliverablesAnalysisSchema = z.object({
  deliverables: z.array(DeliverableSchema),

  // Summary stats
  totalCount: z.number(),
  mandatoryCount: z.number(),
  optionalCount: z.number(),

  // Submission info
  primarySubmissionMethod: z.enum(['email', 'portal', 'physical', 'unknown']),
  submissionEmail: z.string().optional(),
  portalUrl: z.string().optional(),

  // Effort estimation
  estimatedEffortHours: z.number().optional(),

  confidence: z.number().min(0).max(100),
});

export type Deliverable = z.infer<typeof DeliverableSchema>;
export type DeliverablesAnalysis = z.infer<typeof DeliverablesAnalysisSchema>;
```

### Step 2: Implement Deliverables Agent

```typescript
// lib/agents/expert-agents/deliverables-agent.ts
import { generateStructuredOutput } from '@/lib/ai/config';
import { queryRfpDocument, storeAgentResult } from './base';
import { DeliverablesAnalysisSchema, type DeliverablesAnalysis } from './deliverables-schema';
import type { ExpertAgentInput, ExpertAgentOutput } from './types';
import { createId } from '@paralleldrive/cuid2';

const DELIVERABLES_QUERIES = [
  'submission requirements mandatory components proposal shall include vendor must provide',
  'executive summary technical proposal commercial proposal pricing',
  'required documents certificates references case studies',
  'submission format PDF copies email portal physical',
  'page limit maximum pages word count',
];

export async function runDeliverablesAgent(
  input: ExpertAgentInput
): Promise<ExpertAgentOutput<DeliverablesAnalysis>> {
  console.error(`[Deliverables Agent] Starting analysis for RFP ${input.rfpId}`);

  try {
    const ragResults = await Promise.all(
      DELIVERABLES_QUERIES.map(q => queryRfpDocument(input.rfpId, q, 5))
    );

    const combinedContext = ragResults.map(r => r.context).join('\n\n---\n\n');

    const systemPrompt = `Du bist ein Experte für RFP-Analyse mit Fokus auf einzureichende Unterlagen.
Analysiere das RFP-Dokument und extrahiere ALLE Deliverables/Unterlagen, die der Bieter einreichen muss.

KATEGORIEN:
- proposal_document: Executive Summary, Technical Proposal, Approach
- commercial: Pricing, Cost Breakdown, Commercial Terms
- legal: Contracts, NDAs, Insurance Certificates, Compliance Docs
- technical: Architecture Diagrams, Technical Specifications
- reference: Case Studies, Customer References, Team CVs
- administrative: Company Profile, Financial Statements
- presentation: Demo, Pitch Deck, Q&A Preparation

WICHTIG:
- Erfasse auch Format-Anforderungen (PDF, Word, etc.)
- Erfasse Seitenlimits falls genannt
- Unterscheide mandatory vs. optional`;

    const result = await generateStructuredOutput({
      model: 'quality',
      schema: DeliverablesAnalysisSchema,
      system: systemPrompt,
      prompt: `Extrahiere alle Deliverables aus diesem RFP:\n\n${combinedContext}`,
      temperature: 0.2,
    });

    // Add IDs to deliverables
    result.deliverables = result.deliverables.map(d => ({
      ...d,
      id: d.id || createId(),
    }));

    // Store in RAG
    const content = formatDeliverablesForRAG(result);
    await storeAgentResult(input.rfpId, 'deliverables_expert', content, {
      totalCount: result.totalCount,
      mandatoryCount: result.mandatoryCount,
      submissionMethod: result.primarySubmissionMethod,
      confidence: result.confidence,
    });

    return {
      success: true,
      data: result,
      confidence: result.confidence,
      analyzedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error('[Deliverables Agent] Error:', error);
    return {
      success: false,
      data: null,
      confidence: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
      analyzedAt: new Date().toISOString(),
    };
  }
}

function formatDeliverablesForRAG(analysis: DeliverablesAnalysis): string {
  const parts: string[] = ['# Deliverables Analysis\n'];

  parts.push(
    `Total: ${analysis.totalCount} (${analysis.mandatoryCount} mandatory, ${analysis.optionalCount} optional)\n`
  );

  const byCategory = analysis.deliverables.reduce(
    (acc, d) => {
      acc[d.category] = acc[d.category] || [];
      acc[d.category].push(d);
      return acc;
    },
    {} as Record<string, typeof analysis.deliverables>
  );

  for (const [category, items] of Object.entries(byCategory)) {
    parts.push(`## ${category}`);
    items.forEach(d => {
      parts.push(`- ${d.mandatory ? '⚠️' : '○'} ${d.name}: ${d.description}`);
      if (d.format) parts.push(`  Format: ${d.format}`);
      if (d.pageLimit) parts.push(`  Max pages: ${d.pageLimit}`);
    });
    parts.push('');
  }

  return parts.join('\n');
}
```

### Step 3: Commit

```bash
git add lib/agents/expert-agents/deliverables-*
git commit -m "feat(agents): add deliverables expert agent"
```

---

## Task 4: TechStack Expert Agent (RFP Document)

**Files:**

- Create: `lib/agents/expert-agents/techstack-agent.ts`
- Create: `lib/agents/expert-agents/techstack-schema.ts`

### Step 1: Create TechStack Schema

```typescript
// lib/agents/expert-agents/techstack-schema.ts
import { z } from 'zod';

export const TechnologyRequirementSchema = z.object({
  name: z.string(),
  category: z.enum([
    'cms',
    'framework',
    'language',
    'database',
    'cloud',
    'integration',
    'security',
    'analytics',
    'other',
  ]),
  requirementType: z.enum(['required', 'preferred', 'excluded', 'mentioned']),
  context: z.string(), // Why is this mentioned?
  confidence: z.number().min(0).max(100),
});

export const TechStackAnalysisSchema = z.object({
  // Explicit requirements from RFP
  requirements: z.array(TechnologyRequirementSchema),

  // CMS-specific (important for adesso)
  cmsRequirements: z.object({
    explicit: z.array(z.string()).optional(), // Explicitly named CMS
    preferred: z.array(z.string()).optional(),
    excluded: z.array(z.string()).optional(),
    flexibility: z.enum(['rigid', 'preferred', 'flexible', 'open']),
    headlessRequired: z.boolean().optional(),
    multilingualRequired: z.boolean().optional(),
  }),

  // Integration requirements
  integrations: z.object({
    sso: z.array(z.string()).optional(), // SSO providers mentioned
    erp: z.array(z.string()).optional(), // ERP systems
    crm: z.array(z.string()).optional(), // CRM systems
    payment: z.array(z.string()).optional(), // Payment providers
    other: z.array(z.string()).optional(),
  }),

  // Infrastructure
  infrastructure: z.object({
    cloudProviders: z.array(z.string()).optional(),
    hostingRequirements: z.string().optional(),
    securityCertifications: z.array(z.string()).optional(),
    complianceRequirements: z.array(z.string()).optional(),
  }),

  // Assessment
  complexityScore: z.number().min(1).max(10),
  complexityFactors: z.array(z.string()),

  confidence: z.number().min(0).max(100),
});

export type TechStackAnalysis = z.infer<typeof TechStackAnalysisSchema>;
```

### Step 2: Implement TechStack Agent

```typescript
// lib/agents/expert-agents/techstack-agent.ts
import { generateStructuredOutput } from '@/lib/ai/config';
import { queryRfpDocument, storeAgentResult } from './base';
import { TechStackAnalysisSchema, type TechStackAnalysis } from './techstack-schema';
import type { ExpertAgentInput, ExpertAgentOutput } from './types';

const TECHSTACK_QUERIES = [
  'technology stack platform CMS content management system Drupal WordPress',
  'SSO single sign-on authentication SAML OAuth integration',
  'ERP SAP Oracle integration CRM Salesforce HubSpot',
  'cloud AWS Azure GCP hosting infrastructure',
  'security certification ISO 27001 SOC2 GDPR compliance',
  'headless API REST GraphQL decoupled architecture',
  'multilingual internationalization i18n translation',
];

export async function runTechStackAgent(
  input: ExpertAgentInput
): Promise<ExpertAgentOutput<TechStackAnalysis>> {
  console.error(`[TechStack Agent] Starting analysis for RFP ${input.rfpId}`);

  try {
    const ragResults = await Promise.all(
      TECHSTACK_QUERIES.map(q => queryRfpDocument(input.rfpId, q, 5))
    );

    const combinedContext = ragResults.map(r => r.context).join('\n\n---\n\n');

    const systemPrompt = `Du bist ein Experte für technische RFP-Analyse.
Extrahiere ALLE technischen Anforderungen aus dem RFP-Dokument.

FOKUS:
1. CMS-Anforderungen (Drupal, WordPress, Sitecore, AEM, headless, etc.)
2. Integrations-Anforderungen (SSO, ERP, CRM, Payment)
3. Infrastruktur (Cloud, Security, Compliance)

WICHTIG:
- Unterscheide "required" vs "preferred" vs "mentioned"
- Beachte auch ausgeschlossene Technologien ("excluded")
- Bewerte die Flexibilität bei CMS-Wahl
- Identifiziere Komplexitätsfaktoren`;

    const result = await generateStructuredOutput({
      model: 'quality',
      schema: TechStackAnalysisSchema,
      system: systemPrompt,
      prompt: `Analysiere die technischen Anforderungen:\n\n${combinedContext}`,
      temperature: 0.2,
    });

    // Store in RAG
    const content = formatTechStackForRAG(result);
    await storeAgentResult(input.rfpId, 'techstack_expert', content, {
      cmsFlexibility: result.cmsRequirements.flexibility,
      complexityScore: result.complexityScore,
      requirementsCount: result.requirements.length,
      confidence: result.confidence,
    });

    return {
      success: true,
      data: result,
      confidence: result.confidence,
      analyzedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error('[TechStack Agent] Error:', error);
    return {
      success: false,
      data: null,
      confidence: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
      analyzedAt: new Date().toISOString(),
    };
  }
}

function formatTechStackForRAG(analysis: TechStackAnalysis): string {
  const parts: string[] = ['# TechStack Analysis (from RFP Document)\n'];

  parts.push('## CMS Requirements');
  parts.push(`Flexibility: ${analysis.cmsRequirements.flexibility}`);
  if (analysis.cmsRequirements.explicit?.length) {
    parts.push(`Required: ${analysis.cmsRequirements.explicit.join(', ')}`);
  }
  if (analysis.cmsRequirements.preferred?.length) {
    parts.push(`Preferred: ${analysis.cmsRequirements.preferred.join(', ')}`);
  }

  parts.push('\n## Technology Requirements');
  const byCategory = analysis.requirements.reduce(
    (acc, r) => {
      acc[r.category] = acc[r.category] || [];
      acc[r.category].push(r);
      return acc;
    },
    {} as Record<string, typeof analysis.requirements>
  );

  for (const [cat, reqs] of Object.entries(byCategory)) {
    parts.push(`\n### ${cat}`);
    reqs.forEach(r => parts.push(`- ${r.name} (${r.requirementType}): ${r.context}`));
  }

  parts.push(`\n## Complexity: ${analysis.complexityScore}/10`);
  analysis.complexityFactors.forEach(f => parts.push(`- ${f}`));

  return parts.join('\n');
}
```

### Step 3: Commit

```bash
git add lib/agents/expert-agents/techstack-*
git commit -m "feat(agents): add techstack expert agent for RFP document analysis"
```

---

## Task 5: Legal Expert Agent (RFP Document-focused)

**Files:**

- Modify: `lib/agents/legal-check-agent.ts`
- Create: `lib/agents/expert-agents/legal-rfp-agent.ts`
- Create: `lib/agents/expert-agents/legal-rfp-schema.ts`

### Step 1: Create Legal RFP Schema

```typescript
// lib/agents/expert-agents/legal-rfp-schema.ts
import { z } from 'zod';

export const LegalRequirementSchema = z.object({
  requirement: z.string(),
  category: z.enum([
    'contract_terms', // Contract duration, termination, liability
    'compliance', // GDPR, SOC2, ISO, industry-specific
    'insurance', // Required insurances
    'certification', // Required certifications
    'nda_ip', // NDA, IP ownership
    'subcontracting', // Subcontractor rules
    'payment_terms', // Payment conditions
    'warranty', // Warranty/SLA requirements
    'data_protection', // Data handling, privacy
    'other',
  ]),
  mandatory: z.boolean(),
  riskLevel: z.enum(['low', 'medium', 'high', 'critical']),
  implication: z.string(), // What does this mean for us?
  confidence: z.number().min(0).max(100),
  rawText: z.string(),
});

export const LegalRfpAnalysisSchema = z.object({
  requirements: z.array(LegalRequirementSchema),

  // Contract specifics
  contractDetails: z.object({
    contractType: z.string().optional(),
    duration: z.string().optional(),
    terminationNotice: z.string().optional(),
    liabilityLimit: z.string().optional(),
    penaltyClauses: z.array(z.string()).optional(),
  }),

  // Required certifications/insurance
  requiredCertifications: z.array(z.string()),
  requiredInsurance: z.array(
    z.object({
      type: z.string(),
      minAmount: z.string().optional(),
    })
  ),

  // Risk assessment
  overallRiskLevel: z.enum(['low', 'medium', 'high', 'critical']),
  riskFactors: z.array(z.string()),
  dealBreakers: z.array(z.string()),

  // Recommendations
  recommendations: z.array(z.string()),
  questionsForLegal: z.array(z.string()),

  confidence: z.number().min(0).max(100),
});

export type LegalRfpAnalysis = z.infer<typeof LegalRfpAnalysisSchema>;
```

### Step 2: Implement Legal RFP Agent

```typescript
// lib/agents/expert-agents/legal-rfp-agent.ts
import { generateStructuredOutput } from '@/lib/ai/config';
import { queryRfpDocument, storeAgentResult } from './base';
import { LegalRfpAnalysisSchema, type LegalRfpAnalysis } from './legal-rfp-schema';
import type { ExpertAgentInput, ExpertAgentOutput } from './types';

const LEGAL_QUERIES = [
  'terms conditions contract agreement liability warranty',
  'GDPR privacy data protection compliance certification ISO SOC2',
  'insurance liability indemnification indemnity',
  'NDA confidentiality intellectual property IP ownership',
  'subcontractor subcontracting partner',
  'payment terms net invoice milestones',
  'penalty SLA service level agreement breach',
];

export async function runLegalRfpAgent(
  input: ExpertAgentInput
): Promise<ExpertAgentOutput<LegalRfpAnalysis>> {
  console.error(`[Legal RFP Agent] Starting analysis for RFP ${input.rfpId}`);

  try {
    const ragResults = await Promise.all(
      LEGAL_QUERIES.map(q => queryRfpDocument(input.rfpId, q, 5))
    );

    const combinedContext = ragResults.map(r => r.context).join('\n\n---\n\n');

    const systemPrompt = `Du bist ein Legal-Experte für IT-Projekte und RFP-Analyse.
Analysiere das RFP-Dokument und identifiziere ALLE rechtlichen Anforderungen und Risiken.

FOKUS:
1. Vertragsklauseln (Laufzeit, Kündigung, Haftung, Pönalen)
2. Compliance (GDPR, Zertifizierungen, Branchenspezifisch)
3. Versicherungen (Berufshaftpflicht, etc.)
4. IP und Vertraulichkeit
5. Subunternehmer-Regelungen

BEWERTUNG:
- Identifiziere "Deal Breakers" (nicht akzeptable Bedingungen)
- Formuliere Fragen für die Rechtsabteilung
- Bewerte das Gesamtrisiko`;

    const result = await generateStructuredOutput({
      model: 'quality',
      schema: LegalRfpAnalysisSchema,
      system: systemPrompt,
      prompt: `Analysiere die rechtlichen Aspekte:\n\n${combinedContext}`,
      temperature: 0.2,
    });

    // Store in RAG
    const content = formatLegalForRAG(result);
    await storeAgentResult(input.rfpId, 'legal_rfp_expert', content, {
      overallRiskLevel: result.overallRiskLevel,
      dealBreakersCount: result.dealBreakers.length,
      requirementsCount: result.requirements.length,
      confidence: result.confidence,
    });

    return {
      success: true,
      data: result,
      confidence: result.confidence,
      analyzedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error('[Legal RFP Agent] Error:', error);
    return {
      success: false,
      data: null,
      confidence: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
      analyzedAt: new Date().toISOString(),
    };
  }
}

function formatLegalForRAG(analysis: LegalRfpAnalysis): string {
  const parts: string[] = ['# Legal RFP Analysis\n'];

  parts.push(`## Risk Level: ${analysis.overallRiskLevel.toUpperCase()}\n`);

  if (analysis.dealBreakers.length > 0) {
    parts.push('## ⚠️ Deal Breakers');
    analysis.dealBreakers.forEach(d => parts.push(`- ${d}`));
    parts.push('');
  }

  parts.push('## Legal Requirements');
  const byCategory = analysis.requirements.reduce(
    (acc, r) => {
      acc[r.category] = acc[r.category] || [];
      acc[r.category].push(r);
      return acc;
    },
    {} as Record<string, typeof analysis.requirements>
  );

  for (const [cat, reqs] of Object.entries(byCategory)) {
    parts.push(`\n### ${cat}`);
    reqs.forEach(r => parts.push(`- [${r.riskLevel}] ${r.requirement}: ${r.implication}`));
  }

  if (analysis.questionsForLegal.length > 0) {
    parts.push('\n## Questions for Legal Team');
    analysis.questionsForLegal.forEach((q, i) => parts.push(`${i + 1}. ${q}`));
  }

  return parts.join('\n');
}
```

### Step 3: Commit

```bash
git add lib/agents/expert-agents/legal-rfp-*
git commit -m "feat(agents): add legal RFP expert agent (document-focused)"
```

---

## Task 6: Summary Expert Agent (for Overview page)

**Files:**

- Create: `lib/agents/expert-agents/summary-agent.ts`
- Create: `lib/agents/expert-agents/summary-schema.ts`

### Step 1: Create Summary Schema

```typescript
// lib/agents/expert-agents/summary-schema.ts
import { z } from 'zod';

export const ManagementSummarySchema = z.object({
  // One-liner
  headline: z.string().max(100),

  // Executive summary (2-3 sentences)
  executiveSummary: z.string().max(500),

  // Key facts
  keyFacts: z.object({
    customer: z.string(),
    industry: z.string().optional(),
    projectType: z.string(),
    estimatedValue: z.string().optional(),
    submissionDeadline: z.string().optional(),
    daysRemaining: z.number().optional(),
  }),

  // Top 3 deliverables
  topDeliverables: z
    .array(
      z.object({
        name: z.string(),
        mandatory: z.boolean(),
      })
    )
    .max(5),

  // Timeline highlights
  timelineHighlights: z
    .array(
      z.object({
        milestone: z.string(),
        date: z.string(),
      })
    )
    .max(5),

  // Quick assessment
  assessment: z.object({
    fitScore: z.number().min(1).max(10), // How well does this fit adesso?
    complexityScore: z.number().min(1).max(10),
    urgencyLevel: z.enum(['critical', 'high', 'medium', 'low']),
    recommendation: z.enum(['pursue', 'consider', 'decline']),
    reasoning: z.string(),
  }),

  // Key risks (max 3)
  topRisks: z.array(z.string()).max(3),

  // Key opportunities (max 3)
  topOpportunities: z.array(z.string()).max(3),

  confidence: z.number().min(0).max(100),
});

export type ManagementSummary = z.infer<typeof ManagementSummarySchema>;
```

### Step 2: Implement Summary Agent (reads from other agents' RAG output)

```typescript
// lib/agents/expert-agents/summary-agent.ts
import { generateStructuredOutput } from '@/lib/ai/config';
import { queryRfpDocument, storeAgentResult } from './base';
import { ManagementSummarySchema, type ManagementSummary } from './summary-schema';
import type { ExpertAgentInput, ExpertAgentOutput } from './types';
import { db } from '@/lib/db';
import { rfpEmbeddings } from '@/lib/db/schema';
import { eq, and, inArray } from 'drizzle-orm';

export async function runSummaryAgent(
  input: ExpertAgentInput
): Promise<ExpertAgentOutput<ManagementSummary>> {
  console.error(`[Summary Agent] Starting analysis for RFP ${input.rfpId}`);

  try {
    // Read outputs from other expert agents
    const agentResults = await db
      .select({ agentName: rfpEmbeddings.agentName, content: rfpEmbeddings.content })
      .from(rfpEmbeddings)
      .where(
        and(
          eq(rfpEmbeddings.rfpId, input.rfpId),
          inArray(rfpEmbeddings.agentName, [
            'timing_expert',
            'deliverables_expert',
            'techstack_expert',
            'legal_rfp_expert',
            'extract', // Original extraction
          ])
        )
      );

    const expertContext = agentResults
      .map(r => `### ${r.agentName}\n${r.content}`)
      .join('\n\n---\n\n');

    // Also get some raw document context for headline
    const rawContext = await queryRfpDocument(
      input.rfpId,
      'executive summary introduction scope objectives',
      5
    );

    const systemPrompt = `Du bist ein Management-Berater, der RFP-Analysen für Führungskräfte zusammenfasst.
Erstelle eine prägnante Management Summary basierend auf den Expert-Analysen.

STIL:
- Kurz und prägnant (C-Level geeignet)
- Fokus auf Entscheidungsrelevantes
- Klare Empfehlung (pursue/consider/decline)

ADESSO-KONTEXT:
- adesso ist ein IT-Beratungsunternehmen
- Fokus auf CMS/Web-Projekte, Digital Transformation
- Drupal, Headless CMS, Enterprise Solutions`;

    const result = await generateStructuredOutput({
      model: 'quality',
      schema: ManagementSummarySchema,
      system: systemPrompt,
      prompt: `Erstelle eine Management Summary:\n\n## Raw Document\n${rawContext.context}\n\n## Expert Analyses\n${expertContext}`,
      temperature: 0.3,
    });

    // Store in RAG
    const content = formatSummaryForRAG(result);
    await storeAgentResult(input.rfpId, 'summary_expert', content, {
      fitScore: result.assessment.fitScore,
      recommendation: result.assessment.recommendation,
      urgencyLevel: result.assessment.urgencyLevel,
      confidence: result.confidence,
    });

    return {
      success: true,
      data: result,
      confidence: result.confidence,
      analyzedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error('[Summary Agent] Error:', error);
    return {
      success: false,
      data: null,
      confidence: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
      analyzedAt: new Date().toISOString(),
    };
  }
}

function formatSummaryForRAG(summary: ManagementSummary): string {
  return `# Management Summary

## ${summary.headline}

${summary.executiveSummary}

## Key Facts
- Customer: ${summary.keyFacts.customer}
- Industry: ${summary.keyFacts.industry || 'N/A'}
- Project Type: ${summary.keyFacts.projectType}
- Value: ${summary.keyFacts.estimatedValue || 'N/A'}
- Deadline: ${summary.keyFacts.submissionDeadline || 'N/A'}

## Assessment
- Fit Score: ${summary.assessment.fitScore}/10
- Complexity: ${summary.assessment.complexityScore}/10
- Urgency: ${summary.assessment.urgencyLevel}
- **Recommendation: ${summary.assessment.recommendation.toUpperCase()}**
- Reasoning: ${summary.assessment.reasoning}

## Top Risks
${summary.topRisks.map(r => `- ${r}`).join('\n')}

## Top Opportunities
${summary.topOpportunities.map(o => `- ${o}`).join('\n')}
`;
}
```

### Step 3: Commit

```bash
git add lib/agents/expert-agents/summary-*
git commit -m "feat(agents): add summary expert agent for management overview"
```

---

## Task 7: Agent Orchestrator for Expert Agents

**Files:**

- Create: `lib/agents/expert-agents/orchestrator.ts`
- Create: `app/api/rfps/[id]/run-expert-agents/route.ts`

### Step 1: Create Expert Agent Orchestrator

```typescript
// lib/agents/expert-agents/orchestrator.ts
import { runTimingAgent } from './timing-agent';
import { runDeliverablesAgent } from './deliverables-agent';
import { runTechStackAgent } from './techstack-agent';
import { runLegalRfpAgent } from './legal-rfp-agent';
import { runSummaryAgent } from './summary-agent';
import type { ExpertAgentInput } from './types';

export interface OrchestratorResult {
  success: boolean;
  results: {
    timing: { success: boolean; confidence: number };
    deliverables: { success: boolean; confidence: number };
    techstack: { success: boolean; confidence: number };
    legal: { success: boolean; confidence: number };
    summary: { success: boolean; confidence: number };
  };
  errors: string[];
  completedAt: string;
}

export async function runExpertAgents(input: ExpertAgentInput): Promise<OrchestratorResult> {
  console.error(`[Expert Orchestrator] Starting all agents for RFP ${input.rfpId}`);

  const errors: string[] = [];

  // Run parallel agents (timing, deliverables, techstack, legal)
  const [timing, deliverables, techstack, legal] = await Promise.allSettled([
    runTimingAgent(input),
    runDeliverablesAgent(input),
    runTechStackAgent(input),
    runLegalRfpAgent(input),
  ]);

  // Collect results
  const timingResult = timing.status === 'fulfilled' ? timing.value : null;
  const deliverablesResult = deliverables.status === 'fulfilled' ? deliverables.value : null;
  const techstackResult = techstack.status === 'fulfilled' ? techstack.value : null;
  const legalResult = legal.status === 'fulfilled' ? legal.value : null;

  if (!timingResult?.success) errors.push(`Timing: ${timingResult?.error || 'failed'}`);
  if (!deliverablesResult?.success)
    errors.push(`Deliverables: ${deliverablesResult?.error || 'failed'}`);
  if (!techstackResult?.success) errors.push(`TechStack: ${techstackResult?.error || 'failed'}`);
  if (!legalResult?.success) errors.push(`Legal: ${legalResult?.error || 'failed'}`);

  // Run summary AFTER others complete (needs their output)
  const summaryResult = await runSummaryAgent(input);
  if (!summaryResult.success) errors.push(`Summary: ${summaryResult.error || 'failed'}`);

  return {
    success: errors.length === 0,
    results: {
      timing: {
        success: timingResult?.success ?? false,
        confidence: timingResult?.confidence ?? 0,
      },
      deliverables: {
        success: deliverablesResult?.success ?? false,
        confidence: deliverablesResult?.confidence ?? 0,
      },
      techstack: {
        success: techstackResult?.success ?? false,
        confidence: techstackResult?.confidence ?? 0,
      },
      legal: { success: legalResult?.success ?? false, confidence: legalResult?.confidence ?? 0 },
      summary: { success: summaryResult.success, confidence: summaryResult.confidence },
    },
    errors,
    completedAt: new Date().toISOString(),
  };
}
```

### Step 2: Create API Route

```typescript
// app/api/rfps/[id]/run-expert-agents/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { runExpertAgents } from '@/lib/agents/expert-agents/orchestrator';
import { getCachedRfp } from '@/lib/rfps/cached-queries';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  // Verify ownership
  const rfp = await getCachedRfp(id);
  if (!rfp || rfp.userId !== session.user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  try {
    const result = await runExpertAgents({ rfpId: id });
    return NextResponse.json(result);
  } catch (error) {
    console.error('[Expert Agents API] Error:', error);
    return NextResponse.json({ error: 'Failed to run expert agents' }, { status: 500 });
  }
}
```

### Step 3: Commit

```bash
git add lib/agents/expert-agents/orchestrator.ts app/api/rfps/*/run-expert-agents/
git commit -m "feat(agents): add expert agent orchestrator and API route"
```

---

## Task 8: Update Overview Page (Management Summary)

**Files:**

- Modify: `app/(dashboard)/rfps/[id]/page.tsx`
- Create: `lib/agents/expert-agents/read-agent-result.ts`

### Step 1: Create helper to read agent results from RAG

```typescript
// lib/agents/expert-agents/read-agent-result.ts
import { db } from '@/lib/db';
import { rfpEmbeddings } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export async function getAgentResult<T>(
  rfpId: string,
  agentName: string
): Promise<{ data: T | null; metadata: Record<string, unknown> | null }> {
  const results = await db
    .select({
      content: rfpEmbeddings.content,
      metadata: rfpEmbeddings.metadata,
    })
    .from(rfpEmbeddings)
    .where(and(eq(rfpEmbeddings.rfpId, rfpId), eq(rfpEmbeddings.agentName, agentName)))
    .orderBy(rfpEmbeddings.createdAt)
    .limit(1);

  if (results.length === 0) return { data: null, metadata: null };

  try {
    const metadata = results[0].metadata ? JSON.parse(results[0].metadata as string) : null;
    // For now return content as-is, specific parsers can be added
    return { data: results[0].content as T, metadata };
  } catch {
    return { data: null, metadata: null };
  }
}
```

### Step 2: Update Overview Page to show Management Summary

See implementation in separate task - this involves updating `page.tsx` with:

- Summary Agent result display
- Quick actions (Run Expert Agents button)
- Timeline highlights
- Top deliverables
- Assessment badge

### Step 3: Commit

```bash
git add lib/agents/expert-agents/read-agent-result.ts app/\(dashboard\)/rfps/\[id\]/page.tsx
git commit -m "feat(ui): update overview page with management summary"
```

---

## Task 9: CMS Decision Matrix Page

**Files:**

- Create: `app/(dashboard)/rfps/[id]/routing/cms-matrix/page.tsx`
- Modify: `app/(dashboard)/rfps/[id]/layout.tsx` (add nav link)

### Step 1: Create CMS Matrix Page

```typescript
// app/(dashboard)/rfps/[id]/routing/cms-matrix/page.tsx
// Display CMS evaluation matrix from quickScan.cmsEvaluation
// Use ShadCN Table with scores, pros/cons for each CMS option
// Reference existing CMSMatchingResult type
```

### Step 2: Add navigation link in layout

### Step 3: Commit

```bash
git add app/\(dashboard\)/rfps/\[id\]/routing/cms-matrix/
git commit -m "feat(ui): add CMS decision matrix page"
```

---

## Task 10: Update Timing Page to use Expert Agent

**Files:**

- Modify: `app/(dashboard)/rfps/[id]/timing/page.tsx`

### Step 1: Refactor to read from timing_expert RAG

- Query `rfpEmbeddings` where `agentName = 'timing_expert'`
- Display milestones in visual timeline
- Show urgency badge
- Add clarification deadlines section

### Step 2: Commit

```bash
git add app/\(dashboard\)/rfps/\[id\]/timing/page.tsx
git commit -m "feat(ui): update timing page with expert agent data"
```

---

## Execution Options

**Plan complete and saved to `docs/plans/2026-01-22-rfp-workflow-expert-agents.md`**

**Two execution options:**

1. **Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

2. **Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

**Which approach?**
