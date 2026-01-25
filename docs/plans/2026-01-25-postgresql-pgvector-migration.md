# PostgreSQL + pgvector Migration Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Migriere die Anwendung von SQLite mit sqlite-vec zu PostgreSQL mit pgvector für native Vektor-Operationen und bessere Skalierbarkeit.

**Architecture:** Die Migration erfolgt in 6 Phasen: Abhängigkeiten, Schema-Umstellung, Connection-Refactoring, RAG-Services auf pgvector umstellen, Datenmigration und Cleanup. Der docker-compose.yml hat bereits einen pgvector-Container vorbereitet (Port 5433).

**Tech Stack:** PostgreSQL 16, pgvector Extension, Drizzle ORM (drizzle-orm/node-postgres), pg Driver

---

## Übersicht

### Was sich ändert

| Komponente        | Vorher (SQLite)             | Nachher (PostgreSQL)    |
| ----------------- | --------------------------- | ----------------------- |
| Database Driver   | better-sqlite3              | pg / node-postgres      |
| Vector Extension  | sqlite-vec                  | pgvector                |
| Embedding Storage | JSON text                   | vector(3072)            |
| Similarity Search | Manuelle cosineSimilarity() | pgvector `<=>` Operator |
| Connection        | File-based                  | Connection Pool         |
| Schema Syntax     | sqliteTable                 | pgTable                 |

### Betroffene Dateien

**Core:**

- `lib/db/index.ts` - Connection Setup
- `lib/db/schema.ts` - 30 Tabellen
- `drizzle.config.ts` - Drizzle Config
- `package.json` - Dependencies

**RAG/Vector Services (8 Dateien mit manueller cosineSimilarity):**

- `lib/rag/retrieval-service.ts`
- `lib/rag/lead-retrieval-service.ts`
- `lib/rag/raw-retrieval-service.ts`
- `lib/rag/actions.ts`
- `lib/deep-scan/experts/base.ts`
- `lib/bids/embedding-service.ts`
- `lib/bids/duplicate-check.ts`

**Docker/Config:**

- `docker-compose.yml` - Already prepared
- `Dockerfile.worker` - DATABASE_URL update
- `.env.local` - DATABASE_URL

---

## Phase 1: Dependencies

### Task 1.1: PostgreSQL Dependencies installieren

**Files:**

- Modify: `package.json`

**Step 1: Dependencies hinzufügen**

```bash
npm install pg drizzle-orm/node-postgres
npm install -D @types/pg drizzle-kit
```

**Step 2: Alte SQLite Dependencies entfernen (später, nach Migration)**

```bash
# NICHT JETZT - erst nach erfolgreicher Migration
# npm uninstall better-sqlite3 sqlite-vec @types/better-sqlite3
```

**Step 3: Verify Installation**

```bash
npm ls pg drizzle-orm
```

Expected: Both packages listed without errors

---

## Phase 2: Drizzle Config umstellen

### Task 2.1: drizzle.config.ts für PostgreSQL

**Files:**

- Modify: `drizzle.config.ts`

**Step 1: Config ändern**

```typescript
import type { Config } from 'drizzle-kit';

export default {
  schema: './lib/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL || 'postgresql://dealhunter:dealhunter@localhost:5433/dealhunter',
  },
} satisfies Config;
```

---

## Phase 3: Schema migrieren (SQLite → PostgreSQL)

### Task 3.1: Schema-Imports ändern

**Files:**

- Modify: `lib/db/schema.ts`

**Step 1: Import-Statement ändern**

```typescript
// VORHER
import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';

// NACHHER
import { pgTable, text, integer, timestamp, boolean, index, vector } from 'drizzle-orm/pg-core';
```

**Step 2: Helper für Vector-Typ definieren**

