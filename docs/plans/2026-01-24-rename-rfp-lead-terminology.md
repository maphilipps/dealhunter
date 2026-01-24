# RFP→PreQualification & Lead→Qualification Rename

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rename all occurrences of "RFP" to "PreQualification" and "Lead" to "Qualification" across the entire codebase.

**Architecture:** Big-bang approach with database schema migration first, then directory restructuring, followed by global find-and-replace. No backwards compatibility - clean rename throughout.

**Tech Stack:** Drizzle ORM (SQLite), Next.js App Router, TypeScript, Vitest

---

## Task 1: Database Schema - Tables & Types

**Files:**
- Modify: `lib/db/schema.ts`

**Step 1: Rename rfps table to pre_qualifications**

Replace:
```typescript
export const rfps = sqliteTable(
  'rfps',
```

With:
```typescript
export const preQualifications = sqliteTable(
  'pre_qualifications',
```

**Step 2: Rename all rfps index names**

Replace:
```typescript
assignedBusinessUnitIdx: index('rfps_assigned_bu_idx').on(table.assignedBusinessUnitId),
statusIdx: index('rfps_status_idx').on(table.status),
userIdIdx: index('rfps_user_id_idx').on(table.userId),
```

With:
```typescript
assignedBusinessUnitIdx: index('pre_qualifications_assigned_bu_idx').on(table.assignedBusinessUnitId),
statusIdx: index('pre_qualifications_status_idx').on(table.status),
userIdIdx: index('pre_qualifications_user_id_idx').on(table.userId),
```

**Step 3: Rename leads table to qualifications**

Replace:
```typescript
export const leads = sqliteTable(
  'leads',
```

With:
```typescript
export const qualifications = sqliteTable(
  'qualifications',
```

**Step 4: Rename all leads index names**

Replace all `leads_` prefixed indexes to `qualifications_` prefixed.

**Step 5: Update type exports**

Replace:
```typescript
export type Rfp = typeof rfps.$inferSelect;
export type NewRfp = typeof rfps.$inferInsert;
// Backwards compatibility aliases
export type RfpOpportunity = Rfp;
export type NewRfpOpportunity = NewRfp;
export type BidOpportunity = Rfp;
export type NewBidOpportunity = NewRfp;
```

With:
```typescript
export type PreQualification = typeof preQualifications.$inferSelect;
export type NewPreQualification = typeof preQualifications.$inferInsert;
```

Replace:
```typescript
export type Lead = typeof leads.$inferSelect;
export type NewLead = typeof leads.$inferInsert;
```

With:
```typescript
export type Qualification = typeof qualifications.$inferSelect;
export type NewQualification = typeof qualifications.$inferInsert;
```

**Step 6: Commit**

```bash
git add lib/db/schema.ts
git commit -m "refactor(db): rename rfps→pre_qualifications, leads→qualifications tables

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 2: Database Schema - Foreign Keys

**Files:**
- Modify: `lib/db/schema.ts`

**Step 1: Update rfpId references in all tables**

For each table with `rfpId`:
- `quickScans.rfpId` → `quickScans.preQualificationId`
- `deepMigrationAnalyses.rfpId` → `deepMigrationAnalyses.preQualificationId`
- `documents.rfpId` → `documents.preQualificationId`
- `teamAssignments.rfpId` → `teamAssignments.preQualificationId`
- `subjectiveAssessments.rfpId` → `subjectiveAssessments.preQualificationId`
- `backgroundJobs.rfpId` → `backgroundJobs.preQualificationId`
- `qualifications.rfpId` → `qualifications.preQualificationId`
- `dealEmbeddings.rfpId` → `dealEmbeddings.preQualificationId`
- `rawChunks.rfpId` → `rawChunks.preQualificationId`

**Step 2: Update leadId references in all tables**

For each table with `leadId`:
- `leadSectionData.leadId` → `qualificationSectionData.qualificationId` (also rename table)
- `websiteAudits.leadId` → `websiteAudits.qualificationId`
- `cmsMatchResults.leadId` → `cmsMatchResults.qualificationId`
- `baselineComparisons.leadId` → `baselineComparisons.qualificationId`
- `ptEstimations.leadId` → `ptEstimations.qualificationId`
- `referenceMatches.leadId` → `referenceMatches.qualificationId`
- `competitorMatches.leadId` → `competitorMatches.qualificationId`
- `pitchdecks.leadId` → `pitchdecks.qualificationId`
- `dealEmbeddings.leadId` → `dealEmbeddings.qualificationId`

**Step 3: Update index names for foreign keys**

All indexes with `rfp_idx` suffix → `pre_qualification_idx`
All indexes with `lead_idx` suffix → `qualification_idx`

**Step 4: Commit**

```bash
git add lib/db/schema.ts
git commit -m "refactor(db): rename rfpId→preQualificationId, leadId→qualificationId FKs

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 3: Database Schema - Relations

