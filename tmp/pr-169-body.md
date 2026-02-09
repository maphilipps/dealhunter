## Summary\n- Replace sidebar stepper with chat-first streaming UI for Pitch Scan runs.\n- Emit  +  events over the existing Redis-backed SSE channel.\n- Add collapsible result cards that fetch full section content on expand.\n\n## Issues\n- Fixes #165\n- Fixes #166\n\n## Testing\n- 
> lead-agent@0.1.0 typecheck
> tsc --noEmit\n- 
> lead-agent@0.1.0 test:run
> vitest run


 RUN  v4.0.18 /Users/marc.philipps/Sites/dealhunter

 ✓ tests/unit/ai-elements/shimmer.test.tsx (7 tests) 530ms
     ✓ applies default animation duration of 2s  401ms
 ✓ tests/unit/ai-elements/conversation.test.tsx (11 tests) 448ms
     ✓ renders with role="log" for accessibility  417ms
 ✓ tests/unit/ai-elements/prompt-input.test.tsx (13 tests) 404ms
 ✓ tests/unit/ai-elements/confidence-indicator.test.tsx (20 tests) 650ms
 ✓ tests/unit/ai-elements/reasoning.test.tsx (13 tests) 718ms
 ✓ tests/unit/ai-elements/sources.test.tsx (8 tests) 832ms
     ✓ renders trigger with correct source count  356ms
 ✓ tests/unit/ai-elements/abort-button.test.tsx (7 tests) 1073ms
     ✓ renders button with German label  380ms
     ✓ shows confirmation dialog when clicked  408ms
 ✓ lib/deep-analysis/__tests__/xxe-protection.test.ts (18 tests) 98ms
 ✓ tests/unit/ai-elements/activity-stream.test.tsx (24 tests) 582ms
 ✓ tests/unit/ai-elements/agent-message.test.tsx (26 tests) 1537ms
     ✓ calls onCopy when button clicked  794ms
 ✓ tests/unit/ai-elements/agent-activity-view.test.tsx (35 tests) 1163ms
     ✓ shows empty state with loader when streaming with no events  504ms
 ✓ tests/unit/qualification-scan/use-qualifications-scan-progress.test.ts (12 tests) 57ms
 ✓ lib/errors/__tests__/retry.test.ts (25 tests) 120ms
 ✓ tests/unit/ai-elements/loader.test.tsx (8 tests) 82ms
 ✓ tests/unit/qualification-scan/export/pdf-exporter.test.ts (15 tests) 50ms
 ✓ lib/deep-analysis/__tests__/xss-validation.test.ts (18 tests) 31ms
 ✓ tests/integration/pre-qualification-extraction-flow.test.ts (10 tests) 65ms
 ✓ tests/unit/qualification-scan/export/markdown-builder.test.ts (5 tests) 73ms
 ✓ lib/estimations/__tests__/pt-calculator.test.ts (25 tests) 32ms
 ✓ lib/cms-matching/__tests__/matcher.test.ts (25 tests) 91ms
 ✓ tests/unit/ai-elements/message.test.tsx (17 tests) 343ms
 ✓ lib/agents/__tests__/migration-complexity-agent.test.ts (23 tests) 46ms
 ✓ tests/unit/qualification-scan/export/word-exporter.test.ts (9 tests) 26ms
 ✓ lib/pitchdeck/__tests__/timeline-calculator.test.ts (31 tests) 16ms
 ✓ lib/agents/__tests__/content-architecture-agent.test.ts (7 tests) 15ms
 ✓ tests/unit/qualification-scan/rescan-api.test.ts (6 tests) 14ms
 ✓ tests/unit/extraction-schema.test.ts (18 tests) 15ms
stdout | lib/rag/__tests__/raw-embedding-service.test.ts > raw-embedding-service > embedRawText > should return skipped when embeddings are disabled
[RAG-RAW] Embedded 1 chunks (128 tokens) for qualification preQualification-123

stdout | lib/rag/__tests__/raw-embedding-service.test.ts > raw-embedding-service > embedRawText > should return success with zero chunks for empty text
[RAG-RAW] No chunks generated for qualification preQualification-123 - text too short or empty

