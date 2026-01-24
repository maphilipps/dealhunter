# Dealhunter

AI-gestützte BD-Entscheidungsplattform für adesso SE. Workflow-driven mit AI Agents und modernem UI.

## Skills (PFLICHT!)

**KRITISCH: Skills MÜSSEN bei passenden Triggers verwendet werden - keine Ausnahmen!**

| Trigger                                 | Skill                    | Beschreibung                        |
| --------------------------------------- | ------------------------ | ----------------------------------- |
| React/Next.js Code schreiben/reviewen   | `/react-best-practices`  | Performance-Optimierung (45 Regeln) |
| UI reviewen, Accessibility prüfen       | `/web-design-guidelines` | Web Interface Guidelines Compliance |
| Browser-Tests, Screenshots, Formulare   | `/agent-browser`         | Playwright-basierte Automation      |
| Website für Drupal-Relaunch analysieren | `/website-audit`         | Audit mit Drupal-Mapping            |
| PRD für neues Feature schreiben         | `/write-a-prd`           | Strukturiertes PRD-Template         |
| RFC für Refactoring erstellen           | `/create-refactor-rfc`   | RFC mit Modul-Analyse               |

**Skill-Nutzung ist NICHT optional:**

- Bei 1% Wahrscheinlichkeit dass ein Skill passt → Skill aufrufen
- Skill via `Skill` Tool aufrufen, NICHT mit Read Tool lesen
- Mehrere Skills können kombiniert werden (z.B. `/react-best-practices` + `/web-design-guidelines`)

## Stack

- **Framework:** Next.js 16 (App Router)
- **UI System:** ShadCN UI (Sidebar, Charts, Tables, Forms)
- **AI Elements:** Vercel AI SDK Elements (Conversation, Message, Reasoning)
- **AI-Generated UI:** json-render (guardrailed UI generation)
- **AI Agents:** Vercel AI SDK v5 (streamText, generateObject, tools)
- **Database:** Drizzle ORM (SQLite)
- **Styling:** Tailwind CSS v4
- **Durable Execution:** Workflow DevKit (optional)

## Commands

```bash
npm install              # Dependencies
d3k                      # Dev server (Debug, Dev, Devtools) - USE THIS for development!
npm run build            # Production build
npm run start            # Production server
npm run db:push          # Push schema changes to DB
npm run db:studio        # Open Drizzle Studio
```

**WICHTIG:** Verwende immer `d3k` für den Dev-Server, NICHT `npm run dev`!

## Drizzle ORM Migrations

### Schema-Änderungen

- `npm run db:push` - Interactive mode, fragt bei Data-Loss
- `npx drizzle-kit push --force` - Überspringt Bestätigungen (für CI/Scripts)
- Nach Schema-Änderungen: `npm run typecheck` + Scripts in `/scripts/` prüfen

### Deal Embeddings (RAG Storage)

- `dealEmbeddings` = Unified Tabelle für alle RAG-Embeddings
- `rfpId` Filter = Dokument-Phase (Extract, Quick Scan, Expert Agents)
- `leadId` Filter = Qualifizierte Opportunity (Deep Scan, Audit, Section Data)
- `embedding` ist nullable (für Screenshots) → `.filter(chunk => chunk.embedding !== null)` vor `JSON.parse()`

## Code Quality Tools

### Prettier & ESLint

Dieses Projekt nutzt **Prettier** für automatisches Code-Formatting und **ESLint** für Code-Qualität und Best Practices.

**Automatisch (empfohlen):**

- VS Code: Format-on-Save aktiviert (siehe `.vscode/settings.json`)
- Pre-commit Hooks: Automatisches Format + Lint auf staged files

**Manuell:**

```bash
npm run format          # Gesamte Codebase formatieren
npm run format:check    # Formatting prüfen (CI/CD)
npm run lint            # Linting-Fehler anzeigen
npm run lint:fix        # Linting-Fehler auto-fixen
npm run typecheck       # TypeScript type checking
```

**Konfiguration:**

- `.prettierrc` - Prettier Config (2 spaces, single quotes, semicolons)
- `eslint.config.mjs` - ESLint Config (Next.js + TypeScript rules)
- `.husky/pre-commit` - Git Pre-commit Hook (via husky)
- `package.json` → `lint-staged` - Staged files Linting

**Pre-commit Hook Verhalten:**

- Automatisches Format + Lint auf alle staged `.ts`/`.tsx` Dateien
- Automatisches Format auf `.json`, `.md`, `.yml` Dateien
- Auto-fixes werden automatisch committed
- Hook überspringen: `git commit --no-verify` (nur in Notfällen!)

**Integration mit MCP Tools:**