```typescript
import { customType } from 'drizzle-orm/pg-core';

// pgvector Typ für 3072-dimensionale Embeddings
const vector3072 = customType<{ data: number[]; dpiData: string }>({
  dataType() {
    return 'vector(3072)';
  },
  toDriver(value: number[]): string {
    return `[${value.join(',')}]`;
  },
  fromDriver(value: string): number[] {
    // pgvector returns '[1,2,3]' format
    return JSON.parse(value.replace(/^\[/, '[').replace(/\]$/, ']'));
  },
});
```

### Task 3.2: Tabellen konvertieren (Batch 1 - Core)

**Files:**

- Modify: `lib/db/schema.ts`

**Änderungen pro Tabelle:**

| SQLite                                | PostgreSQL                |
| ------------------------------------- | ------------------------- |
| `sqliteTable`                         | `pgTable`                 |
| `integer('x', { mode: 'timestamp' })` | `timestamp('x')`          |
| `integer('x', { mode: 'boolean' })`   | `boolean('x')`            |
| `text('embedding')` (JSON)            | `vector3072('embedding')` |

**Beispiel: users Tabelle**

```typescript
// VORHER
export const users = sqliteTable('users', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => createId()),
  email: text('email').notNull().unique(),
  password: text('password').notNull(),
  name: text('name').notNull(),
  role: text('role', { enum: ['bd', 'bl', 'admin'] })
    .notNull()
    .default('bd'),
  businessUnitId: text('business_unit_id').references(() => businessUnits.id),
  deletedAt: integer('deleted_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// NACHHER
export const users = pgTable('users', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => createId()),
  email: text('email').notNull().unique(),
  password: text('password').notNull(),
  name: text('name').notNull(),
  role: text('role', { enum: ['bd', 'bl', 'admin'] })
    .notNull()
    .default('bd'),
  businessUnitId: text('business_unit_id').references(() => businessUnits.id),
  deletedAt: timestamp('deleted_at'),
  createdAt: timestamp('created_at').$defaultFn(() => new Date()),
});
```

### Task 3.3: Embedding-Tabellen konvertieren

**Files:**

- Modify: `lib/db/schema.ts`

**dealEmbeddings Tabelle:**

```typescript
// VORHER
export const dealEmbeddings = sqliteTable('deal_embeddings', {
  // ... other fields ...
  embedding: text('embedding'), // JSON array
  // ...
});

// NACHHER
export const dealEmbeddings = pgTable('deal_embeddings', {
  // ... other fields ...
  embedding: vector3072('embedding'), // Native vector type!
  // ...
});
```

**rawChunks Tabelle:**

```typescript
// NACHHER
export const rawChunks = pgTable('raw_chunks', {
  // ... other fields ...
  embedding: vector3072('embedding').notNull(), // Native vector type!
  // ...
});
```

**preQualifications - descriptionEmbedding:**

```typescript
// NACHHER
descriptionEmbedding: vector3072('description_embedding'),
```

### Task 3.4: Alle 30 Tabellen konvertieren

**Tabellen-Liste (in Reihenfolge):**

1. `users`
2. `businessUnits`
3. `preQualifications`
4. `references`
5. `technologies`
6. `accounts`
7. `accountContacts`
8. `quickScans`
9. `qualifications`
10. `websiteAudits`
11. `qualificationSectionData`
12. `cmsMatchResults`
13. `baselineComparisons`
14. `ptEstimations`
15. `referenceMatches`
16. `competitors`
17. `competitorMatches`
18. `dealEmbeddings`
19. `rawChunks`
20. `pitchdecks`
21. `pitchdeckSlides`
22. `pitchdeckTemplates`
23. `backgroundJobs`
24. `sessions`
25. `verificationTokens`
26. Plus Relations (bleiben gleich)

**Konvertierungs-Muster:**

```typescript
// Integer timestamps → PostgreSQL timestamps
integer('created_at', { mode: 'timestamp' }) → timestamp('created_at')

// Integer booleans → PostgreSQL booleans
integer('is_active', { mode: 'boolean' }) → boolean('is_active')

// JSON embeddings → pgvector
text('embedding') → vector3072('embedding')
```

---