stdout | lib/rag/__tests__/raw-embedding-service.test.ts > raw-embedding-service > embedRawText > should embed text and store in database
[RAG-RAW] Embedded 1 chunks (290 tokens) for qualification preQualification-123

 ✓ lib/rag/__tests__/raw-embedding-service.test.ts (14 tests) 23ms
 ✓ tests/unit/embedding-service.test.ts (38 tests) 34ms
stdout | lib/rag/__tests__/raw-retrieval-service.test.ts > raw-retrieval-service > queryRawChunks > should filter results by similarity threshold (>0.7)
[RAG-RAW] Query "Budget..." - Top similarities: [1.000, -1.000], Threshold: 0.2

stdout | lib/rag/__tests__/raw-retrieval-service.test.ts > raw-retrieval-service > queryRawChunks > should sort results by similarity in descending order
[RAG-RAW] Query "Budget..." - Top similarities: [1.000, 1.000], Threshold: 0.2

stdout | lib/rag/__tests__/raw-retrieval-service.test.ts > raw-retrieval-service > queryRawChunks > should respect maxResults parameter
[RAG-RAW] Query "Content..." - Top similarities: [1.000, 1.000, 1.000], Threshold: 0.2

stdout | lib/rag/__tests__/raw-retrieval-service.test.ts > raw-retrieval-service > queryMultipleTopics > should query multiple topics in parallel
[RAG-RAW] Query "Budget..." - Top similarities: [1.000], Threshold: 0.2
[RAG-RAW] Query "Kontakt..." - Top similarities: [1.000], Threshold: 0.2

 ✓ lib/rag/__tests__/raw-retrieval-service.test.ts (14 tests) 83ms
stdout | lib/rag/__tests__/qualification-retrieval-service.test.ts > lead-retrieval-service > queryRagForLead > should query dealEmbeddings directly by leadId
[Lead-RAG] Query for qualification lead-123: "What is the current CMS?..."

stdout | lib/rag/__tests__/qualification-retrieval-service.test.ts > lead-retrieval-service > queryRagForLead > should query dealEmbeddings directly by leadId
[Lead-RAG] Found 1 chunks in lead_embeddings

stdout | lib/rag/__tests__/qualification-retrieval-service.test.ts > lead-retrieval-service > queryRagForLead > should query dealEmbeddings directly by leadId
[Lead-RAG] 1 chunks above threshold 0.3

stdout | lib/rag/__tests__/qualification-retrieval-service.test.ts > lead-retrieval-service > queryRagForLead > should return empty array when no embeddings found
[Lead-RAG] Query for qualification lead-nonexistent: "Test..."

stdout | lib/rag/__tests__/qualification-retrieval-service.test.ts > lead-retrieval-service > queryRagForLead > should return empty array when no embeddings found
[Lead-RAG] Found 0 chunks in lead_embeddings

stdout | lib/rag/__tests__/qualification-retrieval-service.test.ts > lead-retrieval-service > queryRagForLead > should use section RAG template when sectionId provided
[Lead-RAG] Query for qualification lead-123: "What is the current technology stack including CMS..."

stdout | lib/rag/__tests__/qualification-retrieval-service.test.ts > lead-retrieval-service > queryRagForLead > should use section RAG template when sectionId provided
[Lead-RAG] Found 1 chunks in lead_embeddings

stdout | lib/rag/__tests__/qualification-retrieval-service.test.ts > lead-retrieval-service > queryRagForLead > should use section RAG template when sectionId provided
[Lead-RAG] 1 chunks above threshold 0.3

stdout | lib/rag/__tests__/qualification-retrieval-service.test.ts > lead-retrieval-service > queryRagForLead > should filter by single agent name
[Lead-RAG] Query for qualification lead-123: "Test..."

stdout | lib/rag/__tests__/qualification-retrieval-service.test.ts > lead-retrieval-service > queryRagForLead > should filter by single agent name
[Lead-RAG] Found 2 chunks in lead_embeddings

stdout | lib/rag/__tests__/qualification-retrieval-service.test.ts > lead-retrieval-service > queryRagForLead > should filter by single agent name
[Lead-RAG] 2 chunks above threshold 0.3

stdout | lib/rag/__tests__/qualification-retrieval-service.test.ts > lead-retrieval-service > queryRagForLead > should filter by multiple agent names
[Lead-RAG] Query for qualification lead-123: "Test..."

stdout | lib/rag/__tests__/qualification-retrieval-service.test.ts > lead-retrieval-service > queryRagForLead > should filter by multiple agent names
[Lead-RAG] Found 3 chunks in lead_embeddings

