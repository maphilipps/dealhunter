# Project CLAUDE.md - Dealhunter

## Workflow Commands

| Command | Purpose |
|---------|---------|
| `/workflows:plan` | Create implementation plan with research agents |
| `/workflows:work` | Execute plan with TodoWrite tracking |
| `/workflows:review` | Review code with specialist agents |
| `/workflows:compound` | Document learnings |
| `/triage` | Process review findings one-by-one |
| `/spec` | Create/Update specifications via interview |
| `/plan` | Transform feature descriptions into implementation plans |

**Workflow:** /spec → /plan → /workflows:work → /workflows:review → /workflows:compound

## Project Context: Dealhunter

**Type**: AI-Powered Company Intelligence Platform for Business Development (INTERNAL MVP)
**Framework**: Next.js 15+ (App Router) + ShadCN UI + Tailwind CSS v4
**Agent SDK**: Anthropic Agent SDK (TypeScript)
**Auth**: NextAuth.js Credentials Provider (Email/Password only, no SSO)
**Database**: PostgreSQL (Drizzle ORM) oder MongoDB
**Queue**: BullMQ oder Inngest für Background Jobs
**Cache**: Redis für Result-Caching und Rate Limiting

> **IMPORTANT**: This is an INTERNAL MVP for adesso SE. Security measures should be practical and balanced - not every edge case needs protection since this is for internal use only. Focus on core functionality and user experience over exhaustive security hardening.

### MVP Scope (Phase 1)
- Single Company Analysis: Quick Scan (30s) und Deep Dive (2min)
- Agent Native Transparenz: Volle Sichtbarkeit aller Agent-Aktionen
- Lead Scoring, Tech Stack Detection, Digital Maturity Assessment
- M&A Intelligence: Executive Summary, Leadership Checks, Valuation, LOI Recommendations

### Tech Stack Dependencies
- **Frontend**: Next.js 15+, ShadCN UI, Tailwind CSS v4, Zustand, Recharts
- **Backend**: Node.js + TypeScript, Anthropic Agent SDK, tRPC (optional)
- **AI/ML**: Claude Opus 4.5, Firecrawl/Playwright, Wappalyzer Skills
- **APIs**: Google PageSpeed Insights API, Lighthouse CI, Google News RSS + Bing News API
- **Testing**: Playwright (E2E), Vitest/JS-Quokka (Unit), Accessibility Tests (WCAG 2.1 AA)

### Key Architecture Decisions

#### Agent Native Implementation
- Regelmäßiger agent-native reviewer während Entwicklung
- `/agent-sdk` Skill MUSS für Agent-SDK-Implementierung genutzt werden
- Reference: https://every.to/guides/agent-native

#### Web Crawling
- Playwright für Crawling (keine robots.txt Respektierung für BD-Zwecke)
- Wappalyzer mit Custom Skills für Tech Detection
- Multi-Site Auto-Discovery: Alle Webseiten eines Unternehmens werden analysiert

#### Performance & SEO Analysis
- Hybrid: Google PageSpeed Insights API (gratis, 25K/day) + Lighthouse CI
- Core Web Vitals pro Webseite
- Meta-Tags, Structured Data, Sitemap, Robots.txt Checks

#### Leadership Vetting (MVP)
- Nur Public Sources: LinkedIn, Press, Company Website
- Keine paid APIs für Sanctions/FBI Checks (Phase 2)

#### Compliance & Data
- Mindestmaß: DS-GVO für deutsche Unternehmen
- Data Retention: Manual Only, kein Auto-Delete
- PII nicht für Training verwenden

#### Rate Limiting
- Keine harten Limits auf Analysen (internes MVP)
- Nur API Rate Limiting für Abuse-Schutz

### 13-Phasen Analysis Workflow

1. Company Discovery Phase (Unternehmens-Info, Webseiten discovern)
2. Multi-Site Crawling Phase (Playwright)
3. Tech Detection Phase (Wappalyzer Skills)
4. Performance Phase (PageSpeed API + Lighthouse CI)
5. UX Analysis Phase (Design Quality, Accessibility, Mobile)
6. SEO & Content Phase (Meta-Tags, Structured Data)
7. MarTech Detection Phase (CRM, Marketing Automation)
8. Company Research Phase (Executive Summary, Leadership Identification)
9. Leadership Vetting Phase (Public Sources)
10. News Analysis Phase (Google RSS + Bing API)
11. Valuation Phase (News/Headlines + Market Multiples)
12. LOI Generation Phase (Letter of Intent Struktur)
13. Scoring Phase (Lead Score, Digital Maturity)

