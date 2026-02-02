# Deep Scan v2 — Technische Spezifikation

> **Status:** Draft v2.0 (Post-Review)
> **Pfad:** `/lib/deep-scan-v2/` (Neubau, kein Refactor von v1)
> **AI SDK:** v6 (`"ai": "^6.0.49"`, `@ai-sdk/openai ^3.x`)
> **Abhängigkeit:** Baut auf Quick Scan + BID-Vote + BU-Zuweisung auf
> **Paradigma:** Agent-Native, Chat-basiert, Human-in-the-Loop

---

## 1. Übersicht

Deep Scan v2 ist eine **chat-gesteuerte, agent-native Dokumentengenerierungs-Pipeline**, die nach der Qualifikationsphase (BID-Vote durch BL + Business-Unit-Zuweisung) ausgeführt wird. Sie erzeugt stufenweise Verkaufsdokumente für Website-Relaunch-Projekte.

**Kernprinzip**: Der Deep Scan ist kein Black-Box-Batch-Job, sondern eine **interaktive AI-Konversation**. Der Benutzer startet einen Chat, die AI stellt Rückfragen, und die Pipeline läuft autonom mit der Möglichkeit jederzeit einzugreifen.

### Positionierung im Platform-Workflow

```
PreQualification → Quick Scan → BID-Vote → BU-Zuweisung
                                                │
                                        ★ Deep Scan v2 ★
                                                │
                                    ┌───────────┤
                                    │           │
                              AI-Interview   Pipeline
                              (Chat, ~30s)   (Background)
                                    │           │
                                    └───────────┤
                                                │
                                    ├── Phase 1: Website-Audit
                                    ├── Phase 2: Indikation
                                    ├── Phase 3: Kalkulation (XLSX)
                                    ├── Phase 4: Präsentation (PPTX)
                                    └── Phase 5: Angebot (DOCX)
```

### Dokumenttypen (stufenweise)

| Stufe | Dokument      | Format              | Beschreibung                                             |
| ----- | ------------- | ------------------- | -------------------------------------------------------- |
| 1     | Website-Audit | In-App + Share-Link | Vollständiges technisches Audit der bestehenden Website  |
| 2     | Indikation    | In-App (HTML)       | Erste Einschätzung zu Scope, CMS, Aufwand                |
| 3     | Kalkulation   | XLSX (Excel)        | Phase × Rolle Matrix mit detaillierter Aufwandsschätzung |
| 4     | Präsentation  | PPTX                | Slide-Baukasten mit adesso CI                            |
| 5     | Angebot       | DOCX                | Formales Angebotsschreiben                               |

### Multi-CMS-Varianten

Pro Dokument werden **parallele Varianten nur für CMS der zugewiesenen Business Unit** erstellt. Das BU-CMS-Mapping wird über die DB-Relation `technologies ↔ businessUnits` aufgelöst.

---

## 2. Architektur

### High-Level Systemarchitektur

```
┌──────────────────────────────────────────────────────────────┐
│                       Next.js App                             │
│                                                               │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  Chat UI (React + AI SDK useChat)                      │  │
│  │  ┌──────────────────┐  ┌───────────────────────────┐   │  │
│  │  │ AI-Interview     │  │ Pipeline Progress +       │   │  │
│  │  │ (interaktiv)     │  │ Human-in-the-Loop Chat    │   │  │
│  │  └────────┬─────────┘  └─────────────┬─────────────┘   │  │
│  └───────────┼──────────────────────────┼─────────────────┘  │
│              │                          │                      │
│  ┌───────────▼──────────┐  ┌───────────▼──────────────────┐  │
│  │ Chat API (useChat)   │  │ SSE + Checkpoint API         │  │
│  │ /api/v2/deep-scan/   │  │ /api/v2/deep-scan/:id/       │  │
│  │ chat                 │  │ progress | answer             │  │
│  └───────────┬──────────┘  └───────────┬──────────────────┘  │
│              │                          │                      │
│  ┌───────────▼──────────────────────────▼──────────────────┐  │
│  │                   BullMQ Queue                           │  │
│  │                   'deep-scan-v2'                          │  │
│  └──────────────────────────┬───────────────────────────────┘  │
└─────────────────────────────┼─────────────────────────────────┘
                              │
┌─────────────────────────────▼─────────────────────────────────┐
│                     Worker Process                              │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │           Orchestrator Agent (autonom, pausierbar)       │  │
│  │                                                          │  │
│  │   ┌─────────────────────────────────────────────────┐   │  │
│  │   │ Tools:                                           │   │  │
│  │   │  runAudit | queryCms | queryIndustry | askUser  │   │  │
│  │   │  generateIndication | flagUncertainty | ...      │   │  │
│  │   └──────────────────────┬──────────────────────────┘   │  │
│  │                          │                               │  │
│  │   ┌──────────────────────▼──────────────────────────┐   │  │
│  │   │  Checkpoint System (DB-persistent)              │   │  │
│  │   │  → Pause bei askUser → Resume nach Antwort      │   │  │
│  │   └─────────────────────────────────────────────────┘   │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐      │
│  │ RAG      │  │ Audit    │  │ Agents   │  │ Doc Gen  │      │
│  │ System   │  │ Module   │  │ (Expert) │  │ XLSX/PPTX│      │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘      │
└─────────────────────────────────────────────────────────────────┘
```

### Zwei-Phasen-Architektur (Hybrid)

Die Architektur trennt sauber **interaktive Phase** von **Compute-Phase**:

| Phase                     | Technologie                  | Dauer   | Interaktion                      |
| ------------------------- | ---------------------------- | ------- | -------------------------------- |
| **1. AI-Interview**       | AI SDK `useChat` (Streaming) | ~30s    | Echtzeit-Chat                    |
| **2. Pipeline-Execution** | BullMQ + Checkpoints         | 2-10min | Human-in-the-Loop bei Rückfragen |

**Warum Hybrid?**

- `useChat` ist ideal für schnelle, interaktive Konversation (Interview)
- BullMQ ist robust für lang laufende Background-Jobs (Pipeline)
- Checkpoints ermöglichen Pause/Resume bei Rückfragen ohne WebSocket-Abhängigkeit

### Kernkomponenten

| Komponente              | Verantwortung                                             | Verzeichnis                                      |
| ----------------------- | --------------------------------------------------------- | ------------------------------------------------ |
| **Chat Interface**      | AI-Interview + Pipeline-Progress + Human-in-the-Loop      | `app/(dashboard)/qualifications/[id]/deep-scan/` |
| **Orchestrator Agent**  | Adaptives Steuern, entscheidet Agents + Rückfragen        | `lib/deep-scan-v2/orchestrator.ts`               |
| **Checkpoint System**   | Pause/Resume bei User-Rückfragen, persistiert in DB       | `lib/deep-scan-v2/checkpoints.ts`                |
| **Expert Agents**       | Spezialisierte Analyse-Agents (CMS, Industry, Scope etc.) | `lib/deep-scan-v2/agents/`                       |
| **RAG System**          | Wissensabruf über alle Domänen                            | `lib/deep-scan-v2/rag/`                          |
| **Document Generators** | Erzeugen von DOCX, XLSX, PPTX, HTML                       | `lib/deep-scan-v2/generators/`                   |
| **Audit Module**        | Website-Audit mit Komponentenanalyse                      | `lib/deep-scan-v2/audit/`                        |
| **Kalkulations-Engine** | Phase × Rolle Matrix, Baselines                           | `lib/deep-scan-v2/calculation/`                  |