- `d3k` zeigt ESLint-Fehler im Browser an (Dev Server)
- `fix_my_app(focusArea: 'build')` analysiert ESLint + TypeScript Fehler
- `agent_browser_action` für Browser-basierte Tests nach Lint-Fixes

## Large Codebase Analysis mit Gemini CLI

Für die Analyse großer Codebases oder mehrerer Dateien, die Context Limits überschreiten könnten, verwende Gemini CLI mit seinem massiven Context Window.

**Verwende `gemini -p` wenn:**

- Gesamte Codebases oder große Verzeichnisse analysiert werden
- Mehrere große Dateien verglichen werden
- Projekt-weite Patterns oder Architektur verstanden werden müssen
- Mit Dateien gearbeitet wird, die insgesamt mehr als 100KB sind
- Spezifische Features, Patterns oder Security-Maßnahmen codebase-weit verifiziert werden

**Wichtige Hinweise:**

- Pfade in @ Syntax sind relativ zum aktuellen Working Directory beim Aufruf von gemini
- Kein --yolo Flag für read-only Analysen nötig
- Sei spezifisch, wonach du suchst, um genaue Ergebnisse zu erhalten

**Beispiel:**

```bash
# Analysiere alle Server Actions für fehlende Zod Validation
gemini -p "Check all files in @lib for Server Actions that are missing Zod validation. List files with issues." @lib/**/*.ts

# Architektur-Review über gesamtes Projekt
gemini -p "Analyze the overall architecture and identify SOLID violations" @app @lib @components
```

## Verfügbare MCP Tools

### ShadCN MCP (`mcp__plugin_fullstack-ai_shadcn__*`)

Für UI-Komponenten Installation und Examples:

```typescript
// 1. Komponente suchen
search_items_in_registries(registries: ['@shadcn'], query: 'sidebar')

// 2. Details abrufen
view_items_in_registries(items: ['@shadcn/sidebar'])

// 3. Examples holen
get_item_examples_from_registries(registries: ['@shadcn'], query: 'sidebar-demo')

// 4. Install Command
get_add_command_for_items(items: ['@shadcn/sidebar'])
```

### Chrome DevTools MCP (`mcp__chrome-devtools__*`)

Für Visual Testing und Debugging:

```typescript
// Screenshots für Visual Verification
take_screenshot(filePath: 'screenshots/dashboard.png')

// Console Logs prüfen
list_console_messages(types: ['error', 'warn'])

// Network Requests inspizieren
list_network_requests(resourceTypes: ['fetch', 'xhr'])
```

### Next.js DevTools MCP (`mcp__plugin_fullstack-ai_next-devtools__*`)

Für Dev Server Diagnostics:

```typescript
// Server Errors abrufen
nextjs_index(port: '3000')
nextjs_call(port: '3000', toolName: 'get_errors')

// Routes inspizieren
nextjs_call(port: '3000', toolName: 'get_routes')
```

## JSON Render (AI-Generated UI)

Für Agent Output Visualisierung nutzt das Projekt `json-render`:

- **Registry:** `components/json-render/quick-scan-registry.tsx`
- **Guardrails:** AI kann nur definierte Komponenten nutzen
- **Streaming:** Progressive Rendering während AI generiert

## Workflow-Driven Architecture

```
User Upload (PDF/Email/Text)
     ↓
EXTRACT Agent ← AI SDK streamText + tools
     ↓           (PII cleaning, field extraction)
Preview & Edit ← User confirms/edits
     ↓
QUICK SCAN Agent ← AI SDK generateObject
     ↓              (Tech stack, BL recommendation)
BID/NO-BID Evaluation
     ↓
├─ TECH Agent ← Multi-agent parallel execution
├─ COMMERCIAL Agent
├─ RISK Agent
├─ LEGAL Agent
└─ TEAM Agent
     ↓
Decision Tree ← AI SDK generateObject (structured output)
     ↓
Deep Analysis (if needed) ← Background job
     ↓
Team Assignment + Notification
```

## UI Component Guidelines

### ShadCN Components (bevorzugt verwenden)

| Use Case      | Component                                          |
| ------------- | -------------------------------------------------- |
| **Layout**    | `sidebar`, `navigation-menu`, `breadcrumb`         |
| **Data Viz**  | `chart` (Pie, Bar, Line, Radar, Radial)            |
| **Tables**    | `table`, `data-table-demo` (mit Sorting/Filtering) |
| **Forms**     | `form`, `select`, `slider`, `checkbox`, `switch`   |
| **Feedback**  | `alert`, `progress`, `skeleton`, `spinner`         |
| **Dialogs**   | `dialog`, `alert-dialog`, `sheet`                  |
| **Expansion** | `accordion`, `collapsible`, `tabs`                 |
| **Status**    | `badge`, `avatar`, `tooltip`                       |

