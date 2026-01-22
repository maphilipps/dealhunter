# Tech Stack

## Core Framework

- **Next.js 16** (App Router) - React Framework mit Server Components
- **React 19.2** - UI Library mit Concurrent Features
- **TypeScript 5** - Type Safety

## UI System

### ShadCN UI Components

Alle UI-Komponenten basieren auf ShadCN - **nie custom Components bauen**!

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

## Styling

- **Tailwind CSS v4** - Utility-first CSS
- **tw-animate-css** - Animation Utilities
- **next-themes** - Dark Mode Support
- **class-variance-authority** - Component Variants
- **tailwind-merge** - Conditional Styling

## AI & Agents

- **Vercel AI SDK v5** (`ai` package)
  - `streamText` - Streaming responses
  - `generateObject` - Structured outputs
  - `tools` - Function calling
- **@ai-sdk/openai** - OpenAI-compatible provider
- **@ai-sdk/react** - React Hooks (`useChat`, `useCompletion`)

## Database

- **SQLite** (via better-sqlite3) - Local-first database
- **Drizzle ORM** - Type-safe queries
- **sqlite-vec** - Vector search für RAG

## Background Jobs

- **Inngest** - Durable workflows & scheduling
- **Workflow DevKit** - Workflow orchestration (optional)

## Authentication

- **NextAuth v5** (beta) - Auth.js für Next.js
- **bcryptjs** - Password hashing

## External Services

- **Slack** (@slack/bolt, @slack/web-api) - Notifications
- **Resend** - Email delivery
- **Exa** (exa-js) - Web search
- **Simple Wappalyzer** - Tech stack detection

## PDF Processing

- **pdf-lib** - PDF manipulation
- **pdf2json** - PDF parsing
- **Cheerio** - HTML parsing

## Utilities

- **Zod v4** - Schema validation
- **@paralleldrive/cuid2** - ID generation
- **isomorphic-dompurify** - XSS protection
- **botid** - Bot detection
- **fast-xml-parser** - XML parsing
- **streamdown** - Markdown streaming

## Development Tools

Siehe [Testing](./testing.md) für vollständige Testing-Tools Dokumentation.

- **Prettier** - Code formatting
- **ESLint** - Linting (Next.js + TypeScript)
- **Husky** - Git hooks
- **lint-staged** - Pre-commit formatting

## Dependencies Version Matrix

| Package      | Version        | Notes                   |
| ------------ | -------------- | ----------------------- |
| Next.js      | ^16.1.2        | Stable release          |
| React        | 19.2.1         | Latest stable           |
| AI SDK       | ^5.0.121       | Major version 5         |
| Drizzle ORM  | ^0.45.1        | Latest features         |
| NextAuth     | ^5.0.0-beta.30 | Beta - production ready |
| Zod          | ^4.3.5         | Major version 4         |
| Tailwind CSS | ^4             | Major version 4         |
| TypeScript   | ^5             | Latest stable           |
| Inngest      | ^3.49.3        | Stable                  |
| Playwright   | ^1.57.0        | E2E testing             |
| Vitest       | ^4.0.17        | Unit testing            |

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

# NextAuth (auto-generated)
AUTH_SECRET=
AUTH_URL=http://localhost:3000
```

## Deprecated / Nicht verwenden

- ❌ **Custom UI Components** - Immer ShadCN nutzen
- ❌ **Styled Components** - Nur Tailwind
- ❌ **Redux** - State in Server Components oder React Context
- ❌ **Axios** - Native `fetch` verwenden
- ❌ **Moment.js** - Native Date oder date-fns