**Files:**
- Modify: `lib/db/schema.ts`

**Step 1: Rename relation definitions**

Replace all:
- `rfpsRelations` → `preQualificationsRelations`
- `leadsRelations` → `qualificationsRelations`
- `leadSectionData` → `qualificationSectionData`
- `leadSectionDataRelations` → `qualificationSectionDataRelations`

**Step 2: Update relation field references**

Replace all:
- `rfps: many(rfps)` → `preQualifications: many(preQualifications)`
- `rfp: one(rfps, ...)` → `preQualification: one(preQualifications, ...)`
- `leads: many(leads)` → `qualifications: many(qualifications)`
- `lead: one(leads, ...)` → `qualification: one(qualifications, ...)`

**Step 3: Update auditTrails entityType enum**

Replace:
```typescript
entityType: text('entity_type', {
  enum: [
    'rfp',
    'lead',
    ...
  ],
}).notNull(),
```

With:
```typescript
entityType: text('entity_type', {
  enum: [
    'pre_qualification',
    'qualification',
    ...
  ],
}).notNull(),
```

**Step 4: Commit**

```bash
git add lib/db/schema.ts
git commit -m "refactor(db): update relations and entity types

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 4: Rename lib/rfps/ → lib/pre-qualifications/

**Files:**
- Move: `lib/rfps/` → `lib/pre-qualifications/`

**Step 1: Move directory**

```bash
git mv lib/rfps lib/pre-qualifications
```

**Step 2: Rename files**

```bash
# Files stay same name, content will be updated in global replace
```

**Step 3: Commit**

```bash
git add .
git commit -m "refactor: move lib/rfps → lib/pre-qualifications

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 5: Rename lib/leads/ → lib/qualifications/

**Files:**
- Move: `lib/leads/` → `lib/qualifications/`

**Step 1: Move directory**

```bash
git mv lib/leads lib/qualifications
```

**Step 2: Commit**

```bash
git add .
git commit -m "refactor: move lib/leads → lib/qualifications

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 6: Rename components/rfps/ → components/pre-qualifications/

**Files:**
- Move: `components/rfps/` → `components/pre-qualifications/`

**Step 1: Move directory**

```bash
git mv components/rfps components/pre-qualifications
```

**Step 2: Commit**

```bash
git add .
git commit -m "refactor: move components/rfps → components/pre-qualifications

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 7: Rename components/leads/ → components/qualifications/

**Files:**
- Move: `components/leads/` → `components/qualifications/`

**Step 1: Move directory and rename lead-specific files**

```bash
git mv components/leads components/qualifications
git mv components/qualifications/lead-overview-client.tsx components/qualifications/qualification-overview-client.tsx
git mv components/qualifications/lead-sidebar-right.tsx components/qualifications/qualification-sidebar-right.tsx
git mv components/qualifications/leads-empty-state-client.tsx components/qualifications/qualifications-empty-state-client.tsx
```

**Step 2: Commit**

```bash
git add .
git commit -m "refactor: move components/leads → components/qualifications

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 8: Rename API Routes - RFPs

**Files:**
- Move: `app/api/rfps/` → `app/api/pre-qualifications/`

**Step 1: Move directory**

```bash
git mv app/api/rfps app/api/pre-qualifications
```

**Step 2: Commit**

```bash
git add .
git commit -m "refactor: move app/api/rfps → app/api/pre-qualifications

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 9: Rename API Routes - Leads

**Files:**
- Move: `app/api/leads/` → `app/api/qualifications/`

**Step 1: Move directory**

```bash
git mv app/api/leads app/api/qualifications
```

**Step 2: Commit**