### AI SDK Elements (für Agent UI)

| Component          | Use For                              |
| ------------------ | ------------------------------------ |
| `<Conversation>`   | Agent Activity Stream (live updates) |
| `<Message>`        | Individual Agent Outputs             |
| `<MessageActions>` | Copy, Expand, Retry buttons          |
| `<Reasoning>`      | Chain-of-Thought display             |
| `<Sources>`        | Referenced data and citations        |
| `<PromptInput>`    | User input fields (if needed)        |
| `<Loader>`         | Processing states with animation     |

### Chart Usage (Recharts-basiert)

| Data Type           | ShadCN Chart Block     |
| ------------------- | ---------------------- |
| Bit/No Bit Rate     | `chart-pie-donut-text` |
| Pipeline Funnel     | `chart-bar-horizontal` |
| Opportunities by BL | `chart-bar-stacked`    |
| Time to Decision    | `chart-line-default`   |
| Risk Assessment     | `chart-radar-default`  |
| Confidence Score    | `chart-radial-label`   |
| PT Breakdown        | `chart-bar-stacked`    |

## Project Structure

```
app/
├── (dashboard)/              # Protected routes with Sidebar
│   ├── layout.tsx           # Sidebar layout
│   ├── page.tsx             # Dashboard home
│   ├── leads/               # Qualifizierte Opportunities
│   │   ├── page.tsx         # Lead list
│   │   └── [id]/            # Lead detail mit Sections
│   │       ├── page.tsx     # Overview
│   │       ├── audit/       # Deep Scan Audit
│   │       ├── decision/    # Bid/No-Bid Entscheidung
│   │       └── cms-comparison/
│   ├── rfps/                # RFP Pipeline (vor Qualifizierung)
│   │   ├── page.tsx         # RFP list
│   │   └── [id]/            # RFP detail
│   │       ├── page.tsx     # Quick Scan
│   │       ├── routing/     # BL Routing
│   │       └── tech/legal/timing/
│   └── admin/               # Admin panel
└── api/                     # API routes

components/
├── ui/                      # ShadCN components
├── leads/                   # Lead-specific components
├── rfps/                    # RFP-specific components
├── rag/                     # RAG/Embedding components
└── json-render/             # AI-generated UI

lib/
├── agents/                  # AI SDK Agents (Expert Agents)
├── db/schema.ts            # Drizzle schema
├── leads/                   # Lead actions
├── rfps/                    # RFP actions
├── rag/                     # RAG/Embedding services
└── quick-scan/              # Quick Scan tools
```

## Key Principles

### 0. Skills First (PFLICHT!)

- **Bei jedem Task prüfen:** Passt ein Skill? → Skill SOFORT aufrufen
- **Keine Rationalisierung:** "Das ist nur eine kleine Änderung" ist KEIN Grund, Skills zu überspringen
- **React/Next.js Code → `/react-best-practices`** - IMMER, auch bei kleinen Komponenten
- **UI Review → `/web-design-guidelines`** - IMMER bei UI-Änderungen
- **Browser Testing → `/agent-browser`** - IMMER für E2E Tests

### 1. Continuously Shippable Application

- **Jedes Epic muss eine nutzbare Anwendung hinterlassen** - keine halbfertigen Features
- Die App muss nach jedem Commit besser werden, nie schlechter
- Alle Seiten müssen ins bestehende Layout passen (Sidebar, Breadcrumbs, etc.)
- Keine "Baustellen-Seiten" committen, die aus dem Design herausbrechen
- Wenn ein Feature nicht fertig ist: lieber ausblenden als kaputt zeigen
- **Regel:** Vor jedem Commit die betroffenen Seiten im Browser prüfen

### 2. Navigation Integrity

- **Nur Views mit echtem Inhalt in der Navigation verlinken** - keine Dummy-Seiten oder Platzhalter
- Keine "Coming soon..." oder leere Seiten in der Sidebar/Navigation
- **Jede View muss erreichbar sein** - alle Seiten müssen irgendwo verlinkt sein (Navigation, Buttons, Links)
- Verwaiste Seiten ohne Verlinkung sind nicht erlaubt
- Wenn ein Feature noch nicht fertig ist: Link aus Navigation entfernen statt auf leere Seite verweisen
- **Regel:** Nach Navigation-Änderungen alle Links durchklicken und prüfen

### 3. Workflow-Driven Development

- Alle Features als Agent Workflows implementieren
- Live streaming mit AI SDK Elements
- Structured outputs mit generateObject

### 4. ShadCN First