### Testing Strategy (MVP)

#### Unit Tests
- Company Discovery Logic
- Tech Detection Logic (CMS, Frameworks, Libraries)
- Lead Scoring Algorithm (verschiedene Szenarien)
- Performance Metrics Calculation
- Valuation Logic aus News/Headlines
- LOI Generation Logic

#### Integration Tests
- Agent Orchestration (vollständiger 13-Phasen Workflow)
- API Endpoints (CRUD Operations)
- Database Operations (Create, Read, Update, Delete)
- External API Integrations (Playwright, PageSpeed, Wappalyzer, News APIs)

#### E2E Tests (Playwright MANDATORY)
- Happy Path: Company Name → Analyse → Full Result
- Multi-Website Analyse (3+ Webseiten)
- Live Updates während Analyse (WebSocket)
- Error Recovery (Re-analyze nach Fehler)
- **ALWAYS use Playwright MCP to verify UI changes**

#### Accessibility Tests (MANDATORY)
- Keyboard Navigation
- Screen Reader Compatibility
- Color Contrast (WCAG 2.1 Level AA)
- Focus Management

### Phase 2 Features (NOT in MVP)
- Competitor Analysis (Vergleich von 2-5 Unternehmen)
- Batch Analysis (CSV Upload für 10+ Unternehmen)
- PDF Export (Full Report, One-Pager, Tech Deep Dive)
- CRM Export (HubSpot/Salesforce)
- Team Sharing (Geteilte Analysen)
- Admin Dashboard (Monitoring/User Management)
- Auto-Updates (Automatische Re-Analyze)
- Paid APIs für Leadership Checks (Sanctions/FBI)

## Agent Categories

### Specialists (Domain Expertise)

Use for domain-specific expertise (format: `adessocms-engineering:specialists:<name>`):

- `drupal-specialist` - Drupal APIs, hooks, services
- `sdc-specialist` - Single Directory Components
- `twig-specialist` - Twig templates, filters
- `tailwind-specialist` - Tailwind CSS, theming
- `accessibility-specialist` - WCAG 2.1 AA compliance
- `security-sentinel` - Security review, vulnerabilities
- `architecture-strategist` - Architecture decisions
- `performance-oracle` - Performance analysis

### Research Agents (Parallel Analysis)

- `repo-research-analyst` - Codebase research (local)
- `librarian` - External docs, framework research, best practices
- `git-history-analyzer` - Git history analysis

### Core Agents

- `frontend-engineer` - Visual changes, UI/UX, Tailwind, Alpine.js
- `document-writer` - README, API docs, user guides

### Compound Engineering Specific

- `agent-native-audit` - Run comprehensive agent-native architecture review
- `ivangrynenko-cursorrules-drupal` - Drupal development and security patterns

## Usage Example

```
Task(subagent_type="adessocms-engineering:specialists:drupal-specialist", prompt="...")
Task(subagent_type="adessocms-engineering:research:repo-research-analyst", prompt="...")
Task(subagent_type="adessocms-engineering:core:accessibility-specialist", prompt="...")
```

## Pre-Commit Checklist (MANDATORY)

### For UI Changes
1. **Playwright MCP**: Screenshot/Snapshot der Änderung machen
2. **Icon-Pfade prüfen**: Icons werden nur als Pfad ausgegeben
3. **Responsive Verhalten**: Mobile, Tablet, Desktop testen

### For Code Changes
1. **Security fixes**: MANDATORY comprehensive tests
2. **Bug fixes**: MUST include reproduction test
3. **New features**: MUST have test coverage
4. **Frontend**: MUST use Playwright MCP + Storybook

### Agent Native Review (REGULARLY)
- Run `agent-native-audit` regularly during development
- Use `/agent-sdk` skill for Agent SDK implementation

## Compound Triggers

Document learnings after:
- Problem solved
- Non-trivial fix completed
- Pattern discovered

Use `/workflows:compound` to capture learnings in `docs/solutions/`.

## Philosophy

> "Work, delegate, verify, ship, LEARN."