## Phase 4: Connection-Layer umstellen

### Task 4.1: Database Connection

**Files:**

- Modify: `lib/db/index.ts`

**Step 1: Neuer Connection Code**

```typescript
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import * as schema from './schema';

// Connection Pool für PostgreSQL
const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL || 'postgresql://dealhunter:dealhunter@localhost:5433/dealhunter',
  max: 20, // Max connections in pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

export const db = drizzle(pool, { schema });

// Graceful shutdown
process.on('SIGTERM', async () => {
  await pool.end();
});
```

**Step 2: pgvector Extension aktivieren (Initial Setup)**

```typescript
// In einer Migration oder Init-Script
async function initPgVector() {
  const client = await pool.connect();
  try {
    await client.query('CREATE EXTENSION IF NOT EXISTS vector');
  } finally {
    client.release();
  }
}
```

---

## Phase 5: RAG Services auf pgvector umstellen

### Task 5.1: Native Vektor-Suche implementieren

**Files:**

- Create: `lib/db/vector-search.ts`

**Step 1: pgvector Similarity Functions**

```typescript
import { sql } from 'drizzle-orm';
import { db } from './index';
import { dealEmbeddings } from './schema';

/**
 * Cosine similarity search using pgvector
 *
 * pgvector operators:
 * - <-> : L2 distance
 * - <=> : Cosine distance (1 - cosine_similarity)
 * - <#> : Inner product (negative)
 */
export async function vectorSimilaritySearch(
  qualificationId: string,
  queryEmbedding: number[],
  options: {
    limit?: number;
    threshold?: number;
    agentNameFilter?: string | string[];
  } = {}
) {
  const { limit = 5, threshold = 0.3, agentNameFilter } = options;

  // pgvector: cosine distance = 1 - cosine_similarity
  // So we need: 1 - distance > threshold, i.e., distance < 1 - threshold
  const distanceThreshold = 1 - threshold;

  const embeddingStr = `[${queryEmbedding.join(',')}]`;

  const results = await db.execute(sql`
    SELECT
      id,
      agent_name,
      chunk_type,
      content,
      metadata,
      chunk_category,
      confidence,
      validated_at,
      1 - (embedding <=> ${embeddingStr}::vector) as similarity
    FROM deal_embeddings
    WHERE qualification_id = ${qualificationId}
      AND embedding IS NOT NULL
      AND (embedding <=> ${embeddingStr}::vector) < ${distanceThreshold}
      ${agentNameFilter ? sql`AND agent_name = ANY(${Array.isArray(agentNameFilter) ? agentNameFilter : [agentNameFilter]})` : sql``}
    ORDER BY embedding <=> ${embeddingStr}::vector
    LIMIT ${limit}
  `);

  return results.rows;
}
```

### Task 5.2: lead-retrieval-service.ts umstellen

**Files:**

- Modify: `lib/rag/lead-retrieval-service.ts`

**Step 1: Import ändern**

```typescript
// ENTFERNEN:
// function cosineSimilarity(vecA: number[], vecB: number[]): number { ... }

// HINZUFÜGEN:
import { vectorSimilaritySearch } from '@/lib/db/vector-search';
```

**Step 2: queryRagForLead() refactoren**