- Immer ShadCN Komponenten verwenden (nie custom components)
- Examples als Referenz nutzen
- Recharts für Charts (via ShadCN chart component)

### 5. Agent-Native UI

- Agent Activity sichtbar machen (Conversation component)
- Chain-of-Thought anzeigen (Reasoning component)
- Tool calls transparent darstellen

### 6. Visual Verification

- Nach jeder UI Änderung: `/agent-browser` für Screenshot + Test
- Console Logs prüfen mit `list_console_messages()`

### 7. EPICS.md Dokumentationsstil

- **Nur Beschreibungen, keine Code-Skizzen** - Code entsteht während der Implementierung
- **Regel:** EPICS.md = WAS gebaut wird, Code = WIE es gebaut wird

### 8. Code Quality & Consistency

- **Prettier für Formatting** - Automatisches Format-on-Save, kein manuelles Formatieren
- **ESLint für Best Practices** - TypeScript-strict, React Hooks, Import Ordering
- **Pre-commit Hooks** - Automatische Qualitätssicherung vor jedem Commit
- **AI-Friendly Configuration** - Warnings statt Errors für Style (AI kann Feedback verarbeiten)
- **VS Code Integration** - Format-on-Save + ESLint Auto-Fix aktiviert

## Plan Mode

**Aktivierung:** `/plan` oder `Shift+Tab` zweimal

**Nutzen für:** Komplexe Features, Architektur-Entscheidungen, DB Migrations, unbekannte Codebases

**Nicht nötig für:** Typo fixes, kleine Änderungen, bekannte Patterns

## Feature Implementation Workflow

**WICHTIG:** Nutze Linear Issues für Tracking. Dokumentiere jeden Schritt, hohe Testabdeckung (80%+) erforderlich.

```
1. Linear Issue → Stelle Linear Issue ID bereit (z.B. DEA-123)

2. /plan "Feature description"
   → Übergebe an workflows:plan:
     - Linear Issue ID: DEA-123
     - Hinweis: "Brauchen min. 80% Test Coverage (Vitest)"
     - Hinweis: "Pflege Linear Issue mit jedem Schritt"

3. TodoWrite → Tasks aus Plan erstellen

4. /work → Development mit Tests
   → workflows:work updatet Linear Issue kontinuierlich
   → Jeder completed Task → Linear Comment

5. /review → Multi-agent Review
   → Ergebnisse in Linear dokumentiert

6. /test-browser → Browser Testing
   → Screenshots in Linear

7. Git Commit: feat(DEA-123): description

8. PR erstellen → Link in Linear Issue

9. progress.txt updaten → BLEIBT bestehen
```

**Linear MCP Tools:**

- `mcp__linear-server__create_comment(issueId, body)` - Step dokumentieren
- `mcp__linear-server__update_issue(id, state)` - Status updaten
- `mcp__linear-server__get_issue(id)` - Issue Details abrufen

**Test Coverage Enforcement:**

- Minimum 80% Vitest coverage REQUIRED
- Falls <80%: Sub-Issue erstellen, blockieren bis erreicht

## Environment Variables

```bash
# AI - adesso AI Hub (OpenAI-compatible)
OPENAI_API_KEY=
OPENAI_BASE_URL=https://adesso-ai-hub.3asabc.de/v1

# Database
DATABASE_URL=file:./local.db

# Optional: Slack Bot
SLACK_BOT_TOKEN=
SLACK_SIGNING_SECRET=
SLACK_CHANNEL_ID=

# Optional: Web Search
EXA_API_KEY=
```

## Debugging

**Build-Fehler:** `fix_my_app(focusArea: 'build')` → Fix → Repeat bis clean

**Browser Testing:** Nutze `/agent-browser` Skill oder `mcp__dev3000__agent_browser_action`:

```typescript
agent_browser_action(action: 'open', params: { url: 'http://localhost:3000' }, session: 'test')
agent_browser_action(action: 'snapshot', session: 'test')  // A11y tree mit @refs
agent_browser_action(action: 'click', params: { target: '@e5' }, session: 'test')
```

**Console/Network:** `list_console_messages(types: ['error'])`, `list_network_requests()`

## When Implementing Features

1. **Skills ZUERST prüfen** - Passt `/react-best-practices`, `/web-design-guidelines`, etc.?
2. **Plan Mode für komplexe Tasks** - `/plan` für Features mit mehreren Dateien
3. **Read existing code first** - Never propose changes to code you haven't read
4. **ShadCN Components** - Always use ShadCN, never custom UI
5. **Visual Verify** - `/agent-browser` nach jeder UI-Änderung
6. **No over-engineering** - Keep it simple, YAGNI principle