### Autonomer Orchestrator-Agent

Der Orchestrator ist **kein statischer Pipeline-Runner**, sondern ein AI-Agent, der adaptiv entscheidet und **jederzeit den User fragen kann**:

```typescript
// lib/deep-scan-v2/orchestrator.ts — Konzept
import { generateText } from 'ai';
import { getModel } from '@/lib/ai/providers';

const orchestratorResult = await generateText({
  model: getModel('quality'),
  system: ORCHESTRATOR_SYSTEM_PROMPT,
  prompt: buildOrchestratorPrompt(context),
  tools: {
    // Analysis Tools
    runAudit: auditTool,
    queryCmsKnowledge: ragCmsTool,
    queryIndustryKnowledge: ragIndustryTool,
    queryReferenceKnowledge: ragReferenceTool,

    // Generation Tools
    generateIndication: indicationTool,
    generateCalculation: calculationTool,
    generatePresentation: presentationTool,
    generateProposal: proposalTool,

    // Communication Tools
    reportProgress: progressTool,
    flagUncertainty: uncertaintyTool,

    // ★ Human-in-the-Loop Tool ★
    askUser: askUserTool, // Pausiert Job, wartet auf User-Antwort
  },
  maxSteps: 50,
});
```

Der Orchestrator:

- Führt ein **initiales Interview** über den Chat (via `useChat`)
- Prüft verfügbare Inputs (Quick Scan, BU, CMS-Auswahl, Interview-Antworten)
- Entscheidet adaptiv welche Agents in welcher Reihenfolge laufen
- **Fragt den User bei niedrigem Confidence** (z.B. "Soll A11y-Remediation in den Scope?")
- Ruft RAG-Wissen ab bevor er Dokumente generiert
- Markiert unsichere Bereiche mit Confidence-Flags
- Reportet Progress über SSE an das Frontend

### Human-in-the-Loop: Checkpoint-System

```typescript
// Checkpoint wird bei jeder askUser-Invocation gespeichert
interface OrchestratorCheckpoint {
  runId: string;
  phase: string;
  completedAgents: string[];
  agentResults: Record<string, unknown>;

  // Conversation State
  conversationHistory: Array<{
    role: 'assistant' | 'user';
    content: string;
  }>;
  collectedAnswers: Record<string, string>;

  // Pending Question (null = kein Halt)
  pendingQuestion: {
    question: string;
    context: string;
    options?: string[]; // Optional: Multiple-Choice
    defaultAnswer?: string; // Optional: Vorschlag
  } | null;
}
```

**Flow bei Rückfrage:**

1. Orchestrator ruft `askUser`-Tool auf
2. Worker speichert Checkpoint in DB (Status: `waiting_for_user`)
3. BullMQ-Job wird als `completed` markiert
4. Frontend zeigt Frage im Chat
5. User antwortet
6. Neuer BullMQ-Job wird gequeued mit Checkpoint als Input
7. Orchestrator setzt genau dort fort wo er aufgehört hat

### AI-Interview (Chat-Phase)

```typescript
// app/api/v2/deep-scan/chat/route.ts — Konzept
import { streamText } from 'ai';

export async function POST(req: Request) {
  const { messages, qualificationId } = await req.json();

  const result = streamText({
    model: getModel('quality'),
    system: INTERVIEW_SYSTEM_PROMPT,
    messages,
    tools: {
      startPipeline: {
        description: 'Startet die Deep Scan Pipeline mit den gesammelten Infos',
        parameters: z.object({
          goal: z.string(),
          cmsPreference: z.string().optional(),
          budgetRange: z.string().optional(),
          specialRequirements: z.string().optional(),
          tonality: z.enum(['formal', 'balanced', 'casual']).optional(),
        }),
        execute: async params => {
          // BullMQ Job starten mit Interview-Ergebnissen
          await startDeepScanV2Pipeline({
            qualificationId,
            interviewResults: params,
          });
          return { started: true };
        },
      },
    },
    maxSteps: 10,
  });

  return result.toDataStreamResponse();
}
```

---

## 3. Website-Audit

### Überblick

Das Website-Audit ist **Phase 1** des Deep Scan v2. Es liefert ein vollständiges technisches Audit der bestehenden Kundenwebsite als Grundlage für alle nachfolgenden Agents und Dokumente.

### Audit-Bereiche

| Bereich                | Details                                                        | Output                   |
| ---------------------- | -------------------------------------------------------------- | ------------------------ |
| **Tech Stack**         | CMS, Framework, Libraries, CDN, Fonts                          | Strukturierte Tech-Liste |
| **Performance**        | Core Web Vitals (LCP, FID, CLS, TTFB), Lighthouse Score        | Performance-Report       |
| **Accessibility**      | WCAG-Level, Axe-Violations, Issue-Count, Fix-Aufwand           | A11y-Report              |
| **Architektur**        | Navigation, Seitenbaum, Content-Typen, Informationsarchitektur | Architektur-Map          |
| **Hosting**            | Server, CDN, SSL, DNS, Hosting-Provider                        | Infrastructure-Report    |
| **Integrationen**      | Third-Party-Services, APIs, Analytics, Marketing-Tools         | Integration-Inventory    |
| **Komponentenanalyse** | UI-Patterns, Content-Typen, Formulare, Interaktionen           | Component Library        |

### Detaillierte Komponentenanalyse

Die Komponentenanalyse inventarisiert alle UI-Patterns der bestehenden Website:

```typescript
interface ComponentAnalysis {
  // UI Components
  components: Array<{
    name: string; // z.B. "Hero Banner", "Card Grid", "Accordion"
    category: 'layout' | 'navigation' | 'content' | 'form' | 'interactive' | 'media';
    occurrences: number; // Wie oft auf der Website verwendet
    complexity: 'simple' | 'medium' | 'complex';
    description: string;
    screenshot?: string; // Screenshot-Referenz
    migrationNotes: string; // Hinweise zur Migration
  }>;

  // Content Types
  contentTypes: Array<{
    name: string; // z.B. "Blog Post", "Product Page", "Landing Page"
    count: number;
    fields: string[]; // Erkannte Felder/Struktur
    hasCustomLogic: boolean;
  }>;

  // Forms
  forms: Array<{
    name: string;
    fields: number;
    hasValidation: boolean;
    hasFileUpload: boolean;
    submitsTo: string; // Backend-Endpoint
  }>;

  // Interactive Features
  interactions: Array<{
    name: string; // z.B. "Search", "Filter", "Infinite Scroll"
    type: 'search' | 'filter' | 'sort' | 'pagination' | 'animation' | 'realtime' | 'other';
    complexity: 'simple' | 'medium' | 'complex';
  }>;
}
```

### Darstellung

- **In-App-Ansicht**: Vollständiges Audit als interaktives Dashboard innerhalb der Plattform
- **Public Share-Link**: Nicht-authentifizierter Zugang für Kunden über einmaligen Share-Link (`/audit/share/:token`)
- **Kein separates Download-Dokument**: Audit-Ergebnisse leben ausschließlich in der App und als Share-Link

### Datenfluss

Audit-Ergebnisse fließen in **alle nachfolgenden Agents und Dokumente** ein:

- Component Library → Kalkulation (Bottom-Up pro Komponente)
- Tech Stack → CMS-Agent (Migration-Strategie)
- Performance → Indikation (Optimierungs-Scope)
- Accessibility → Kalkulation (A11y-Remediation-Aufwand)

---

## 4. RAG-System

### Bootstrapping-Strategie: Agent First

> **Entscheidung**: Agents starten **ohne vorhandenes RAG-Content**. System-Prompts liefern Basis-Wissen. RAG wird schrittweise befüllt.

**Warum Agent First?**

- Keine Blockierung durch Content-Erstellung — MVP kann sofort laufen
- Jeder Run erzeugt implizit neues Wissen (Learning Loop)
- System-Prompts mit hartkodiertem Basis-Wissen als Fallback
- RAG-Qualität wächst organisch mit der Nutzung

**Konsequenz**: Die ersten Runs haben niedrigere Qualität. Das ist akzeptabel mit der "Best-Effort + Flags"-Philosophie — der Confidence-Score zeigt an dass wenig RAG-Wissen verfügbar war.

### Domänen

Das RAG-System behandelt **alle Domänen gleichwertig** — kein Domänen-spezifisches Routing:

| Domäne            | Inhalte                                                    | Beispiel-Chunks                                          |
| ----------------- | ---------------------------------------------------------- | -------------------------------------------------------- |
| **CMS-Baselines** | Standard-Aufwände pro CMS, Feature-Support, Best Practices | "Drupal Blog-Migration: 120h Baseline, 15 Content-Typen" |
| **Referenzen**    | Case Studies, vergangene Projekte, Erfahrungswerte         | "Pharma-Portal mit Magnolia: 6 Monate, 8 PT"             |
| **Branchen**      | Branchen-spezifische Anforderungen, Regulatorik, Patterns  | "Finanzbranche: MaRisk-Compliance, BSI-Grundschutz"      |
| **Kalkulation**   | Aufwands-Benchmarks, Rollen-Tagessätze, Phase-Verteilung   | "UX-Phase: 15% Gesamtaufwand, Design System: 40h"        |
| **Methodik**      | Projekt-Methodiken, agile Frameworks, adesso-Standards     | "adesso SAFe Framework: PI Planning alle 10 Wochen"      |
| **Patterns**      | Wiederkehrende Architektur-Patterns, Lösungs-Templates     | "Headless CMS + React Frontend: API-First Architektur"   |

### Ingest-Pipeline

```
Upload (DOCX/PDF/XLSX/MD) → Auto-Parse → Semantisches Chunking → Embedding → pgvector
                                │
                                ├── Abschnitte als Chunks
                                ├── Tabellen als eigene Chunks
                                ├── Metadaten-Extraktion
                                └── Confidence-Scoring
```

**Upload → Auto-Parse**: Beim Hochladen wird automatisch extrahiert und gechunkt — kein manueller Klassifizierungsschritt.

### Chunking-Strategie

**Semantisches Chunking** (nicht token-basiert):

- **Dokument-Abschnitte**: Jeder logische Abschnitt (Heading + Content) wird ein Chunk
- **Tabellen**: Jede Tabelle wird ein eigener Chunk (inkl. Header-Zeile in jedem Chunk)
- **Listen**: Zusammenhängende Listen bleiben als ein Chunk
- **Max Chunk Size**: ~2000 Tokens (für Embedding-Qualität)
- **Overlap**: 100 Tokens am Chunk-Rand für Kontext-Erhalt

### Metadaten-Schema

#### MVP-Schema (5 Kern-Felder)

Für den MVP nutzen wir ein **reduziertes Schema** mit den 5 wichtigsten Feldern:

```typescript
interface KnowledgeChunkMetadataMVP {
  cms: string | null; // z.B. "drupal", "magnolia", "ibexa"
  industry: string | null; // z.B. "pharma", "finance", "automotive"
  documentType: string | null; // z.B. "baseline", "reference", "methodology"
  confidence: number; // 0-100, wie verlässlich der Chunk ist
  businessUnit: string | null; // z.B. "dxs", "dxn", "dxw"
}
```

#### Erweitertes Schema (Post-MVP)

Zusätzliche Felder werden on-demand hinzugefügt wenn sie tatsächlich für Retrieval-Filterung gebraucht werden:

```typescript
interface KnowledgeChunkMetadataExtended extends KnowledgeChunkMetadataMVP {
  useCase: string | null; // z.B. "corporate-website", "intranet", "portal"
  phase: string | null; // z.B. "discovery", "ux", "development", "migration"
  effortRange: string | null; // z.B. "small", "medium", "large", "enterprise"
  customerSize: string | null; // z.B. "smb", "mid-market", "enterprise"
  projectVolume: string | null; // z.B. "< 100k", "100k-500k", "> 500k"
  contractType: string | null; // z.B. "festpreis", "agil", "hybrid"
  region: string | null; // z.B. "dach", "eu", "global"
  competitorContext: string | null; // z.B. "against-accenture", "against-reply"
  legalRequirements: string | null; // z.B. "gdpr", "bdsg", "marisk"
  accessibilityLevel: string | null; // z.B. "wcag-a", "wcag-aa", "bfsg"
  hostingModel: string | null; // z.B. "on-premise", "cloud", "hybrid"
}
```

> **Entscheidung**: DB-Schema enthält alle Spalten von Anfang an (Schema-Migration ist teurer als nullable Spalten). Aber die Ingest-Pipeline füllt im MVP nur die 5 Kern-Felder.

### Embedding-Konfiguration

- **Modell**: `text-embedding-3-large` (OpenAI)
- **Dimensionen**: 3072
- **Speicher**: `pgvector` Extension in PostgreSQL
- **Tabelle**: `knowledgeChunks` (neu) + bestehende `dealEmbeddings`

### Retrieval

```typescript
// Konzept: Semantische Suche mit Metadaten-Filter
async function queryKnowledge(params: {
  query: string;
  filters?: Partial<KnowledgeChunkMetadataMVP>;
  topK?: number; // Default: 10
  minConfidence?: number; // Default: 30
}): Promise<KnowledgeChunk[]>;
```

### Feedback-Loop: Implizites Learning

Jeder Deep Scan Run erzeugt **implizit neues RAG-Wissen**:

- Audit-Ergebnisse → werden als Chunks für zukünftige Referenzen gespeichert
- Kalkulationen → fließen als Benchmarks zurück
- User-Korrekturen → aktualisieren Confidence-Scores

```
Run N → Dokumente generiert → User bearbeitet → Diff → Korrektur-Chunks → RAG
                                                                    ↓
                                                              Run N+1 ist besser
```

---

## 5. Agent-System

### Agent-Übersicht