```typescript
export async function queryRagForLead(query: LeadRAGQuery): Promise<LeadRAGResult[]> {
  try {
    // 1. Build question from section template
    let question = query.question;
    if (query.sectionId) {
      const template = getRAGQueryTemplate(query.sectionId);
      if (template) {
        question = query.question ? `${query.question}\n\nContext: ${template}` : template;
      }
    }

    // 2. Generate query embedding
    const queryEmbedding = await generateQueryEmbedding(question);

    if (!queryEmbedding) {
      console.warn('[Lead-RAG] No embeddings available, using fallback');
      // Fallback: Return all chunks without similarity ranking
      return await getFallbackResults(query);
    }

    // 3. Use pgvector native similarity search
    const results = await vectorSimilaritySearch(query.qualificationId, queryEmbedding, {
      limit: query.maxResults || 5,
      threshold: SIMILARITY_THRESHOLD,
      agentNameFilter: query.agentNameFilter,
    });

    // 4. Map to LeadRAGResult format
    return results.map(row => ({
      chunkId: row.id,
      agentName: row.agent_name,
      chunkType: row.chunk_type,
      content: row.content,
      similarity: row.similarity,
      metadata: row.metadata ? JSON.parse(row.metadata) : {},
      sources: [
        {
          agentName: row.agent_name,
          chunkId: row.id,
          chunkType: row.chunk_type,
          relevance: row.similarity,
        },
      ],
      chunkCategory: row.chunk_category,
      chunkConfidence: row.confidence,
      isValidated: row.validated_at !== null,
    }));
  } catch (error) {
    console.error('[Lead-RAG] Query failed:', error);
    return [];
  }
}
```

### Task 5.3: Andere RAG-Services umstellen

**Files zu ändern:**

- `lib/rag/retrieval-service.ts`
- `lib/rag/raw-retrieval-service.ts`
- `lib/rag/actions.ts`
- `lib/deep-scan/experts/base.ts`
- `lib/bids/duplicate-check.ts`

**Muster:**

1. Manuelle `cosineSimilarity()` Funktion entfernen
2. `vectorSimilaritySearch()` importieren und verwenden
3. JSON-Parsing der Embeddings entfernen (pgvector gibt native Arrays zurück)

---

## Phase 6: Embedding-Storage umstellen

### Task 6.1: embedding-service.ts anpassen

**Files:**

- Modify: `lib/rag/embedding-service.ts`

**Änderung: Embedding-Insert**

```typescript
// VORHER
await db.insert(dealEmbeddings).values(
  chunksWithEmbeddings.map(chunk => ({
    // ...
    embedding: JSON.stringify(chunk.embedding), // JSON string
  }))
);

// NACHHER
await db.insert(dealEmbeddings).values(
  chunksWithEmbeddings.map(chunk => ({
    // ...
    embedding: chunk.embedding, // Native number[] - Drizzle/pgvector handles conversion
  }))
);
```

### Task 6.2: bids/embedding-service.ts anpassen

**Files:**

- Modify: `lib/bids/embedding-service.ts`

**Gleiche Änderung wie oben - JSON.stringify entfernen**

---

## Phase 7: Datenmigration

### Task 7.1: PostgreSQL Schema erstellen

**Step 1: Container starten**

```bash
docker compose up -d postgres
```

**Step 2: pgvector Extension aktivieren**

```bash
docker compose exec postgres psql -U dealhunter -d dealhunter -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

**Step 3: Schema generieren**

```bash
npx drizzle-kit generate
```

**Step 4: Schema pushen**

```bash
npx drizzle-kit push
```

### Task 7.2: Daten migrieren (SQLite → PostgreSQL)

**Create: `scripts/migrate-sqlite-to-postgres.ts`**

```typescript
#!/usr/bin/env npx tsx

import Database from 'better-sqlite3';
import { Pool } from 'pg';

const sqliteDb = new Database('./local.db');
const pgPool = new Pool({
  connectionString: 'postgresql://dealhunter:dealhunter@localhost:5433/dealhunter',
});

const TABLES_IN_ORDER = [
  'business_units',
  'users',
  'accounts',
  'account_contacts',
  'pre_qualifications',
  'references',
  'technologies',
  'quick_scans',
  'qualifications',
  'website_audits',
  'qualification_section_data',
  'cms_match_results',
  'baseline_comparisons',
  'pt_estimations',
  'reference_matches',
  'competitors',
  'competitor_matches',
  'deal_embeddings',
  'raw_chunks',
  'pitchdecks',
  'pitchdeck_slides',
  'pitchdeck_templates',
  'background_jobs',
  'sessions',
  'verification_tokens',
];

