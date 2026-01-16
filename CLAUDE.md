# Dealhunter

AI-gestützte BD-Entscheidungsplattform für adesso SE. Workflow-driven mit AI Agents und modernem UI.

## Stack

- **Framework:** Next.js 16 (App Router)
- **UI System:** ShadCN UI (Sidebar, Charts, Tables, Forms)
- **AI Elements:** Vercel AI SDK Elements (Conversation, Message, Reasoning)
- **AI Agents:** Vercel AI SDK v5 (streamText, generateObject, tools)
- **Database:** Drizzle ORM (SQLite)
- **Styling:** Tailwind CSS v4
- **Durable Execution:** Workflow DevKit (optional)

## Commands

```bash
npm install              # Dependencies
npm run dev              # Dev server (localhost:3000)
npm run build            # Production build
npm run start            # Production server
npm run db:push          # Push schema changes to DB
npm run db:studio        # Open Drizzle Studio
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

### Context7 MCP (`mcp__plugin_fullstack-ai_context7__*`)

Für AI SDK und Next.js Dokumentation:

```typescript
// 1. Library ID resolven
resolve-library-id(libraryName: 'ai', query: 'AI SDK documentation')

// 2. Docs abrufen
query-docs(libraryId: '/vercel/ai', query: 'useChat hook streaming')
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
BIT/NO BIT Evaluation
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

| Use Case | Component |
|----------|-----------|
| **Layout** | `sidebar`, `navigation-menu`, `breadcrumb` |
| **Data Viz** | `chart` (Pie, Bar, Line, Radar, Radial) |
| **Tables** | `table`, `data-table-demo` (mit Sorting/Filtering) |
| **Forms** | `form`, `select`, `slider`, `checkbox`, `switch` |
| **Feedback** | `alert`, `progress`, `skeleton`, `spinner` |
| **Dialogs** | `dialog`, `alert-dialog`, `sheet` |
| **Expansion** | `accordion`, `collapsible`, `tabs` |
| **Status** | `badge`, `avatar`, `tooltip` |

### AI SDK Elements (für Agent UI)

| Component | Use For |
|-----------|---------|
| `<Conversation>` | Agent Activity Stream (live updates) |
| `<Message>` | Individual Agent Outputs |
| `<MessageActions>` | Copy, Expand, Retry buttons |
| `<Reasoning>` | Chain-of-Thought display |
| `<Sources>` | Referenced data and citations |
| `<PromptInput>` | User input fields (if needed) |
| `<Loader>` | Processing states with animation |

### Chart Usage (Recharts-basiert)

| Data Type | ShadCN Chart Block |
|-----------|-------------------|
| Bit/No Bit Rate | `chart-pie-donut-text` |
| Pipeline Funnel | `chart-bar-horizontal` |
| Opportunities by BL | `chart-bar-stacked` |
| Time to Decision | `chart-line-default` |
| Risk Assessment | `chart-radar-default` |
| Confidence Score | `chart-radial-label` |
| PT Breakdown | `chart-bar-stacked` |

## Project Structure

```
app/
├── (dashboard)/              # Protected routes with Sidebar
│   ├── layout.tsx           # Sidebar layout
│   ├── page.tsx             # Dashboard home
│   ├── bids/
│   │   ├── page.tsx         # Bid list (Table)
│   │   ├── new/page.tsx     # Upload form
│   │   └── [id]/
│   │       ├── page.tsx     # Bid detail
│   │       └── evaluate/    # Bit/No Bit evaluation
│   ├── accounts/            # Account management
│   ├── analytics/           # Analytics dashboard
│   └── admin/               # Admin panel
├── (auth)/                  # Login/Register
└── api/                     # API routes

components/
├── ui/                      # ShadCN components
├── ai-elements/             # AI SDK Elements
│   ├── conversation.tsx
│   ├── message.tsx
│   ├── reasoning.tsx
│   └── sources.tsx
├── bids/                    # Bid-specific components
└── charts/                  # Chart wrappers

lib/
├── agents/                  # AI SDK Agents
│   ├── extraction-agent.ts
│   ├── quick-scan-agent.ts
│   ├── bit-evaluation-agent.ts
│   └── coordinator-agent.ts
├── db/
│   ├── schema.ts           # Drizzle schema
│   └── index.ts            # DB connection
├── bids/                    # Bid actions
└── types.ts                 # Schemas and types
```

