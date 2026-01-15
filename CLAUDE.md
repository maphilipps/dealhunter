# Dealhunter
This is a prototype. Speed over perfection.
AI-gestützte BD-Entscheidungsplattform für adesso SE. Automatisiert den Akquise-Prozess von Anforderungsaufnahme bis Team-Benachrichtigung.

## WHAT: Project & Architecture

**Stack:** Next.js 15 (App Router) · Vercel AI SDK · ShadCN UI · Tailwind v4 · SQLite/Drizzle · BullMQ

**Core Flow:**
```
Upload → AI-Extraktion → Quick Scan → Bit/No Bit → BL-Routing → Deep Analysis → Team → Notify
```

**Key Entities:** BidOpportunity, BusinessLine, Technology (with Baselines), Employee, TeamAssignment

## WHY: Business Context

Internes MVP für adesso Digital Experience. BD-Team lädt Kundenanfragen hoch (PDF/Text/E-Mail), System entscheidet automatisch "Bit or No Bit", routet zum passenden Bereichsleiter, analysiert Kundenwebsite, schätzt Aufwand, und benachrichtigt zusammengestelltes Team per E-Mail.

**Prinzip:** Agent Native (https://every.to/guides/agent-native) - volle Transparenz aller AI-Aktionen.

## HOW: Commands

```bash
bun install          # Dependencies
bun run dev          # Dev server (localhost:3000)
bun run build        # Production build
bun run test         # Vitest unit tests
bun run test:e2e     # Playwright E2E tests
bun run db:push      # Push schema to database
bun run db:studio    # Drizzle Studio
```

## Plan Mode

- Make the plan extremely concise. Sacrifice grammar for the sake of concision.
- At the end of each plan, give me a list of unresolved questions to answer, if any.

## Key Files

| File | Purpose |
|------|---------|
| `SPEC.md` | Vollständige MVP-Spezifikation (Datenmodelle, APIs, UI) |
| `FEATURES.json` | 75+ testbare Features im Anthropic-Format |
| `.claude/skills/` | React, Vercel Design, Website-Audit Skills |

## Architecture Decisions

- **Vercel AI SDK** für alle LLM-Interaktionen (`ai`, `@ai-sdk/react`, `@ai-sdk/anthropic`)
- **Zwei-Phasen Analysis:** Quick Scan (2-5min) für BD, Deep Migration (10-30min Background) für BL
- **Multi-CMS Baselines:** Drupal (adessoCMS 693h), Ibexa, Magnolia, Firstspirit
- **Agent Native:** Chain-of-Thought sichtbar, Abort möglich, Confidence Indicators

## When Implementing

1. **Read SPEC.md first** - contains all data models, API contracts, UI requirements
2. **Check FEATURES.json** - each feature has step-by-step acceptance criteria
3. **Use skills** - `react-best-practices`, `vercel-design-guidelines` for React/UI code
4. **Debugging** - use `fix_my_app()` d3k tool for any errors
