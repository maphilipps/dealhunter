# Dealhunter (Lead Agent)

AI-gestützte BD-Entscheidungsplattform für adesso SE. Basiert auf dem Vercel Lead Agent Starterkit.

## Stack

- **Framework:** Next.js 16 (App Router)
- **Durable Execution:** Workflow DevKit
- **AI:** Vercel AI SDK v5 mit adesso AI Hub
- **Human-in-the-Loop:** Slack Bolt + Vercel Slack Adapter
- **Web Search:** Exa.ai (optional)
- **UI:** ShadCN UI, Tailwind v4

## Commands

```bash
npm install        # Dependencies
npm run dev        # Dev server (localhost:3000)
npm run build      # Production build
npm run start      # Production server
```

## Architecture

```
User submits form (PDF/Email Upload)
     ↓
start(workflow) ← Workflow DevKit
     ↓
Research agent ← AI SDK Agent (Deep Analysis)
     ↓
Qualify lead ← AI SDK generateObject (Bit/No Bit)
     ↓
Generate email ← AI SDK generateText (Team-Benachrichtigung)
     ↓
Slack approval (BL-Routing, Human-in-the-Loop)
     ↓
Send email (on approval)
```

## Project Structure

```
app/
├── api/
│   ├── submit/       # Form submission → Workflow trigger
│   └── slack/        # Slack webhook handler
└── page.tsx          # Home page (Lead form)

lib/
├── services.ts       # Core business logic (qualify, research, email)
├── slack.ts          # Slack integration
├── exa.ts            # Web search (optional)
├── types.ts          # Schemas and types
└── utils.ts          # Utilities

workflows/
└── inbound/          # Lead qualification workflow
    ├── index.ts      # Exported workflow function
    └── steps.ts      # Workflow steps

components/
└── lead-form.tsx     # Main form component
```

## Environment Variables

```bash
# AI - adesso AI Hub (OpenAI-compatible)
OPENAI_API_KEY=
OPENAI_BASE_URL=https://adesso-ai-hub.3asabc.de/v1

# Slack Bot (optional)
SLACK_BOT_TOKEN=
SLACK_SIGNING_SECRET=
SLACK_CHANNEL_ID=

# Exa API Key (optional, for web search)
EXA_API_KEY=
```

## Key Files

| File | Purpose |
|------|---------|
| `lib/services.ts` | AI calls, Agent, Tools - anpassen für Dealhunter |
| `lib/types.ts` | Qualification categories, Schemas |
| `workflows/inbound/steps.ts` | Workflow steps |
| `app/api/submit/route.ts` | Form submission handler |

## Dealhunter Anpassungen

1. **Form:** Upload für PDF/Text/E-Mail statt Contact Form
2. **Research Agent:** AI-Extraktion + Website-Analyse
3. **Qualification:** "Bit or No Bit" Entscheidung
4. **Routing:** BL-Zuordnung nach Qualification
5. **Notification:** Team-Benachrichtigung statt einzelne E-Mail

## When Implementing

1. **Workflow DevKit** für alle Background-Jobs verwenden
2. **AI SDK Agent** für Research und Deep Analysis
3. **generateObject** für strukturierte Qualification
4. **Slack Integration** optional - kann später hinzugefügt werden
