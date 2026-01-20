# System Architecture

This document describes the architecture of Dealhunter, an AI-powered BD decision platform.

## Table of Contents

- [High-Level Architecture](#high-level-architecture)
- [Technology Stack](#technology-stack)
- [System Components](#system-components)
- [Data Flow](#data-flow)
- [AI Agent Architecture](#ai-agent-architecture)
- [Database Schema](#database-schema)
- [Security Architecture](#security-architecture)
- [Deployment Architecture](#deployment-architecture)

---

## High-Level Architecture

```mermaid
graph TB
    subgraph "Client Layer"
        Browser[Browser]
        Mobile[Mobile]
    end

    subgraph "Application Layer (Next.js)"
        UI[UI Components<br/>ShadCN + Tailwind]
        Pages[Pages<br/>App Router]
        API[API Routes]
        ServerActions[Server Actions]
    end

    subgraph "AI Layer"
        ExtractAgent[Extract Agent]
        QuickScanAgent[Quick Scan Agent]
        BITAgent[BIT Evaluation Agent]
        MultiAgent[Multi-Agent System]
    end

    subgraph "Background Jobs"
        Inngest[Inngest]
        DeepAnalysis[Deep Analysis]
        EmailNotif[Email Notifications]
    end

    subgraph "Data Layer"
        DB[(SQLite/PostgreSQL)]
        FileStorage[File Storage]
    end

    subgraph "External Services"
        AIHub[adesso AI Hub<br/>OpenAI-compatible]
        WebSearch[Exa Web Search]
        Slack[Slack API]
    end

    Browser --> UI
    Mobile --> UI
    UI --> Pages
    Pages --> API
    Pages --> ServerActions
    API --> ExtractAgent
    API --> QuickScanAgent
    API --> BITAgent
    ExtractAgent --> MultiAgent
    QuickScanAgent --> MultiAgent
    BITAgent --> MultiAgent
    API --> Inngest
    Inngest --> DeepAnalysis
    Inngest --> EmailNotif
    ServerActions --> DB
    API --> DB
    MultiAgent --> AIHub
    MultiAgent --> WebSearch
    EmailNotif --> Slack
    API --> FileStorage
```

---

## Technology Stack

### Frontend

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Framework** | Next.js 16 (App Router) | React framework with SSR/SSG |
| **UI Library** | ShadCN UI | Component library (Radix + Tailwind) |
| **Styling** | Tailwind CSS v4 | Utility-first CSS framework |
| **AI UI** | Vercel AI SDK Elements | Streaming conversation UI |
| **Charts** | Recharts | Data visualization |
| **Forms** | React Hook Form + Zod | Form handling & validation |
| **State** | Zustand | Client state management |

### Backend

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Runtime** | Node.js 20+ | JavaScript runtime |
| **Framework** | Next.js API Routes | API endpoints |
| **AI SDK** | Vercel AI SDK v5 | LLM orchestration |
| **Database** | Drizzle ORM | Type-safe SQL queries |
| **Auth** | NextAuth.js v5 | Authentication & sessions |
| **Jobs** | Inngest | Background job processing |
| **Validation** | Zod | Schema validation |

### Data & Storage

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Database** | SQLite (dev)<br/>PostgreSQL (prod) | Relational data storage |
| **File Storage** | Vercel Blob (prod)<br/>Local FS (dev) | Document storage |
| **Cache** | In-memory (dev)<br/>Redis (future) | Caching layer |

### AI & External Services

| Service | Provider | Purpose |
|---------|----------|---------|
| **LLM** | adesso AI Hub (OpenAI-compatible) | GPT-4o, GPT-4o-mini |
| **Web Search** | Exa | Semantic web search |
| **Notifications** | Slack API | Team notifications |
| **Email** | Resend (future) | Email notifications |

---

## System Components

### 1. Frontend Layer

```
app/
├── (dashboard)/              # Authenticated routes
│   ├── layout.tsx           # Sidebar layout
│   ├── page.tsx             # Dashboard home
│   ├── bids/                # RFP management
│   │   ├── page.tsx         # RFP list
│   │   ├── new/             # Upload form
│   │   └── [id]/            # RFP detail
│   ├── accounts/            # Account management
│   ├── analytics/           # Analytics dashboard
│   └── admin/               # Admin panel
├── (auth)/                  # Public routes
│   ├── login/
│   └── register/
└── api/                     # API routes
```

**Key Patterns:**
- Server Components by default
- Client Components marked with `'use client'`
- Server Actions for mutations
- Streaming responses for AI

### 2. API Layer

```
app/api/
├── auth/                    # NextAuth.js
├── submit/                  # File upload
├── rfps/[id]/
│   ├── extraction/stream/   # SSE: Extraction
│   ├── quick-scan/stream/   # SSE: Quick Scan
│   ├── evaluate/stream/     # SSE: BIT Evaluation
│   ├── deep-analysis/       # Background job control
│   ├── visualization/       # json-render UI
│   └── bu-matching/         # BU recommendation
├── admin/
│   └── technologies/        # Tech research
├── documents/[id]/download/ # File download
├── inngest/                 # Background job webhook
└── slack/                   # Slack webhook
```

**API Characteristics:**
- RESTful design
- SSE for streaming
- JSON responses
- NextAuth.js authentication
- Zod validation

### 3. AI Agent Layer

```
lib/
├── agents/
│   ├── extraction/          # Extract Agent
│   │   ├── agent.ts        # Main agent logic
│   │   └── tools/          # Extraction tools
│   ├── quick-scan/          # Quick Scan Agent
│   │   ├── agent.ts
│   │   └── tools/          # Tech detection, BU matching
│   └── bit-evaluation/      # BIT Evaluation Agent
│       ├── agent.ts
│       └── agents/         # Sub-agents
│           ├── capability-agent.ts
│           ├── competition-agent.ts
│           ├── deal-quality-agent.ts
│           ├── legal-agent.ts
│           ├── reference-agent.ts
│           └── strategic-fit-agent.ts
```

**Agent Design Pattern:**
- Tool-calling agents (Vercel AI SDK)
- Streaming responses
- Structured outputs (Zod)
- Multi-agent orchestration
- Event-driven updates

### 4. Data Layer

```
lib/db/
├── schema.ts               # Drizzle schema
├── index.ts                # DB connection
└── seed.ts                 # Seed data

Schema Tables:
- users                     # User accounts
- businessUnits            # Business units
- rfps                      # RFP opportunities
- quickScans               # Quick scan results
- evaluations              # BIT evaluations
- technologies             # Tech catalog
- competencies             # Skill catalog
- documents                # Uploaded files
- auditLogs                # Audit trail
```

### 5. Background Jobs

```
lib/jobs/
├── deep-analysis.ts        # Deep analysis workflow
├── email-notifications.ts  # Email sending
└── tech-research.ts        # Tech research

Inngest Functions:
- "deep-analysis"           # Full company analysis
- "send-notification"       # Email/Slack notifications
- "tech-research"           # Technology documentation scraping
```

---

## Data Flow

### RFP Lifecycle Flow

```mermaid
sequenceDiagram
    participant User
    participant UI
    participant API
    participant ExtractAgent
    participant QuickScanAgent
    participant BITAgent
    participant DB
    participant Inngest

    User->>UI: Upload RFP (PDF/Text)
    UI->>API: POST /api/submit
    API->>DB: Create RFP record
    API-->>UI: Return RFP ID

    User->>UI: Start Extraction
    UI->>API: GET /api/rfps/{id}/extraction/stream
    API->>ExtractAgent: Run extraction
    ExtractAgent->>ExtractAgent: Parse document
    ExtractAgent->>ExtractAgent: Extract fields
    ExtractAgent-->>API: Stream events (SSE)
    API-->>UI: SSE: agent-thinking, tool-result
    ExtractAgent->>DB: Save extracted data
    ExtractAgent-->>API: agent-complete
    API-->>UI: SSE: agent-complete

    User->>UI: Start Quick Scan
    UI->>API: GET /api/rfps/{id}/quick-scan/stream
    API->>QuickScanAgent: Run scan
    QuickScanAgent->>QuickScanAgent: Detect tech stack
    QuickScanAgent->>QuickScanAgent: Match BU
    QuickScanAgent-->>API: Stream events
    API-->>UI: SSE: agent-thinking, tool-result
    QuickScanAgent->>DB: Save scan results
    QuickScanAgent-->>API: agent-complete
    API-->>UI: SSE: agent-complete

    User->>UI: Run BIT Evaluation
    UI->>API: GET /api/rfps/{id}/evaluate/stream
    API->>BITAgent: Run evaluation
    BITAgent->>BITAgent: Run 6 sub-agents in parallel
    BITAgent-->>API: Stream events from all agents
    API-->>UI: SSE: agent-thinking, tool-result
    BITAgent->>BITAgent: Aggregate scores
    BITAgent->>DB: Save evaluation
    BITAgent-->>API: agent-complete
    API-->>UI: SSE: agent-complete (BIT/NO BIT)

    User->>UI: Trigger Deep Analysis
    UI->>API: POST /api/rfps/{id}/deep-analysis/trigger
    API->>Inngest: Trigger background job
    Inngest->>Inngest: Run analysis (async)
    Inngest->>DB: Save results
    API-->>UI: Return job ID

    User->>UI: Check Deep Analysis Status
    UI->>API: GET /api/rfps/{id}/deep-analysis/status
    API->>DB: Query job status
    API-->>UI: Return status + progress
```

### AI Agent Flow

```mermaid
graph LR
    subgraph "Agent Execution"
        Input[User Input] --> SystemPrompt[System Prompt]
        SystemPrompt --> LLM[LLM<br/>GPT-4o-mini]
        LLM --> Decision{Tool Call?}
        Decision -->|Yes| Tool[Execute Tool]
        Tool --> LLM
        Decision -->|No| Output[Structured Output]
        Output --> Validation[Zod Validation]
        Validation --> Stream[Stream to UI]
    end

    subgraph "Tools"
        Tool --> T1[Extract Field]
        Tool --> T2[Web Search]
        Tool --> T3[Tech Detection]
        Tool --> T4[BU Matching]
    end

    subgraph "Events"
        Stream --> E1[agent-thinking]
        Stream --> E2[tool-call]
        Stream --> E3[tool-result]
        Stream --> E4[agent-complete]
    end
```

---

## AI Agent Architecture

### Multi-Agent System

```mermaid
graph TB
    subgraph "Coordinator Agent"
        Coord[BIT Evaluation Coordinator]
    end

    subgraph "Sub-Agents (Parallel)"
        Cap[Capability Agent<br/>Tech Fit Analysis]
        Comp[Competition Agent<br/>Market Analysis]
        Deal[Deal Quality Agent<br/>Commercial Viability]
        Legal[Legal Agent<br/>Contract Risks]
        Ref[Reference Agent<br/>Similar Projects]
        Strat[Strategic Fit Agent<br/>Alignment]
    end

    subgraph "Aggregation"
        Agg[Score Aggregation]
        Decision[BIT/NO BIT Decision]
    end

    Coord --> Cap
    Coord --> Comp
    Coord --> Deal
    Coord --> Legal
    Coord --> Ref
    Coord --> Strat

    Cap --> Agg
    Comp --> Agg
    Deal --> Agg
    Legal --> Agg
    Ref --> Agg
    Strat --> Agg

    Agg --> Decision
```

### Agent Capabilities

| Agent | Model | Tools | Output |
|-------|-------|-------|--------|
| **Extract Agent** | GPT-4o-mini | Extract fields, PII removal | Structured JSON |
| **Quick Scan Agent** | GPT-4o-mini | Tech detection, BU matching | Tech stack + BU |
| **Capability Agent** | GPT-4o-mini | Skill matching, gap analysis | Capability score (0-1) |
| **Competition Agent** | GPT-4o-mini | Web search, competitor analysis | Competition score (0-1) |
| **Deal Quality Agent** | GPT-4o-mini | Budget analysis, ROI calculation | Deal quality score (0-1) |
| **Legal Agent** | GPT-4o-mini | Contract analysis, risk detection | Legal score (0-1) |
| **Reference Agent** | GPT-4o-mini | Project similarity search | Reference score (0-1) |
| **Strategic Fit Agent** | GPT-4o-mini | Alignment analysis | Strategic fit score (0-1) |

### Event-Driven Streaming

```typescript
// Agent event stream
type AgentEvent =
  | { type: 'agent-start', data: { agentName: string } }
  | { type: 'agent-thinking', data: { thought: string } }
  | { type: 'tool-call', data: { toolName: string, args: any } }
  | { type: 'tool-result', data: { toolName: string, result: any } }
  | { type: 'agent-message', data: { message: string } }
  | { type: 'agent-complete', data: { result: any } }
  | { type: 'error', data: { message: string } }

// Event emitter pattern
const emitter = createAgentEventStream()
emitter.emit('agent-thinking', { thought: 'Analyzing tech stack...' })
```

---

## Database Schema

```mermaid
erDiagram
    USERS ||--o{ RFPS : creates
    USERS ||--o{ AUDIT_LOGS : performs
    BUSINESS_UNITS ||--o{ USERS : has_members
    BUSINESS_UNITS ||--o{ RFPS : receives
    RFPS ||--o{ DOCUMENTS : contains
    RFPS ||--o| QUICK_SCANS : has
    RFPS ||--o| EVALUATIONS : has
    RFPS ||--o{ AUDIT_LOGS : tracks
    TECHNOLOGIES }o--o{ QUICK_SCANS : detected_in
    COMPETENCIES }o--o{ USERS : has_skills

    USERS {
        string id PK
        string email
        string passwordHash
        string name
        string role
        string businessUnitId FK
        timestamp createdAt
    }

    BUSINESS_UNITS {
        string id PK
        string name
        string leaderId FK
        timestamp createdAt
    }

    RFPS {
        string id PK
        string title
        text description
        string status
        string createdById FK
        string businessUnitId FK
        timestamp createdAt
        timestamp updatedAt
    }

    QUICK_SCANS {
        string id PK
        string rfpId FK
        json technologies
        string businessUnitId FK
        float confidence
        text reasoning
        timestamp createdAt
    }

    EVALUATIONS {
        string id PK
        string rfpId FK
        string recommendation
        float confidence
        json scores
        json risks
        timestamp createdAt
    }

    DOCUMENTS {
        string id PK
        string rfpId FK
        string filename
        string mimeType
        string url
        int size
        timestamp createdAt
    }

    TECHNOLOGIES {
        string id PK
        string name
        string category
        json baselines
        timestamp createdAt
    }

    COMPETENCIES {
        string id PK
        string name
        string category
        timestamp createdAt
    }

    AUDIT_LOGS {
        string id PK
        string rfpId FK
        string userId FK
        string action
        json previousValue
        json newValue
        text reason
        timestamp createdAt
    }
```

---

## Security Architecture

### Authentication Flow

```mermaid
sequenceDiagram
    participant User
    participant Browser
    participant NextAuth
    participant DB

    User->>Browser: Enter email + password
    Browser->>NextAuth: POST /api/auth/signin
    NextAuth->>DB: Query user by email
    DB-->>NextAuth: Return user + passwordHash
    NextAuth->>NextAuth: Verify password (bcrypt)
    NextAuth->>NextAuth: Generate JWT
    NextAuth-->>Browser: Set session cookie (httpOnly)
    Browser-->>User: Redirect to dashboard

    User->>Browser: Access protected page
    Browser->>NextAuth: Request with cookie
    NextAuth->>NextAuth: Verify JWT
    NextAuth-->>Browser: Allow access
```

### Authorization Model

| Role | Permissions |
|------|------------|
| **admin** | Full system access, user management, admin panel |
| **bl** (BU Lead) | View/edit RFPs in own BU, assign teams |
| **bd** (BD Manager) | Create/edit own RFPs, view all RFPs |

### Security Layers

```mermaid
graph TB
    subgraph "Frontend Security"
        HTTPS[HTTPS Only]
        CSP[Content Security Policy]
        XSS[XSS Protection]
    end

    subgraph "API Security"
        Auth[NextAuth.js]
        CSRF[CSRF Protection]
        RateLimit[Rate Limiting<br/>future]
    end

    subgraph "Data Security"
        Encryption[Data Encryption at Rest]
        PII[PII Removal]
        Audit[Audit Trail]
    end

    subgraph "External Security"
        APIKey[API Key Management]
        Webhook[Webhook Verification]
    end

    HTTPS --> Auth
    CSP --> Auth
    XSS --> Auth
    Auth --> Encryption
    CSRF --> Encryption
    RateLimit --> Encryption
    Encryption --> APIKey
    PII --> APIKey
    Audit --> APIKey
    APIKey --> Webhook
```

---

## Deployment Architecture

### Vercel Deployment

```mermaid
graph TB
    subgraph "Vercel Edge Network"
        Edge[Edge Network<br/>CDN]
    end

    subgraph "Vercel Serverless"
        Pages[Pages<br/>Server Components]
        API[API Routes<br/>Serverless Functions]
    end

    subgraph "External Services"
        DB[(PostgreSQL<br/>Vercel Postgres)]
        AIHub[adesso AI Hub]
        Inngest[Inngest<br/>Background Jobs]
        Blob[Vercel Blob<br/>File Storage]
    end

    User[Users] --> Edge
    Edge --> Pages
    Edge --> API
    Pages --> DB
    API --> DB
    API --> AIHub
    API --> Inngest
    API --> Blob
    Inngest --> DB
```

### Environment Configuration

| Environment | Database | File Storage | Cache | Jobs |
|------------|----------|--------------|-------|------|
| **Development** | SQLite | Local FS | In-memory | Inngest Dev |
| **Preview** | PostgreSQL | Vercel Blob | In-memory | Inngest |
| **Production** | PostgreSQL | Vercel Blob | Redis (future) | Inngest |

### Scaling Characteristics

- **Serverless Functions:** Auto-scale based on load
- **Database:** Connection pooling via Drizzle
- **File Storage:** CDN-backed blob storage
- **Background Jobs:** Inngest auto-scales workers

---

## Performance Considerations

### Optimization Strategies

1. **Server Components by Default**
   - Reduce client-side JavaScript
   - Faster initial page load

2. **Streaming Responses**
   - Progressive rendering
   - Better perceived performance

3. **ISR (Incremental Static Regeneration)**
   - Static pages with revalidation
   - Fast response times

4. **Database Indexes**
   - Indexed on common query fields
   - Optimized joins

5. **AI Model Selection**
   - GPT-4o-mini for speed
   - GPT-4o for quality

### Performance Targets

| Metric | Target |
|--------|--------|
| **Upload** | < 30s (extraction complete) |
| **Quick Scan** | < 60s |
| **BIT Evaluation** | 5-15 minutes |
| **Deep Analysis** | 10-30 minutes (background) |
| **Page Load** | < 2s (FCP) |

---

## Monitoring & Observability

### Future Integrations

```mermaid
graph LR
    App[Dealhunter] --> Vercel[Vercel Analytics]
    App --> Sentry[Sentry<br/>Error Tracking]
    App --> Logs[Vercel Logs]
    App --> Inngest[Inngest Dashboard<br/>Job Monitoring]
```

---

## References

- [Next.js Documentation](https://nextjs.org/docs)
- [Vercel AI SDK](https://sdk.vercel.ai)
- [Drizzle ORM](https://orm.drizzle.team)
- [NextAuth.js](https://next-auth.js.org)
- [Inngest](https://inngest.com/docs)
- [ShadCN UI](https://ui.shadcn.com)