```bash
git add .
git commit -m "refactor: move app/api/leads → app/api/qualifications

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 10: Rename App Pages - RFPs

**Files:**
- Move: `app/(dashboard)/rfps/` → `app/(dashboard)/pre-qualifications/`

**Step 1: Move directory**

```bash
git mv "app/(dashboard)/rfps" "app/(dashboard)/pre-qualifications"
```

**Step 2: Commit**

```bash
git add .
git commit -m "refactor: move app/(dashboard)/rfps → app/(dashboard)/pre-qualifications

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 11: Rename App Pages - Leads

**Files:**
- Move: `app/(dashboard)/leads/` → `app/(dashboard)/qualifications/`

**Step 1: Move directory**

```bash
git mv "app/(dashboard)/leads" "app/(dashboard)/qualifications"
```

**Step 2: Commit**

```bash
git add .
git commit -m "refactor: move app/(dashboard)/leads → app/(dashboard)/qualifications

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 12: Rename Agent Tool Files

**Files:**
- Modify: `lib/agent-tools/tools/rfp.ts` → `lib/agent-tools/tools/pre-qualification.ts`
- Modify: `lib/agent-tools/tools/lead.ts` → `lib/agent-tools/tools/qualification.ts`

**Step 1: Move files**

```bash
git mv lib/agent-tools/tools/rfp.ts lib/agent-tools/tools/pre-qualification.ts
git mv lib/agent-tools/tools/lead.ts lib/agent-tools/tools/qualification.ts
```

**Step 2: Commit**

```bash
git add .
git commit -m "refactor: rename agent tool files rfp→pre-qualification, lead→qualification

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 13: Rename Expert Agents

**Files:**
- Move: `lib/agents/expert-agents/legal-rfp-agent.ts` → `lib/agents/expert-agents/legal-pre-qualification-agent.ts`
- Move: `lib/agents/expert-agents/legal-rfp-schema.ts` → `lib/agents/expert-agents/legal-pre-qualification-schema.ts`

**Step 1: Move files**

```bash
git mv lib/agents/expert-agents/legal-rfp-agent.ts lib/agents/expert-agents/legal-pre-qualification-agent.ts
git mv lib/agents/expert-agents/legal-rfp-schema.ts lib/agents/expert-agents/legal-pre-qualification-schema.ts
```

**Step 2: Commit**

```bash
git add .
git commit -m "refactor: rename legal-rfp-agent → legal-pre-qualification-agent

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 14: Rename Test Files

**Files:**
- Move: `tests/integration/rfp-extraction-flow.test.ts` → `tests/integration/pre-qualification-extraction-flow.test.ts`
- Move: `lib/rag/__tests__/lead-retrieval-service.test.ts` → `lib/rag/__tests__/qualification-retrieval-service.test.ts`

**Step 1: Move files**

```bash
git mv tests/integration/rfp-extraction-flow.test.ts tests/integration/pre-qualification-extraction-flow.test.ts
git mv lib/rag/__tests__/lead-retrieval-service.test.ts lib/rag/__tests__/qualification-retrieval-service.test.ts
```

**Step 2: Commit**

```bash
git add .
git commit -m "refactor: rename test files for new terminology

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 15: Global Replace - RFP Terms (TypeScript/Code)

**Files:**
- All `.ts`, `.tsx` files

**Step 1: Replace type names (case-sensitive, word boundary)**

Using sed or manual replacement:
- `\bRfp\b` → `PreQualification`
- `\brfp\b` → `preQualification`
- `\bRFP\b` → `PRE_QUALIFICATION`
- `\bRfps\b` → `PreQualifications`
- `\brfps\b` → `preQualifications`
- `\bRFPS\b` → `PRE_QUALIFICATIONS`

**Note:** Be careful with:
- `rfpId` → `preQualificationId`
- `/rfps` (URL) → `/pre-qualifications`
- `'rfp'` (string literal) → `'pre_qualification'`

**Step 2: Run TypeScript check**

```bash
npm run typecheck
```

**Step 3: Fix remaining errors iteratively**

**Step 4: Commit**