| Agent                 | Input                                 | Output                               | RAG-Domänen                 |
| --------------------- | ------------------------------------- | ------------------------------------ | --------------------------- |
| **Orchestrator**      | Qualification + Quick Scan + BU + CMS | Steuerung aller Sub-Agents           | Alle                        |
| **Audit-Website**     | Website-URL                           | Tech, Performance, A11y, Architektur | —                           |
| **Audit-Components**  | Website-URL                           | UI-Pattern-Inventur                  | —                           |
| **CMS-Agent**         | Audit-Ergebnisse + BU-CMS-Liste       | CMS-Empfehlung, Migration-Strategie  | CMS-Baselines               |
| **Industry-Agent**    | Branchen-Info aus Quick Scan          | Branchen-spezifische Anforderungen   | Branchen + Patterns         |
| **Reference-Agent**   | Projekt-Kontext                       | Passende Case Studies                | Referenzen                  |
| **Scope-Agent**       | Audit + CMS + Industry                | Feature-Scope-Definition             | Patterns + Methodik         |
| **Methodology-Agent** | Scope + Branchen-Anforderungen        | Projekt-Methodik-Empfehlung          | Methodik                    |
| **Quality-Agent**     | Alle bisherigen Ergebnisse            | Confidence-Check, Lücken-Erkennung   | Alle                        |
| **Calculation-Agent** | Scope + CMS + Components              | Phase × Rolle Matrix                 | Kalkulation + CMS-Baselines |

### Generischer CMS-Agent + RAG

Statt dedizierter Agents pro CMS (Drupal-Agent, Magnolia-Agent etc.) gibt es **einen generischen CMS-Agent**, der sein Wissen aus dem RAG bezieht:

```typescript
// Der CMS-Agent fragt RAG nach CMS-spezifischem Wissen
const cmsKnowledge = await queryKnowledge({
  query: `Migration von ${sourceCms} zu ${targetCms} für ${industry}`,
  filters: {
    cms: targetCms,
    documentType: 'baseline',
    industry: industry,
  },
  topK: 15,
});

// Agent nutzt RAG-Wissen als Kontext
const cmsAnalysis = await generateObject({
  model: getModel('quality'),
  schema: cmsAnalysisSchema,
  system: CMS_AGENT_SYSTEM_PROMPT,
  prompt: buildCmsPrompt({ auditResults, cmsKnowledge, requirements }),
});
```

### Industry-Layer + Use-Case-Layer

Branchen-Wissen ist in zwei Schichten organisiert:

1. **Industry-Layer**: Branchen-übergreifende Anforderungen (z.B. "Pharma: GxP-Compliance")
2. **Use-Case-Layer**: Projekt-Typ-spezifische Patterns (z.B. "Corporate Website: Karriere-Bereich, News, Investor Relations")

Der Industry-Agent kombiniert beide Layer:

```typescript
// Industry + Use-Case kombiniert
const industryKnowledge = await queryKnowledge({
  query: `${industry} ${useCase} Anforderungen`,
  filters: { industry, useCase },
});
```

---

## 6. Kalkulationsmotor

### Phase × Rolle Matrix

Die Kalkulation basiert auf einer **Phase × Rolle Matrix** mit **7 festen Überschriften**:

| Phase                | PM  | UX/UI | Frontend | Backend | DevOps | QA  | Consulting |
| -------------------- | --- | ----- | -------- | ------- | ------ | --- | ---------- |
| Discovery & Analyse  |     |       |          |         |        |     |            |
| UX/UI Design         |     |       |          |         |        |     |            |
| Development          |     |       |          |         |        |     |            |
| Content-Migration    |     |       |          |         |        |     |            |
| Testing & QA         |     |       |          |         |        |     |            |
| Go-Live & Deployment |     |       |          |         |        |     |            |
| Projektmanagement    |     |       |          |         |        |     |            |

### Dynamische Sub-Items

Innerhalb jeder Phase bestimmt der **Orchestrator-Agent dynamisch die Sub-Items** basierend auf:

- Audit-Ergebnisse (welche Komponenten müssen migriert werden)
- CMS-Auswahl (CMS-spezifische Tasks)
- Branchen-Anforderungen (Compliance-Tasks etc.)
- Scope-Definition (welche Features enthalten sind)

```typescript
interface CalculationMatrix {
  phases: Array<{
    name: string; // Eine der 7 festen Überschriften
    subItems: Array<{
      name: string; // Dynamisch vom Orchestrator
      roles: Record<
        Role,
        {
          hours: number;
          confidence: number; // 0-100
          source: 'baseline' | 'rag' | 'estimated';
        }
      >;
    }>;
  }>;

  // Zusammenfassung
  totalHours: number;
  totalByRole: Record<Role, number>;
  totalByPhase: Record<string, number>;
  riskBuffer: number; // Prozent
  confidenceLevel: 'low' | 'medium' | 'high';
}
```

### Komponentenbasierte Kalkulation

Die Audit-Inventur ermöglicht **Bottom-Up-Kalkulation pro Komponente**:

```
Component Library (Audit) → Aufwand pro Komponente → Aggregiert in Phase × Rolle Matrix
```

Jede erkannte Komponente wird mit CMS-Baseline-Daten aus dem RAG abgeglichen:

- "Hero Banner" → 8h Frontend + 4h Backend (Drupal Paragraph)
- "Card Grid" → 12h Frontend + 6h Backend
- "Contact Form" → 16h Frontend + 8h Backend + 4h QA

### CMS-Baselines

Pro CMS existieren **Baseline-Stunden** in der `technologies`-Tabelle:

- `baselineHours`: Standard-Gesamtaufwand
- `baselineEntityCounts`: Standard-Anzahl Content-Typen, Views etc.

Der Kalkulations-Agent vergleicht die tatsächlichen Audit-Ergebnisse gegen die Baseline und berechnet Deltas.

### Export

Die Kalkulation wird zu **vordefinierten Excel-Templates** exportiert:

```typescript
// lib/deep-scan-v2/generators/xlsx-generator.ts
import ExcelJS from 'exceljs';

async function generateCalculationXlsx(
  calculation: CalculationMatrix,
  template: Buffer // Vordefiniertes Excel-Template
): Promise<Buffer>;
```

---

## 7. Dokumentengenerierung

### Indikation

| Aspekt        | Detail                                                                     |
| ------------- | -------------------------------------------------------------------------- |
| **Inhalt**    | Erste Scope-Einschätzung, CMS-Empfehlung, grobe Aufwandsschätzung, Risiken |
| **Format**    | In-App HTML (rendered Markdown/React)                                      |
| **Generator** | AI SDK `generateObject` → React-Komponente                                 |
| **Delivery**  | Sofort in der App sichtbar (SSE-Streaming)                                 |

```typescript
interface IndicationDocument {
  executiveSummary: string;
  currentState: {
    techStack: TechStackSummary;
    contentVolume: ContentVolumeSummary;
    componentCount: number;
  };
  recommendation: {
    targetCms: string;
    reasoning: string;
    alternatives: Array<{ cms: string; reasoning: string }>;
  };
  scopeEstimate: {
    phases: Array<{ name: string; effort: string; confidence: number }>;
    totalRange: { min: number; max: number; unit: 'PT' };
    riskFactors: string[];
  };
  nextSteps: string[];
  flags: Array<{ area: string; message: string; severity: 'info' | 'warning' | 'critical' }>;
}
```

### Kalkulation (XLSX)

| Aspekt        | Detail                                             |
| ------------- | -------------------------------------------------- |
| **Inhalt**    | Phase × Rolle Matrix, Sub-Items, Baselines, Deltas |
| **Format**    | XLSX (Excel)                                       |
| **Generator** | `exceljs` Library                                  |
| **Template**  | Vordefiniertes adesso-Template mit CI/CD           |

### Präsentation (PPTX)