async function migrateTable(tableName: string) {
  console.log(`Migrating ${tableName}...`);

  const rows = sqliteDb.prepare(`SELECT * FROM ${tableName}`).all();

  if (rows.length === 0) {
    console.log(`  No data in ${tableName}`);
    return;
  }

  const client = await pgPool.connect();
  try {
    // Get column names
    const columns = Object.keys(rows[0]);

    // Handle special conversions
    for (const row of rows) {
      // Convert timestamps (SQLite integer → PostgreSQL timestamp)
      for (const col of columns) {
        if (col.endsWith('_at') && typeof row[col] === 'number') {
          row[col] = new Date(row[col]);
        }
        // Convert embeddings (JSON string → pgvector format)
        if (col === 'embedding' && row[col]) {
          const arr = JSON.parse(row[col]);
          row[col] = `[${arr.join(',')}]`;
        }
        if (col === 'description_embedding' && row[col]) {
          const arr = JSON.parse(row[col]);
          row[col] = `[${arr.join(',')}]`;
        }
      }

      const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
      const values = columns.map(col => row[col]);

      await client.query(
        `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`,
        values
      );
    }

    console.log(`  Migrated ${rows.length} rows`);
  } finally {
    client.release();
  }
}

async function main() {
  console.log('Starting SQLite → PostgreSQL migration...\n');

  for (const table of TABLES_IN_ORDER) {
    await migrateTable(table);
  }

  console.log('\nMigration complete!');

  sqliteDb.close();
  await pgPool.end();
}

main().catch(console.error);
```

**Step 1: Run Migration**

```bash
npx tsx scripts/migrate-sqlite-to-postgres.ts
```

---

## Phase 8: Index-Optimierung für pgvector

### Task 8.1: Vector-Indizes erstellen

**Add to migration or schema:**

```sql
-- IVFFlat Index für schnelle Similarity-Suche
-- Lists = sqrt(n) wo n = erwartete Anzahl Vektoren
CREATE INDEX deal_embeddings_embedding_idx ON deal_embeddings
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

CREATE INDEX raw_chunks_embedding_idx ON raw_chunks
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

CREATE INDEX pre_qualifications_embedding_idx ON pre_qualifications
  USING ivfflat (description_embedding vector_cosine_ops) WITH (lists = 50);
```

**Oder mit Drizzle Schema:**

```typescript
// In schema.ts
export const dealEmbeddings = pgTable(
  'deal_embeddings',
  {
    // ... columns ...
  },
  table => ({
    // ... existing indexes ...
    embeddingIdx: index('deal_embeddings_embedding_idx')
      .using('ivfflat', table.embedding)
      .with({ lists: 100 }),
  })
);
```

---

## Phase 9: Environment & Docker anpassen

### Task 9.1: Environment Variables

**Modify: `.env.local`**

```bash
# VORHER
# DATABASE_URL=file:./local.db

# NACHHER
DATABASE_URL=postgresql://dealhunter:dealhunter@localhost:5433/dealhunter
```

### Task 9.2: Dockerfile.worker anpassen

**Modify: `Dockerfile.worker`**

```dockerfile
# Entfernen: native SQLite module dependencies
# RUN apk add --no-cache python3 make g++ sqlite-dev

# PostgreSQL client libraries hinzufügen (falls nötig)
RUN apk add --no-cache postgresql-client
```

### Task 9.3: docker-compose.yml - Worker DATABASE_URL

**Modify: `docker-compose.yml`**

```yaml
worker:
  # ...
  environment:
    - REDIS_URL=redis://redis:6379
    - DATABASE_URL=postgresql://dealhunter:dealhunter@postgres:5432/dealhunter # Internal Docker network
    # ... other env vars ...
  depends_on:
    redis:
      condition: service_healthy
    postgres:
      condition: service_healthy # ADD THIS
```

---

## Phase 10: Cleanup & Testing

### Task 10.1: SQLite Dependencies entfernen

**After successful migration:**

```bash
npm uninstall better-sqlite3 sqlite-vec @types/better-sqlite3
```

### Task 10.2: Tests ausführen

```bash
# Unit Tests
npm run test