stdout | lib/rag/__tests__/qualification-retrieval-service.test.ts > lead-retrieval-service > queryRagForLead > should filter by multiple agent names
[Lead-RAG] 3 chunks above threshold 0.3

stdout | lib/rag/__tests__/qualification-retrieval-service.test.ts > lead-retrieval-service > queryRagForLead > should fallback to all results if agent filter yields no results
[Lead-RAG] Query for qualification lead-123: "Test..."

stdout | lib/rag/__tests__/qualification-retrieval-service.test.ts > lead-retrieval-service > queryRagForLead > should fallback to all results if agent filter yields no results
[Lead-RAG] Found 1 chunks in lead_embeddings

stdout | lib/rag/__tests__/qualification-retrieval-service.test.ts > lead-retrieval-service > queryRagForLead > should fallback to all results if agent filter yields no results
[Lead-RAG] 1 chunks above threshold 0.3

stdout | lib/rag/__tests__/qualification-retrieval-service.test.ts > lead-retrieval-service > queryRagForLead > should handle errors gracefully
[Lead-RAG] Query for qualification lead-123: "Test..."

stdout | lib/rag/__tests__/qualification-retrieval-service.test.ts > lead-retrieval-service > batchQuerySections > should query multiple sections in parallel
[Lead-RAG] Query for qualification lead-123: "Tech stack template

Context: Budget template..."
[Lead-RAG] Query for qualification lead-123: "What is the current technology stack including CMS..."
[Lead-RAG] Found 1 chunks in lead_embeddings
[Lead-RAG] Found 1 chunks in lead_embeddings
[Lead-RAG] 1 chunks above threshold 0.3
[Lead-RAG] 1 chunks above threshold 0.3

stdout | lib/rag/__tests__/qualification-retrieval-service.test.ts > lead-retrieval-service > batchQuerySections > should calculate confidence scores for each section
[Lead-RAG] Query for qualification lead-123: "Test template

Context: Test template..."

stdout | lib/rag/__tests__/qualification-retrieval-service.test.ts > lead-retrieval-service > batchQuerySections > should calculate confidence scores for each section
[Lead-RAG] Found 1 chunks in lead_embeddings

stdout | lib/rag/__tests__/qualification-retrieval-service.test.ts > lead-retrieval-service > batchQuerySections > should calculate confidence scores for each section
[Lead-RAG] 1 chunks above threshold 0.3

stdout | lib/rag/__tests__/qualification-retrieval-service.test.ts > lead-retrieval-service > batchQuerySections > should mark sections with no data
[Lead-RAG] Query for qualification lead-123: "Test template

Context: Test template..."

stdout | lib/rag/__tests__/qualification-retrieval-service.test.ts > lead-retrieval-service > batchQuerySections > should mark sections with no data
[Lead-RAG] Found 0 chunks in lead_embeddings

stdout | lib/rag/__tests__/qualification-retrieval-service.test.ts > lead-retrieval-service > queryMultipleAgents > should query multiple agents in parallel
[Lead-RAG] Query for qualification lead-123: "Test question..."
[Lead-RAG] Query for qualification lead-123: "Test question..."
[Lead-RAG] Found 2 chunks in lead_embeddings
[Lead-RAG] Found 2 chunks in lead_embeddings
[Lead-RAG] 2 chunks above threshold 0.3
[Lead-RAG] 2 chunks above threshold 0.3

 ✓ lib/rag/__tests__/qualification-retrieval-service.test.ts (24 tests) 27ms
 ✓ tests/unit/qualification-scan/notes/actions.test.ts (13 tests) 19ms
 ✓ tests/unit/navigation-config.test.ts (34 tests) 7ms
 ✓ tests/unit/qualification-scan/steps/industry-scoring.test.ts (11 tests) 8ms
stdout | lib/research/__tests__/web-research-service.test.ts > web-research-service > rate limiting > should allow requests within rate limit
[WEB-RESEARCH] Starting research for: "Test query 1" (section: overview)
[WEB-RESEARCH] Exa API key not configured, skipping Exa search

stdout | lib/research/__tests__/web-research-service.test.ts > web-research-service > rate limiting > should allow requests within rate limit
[WEB-RESEARCH] Falling back to native web search
[WEB-RESEARCH] Native web search not yet implemented (query: "Test query 1", maxResults: 3)

