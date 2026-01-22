# MCP Tools & Browser Automation

## Overview

Claude Code hat Zugriff auf mehrere MCP (Model Context Protocol) Servers für erweiterte Funktionalität.

---

## ShadCN MCP

**Für:** UI Component Installation & Examples

### Available Tools

| Tool                                | Use For                                     |
| ----------------------------------- | ------------------------------------------- |
| `search_items_in_registries`        | Suche nach Komponenten (z.B. "sidebar")     |
| `view_items_in_registries`          | Details zu spezifischen Komponenten abrufen |
| `get_item_examples_from_registries` | Usage Examples & Demos holen                |
| `get_add_command_for_items`         | Install Command generieren                  |

### Workflow: Component Installation

```typescript
// 1. Komponente suchen
search_items_in_registries({
  registries: ['@shadcn'],
  query: 'data table'
});
// Returns: @shadcn/table, @shadcn/data-table-demo

// 2. Details abrufen
view_items_in_registries({
  items: ['@shadcn/data-table-demo']
});
// Returns: Files, dependencies, props

// 3. Examples holen
get_item_examples_from_registries({
  registries: ['@shadcn'],
  query: 'data-table-demo'
});
// Returns: Full demo code with sorting, filtering, pagination

// 4. Install Command
get_add_command_for_items({
  items: ['@shadcn/data-table']
});
// Returns: npx shadcn@latest add data-table

// 5. Bash: Install ausführen
npx shadcn@latest add data-table
```

### Best Practices

- **Immer Examples checken** vor eigener Implementierung
- **ShadCN Registry nutzen** - niemals custom UI Components bauen
- **Demo Code als Template** verwenden und anpassen

---

## Context7 MCP

**Für:** AI SDK & Next.js Dokumentation

### Available Tools

| Tool                 | Use For                                |
| -------------------- | -------------------------------------- |
| `resolve-library-id` | Library ID aus Package-Namen ermitteln |
| `query-docs`         | Dokumentation abfragen mit Query       |

### Workflow: Docs Lookup

```typescript
// 1. Library ID resolven
resolve -
  library -
  id({
    libraryName: 'ai',
    query: 'How to use useChat hook with streaming',
  });
// Returns: '/vercel/ai'

// 2. Docs abrufen
query -
  docs({
    libraryId: '/vercel/ai',
    query: 'useChat hook streaming responses with tool calls',
  });
// Returns: Documentation, code examples, API reference
```

### Supported Libraries

- `/vercel/ai` - AI SDK (useChat, streamText, generateObject)
- `/vercel/next.js` - Next.js Framework
- `/supabase/supabase` - Supabase Client
- `/mongodb/docs` - MongoDB Node Driver
- Und viele mehr...

### Best Practices

- **Spezifische Queries** - "useChat with tool calling" statt "ai sdk"
- **IMMER Context7 nutzen** für AI SDK Fragen statt alte Docs
- **Library ID cachen** für wiederholte Queries

---

## Chrome DevTools MCP

**Für:** Visual Testing, Console Logs, Network Debugging

**WICHTIG:** Nur nutzen wenn `agent-browser` CLI nicht verfügbar ist!

### Available Tools

| Tool                    | Use For                         |
| ----------------------- | ------------------------------- |
| `take_screenshot`       | Screenshots (page oder element) |
| `take_snapshot`         | A11y tree snapshot              |
| `list_console_messages` | Console logs/errors/warnings    |
| `list_network_requests` | HTTP requests (XHR, Fetch)      |
| `navigate_page`         | Page navigation                 |

### Example: Visual Testing

```typescript
// Screenshot der gesamten Seite
take_screenshot({
  filePath: 'screenshots/dashboard.png',
  fullPage: true,
});

// Screenshot eines Elements
take_snapshot(); // Erst snapshot um Element UID zu bekommen
take_screenshot({
  filePath: 'screenshots/sidebar.png',
  uid: 'e42', // Element UID aus snapshot
});
```

### Example: Console Debugging

```typescript
// Alle Errors
list_console_messages({
  types: ['error'],
});

// Errors + Warnings
list_console_messages({
  types: ['error', 'warn'],
  pageSize: 50,
});
```

### Example: Network Analysis

```typescript
// Failed requests finden
list_network_requests({
  resourceTypes: ['fetch'],
  pageIdx: 0,
});

// Request Details
get_network_request({ reqid: 123 });
```

---

## Next.js DevTools MCP

**Für:** Dev Server Diagnostics & Error Detection

### Available Tools

