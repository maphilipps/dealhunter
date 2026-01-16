# Dealhunter

AI-gestützte BD-Entscheidungsplattform für adesso SE.

## Quick Start

```bash
# Dependencies installieren
npm install

# Datenbank initialisieren und Seed-Daten laden
npm run db:push
npm run db:seed

# Development Server starten
npm run dev
```

App öffnen: [http://localhost:3000](http://localhost:3000)

## Testbenutzer

| E-Mail | Passwort | Rolle | Beschreibung |
|--------|----------|-------|--------------|
| `admin@adesso.de` | `admin123` | Admin | Vollzugriff auf alle Funktionen |

### Rollen

- **admin**: Administrator mit Zugriff auf Nutzerverwaltung, Stammdaten und alle Funktionen
- **bl**: Business Line Manager - kann Bids der eigenen BL verwalten und Teams zuweisen
- **bd**: Business Development - kann Bids erstellen, einsehen und bearbeiten

## Seed-Daten

Die Seed-Daten (`npm run db:seed`) erstellen:

**Business Lines:**
- Banking & Insurance
- Automotive
- Energy & Utilities
- Retail & E-Commerce
- Healthcare
- Public Sector
- Manufacturing
- Technology & Innovation

**Technologien:**
- Drupal, TYPO3, AEM, Contentful (CMS)
- React, Angular, Vue.js, Next.js (Frontend)
- Java, .NET, Python, Node.js (Backend)
- AWS, Azure, GCP (Cloud)
- PostgreSQL, MongoDB, Redis (Database)
- Kubernetes, Docker (DevOps)

**Kompetenzen:**
- Project Management, Technical Architecture, Backend Development
- Frontend Development, UX Design, QA Engineering, DevOps
- Business Analysis, Data Engineering, AI/ML

## Scripts

```bash
npm run dev          # Development Server (localhost:3000)
npm run build        # Production Build
npm run start        # Production Server
npm run db:push      # Schema auf DB anwenden
npm run db:seed      # Seed-Daten laden
npm run db:studio    # Drizzle Studio öffnen
```

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **UI:** ShadCN UI + Tailwind CSS v4
- **AI:** Vercel AI SDK v5
- **Database:** Drizzle ORM (SQLite)
- **Auth:** NextAuth.js v5

## Architecture

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

## Project Structure

```
app/
├── (dashboard)/              # Protected routes with Sidebar
│   ├── layout.tsx           # Sidebar layout
│   ├── page.tsx             # Dashboard home
│   ├── bids/                # Bid management
│   ├── accounts/            # Account management
│   ├── analytics/           # Analytics dashboard
│   └── admin/               # Admin panel
├── (auth)/                  # Login/Register
└── api/                     # API routes

lib/
├── agents/                  # AI SDK Agents
│   ├── extraction/          # Extraction agent
│   ├── quick-scan/          # Quick Scan agent
│   ├── bit-evaluation/      # Bit/No Bit evaluation
│   └── team/                # Team suggestion agent
├── db/
│   ├── schema.ts           # Drizzle schema
│   └── seed.ts             # Seed data
└── auth/                    # NextAuth config
```

## Umgebungsvariablen

```bash
# .env.local erstellen
OPENAI_API_KEY=your-api-key
OPENAI_BASE_URL=https://adesso-ai-hub.3asabc.de/v1
DATABASE_URL=file:./local.db
AUTH_SECRET=your-secret-key
```

## License

MIT