stdout | lib/research/__tests__/web-research-service.test.ts > web-research-service > rate limiting > should block requests exceeding rate limit
[WEB-RESEARCH] Starting research for: "Test query 0" (section: overview)
[WEB-RESEARCH] Exa API key not configured, skipping Exa search

stdout | lib/research/__tests__/web-research-service.test.ts > web-research-service > rate limiting > should block requests exceeding rate limit
[WEB-RESEARCH] Falling back to native web search
[WEB-RESEARCH] Native web search not yet implemented (query: "Test query 0", maxResults: 3)

stdout | lib/research/__tests__/web-research-service.test.ts > web-research-service > rate limiting > should block requests exceeding rate limit
[WEB-RESEARCH] Starting research for: "Test query 1" (section: overview)
[WEB-RESEARCH] Exa API key not configured, skipping Exa search

stdout | lib/research/__tests__/web-research-service.test.ts > web-research-service > rate limiting > should block requests exceeding rate limit
[WEB-RESEARCH] Falling back to native web search
[WEB-RESEARCH] Native web search not yet implemented (query: "Test query 1", maxResults: 3)

stdout | lib/research/__tests__/web-research-service.test.ts > web-research-service > rate limiting > should block requests exceeding rate limit
[WEB-RESEARCH] Starting research for: "Test query 2" (section: overview)
[WEB-RESEARCH] Exa API key not configured, skipping Exa search

stdout | lib/research/__tests__/web-research-service.test.ts > web-research-service > rate limiting > should block requests exceeding rate limit
[WEB-RESEARCH] Falling back to native web search
[WEB-RESEARCH] Native web search not yet implemented (query: "Test query 2", maxResults: 3)

stdout | lib/research/__tests__/web-research-service.test.ts > web-research-service > rate limiting > should block requests exceeding rate limit
[WEB-RESEARCH] Starting research for: "Test query 3" (section: overview)
[WEB-RESEARCH] Exa API key not configured, skipping Exa search

stdout | lib/research/__tests__/web-research-service.test.ts > web-research-service > rate limiting > should block requests exceeding rate limit
[WEB-RESEARCH] Falling back to native web search
[WEB-RESEARCH] Native web search not yet implemented (query: "Test query 3", maxResults: 3)

stdout | lib/research/__tests__/web-research-service.test.ts > web-research-service > rate limiting > should block requests exceeding rate limit
[WEB-RESEARCH] Starting research for: "Test query 4" (section: overview)
[WEB-RESEARCH] Exa API key not configured, skipping Exa search

stdout | lib/research/__tests__/web-research-service.test.ts > web-research-service > rate limiting > should block requests exceeding rate limit
[WEB-RESEARCH] Falling back to native web search
[WEB-RESEARCH] Native web search not yet implemented (query: "Test query 4", maxResults: 3)

stdout | lib/research/__tests__/web-research-service.test.ts > web-research-service > Exa API integration > should skip Exa API when API key is not configured
[WEB-RESEARCH] Starting research for: "Test query" (section: overview)
[WEB-RESEARCH] Exa API key not configured, skipping Exa search

stdout | lib/research/__tests__/web-research-service.test.ts > web-research-service > Exa API integration > should skip Exa API when API key is not configured
[WEB-RESEARCH] Falling back to native web search
[WEB-RESEARCH] Native web search not yet implemented (query: "Test query", maxResults: 3)

stdout | lib/research/__tests__/web-research-service.test.ts > web-research-service > Exa API integration > should use Exa API when configured
[WEB-RESEARCH] Starting research for: "Test query" (section: overview)

 ✓ lib/pitch/audit/__tests__/complexity-scorer.test.ts (10 tests) 6ms
stdout | lib/research/__tests__/web-research-service.test.ts > web-research-service > Exa API integration > should use Exa API when configured
[WEB-RESEARCH] Found 1 results from exa

stdout | lib/research/__tests__/web-research-service.test.ts > web-research-service > Exa API integration > should fallback to native search when Exa fails
[WEB-RESEARCH] Starting research for: "Test query" (section: overview)

stdout | lib/research/__tests__/web-research-service.test.ts > web-research-service > Exa API integration > should fallback to native search when Exa fails
[WEB-RESEARCH] Falling back to native web search
[WEB-RESEARCH] Native web search not yet implemented (query: "Test query", maxResults: 3)

