---
status: pending
priority: p3
issue_id: "055"
tags: [code-review, simplicity, dea-186, yagni]
dependencies: []
---

# Language Detection is Unnecessary Complexity

## Problem Statement

The extraction agent makes an LLM call just to detect document language, but then defaults to English anyway (comment at line 73 admits English is "most common for RFPs"). This adds complexity and cost without clear benefit.

**Why it matters:**
- Extra LLM API call per extraction (~500ms, $0.001)
- Dual-language RAG queries add ~400 LOC
- Language detection is fragile
- English queries work fine for German documents via RAG

## Findings

### Code Simplicity Reviewer Analysis

**Location:** `lib/extraction/agent.ts:48-76`

**Complexity:**
```typescript
async function detectDocumentLanguage(rawText: string): Promise<DocumentLanguage> {
  const sample = rawText.substring(0, 1500);
  const completion = await openai.chat.completions.create({ ... });
  // Returns 'de' or 'en'
}
```

**YAGNI Violation:**
- Line 73 comment: `// Default to 'en' as it's most common for RFPs`
- If English is the default anyway, why detect?

**Dual-Language Overhead:**
Every field in `EXTRACTION_FIELDS` (lines 97-286) has both German and English queries:
```typescript
queries: {
  de: 'Firmenname, Kundenname, Organisation, Auftraggeber...',
  en: 'Company name, customer name, client, organization...',
},
```

## Proposed Solutions

### Option A: Remove Language Detection, Use English Only (Recommended)
**Pros:** Simplest, removes 400+ LOC, saves API call
**Cons:** Slightly less optimized German queries
**Effort:** Medium (2-3 hours)
**Risk:** Low

1. Remove `detectDocumentLanguage()` function
2. Remove `DocumentLanguage` type
3. Keep only English queries in `EXTRACTION_FIELDS`
4. Remove `getFieldQuery()` helper

**Impact:**
- Saves 1 LLM call per extraction
- Removes ~400 LOC
- Simplifies field definitions

### Option B: Simple Heuristic Detection
**Pros:** No API call, still localizes queries
**Cons:** Maintains dual-query complexity
**Effort:** Small (1 hour)
**Risk:** Low

```typescript
function detectLanguageHeuristic(text: string): 'de' | 'en' {
  const germanWords = ['und', 'die', 'der', 'für', 'ist', 'auf'];
  const sample = text.toLowerCase().slice(0, 1000);
  const germanCount = germanWords.filter(w => sample.includes(w)).length;
  return germanCount >= 3 ? 'de' : 'en';
}
```

### Option C: Cache Language Detection
**Pros:** Preserves feature, reduces cost
**Cons:** Maintains complexity
**Effort:** Small (30 minutes)
**Risk:** Low

Store detected language in RFP metadata during upload, reuse for extraction.

## Recommended Action

<!-- Fill during triage -->

## Technical Details

**Affected Files:**
- `lib/extraction/agent.ts:48-76` - Remove function
- `lib/extraction/agent.ts:97-286` - Simplify field definitions
- `lib/extraction/agent.ts:81-83` - Remove `getFieldQuery()`

**Components:** Extraction Agent

**Database Changes:** None required

## Acceptance Criteria

- [ ] Decide: Keep language detection or remove?
- [ ] If remove: Delete function and simplify field definitions
- [ ] If keep: Implement caching or heuristic
- [ ] Verify extraction still works for German documents

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-22 | Created from PR #11 review | Code simplicity reviewer flagged YAGNI violation |

## Resources

- PR: https://github.com/maphilipps/dealhunter/pull/11
- Linear Issue: DEA-186