```bash
git add .
git commit -m "refactor: global replace RFP→PreQualification

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 16: Global Replace - Lead Terms (TypeScript/Code)

**Files:**
- All `.ts`, `.tsx` files

**Step 1: Replace type names (case-sensitive, word boundary)**

Using sed or manual replacement:
- `\bLead\b` → `Qualification` (careful: not `Leading`, `Leadership`, etc.)
- `\blead\b` → `qualification` (careful: not `leading`, etc.)
- `\bLEAD\b` → `QUALIFICATION`
- `\bLeads\b` → `Qualifications`
- `\bleads\b` → `qualifications`
- `\bLEADS\b` → `QUALIFICATIONS`

**Note:** Be careful with:
- `leadId` → `qualificationId`
- `/leads` (URL) → `/qualifications`
- `'lead'` (string literal) → `'qualification'`
- Don't replace `teamLead`, `Leading`, `leadership`

**Step 2: Run TypeScript check**

```bash
npm run typecheck
```

**Step 3: Fix remaining errors iteratively**

**Step 4: Commit**

```bash
git add .
git commit -m "refactor: global replace Lead→Qualification

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 17: Update UI Labels

**Files:**
- Search for German labels like "RFP", "RFPs", "Lead", "Leads"

**Step 1: Find and replace UI strings**

Common replacements:
- `"RFPs"` → `"Pre-Qualifications"` (Navigation)
- `"RFP"` → `"Pre-Qualification"` (Detail pages)
- `"Leads"` → `"Qualifications"` (Navigation)
- `"Lead"` → `"Qualification"` (Detail pages)
- `"Neue RFP"` → `"Neue Pre-Qualification"`

**Step 2: Commit**

```bash
git add .
git commit -m "refactor(ui): update labels RFP→Pre-Qualification, Lead→Qualification

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 18: Update Navigation Config

**Files:**
- Modify: `lib/pre-qualifications/navigation.ts`
- Modify: `lib/qualifications/navigation-config.ts`

**Step 1: Update constant names**

Replace:
- `RFP_NAVIGATION_SECTIONS` → `PRE_QUALIFICATION_NAVIGATION_SECTIONS`
- `LEAD_NAVIGATION_SECTIONS` → `QUALIFICATION_NAVIGATION_SECTIONS`

**Step 2: Update route paths**

Replace:
- `'/rfps'` → `'/pre-qualifications'`
- `'/leads'` → `'/qualifications'`

**Step 3: Commit**

```bash
git add .
git commit -m "refactor: update navigation config constants

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 19: Update Test Factories

**Files:**
- Modify: `tests/utils/factories.ts`

**Step 1: Rename factory functions**

Replace:
- `createRfp()` → `createPreQualification()`
- `createLead()` → `createQualification()`

**Step 2: Update factory implementations**

Update table references and field names.

**Step 3: Commit**

```bash
git add .
git commit -m "refactor(tests): rename factories createRfp→createPreQualification

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 20: Update Middleware

**Files:**
- Modify: `middleware.ts`

**Step 1: Update route matchers**

Replace any `/rfps` or `/leads` route matchers with new paths.

**Step 2: Commit**

```bash
git add .
git commit -m "refactor: update middleware route matchers

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 21: Verification - TypeScript

**Step 1: Run TypeScript check**

```bash
npm run typecheck
```

Expected: No errors

**Step 2: Fix any remaining type errors**

---

## Task 22: Verification - Linting

**Step 1: Run ESLint**

```bash
npm run lint
```

Expected: No errors (or only pre-existing ones)

**Step 2: Fix any new lint errors**

---

## Task 23: Verification - Tests

**Step 1: Run unit tests**

```bash
npm run test
```

Expected: All tests pass

**Step 2: Fix any failing tests**

---

## Task 24: Verification - Build

**Step 1: Run build**

```bash
npm run build
```

Expected: Build succeeds

**Step 2: Fix any build errors**

---

## Task 25: Database Migration

**Step 1: Push schema changes**

```bash
npm run db:push
```

Expected: Schema updates successfully

**Step 2: Verify tables renamed**

```bash
npx drizzle-kit studio
```

Check that tables are named `pre_qualifications` and `qualifications`.

---

## Task 26: Final Commit & Document Progress

**Step 1: Commit any remaining changes**

```bash
git add .
git commit -m "chore: final cleanup for terminology rename

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

**Step 2: Update GitHub Issue #27 with completion status**

Add comment with:
- List of renamed files/directories
- Verification results (typecheck, lint, test, build)
- Any known issues or follow-ups

---

## Success Criteria

- [ ] All TypeScript compiles without errors
- [ ] All tests pass
- [ ] All linting passes
- [ ] Dev server starts successfully
- [ ] Database schema shows new table names
- [ ] Navigation shows "Pre-Qualifications" and "Qualifications"
- [ ] URLs use `/pre-qualifications` and `/qualifications`