stdout | lib/research/__tests__/web-research-service.test.ts > web-research-service > result processing > should return empty results when no search results found
[WEB-RESEARCH] Starting research for: "Test query" (section: overview)
[WEB-RESEARCH] Exa API key not configured, skipping Exa search

stdout | lib/research/__tests__/web-research-service.test.ts > web-research-service > result processing > should return empty results when no search results found
[WEB-RESEARCH] Falling back to native web search
[WEB-RESEARCH] Native web search not yet implemented (query: "Test query", maxResults: 3)

stdout | lib/research/__tests__/web-research-service.test.ts > web-research-service > result processing > should respect maxResults parameter
[WEB-RESEARCH] Starting research for: "Test query" (section: overview)

stdout | lib/research/__tests__/web-research-service.test.ts > web-research-service > result processing > should respect maxResults parameter
[WEB-RESEARCH] Falling back to native web search
[WEB-RESEARCH] Native web search not yet implemented (query: "Test query", maxResults: 2)

stdout | lib/research/__tests__/web-research-service.test.ts > web-research-service > error handling > should handle network errors gracefully
[WEB-RESEARCH] Starting research for: "Test query" (section: overview)

stdout | lib/research/__tests__/web-research-service.test.ts > web-research-service > error handling > should handle network errors gracefully
[WEB-RESEARCH] Falling back to native web search
[WEB-RESEARCH] Native web search not yet implemented (query: "Test query", maxResults: 3)

stdout | lib/research/__tests__/web-research-service.test.ts > web-research-service > error handling > should handle malformed API responses
[WEB-RESEARCH] Starting research for: "Test query" (section: overview)

stdout | lib/research/__tests__/web-research-service.test.ts > web-research-service > error handling > should handle malformed API responses
[WEB-RESEARCH] Falling back to native web search
[WEB-RESEARCH] Native web search not yet implemented (query: "Test query", maxResults: 3)

 ✓ lib/research/__tests__/web-research-service.test.ts (10 tests) 17ms
 ✓ lib/agent-tools/tools/__tests__/staffing.test.ts (24 tests) 11ms
 ✓ tests/unit/qualification-scan/steps/competitor-detection.test.ts (14 tests) 8ms
 ✓ lib/security/__tests__/prompt-sanitizer.test.ts (34 tests) 6ms
 ✓ tests/unit/qualification-scan/steps/executive-summary.test.ts (18 tests) 9ms
 ✓ lib/rag/__tests__/raw-chunk-service.test.ts (12 tests) 4ms
 ✓ lib/deep-analysis/__tests__/ssrf-protection.test.ts (38 tests) 5ms
 ✓ tests/unit/agent-tools-phase3.test.ts (14 tests) 6ms
 ✓ lib/errors/__tests__/classification.test.ts (38 tests) 6ms
 ✓ lib/config/__tests__/business-rules.test.ts (48 tests) 8ms
 ✓ tests/unit/qualification-scan/steps/cms-matrix.test.ts (7 tests) 5ms
 ✓ tests/unit/qualification-scan/steps/effort-estimation.test.ts (25 tests) 4ms
 ✓ tests/unit/quick-scan/playwright.test.ts (23 tests) 3ms
 ✓ tests/unit/qualification-scan/steps/budget-indicator.test.ts (18 tests) 4ms
 ✓ tests/unit/schema-validation.test.ts (5 tests) 6ms
 ✓ tests/unit/duplicate-check.test.ts (18 tests) 3ms
 ✓ tests/unit/agent-tools-issue-141.test.ts (6 tests) 3ms
 ✓ lib/timeline/__tests__/risk-analyzer.test.ts (15 tests) 3ms
 ✓ lib/ai/__tests__/fallback.test.ts (16 tests) 2ms
 ✓ tests/unit/pitch-scan-events.test.ts (3 tests) 3ms

 Test Files  55 passed (55)
      Tests  980 passed (980)
   Start at  14:18:59
   Duration  26.54s (transform 6.78s, setup 37.26s, import 38.26s, tests 9.44s, environment 164.40s)\n


## Demo

Preview:

![](https://github.com/maphilipps/dealhunter/blob/main/docs/pr/169/pitch-scan-v2-demo-preview.gif?raw=1)

MP4: https://github.com/maphilipps/dealhunter/raw/main/docs/pr/169/pitch-scan-v2-demo.mp4