| Tool           | Use For                              |
| -------------- | ------------------------------------ |
| `nextjs_index` | Discover running Next.js dev servers |
| `nextjs_call`  | Execute specific Next.js MCP tools   |

### Workflow: Error Diagnostics

```typescript
// 1. Discover servers
nextjs_index({ port: '3000' });
// Returns: Available tools (get_errors, get_routes, etc.)

// 2. Get compilation/runtime errors
nextjs_call({
  port: '3000',
  toolName: 'get_errors',
});
// Returns: TypeScript errors, build errors, runtime errors

// 3. Get all routes
nextjs_call({
  port: '3000',
  toolName: 'get_routes',
});
// Returns: List of all app routes
```

### Requirements

- **Next.js 16+** - MCP support wurde in v16 hinzugefügt
- **Dev server läuft** - `d3k` oder `npm run dev`
- **Port 3000** (default) oder custom port via `--port` flag

---

## Linear MCP

**Für:** Issue Tracking & Project Management

### Available Tools

| Tool             | Use For                              |
| ---------------- | ------------------------------------ |
| `list_issues`    | Issues abrufen (filtered)            |
| `get_issue`      | Issue Details + Relations            |
| `create_issue`   | Neues Issue erstellen                |
| `update_issue`   | Issue updaten (state, assignee, etc) |
| `create_comment` | Kommentar zu Issue hinzufügen        |

### Example: Feature Development Workflow

```typescript
// 1. Issue abrufen
get_issue({ id: 'DEA-123', includeRelations: true });

// 2. Status updaten
update_issue({
  id: 'DEA-123',
  state: 'In Progress',
});

// 3. Progress dokumentieren
create_comment({
  issueId: 'DEA-123',
  body: '✅ Extraction Agent implementiert\n- PDF parsing functional\n- Tests added (85% coverage)',
});

// 4. Sub-Issue erstellen
create_issue({
  title: 'Add test coverage for Quick Scan Agent',
  team: 'Dealhunter',
  parentId: 'DEA-123',
  state: 'Todo',
});
```

### Best Practices

- **Jeder Step → Linear Comment** für Transparency
- **Tests dokumentieren** - Coverage % in Comments
- **Screenshots verlinken** bei UI Changes

---

## Browser Automation (agent-browser CLI)

**BEVORZUGT für alle Browser-Tests!**

### Warum agent-browser statt Chrome DevTools MCP?

- ✅ **Zuverlässiger** in Sandbox-Umgebungen
- ✅ **Ref-basiertes Klicken** (@e1, @e2) statt Selektoren
- ✅ **Session-Isolation** für parallele Tests
- ✅ **Playwright-powered** - robuster als CDP
- ✅ **CLI-basiert** - einfacher zu debuggen

### Quick Start

```bash
# Browser öffnen
agent-browser open http://localhost:3000

# Snapshot mit Interactive Elements
agent-browser snapshot -i
# Output: textbox "Email" [ref=e1], button "Login" [ref=e2]

# Element Interaktionen
agent-browser fill @e1 "test@adesso.de"
agent-browser click @e2

# Screenshot
agent-browser screenshot screenshots/dashboard.png

# Console prüfen
agent-browser console
agent-browser errors
```

### UI Verification Workflow

```bash
# 1. Feature implementieren
# ... code changes ...

# 2. Browser öffnen
agent-browser open http://localhost:3000/bids/new

# 3. Snapshot → Elements prüfen
agent-browser snapshot -i

# 4. Test Interaction
agent-browser click @e5  # Upload button
agent-browser wait --text "Success"

# 5. Visual Verification
agent-browser screenshot screenshots/bid-upload.png

# 6. Console Errors
agent-browser console
# Sollte keine Errors zeigen

# 7. Close
agent-browser close
```

### Advanced Features

#### Form Filling

```bash
agent-browser snapshot -i
# Output: textbox "Title" [ref=e1], textarea "Description" [ref=e2], button "Save" [ref=e3]

agent-browser fill @e1 "Project Alpha"
agent-browser fill @e2 "Description text here"
agent-browser click @e3
agent-browser wait --load networkidle
```

#### Authentication Flow

```bash
# Login + Save State
agent-browser open http://localhost:3000/auth/login
agent-browser snapshot -i
agent-browser fill @e1 "admin@adesso.de"
agent-browser fill @e2 "admin123"
agent-browser click @e3
agent-browser wait --url "**/dashboard"
agent-browser state save auth-admin.json

# Spätere Sessions: State laden
agent-browser state load auth-admin.json
agent-browser open http://localhost:3000/dashboard
```

#### Parallel Sessions