## MCP Workflow Examples

### UI Component Implementation

```
1. ShadCN MCP: search_items → find component
2. ShadCN MCP: view_items → get details
3. ShadCN MCP: get_item_examples → usage reference
4. ShadCN MCP: get_add_command → install command
5. Bash: npx shadcn@latest add <component>
6. Implement using examples
7. Chrome DevTools MCP: take_screenshot → verify
8. Chrome DevTools MCP: list_console_messages → debug
```

### Agent Implementation

```
1. Context7 MCP: resolve-library-id → AI SDK
2. Context7 MCP: query-docs → useChat, streamText, tools
3. Implement agent with streaming
4. Next.js DevTools MCP: nextjs_call → check errors
5. Chrome DevTools MCP: list_console_messages → debug
```

### Chart Implementation

```
1. ShadCN MCP: search_items → 'chart pie donut'
2. ShadCN MCP: get_item_examples → 'chart-pie-demo'
3. Install: npx shadcn@latest add chart
4. Adapt example with real data
5. Chrome DevTools MCP: take_screenshot → verify
```

## Key Principles

### 1. Workflow-Driven Development
- Alle Features als Agent Workflows implementieren
- Live streaming mit AI SDK Elements
- Structured outputs mit generateObject

### 2. ShadCN First
- Immer ShadCN Komponenten verwenden (nie custom components)
- Examples als Referenz nutzen
- Recharts für Charts (via ShadCN chart component)

### 3. Agent-Native UI
- Agent Activity sichtbar machen (Conversation component)
- Chain-of-Thought anzeigen (Reasoning component)
- Tool calls transparent darstellen

### 4. MCP-Driven Discovery
- ShadCN MCP für alle UI Komponenten
- Context7 MCP für AI SDK und Next.js Docs
- Chrome DevTools MCP für Visual Testing
- Next.js DevTools MCP für Server Diagnostics

### 5. Visual Verification
- Nach jeder UI Änderung: Screenshot mit Chrome DevTools MCP
- Console Logs prüfen
- Responsive Design testen

## Feature Implementation Workflow

```
1. TodoWrite → Task planen
2. ShadCN MCP → Komponenten finden
3. Context7 MCP → AI SDK Docs lesen (bei Agents)
4. Implementieren
5. Chrome DevTools MCP → Visual Testing
6. Next.js DevTools MCP → Error Check
7. Git Commit: feat(FEATURE-ID): description
8. progress.txt + FEATURES.json updaten
```

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

## Debugging with MCPs

### Visual Issues
```typescript
// Screenshot für Bug Report
take_screenshot(filePath: 'bug-screenshots/dashboard-broken.png')

// Element inspizieren
take_snapshot() // A11y tree
```

### Console Errors
```typescript
// Alle Errors
list_console_messages(types: ['error'])

// Spezifische Logs filtern
list_console_messages(types: ['error', 'warn'], pageSize: 50)
```

### Network Issues
```typescript
// Failed requests
list_network_requests(resourceTypes: ['fetch'], pageIdx: 0)

// Request Details
get_network_request(reqid: 123)
```

### Dev Server Errors
```typescript
// Next.js Compilation Errors
nextjs_call(port: '3000', toolName: 'get_errors')

// Route List
nextjs_call(port: '3000', toolName: 'get_routes')
```

## Testing Strategy

1. **Visual Testing:** Chrome DevTools MCP Screenshots
2. **Console Logs:** Error/Warning Detection
3. **Performance:** Network Request Analysis
4. **Responsive:** Viewport Resize Tests
5. **Accessibility:** A11y Tree Snapshots

## When Implementing Features

1. **Read existing code first** - Never propose changes to code you haven't read
2. **Use TodoWrite** - Plan tasks before implementing
3. **ShadCN Components** - Always use ShadCN, never custom UI
4. **MCP for Docs** - Context7 MCP für AI SDK/Next.js Docs
5. **Visual Verify** - Screenshot after every UI change
6. **No over-engineering** - Keep it simple, YAGNI principle
7. **Agent-Native** - Make agent activity visible in UI