| Aspekt        | Detail                                 |
| ------------- | -------------------------------------- |
| **Inhalt**    | Slide-Baukasten, dynamisch assembliert |
| **Format**    | PPTX (PowerPoint)                      |
| **Generator** | `pptxgenjs` Library                    |
| **Template**  | PPTX Master-Template mit adesso CI     |

**Slide-Baukasten**: Vordefinierte Slide-Typen, die der Orchestrator dynamisch zusammenstellt:

```typescript
type SlideType =
  | 'title' // Titelfolie
  | 'agenda' // Agenda
  | 'executive_summary' // Management Summary
  | 'current_state' // Ist-Zustand
  | 'tech_analysis' // Technische Analyse
  | 'cms_recommendation' // CMS-Empfehlung
  | 'scope_overview' // Scope-Übersicht
  | 'timeline' // Projekt-Timeline
  | 'cost_overview' // Kostenübersicht
  | 'team' // Team-Vorstellung
  | 'references' // Referenzen
  | 'next_steps' // Nächste Schritte
  | 'appendix'; // Anhang

interface SlideConfig {
  type: SlideType;
  data: Record<string, unknown>; // Slide-spezifische Daten
  layout: string; // Layout-Name aus Master-Template
  notes?: string; // Speaker Notes
}
```

**Input-Dateien als RAG-Wissen**: Beispiele guter Präsentationen werden als RAG-Chunks gespeichert, sodass der Agent Stil und Struktur lernen kann.

### Angebot (DOCX)

| Aspekt        | Detail                                      |
| ------------- | ------------------------------------------- |
| **Inhalt**    | Formales Angebotsschreiben mit Rechtstexten |
| **Format**    | DOCX (Word)                                 |
| **Generator** | `docx` Library                              |
| **Template**  | adesso-Angebotsvorlage                      |

### Download + Edit

Alle generierten Dokumente (DOCX, XLSX, PPTX) können:

- In der App **angezeigt** werden (Preview)
- Als Datei **heruntergeladen** werden
- **Offline bearbeitet** und erneut hochgeladen werden

---

## 8. Datenmodell

### Neue Tabellen

#### `knowledgeChunks` — RAG Knowledge Base