```bash
# Session 1: Admin user
agent-browser --session admin open localhost:3000

# Session 2: Viewer user
agent-browser --session viewer open localhost:3000

# List active sessions
agent-browser session list
```

#### Debugging

```bash
# Show browser window
agent-browser open localhost:3000 --headed

# Console messages
agent-browser console

# Page errors
agent-browser errors

# Get element info
agent-browser get text @e1
agent-browser get value @e2
```

### Semantic Locators (Alternative zu Refs)

```bash
# By role
agent-browser find role button click --name "Submit"

# By text
agent-browser find text "Sign In" click

# By label
agent-browser find label "Email" fill "user@test.com"
```

---

## MCP Workflow Examples

### Example 1: Implementing new Chart Component

```typescript
// 1. ShadCN: Search chart components
search_items_in_registries({ registries: ['@shadcn'], query: 'chart pie' });

// 2. ShadCN: Get example
get_item_examples_from_registries({
  registries: ['@shadcn'],
  query: 'chart-pie-donut-text'
});

// 3. ShadCN: Install
get_add_command_for_items({ items: ['@shadcn/chart'] });
// → Bash: npx shadcn@latest add chart

// 4. Implement (adapt example code)
// ... write component code ...

// 5. Browser: Verify visually
agent-browser open http://localhost:3000/analytics
agent-browser screenshot screenshots/pie-chart.png

// 6. Next.js DevTools: Check errors
nextjs_call({ port: '3000', toolName: 'get_errors' });
```

### Example 2: Implementing AI Agent with Docs

```typescript
// 1. Context7: Get AI SDK docs
resolve-library-id({ libraryName: 'ai', query: 'streaming with tools' });
query-docs({
  libraryId: '/vercel/ai',
  query: 'streamText with tools and structured output'
});

// 2. Implement agent
// ... write code based on docs ...

// 3. Next.js DevTools: Check console for errors
nextjs_call({ port: '3000', toolName: 'get_errors' });

// 4. Browser: Test agent UI
agent-browser open http://localhost:3000/bids/123/evaluate
agent-browser snapshot -i
agent-browser click @e1  # Start evaluation button

// 5. Browser: Check console logs
agent-browser console
```

### Example 3: Debugging Production Issue

```bash
# 1. Reproduce in browser
agent-browser open http://localhost:3000/problem-page
agent-browser snapshot -i

# 2. Console errors
agent-browser console
agent-browser errors

# 3. Screenshot für Bug Report
agent-browser screenshot bug-screenshots/issue-DEA-456.png

# 4. Network requests
# (Switch to Chrome DevTools MCP für Network Debugging)
list_network_requests({ resourceTypes: ['fetch'] });

# 5. Linear: Dokumentieren
create_comment({
  issueId: 'DEA-456',
  body: '**Reproduced Issue:**\n- Console Error: ...\n- Network Request failed: ...\n- Screenshot: bug-screenshots/issue-DEA-456.png'
});
```

---

## Best Practices

### When to use which tool?

| Task                 | Tool                             |
| -------------------- | -------------------------------- |
| UI Component finden  | **ShadCN MCP** → search_items    |
| AI SDK Dokumentation | **Context7 MCP** → query-docs    |
| Visual Testing       | **agent-browser CLI**            |
| Console Debugging    | **agent-browser console**        |
| Build Errors         | **Next.js DevTools MCP**         |
| Network Debugging    | **Chrome DevTools MCP** (Backup) |
| Issue Tracking       | **Linear MCP**                   |

### DO ✅

- **agent-browser für alle Browser-Tests** (nicht Chrome DevTools MCP)
- **Context7 für jede AI SDK Frage** statt alte Docs
- **Linear Comments** bei jedem wichtigen Step
- **Screenshots speichern** bei Visual Changes

### DON'T ❌

- ❌ Chrome DevTools MCP wenn agent-browser verfügbar
- ❌ AI SDK Docs ohne Context7 MCP
- ❌ UI Components ohne ShadCN Registry Check
- ❌ Features ohne Linear Issue Tracking

---

## Troubleshooting

**Problem:** agent-browser not found

```bash
# Install agent-browser CLI
npm install -g @vercel/agent-browser

# Check installation
agent-browser --version
```

**Problem:** Next.js MCP keine Verbindung

```bash
# Stelle sicher, dass d3k läuft
d3k

# Check Port
nextjs_index({ port: '3000' })
```

**Problem:** Context7 Library nicht gefunden

```typescript
// Nutze resolve-library-id FIRST
resolve - library - id({ libraryName: 'package-name', query: 'your question' });
```
