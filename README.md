# Dealhunter

> AI-powered Business Development decision platform for adesso SE

Dealhunter automates the complete RFP (Request for Proposal) evaluation workflow - from document upload to BIT/NO BIT decision and team assignment - using AI agents powered by Vercel AI SDK v5.

## Features

- **AI-Powered Extraction** - Automatically extract key information from RFPs (PDF, DOCX, text)
- **Quick Scan** - Detect tech stack and match to Business Units in seconds
- **BIT Evaluation** - Multi-agent analysis for bid/no-bid recommendations
- **Deep Analysis** - Background jobs for comprehensive company research
- **Team Assignment** - AI-suggested team composition based on skills
- **Analytics Dashboard** - Track bid rates, conversion metrics, and performance
- **Admin Panel** - Manage Business Units, Technologies, and Users

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Set up environment
cp .env.example .env.local
# Edit .env.local and add your API keys

# 3. Initialize database and load seed data
npm run db:push
npm run db:seed

# 4. Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

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
- **Embeddings:** text-embedding-3-large via adesso AI Hub (3072 dimensions)
- **Vector Search:** SQLite vec0 extension (planned for future implementation)

## Database Schema

The application uses SQLite with Drizzle ORM. Key tables include:

- **Core Tables:** `users`, `rfps` (bids), `business_units`, `technologies`, `employees`, `accounts`
- **Scan Tables:** `quick_scans`, `deep_migration_analyses`
- **Master Data:** `references`, `competencies`, `competitors`
- **Support Tables:** `team_assignments`, `subjective_assessments`, `audit_trails`, `documents`

### Vector Search (Future)

For duplicate detection and semantic search, the application is designed to use SQLite's vec0 extension:
- **Embedding Model:** `text-embedding-3-large` (3072 dimensions)
- **Expected Scale:** < 10,000 RFPs
- **Use Cases:** Duplicate RFP detection, semantic similarity matching

**Note:** Vec0 extension needs to be installed separately when vector search features are implemented. The schema is already prepared for embedding storage in JSON columns.

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

## Troubleshooting

### Common Issues

#### Database Connection Failed

**Error:** `Error: Database connection failed`

**Solution:**
```bash
# Recreate database
rm local.db
npm run db:push
npm run db:seed
```

#### AI API Errors (401 Unauthorized)

**Error:** `401 Unauthorized` when calling AI endpoints

**Solution:**
1. Check your `.env.local` file has `OPENAI_API_KEY` set
2. Verify the API key is correct
3. Check `OPENAI_BASE_URL` is set to `https://adesso-ai-hub.3asabc.de/v1`

#### Build Errors

**Error:** `Module not found: @/lib/...`

**Solution:**
Check `tsconfig.json` has correct path aliases:
```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./*"]
    }
  }
}
```

#### Session/Auth Issues

**Error:** `Session not found` or unable to login

**Solution:**
```bash
# Generate new AUTH_SECRET
openssl rand -base64 32

# Add to .env.local
AUTH_SECRET=<your-generated-secret>

# Restart dev server
npm run dev
```

#### Port Already in Use

**Error:** `Port 3000 is already in use`

**Solution:**
```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9

# Or use different port
PORT=3001 npm run dev
```

#### File Upload Fails

**Error:** File upload returns 500 error

**Solution:**
1. Check file size (max 10MB)
2. Verify file type (PDF, DOCX, TXT)
3. Check disk space
4. Review server logs in terminal

#### Slow AI Responses

**Issue:** AI agents take too long to respond

**Solution:**
1. Check your internet connection
2. Verify adesso AI Hub availability
3. Consider using smaller models (GPT-4o-mini)
4. Check Vercel function timeout settings

### Development Tips

- **Clear Cache:** Delete `.next` folder and restart: `rm -rf .next && npm run dev`
- **View Database:** Use Drizzle Studio: `npm run db:studio`
- **Check Logs:** Monitor terminal output for detailed error messages
- **Update Dependencies:** Run `npm install` after pulling latest changes

### Getting Help

- **Documentation:** Check [CONTRIBUTING.md](CONTRIBUTING.md) and [ARCHITECTURE.md](ARCHITECTURE.md)
- **API Reference:** See [API.md](API.md)
- **Deployment:** Review [DEPLOYMENT.md](DEPLOYMENT.md)
- **Team Support:** Contact adesso DevOps team

## License

MIT