# TypeScript Check
npx tsc --noEmit

# Build
npm run build
```

### Task 10.3: Local Development testen

```bash
# Start PostgreSQL
docker compose up -d postgres

# Start Dev Server
npm run dev

# Test RAG queries
# Navigate to a qualification and trigger DeepScan
```

---

## Rollback-Prozedur

Falls die Migration fehlschlägt oder kritische Probleme auftreten, können folgende Schritte zur Wiederherstellung verwendet werden.

### Voraussetzungen für Rollback

1. **SQLite-Backup:** Die ursprüngliche `data/local.db` Datei muss gesichert sein
2. **Git Branch:** Der Zustand vor der Migration muss in Git verfügbar sein
3. **Dependencies:** Die SQLite-Dependencies sind noch in `package.json` vorhanden

### Schnelles Rollback (Code-Revert)

```bash
# 1. Zur letzten stabilen Version zurückkehren
git checkout main -- lib/db/index.ts lib/db/schema.ts drizzle.config.ts

# 2. Dependencies neu installieren (falls sqlite deps entfernt wurden)
npm install

# 3. Environment auf SQLite zurücksetzen
# In .env.local: DATABASE_URL entfernen/auskommentieren

# 4. Dev Server neustarten
npm run dev
```

### Vollständiges Rollback (mit Datenmigration)

```bash
# 1. PostgreSQL Container stoppen
docker compose stop postgres worker

# 2. SQLite-Backup wiederherstellen
cp data/local.db.backup data/local.db

# 3. Code-Revert durchführen
git checkout <commit-vor-migration> -- .

# 4. Dependencies installieren
npm install

# 5. Dev Server starten
npm run dev
```

### Datenexport aus PostgreSQL (falls Rollback nötig nach Produktiveinsatz)

```bash
# Backup der PostgreSQL-Daten vor Rollback
docker compose exec postgres pg_dump -U dealhunter dealhunter > pg_backup.sql

# Optional: Konvertierung der kritischen Daten zurück zu SQLite
npx tsx scripts/export-pg-to-sqlite.ts
```

### Rollback-Indikatoren

Rollback sollte erwogen werden bei:

- **Performance-Regression:** Query-Zeiten >10x langsamer als SQLite
- **Connection-Probleme:** Pool exhaustion, Timeouts trotz Tuning
- **Kritische Bugs:** Datenverlust, inkorrekte Vektor-Berechnungen
- **Deadline-Druck:** Nicht genug Zeit für Debugging vor Release

### Nach dem Rollback

1. Issues dokumentieren im GitHub Repository
2. Root Cause Analysis durchführen
3. Migration erneut planen mit den gewonnenen Erkenntnissen

---

## Zusammenfassung der Hauptvorteile

1. **Native Vector-Operationen**: pgvector `<=>` Operator statt manueller cosineSimilarity()
2. **Bessere Performance**: IVFFlat/HNSW Indizes für O(log n) statt O(n) Suche
3. **Skalierbarkeit**: Connection Pooling, echte Multi-User-Unterstützung
4. **ACID Compliance**: Echte Transaktionen mit Isolation Levels
5. **Einfachere Deployments**: Standard PostgreSQL statt SQLite + Extensions

---

## Checkliste

- [ ] Phase 1: Dependencies installiert
- [ ] Phase 2: drizzle.config.ts umgestellt
- [ ] Phase 3: Schema migriert (30 Tabellen)
- [ ] Phase 4: Connection-Layer umgestellt
- [ ] Phase 5: RAG Services auf pgvector
- [ ] Phase 6: Embedding-Storage angepasst
- [ ] Phase 7: Daten migriert
- [ ] Phase 8: Vector-Indizes erstellt
- [ ] Phase 9: Environment/Docker angepasst
- [ ] Phase 10: Tests bestanden, Cleanup done