```sql
CREATE TABLE knowledge_chunks (
  id TEXT PRIMARY KEY,

  -- Content
  content TEXT NOT NULL,
  content_hash TEXT NOT NULL,         -- SHA-256 für Deduplizierung
  token_count INTEGER NOT NULL,

  -- Source
  source_type TEXT NOT NULL,          -- 'upload', 'reference', 'baseline', 'template'
  source_file_name TEXT,
  source_file_id TEXT,

  -- Embedding
  embedding vector(3072),

  -- Metadaten (vollständiges Schema)
  industry TEXT,
  use_case TEXT,
  cms TEXT,
  phase TEXT,
  document_type TEXT,
  effort_range TEXT,
  confidence INTEGER DEFAULT 50,
  business_unit TEXT,
  customer_size TEXT,
  project_volume TEXT,
  contract_type TEXT,
  region TEXT,
  competitor_context TEXT,
  legal_requirements TEXT,
  accessibility_level TEXT,
  hosting_model TEXT,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### `deepScanV2Runs` — Pipeline-Runs

```sql
CREATE TABLE deep_scan_v2_runs (
  id TEXT PRIMARY KEY,
  qualification_id TEXT NOT NULL REFERENCES qualifications(id),
  user_id TEXT NOT NULL REFERENCES users(id),

  -- Status
  status TEXT NOT NULL DEFAULT 'pending',
    -- 'pending', 'running', 'audit_complete', 'generating',
    -- 'review', 'completed', 'failed'

  -- Snapshot (gesamter Zustand pro Run)
  run_number INTEGER NOT NULL DEFAULT 1,
  snapshot_data TEXT,                  -- JSON: vollständiger Zustand

  -- CMS Context
  target_cms_ids TEXT,                 -- JSON array of technology IDs
  selected_cms_id TEXT REFERENCES technologies(id),

  -- Progress
  current_phase TEXT,
  progress INTEGER DEFAULT 0,
  current_step TEXT,

  -- Agent Tracking
  completed_agents TEXT,               -- JSON array
  failed_agents TEXT,                  -- JSON array
  agent_confidences TEXT,              -- JSON: { agentName: confidence }

  -- Timing
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### `deepScanV2Documents` — Generierte Dokumente

```sql
CREATE TABLE deep_scan_v2_documents (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES deep_scan_v2_runs(id),
  qualification_id TEXT NOT NULL REFERENCES qualifications(id),

  -- Document Type
  document_type TEXT NOT NULL,
    -- 'indication', 'calculation', 'presentation', 'proposal'
  format TEXT NOT NULL,
    -- 'html', 'xlsx', 'pptx', 'docx'

  -- CMS Variant
  cms_variant TEXT,                    -- technology name (null = CMS-agnostic)
  technology_id TEXT REFERENCES technologies(id),

  -- Content
  content TEXT,                        -- HTML content (for indication)
  file_data TEXT,                      -- Base64-encoded file (for XLSX/PPTX/DOCX)
  file_name TEXT,
  file_size INTEGER,

  -- Quality
  confidence INTEGER,                  -- 0-100
  flags TEXT,                          -- JSON: uncertainty flags

  -- Timestamps
  generated_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### `auditResults` — Website-Audit Ergebnisse (v2)

```sql
CREATE TABLE audit_results (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES deep_scan_v2_runs(id),
  qualification_id TEXT NOT NULL REFERENCES qualifications(id),

  -- Website
  website_url TEXT NOT NULL,

  -- Audit Sections (alle als JSON)
  tech_stack TEXT,                     -- JSON: detected technologies
  performance TEXT,                    -- JSON: Core Web Vitals + metrics
  accessibility TEXT,                  -- JSON: WCAG audit results
  architecture TEXT,                   -- JSON: navigation, sitemap, content types
  hosting TEXT,                        -- JSON: infrastructure details
  integrations TEXT,                   -- JSON: third-party services
  component_library TEXT,              -- JSON: ComponentAnalysis
  screenshots TEXT,                    -- JSON: screenshot references

  -- Scores
  performance_score INTEGER,           -- 0-100
  accessibility_score INTEGER,         -- 0-100
  migration_complexity TEXT,           -- 'low', 'medium', 'high', 'very_high'
  complexity_score INTEGER,            -- 0-100

  -- Share Link
  share_token TEXT UNIQUE,             -- Public share token
  share_expires_at TIMESTAMP,

  -- Timing
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### `deepScanV2Conversations` — Chat-Verlauf (Interview + Rückfragen)

```sql
CREATE TABLE deep_scan_v2_conversations (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES deep_scan_v2_runs(id),
  qualification_id TEXT NOT NULL REFERENCES qualifications(id),

  -- Message
  role TEXT NOT NULL,                   -- 'user', 'assistant', 'system'
  content TEXT NOT NULL,
  message_type TEXT NOT NULL,           -- 'interview', 'progress', 'question', 'answer'

  -- Tool Calls (for assistant messages)
  tool_calls TEXT,                      -- JSON: AI SDK tool call data
  tool_results TEXT,                    -- JSON: tool execution results

  -- Ordering
  sequence_number INTEGER NOT NULL,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Schema-Erweiterungen bestehender Tabellen

**`backgroundJobs`** — Neuer Job-Type:

```typescript
jobType: text('job_type', {
  enum: [
    // ... bestehende
    'deep-scan-v2', // NEU
  ],
});
```

**`qualifications`** — Neue Felder:

```typescript
// Deep Scan v2 Reference
deepScanV2RunId: text('deep_scan_v2_run_id')
  .references(() => deepScanV2Runs.id),
deepScanV2Status: text('deep_scan_v2_status', {
  enum: ['pending', 'running', 'completed', 'failed'],
}).default('pending'),
```

---

## 9. API & Workflow

### Endpoints

```
# Chat & Interview
POST   /api/v2/deep-scan/chat           — AI-Interview Chat (AI SDK useChat)

# Pipeline Control
POST   /api/v2/deep-scan/start          — Startet Deep Scan v2 Pipeline (nach Interview)
POST   /api/v2/deep-scan/:runId/answer  — User-Antwort auf Rückfrage (Human-in-Loop)
POST   /api/v2/deep-scan/:runId/retry   — Fehlgeschlagene Agents wiederholen

# Status & Progress
GET    /api/v2/deep-scan/:runId          — Status eines Runs (inkl. Checkpoint)
GET    /api/v2/deep-scan/:runId/progress — SSE Progress Stream
GET    /api/v2/deep-scan/:runId/chat     — Conversation History

# Results
GET    /api/v2/deep-scan/:runId/audit    — Audit-Ergebnisse
GET    /api/v2/deep-scan/:runId/documents — Liste generierter Dokumente
GET    /api/v2/deep-scan/:runId/documents/:docId/download — Dokument-Download

# Public
GET    /api/v2/audit/share/:token        — Public Share-Link (nicht-authentifiziert)

# Knowledge Management
POST   /api/v2/knowledge/upload          — RAG Knowledge Upload
GET    /api/v2/knowledge/search          — RAG Knowledge Search
DELETE /api/v2/knowledge/:chunkId        — RAG Chunk löschen
```

### BullMQ Job-Flow

```typescript
// Neue Queue: 'deep-scan-v2'
export const QUEUE_NAMES = {
  // ... bestehende
  DEEP_SCAN_V2: 'deep-scan-v2',
} as const;

export interface DeepScanV2JobData {
  runId: string;
  qualificationId: string;
  websiteUrl: string;
  userId: string;
  targetCmsIds: string[]; // CMS-IDs der zugewiesenen BU

  // Interview-Ergebnisse
  interviewResults?: {
    goal: string;
    cmsPreference?: string;
    budgetRange?: string;
    specialRequirements?: string;
    tonality?: 'formal' | 'balanced' | 'casual';
  };

  // Checkpoint Resume
  checkpointId?: string; // Bei Resume nach User-Antwort
  userAnswer?: string; // Antwort auf Rückfrage

  forceReset?: boolean;
}

export interface DeepScanV2JobResult {
  success: boolean;
  phase: 'audit' | 'analysis' | 'generation' | 'waiting_for_user' | 'complete';
  completedAgents: string[];
  failedAgents: string[];
  generatedDocuments: string[]; // Document IDs
  checkpointId?: string; // Bei Pause für User-Rückfrage
  error?: string;
}
```

### SSE Progress-Streaming

```typescript
// Progress Events an das Frontend
interface ProgressEvent {
  type:
    | 'phase_start'
    | 'agent_start'
    | 'agent_complete'
    | 'document_ready'
    | 'question' // ★ NEU: Human-in-the-Loop Rückfrage
    | 'answer_received' // ★ NEU: User-Antwort verarbeitet
    | 'complete'
    | 'error';
  phase: string;
  agent?: string;
  progress: number; // 0-100
  message: string;
  confidence?: number;
  documentId?: string; // Wenn Dokument fertig
  question?: {
    // Wenn type === 'question'
    text: string;
    options?: string[];
    context?: string;
  };
  timestamp: string;
}
```

### End-to-End Workflow

```
┌──────────────────────────────────────────────────────────────┐
│  1. User klickt "Deep Scan starten"                          │
│     → Chat-UI öffnet sich                                    │
├──────────────────────────────────────────────────────────────┤
│  2. AI-Interview (useChat, ~30s)                             │
│     AI: "Was ist das Ziel des Relaunches?"                   │
│     User: "Migration + Redesign, Budget 200-300k"            │
│     AI: "CMS-Präferenz?"                                     │
│     User: "Drupal bevorzugt"                                 │
│     AI: "Verstanden. Starte die Analyse..."                  │
│     → Pipeline-Job wird gequeued                             │
├──────────────────────────────────────────────────────────────┤
│  3. Pipeline läuft (BullMQ, 2-10min)                         │
│     → SSE: "Website-Audit gestartet..."                      │
│     → SSE: "Audit abgeschlossen. 47 Komponenten gefunden."   │
│     → SSE: "CMS-Analyse läuft..."                            │
│                                                               │
│  3a. ★ Rückfrage (optional, bei niedrigem Confidence) ★      │
│     → SSE type=question: "Das Audit zeigt 12 A11y-           │
│       Violations. Soll A11y-Remediation in den Scope?"        │
│     → Pipeline PAUSIERT (Checkpoint)                          │
│     User: "Ja, WCAG AA ist Pflicht"                          │
│     → Pipeline RESUMED                                        │
│                                                               │
│  3b. Dokumente werden progressiv verfügbar                    │
│     → SSE: "Indikation fertig" (In-App HTML)                 │
│     → SSE: "Kalkulation fertig" (XLSX Download)              │
│     → SSE: "Präsentation fertig" (PPTX Download)             │
├──────────────────────────────────────────────────────────────┤
│  4. Review-Phase                                              │
│     → User prüft Dokumente                                   │
│     → Kann einzelne Agents wiederholen                       │
│     → Markiert als "fertig"                                  │
└──────────────────────────────────────────────────────────────┘
```

### Stufenweise Delivery

Die Pipeline liefert Ergebnisse **progressiv**:

1. **~30s**: AI-Interview abgeschlossen, Pipeline startet
2. **~2min**: Audit abgeschlossen, Komponentenliste verfügbar
3. **~3min**: Indikation generiert (erste Dokument-Ansicht)
4. **~5min**: Kalkulation fertig (XLSX downloadbar)
5. **~8min**: Präsentation fertig (PPTX downloadbar)
6. **~10min**: Angebot fertig (DOCX downloadbar)

Jedes Dokument wird **sofort verfügbar**, sobald es generiert ist — der Benutzer muss nicht auf die gesamte Pipeline warten.

> **Hinweis**: Bei Human-in-the-Loop-Rückfragen pausiert die Pipeline. Die Gesamtdauer hängt von der User-Antwortzeit ab.

---

## 10. MVP-Scope

### Phase 1 — MVP: Chat + Audit + Indikation

**Ziel**: End-to-End Erlebnis vom AI-Interview über Website-Audit bis zur ersten Indikation.

**Enthält**:

**Chat & Interaktion:**

- [ ] Chat-UI-Komponente (React + AI SDK `useChat`)
- [ ] AI-Interview (3-5 adaptive Fragen vor Pipeline-Start)
- [ ] SSE Progress-Streaming mit Chat-Integration
- [ ] Human-in-the-Loop bei niedrigem Confidence (Checkpoint-System)

**RAG Foundation:**

- [ ] RAG Knowledge Base (`knowledgeChunks`-Tabelle)
- [ ] Ingest-Pipeline (Upload → Parse → Chunk → Embed)
- [ ] Retrieval-Service (Semantische Suche + Metadaten-Filter mit 5 MVP-Feldern)
- [ ] Agent-First-Fallback (System-Prompts als Basis-Wissen)

**Audit:**

- [ ] Website-Audit (Tech Stack, Performance, Accessibility, Komponentenanalyse)
- [ ] Audit In-App-Ansicht
- [ ] Public Share-Link (`/audit/share/:token`)

**Agents:**

- [ ] Orchestrator-Agent (autonom, tool-basiert, `askUser`-Tool)
- [ ] CMS-Agent (generisch + RAG)
- [ ] Industry-Agent (RAG-gestützt)

**Output:**

- [ ] Indikation-Dokument (In-App HTML)

**Infrastructure:**

- [ ] BullMQ Queue `deep-scan-v2` mit Checkpoint-Support
- [ ] Datenmodell (`deepScanV2Runs`, `deepScanV2Documents`, `auditResults`, `knowledgeChunks`, `deepScanV2Conversations`)

**Nicht enthalten in Phase 1**:

- XLSX-Export (Kalkulation)
- PPTX-Export (Präsentation)
- DOCX-Export (Angebot)
- Review-Phase mit Re-Run
- Multi-CMS-Varianten
- Erweitertes Metadaten-Schema (nur 5 Kern-Felder)
- RAG Admin-UI (nur API-basierter Upload)

### Phase 2 — Kalkulation

- [ ] Kalkulations-Engine (Phase × Rolle Matrix)
- [ ] Bottom-Up-Kalkulation aus Komponentenanalyse
- [ ] CMS-Baselines aus RAG
- [ ] XLSX-Generator (`exceljs`)
- [ ] Excel-Template-Integration

### Phase 3 — Präsentation + Angebot

- [ ] Slide-Baukasten (PPTX)
- [ ] PPTX-Generator (`pptxgenjs`)
- [ ] Master-Template mit adesso CI
- [ ] DOCX-Angebotsvorlage
- [ ] DOCX-Generator (`docx`)

### Phase 4 — Polish & Scale

- [ ] Multi-CMS-Varianten (parallele Dokumente pro BU-CMS)
- [ ] Review-Phase mit selektivem Agent-Re-Run
- [ ] Snapshot-basierte Versionierung
- [ ] Download + Edit Workflow (Round-Trip)
- [ ] Confidence-Dashboard (Übersicht aller Flags)
- [ ] RAG Admin-UI (Knowledge-Management für Admins)
- [ ] RAG Feedback-Loop (User-Korrekturen → bessere Runs)
- [ ] Erweitertes Metadaten-Schema (alle 16 Felder)
- [ ] Analytics (Agent-Execution-Times, Confidence-Trends, RAG-Hit-Rates)

---

## 11. Berechtigungen, Error Recovery & Betrieb

### Berechtigungskonzept

| Aktion                     | BD (Business Developer) | BL (Business Line Lead) | Admin |
| -------------------------- | :---------------------: | :---------------------: | :---: |
| Deep Scan starten          |            -            |      nach BID-Vote      | immer |
| Chat/Interview führen      |            -            |           ja            |  ja   |
| Rückfragen beantworten     |            -            |           ja            |  ja   |
| Audit ansehen              |     ja (read-only)      |           ja            |  ja   |
| Share-Link erstellen       |            -            |           ja            |  ja   |
| Dokumente downloaden       |           ja            |           ja            |  ja   |
| Agents wiederholen (Retry) |            -            |           ja            |  ja   |
| RAG Knowledge Upload       |            -            |            -            |  ja   |

> **Entscheidung**: Deep Scan wird **nur vom BL nach BID-Vote** gestartet. Der BD sieht die Ergebnisse read-only.

### Error Recovery UX

| Fehlerszenario                     | User-Erlebnis                                                                       | Technische Behandlung                                |
| ---------------------------------- | ----------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Einzelner Agent fehlgeschlagen     | Warnung im Chat: "Hosting-Analyse konnte nicht abgeschlossen werden" + Retry-Button | Agent-Result = null, Confidence = 0, Flag gesetzt    |
| Audit teilweise fehlgeschlagen     | Teilergebnis angezeigt + fehlende Bereiche markiert                                 | Partial result, betroffene Sections leer             |
| Gesamter Run fehlgeschlagen        | Fehlermeldung + "Erneut starten"-Button                                             | Status = 'failed', Checkpoint für Resume             |
| User antwortet nicht auf Rückfrage | Pipeline wartet 24h, dann Auto-Continue mit Default                                 | Checkpoint timeout → Auto-Resume mit `defaultAnswer` |
| RAG leer (kein Wissen)             | Ergebnis mit niedrigem Confidence + Hinweis "Basiert auf allgemeinem Wissen"        | Agent-First-Fallback, Confidence < 50                |

### Share-Link Lifecycle

- **Erstellung**: BL oder Admin klickt "Share-Link erstellen"
- **Gültigkeit**: 30 Tage (konfigurierbar)
- **Zugang**: Nicht-authentifiziert, read-only Audit-Ansicht
- **Revoke**: BL oder Admin kann Link jederzeit deaktivieren
- **Tracking**: Zugriffe werden gezählt (anonymisiert)

### Template-Management

Templates (XLSX, PPTX, DOCX) werden im **File-System** gespeichert:

```
lib/deep-scan-v2/templates/
├── calculation-template.xlsx    # adesso Kalkulations-Template
├── presentation-master.pptx     # adesso CI Präsentations-Master
└── proposal-template.docx       # adesso Angebotsvorlage
```

> **Entscheidung**: Templates sind Teil des Repositories (nicht in der DB). Änderungen an Templates erfordern einen Deploy. Für den MVP ist das ausreichend — ein Template-Admin-UI kommt in Phase 4.

### Ausblick: Skills-Architektur

> **Langfristiges Ziel**: Expert Agents werden als **wiederverwendbare Skills** definiert (vgl. [skills.sh](https://skills.sh/)), die auch außerhalb des Deep Scan nutzbar sind.

| Agent → Skill                        | Wiederverwendung                             |
| ------------------------------------ | -------------------------------------------- |
| CMS-Agent → `cms-analysis`           | Quick Scan, Deep Scan, Pitchdeck             |
| Industry-Agent → `industry-context`  | Quick Scan, Deep Scan, Angebotsschreiben     |
| Audit-Components → `component-audit` | Deep Scan, Website-Redesign-Projekte         |
| Calculation → `effort-estimation`    | Deep Scan, Pitchdeck, Standalone-Kalkulation |

**MVP**: Direkte Agent-Aufrufe in `/lib/deep-scan-v2/agents/`. Skills-Abstraktion erst nach Phase 4, wenn die Agent-Interfaces stabil sind.

**Design-Prinzip**: Agents werden von Anfang an so gebaut, dass sie **eigenständig aufrufbar** sind (klare Inputs/Outputs, keine Deep-Scan-spezifischen Abhängigkeiten im Kern). Das erleichtert die spätere Extraktion als Skills.

### Migrations-Pfad von v1

- Deep Scan v1 (`lib/agents/deep-scan-orchestrator.ts`) bleibt **unverändert**
- Bestehende v1 Qualifications behalten ihren v1 Deep Scan
- Neue Qualifications können zwischen v1 und v2 wählen (Feature Flag)
- Langfristig (nach Phase 4): v1 wird deprecated, alle neuen Scans laufen über v2

---

## 12. Technische Entscheidungen

### Libraries

| Library          | Version   | Zweck                                                     |
| ---------------- | --------- | --------------------------------------------------------- |
| `ai`             | `^6.0.49` | AI SDK v6: `generateText`, `generateObject`, tool calling |
| `@ai-sdk/openai` | `^3.0.12` | OpenAI-kompatibler Provider (AI Hub + Direct OpenAI)      |
| `exceljs`        | tbd       | XLSX-Generation für Kalkulationen                         |
| `pptxgenjs`      | tbd       | PPTX-Generation für Präsentationen                        |
| `docx`           | tbd       | DOCX-Generation für Angebote                              |
| `bullmq`         | `^5.67.1` | Background Job Queue (bestehend)                          |
| `drizzle-orm`    | `^0.45.1` | Database ORM (bestehend)                                  |
| `cheerio`        | `^1.1.2`  | HTML-Parsing für Website-Audit (bestehend)                |

### AI SDK v6 Patterns

Deep Scan v2 nutzt ausschließlich **AI SDK v6** Patterns:

```typescript
// ✅ generateObject für strukturierte Outputs
import { generateObject } from 'ai';
import { z } from 'zod';

const { object } = await generateObject({
  model: getModel('quality'),
  schema: z.object({ ... }),
  system: '...',
  prompt: '...',
});

// ✅ generateText mit Tools für den Orchestrator
import { generateText } from 'ai';

const { text, toolCalls } = await generateText({
  model: getModel('quality'),
  system: '...',
  prompt: '...',
  tools: { ... },
  maxSteps: 30,
});
```

### Model-Slots

| Slot          | Verwendung in Deep Scan v2                             |
| ------------- | ------------------------------------------------------ |
| `fast`        | Quick-Checks, Confidence-Scoring, Metadaten-Extraktion |
| `default`     | Standard-Agents (Industry, Reference, Scope)           |
| `quality`     | Orchestrator, CMS-Agent, Kalkulations-Agent            |
| `premium`     | Finale Dokumentengenerierung (Angebot, Exec Summary)   |
| `synthesizer` | Zusammenfassungen, Slide-Content                       |

### Tradeoffs

| Entscheidung            | Gewählt                   | Alternative                     | Begründung                                                                           |
| ----------------------- | ------------------------- | ------------------------------- | ------------------------------------------------------------------------------------ |
| Neubau statt Refactor   | `/lib/deep-scan-v2/`      | Bestehenden Code erweitern      | v1-Architektur ist statisch (Promise.allSettled), v2 braucht adaptiven Orchestrator  |
| Generischer CMS-Agent   | Ein Agent + RAG           | Dedizierter Agent pro CMS       | Skaliert besser bei neuen CMS, Wissen im RAG statt Code                              |
| Autonomer Orchestrator  | AI-Agent mit Tools        | Pipeline-Runner (Step 1-2-3)    | Adaptives Verhalten, kann auf Audit-Ergebnisse reagieren                             |
| Chat-basiertes Steering | AI-Interview im Chat      | Wizard/Formular                 | Agent-Native: AI entscheidet welche Fragen nötig sind, nicht ein statisches Formular |
| Human-in-the-Loop       | Jederzeit via Checkpoints | Nur am Anfang                   | Orchestrator kann bei unsicheren Entscheidungen den User einbeziehen                 |
| Hybrid-Architektur      | useChat + BullMQ          | Nur useChat / Nur BullMQ        | useChat für Interaktion (~30s), BullMQ für Compute (2-10min)                         |
| Agent First RAG         | Ohne Content starten      | Content First                   | Pragmatisch für MVP, Qualität wächst organisch mit Nutzung                           |
| MVP Metadaten           | 5 Kern-Felder             | Alle 16 Felder                  | YAGNI — erweitern wenn gebraucht, DB-Schema hat alle Spalten nullable                |
| pgvector                | In-Database               | Pinecone, Weaviate              | Keine zusätzliche Infrastruktur, bereits für dealEmbeddings verwendet                |
| BullMQ                  | Redis-Queue               | Inngest, Temporal               | Bereits im Projekt, bewährt für Deep Scan v1                                         |
| Stufenweise Delivery    | SSE + progressiv          | Batch (alles oder nichts)       | Bessere UX, Benutzer sieht sofort erste Ergebnisse                                   |
| Best-Effort + Flags     | Confidence-Scores         | Strenge Validierung (Fail fast) | Lieber ein Ergebnis mit Markierungen als kein Ergebnis                               |

### Verzeichnisstruktur

```
lib/deep-scan-v2/
├── orchestrator.ts              # Autonomer Orchestrator-Agent
├── checkpoints.ts               # Checkpoint Save/Restore für Human-in-Loop
├── interview.ts                 # AI-Interview Logic (useChat Backend)
├── types.ts                     # Shared Types & Interfaces
├── constants.ts                 # Konfiguration, Prompts
├── tools/
│   ├── ask-user.ts              # ★ Human-in-the-Loop Tool (pausiert Job)
│   ├── audit-tool.ts            # Website-Audit Tool
│   ├── rag-query-tool.ts        # RAG Retrieval Tool
│   ├── progress-tool.ts         # Progress-Reporting Tool
│   ├── uncertainty-tool.ts      # Confidence-Flag Tool
│   └── generation-tools.ts      # Document Generation Tools
├── agents/
│   ├── audit-website.ts         # Website Tech/Performance/A11y Audit
│   ├── audit-components.ts      # Komponentenanalyse
│   ├── cms-agent.ts             # Generischer CMS-Agent (RAG-basiert)
│   ├── industry-agent.ts        # Industry + Use-Case Agent
│   ├── reference-agent.ts       # Reference/Case Study Agent
│   ├── scope-agent.ts           # Scope-Definition Agent
│   ├── methodology-agent.ts     # Methodik-Agent
│   ├── quality-agent.ts         # Quality/Confidence Check
│   └── calculation-agent.ts     # Kalkulations-Agent
├── rag/
│   ├── knowledge-service.ts     # CRUD für Knowledge Chunks
│   ├── ingest-pipeline.ts       # Upload → Parse → Chunk → Embed
│   ├── retrieval.ts             # Semantische Suche + Filter
│   └── chunking.ts              # Semantisches Chunking
├── generators/
│   ├── indication-generator.ts  # HTML Indikation
│   ├── xlsx-generator.ts        # Excel Kalkulation
│   ├── pptx-generator.ts        # PowerPoint Präsentation
│   └── docx-generator.ts        # Word Angebot
├── calculation/
│   ├── matrix.ts                # Phase × Rolle Matrix
│   ├── baseline-engine.ts       # CMS-Baseline-Vergleich
│   └── component-calculator.ts  # Bottom-Up pro Komponente
├── audit/
│   ├── tech-detector.ts         # Tech Stack Erkennung
│   ├── performance-auditor.ts   # Core Web Vitals
│   ├── a11y-auditor.ts          # Accessibility Audit
│   ├── component-analyzer.ts    # UI Pattern Inventur
│   └── share-link.ts            # Public Share-Link Logik
└── templates/
    ├── calculation-template.xlsx
    ├── presentation-master.pptx
    └── proposal-template.docx
```
