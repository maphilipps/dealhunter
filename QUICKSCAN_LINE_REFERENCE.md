# QuickScan Refactoring: Detaillierte Zeilen-Referenzen

**Aktualisiert:** 2026-01-20
**Zweck:** Schnelle Navigation zu kritischen Code-Abschnitten

---

## 1. STREAMING INFRASTRUCTURE

### 1.1 Event Types Definition
**Datei:** `/Users/marc.philipps/Sites/dealhunter/lib/streaming/event-types.ts`

| Element | Zeilen | Beschreibung |
|---------|--------|-------------|
| **AgentEventType Enum** | 3-14 | START, AGENT_PROGRESS, AGENT_COMPLETE, DECISION, COMPLETE, ERROR, ABORT, PHASE_START, ANALYSIS_COMPLETE |
| **QuickScanPhase Type** | 17 | 'bootstrap' \| 'multi_page' \| 'analysis' \| 'synthesis' |
| **PhaseStartData Interface** | 20-24 | phase, message, timestamp |
| **AnalysisCompleteData Interface** | 26-31 | analysis, success, duration, details |
| **TechStackEventType Enum** | 34-39 | DETECTION_START, FINDING, DETECTION_COMPLETE, DETECTION_ERROR |
| **TechFindingCategory Type** | 41-49 | cms, framework, library, analytics, hosting, cdn, server, build-tool |
| **AgentProgressData Interface** | 51-61 | agent, message, reasoning, toolCalls, confidence |
| **AgentCompleteData Interface** | 63-72 | agent, result, confidence, sources |
| **DecisionData Interface** | 74-85 | decision, overallScore, confidence, reasoning, scores |
| **ErrorData Interface** | 87-90 | message, code |
| **AgentEventData Union** | 92-102 | All possible event type combinations |
| **AgentEvent Interface** | 104-109 | id, type, timestamp, data |
| **StreamState Interface** | 111-125 | events, isStreaming, error, decision, agentStates |

### 1.2 Event Emitter
**Datei:** `/Users/marc.philipps/Sites/dealhunter/lib/streaming/event-emitter.ts`

| Function | Zeilen | Beschreibung |
|----------|--------|-------------|
| **EventEmitter Type** | 5 | Type definition for emit function |
| **createAgentEventStream()** | 11-56 | Main streaming function with ReadableStream |
| **Event Counter** | 14 | let eventCounter = 0 |
| **SSE Encoder** | 18 | const encoder = new TextEncoder() |
| **emit Function** | 20-30 | Creates AgentEvent with id/timestamp, SSE encoding |
| **Error Handling** | 32-45 | try/catch/finally with error event emission |
| **createSSEResponse()** | 61-70 | Returns Response with SSE headers |

**Critical Headers** (lines 62-69):
```typescript
{
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache, no-transform',
  Connection: 'keep-alive',
  'X-Accel-Buffering': 'no',  // Disable nginx buffering
}
```

### 1.3 API Route (SSE Streaming)
**Datei:** `/Users/marc.philipps/Sites/dealhunter/app/api/rfps/[id]/quick-scan/stream/route.ts`

| Section | Zeilen | Beschreibung |
|---------|--------|-------------|
| **Runtime Config** | 10-11 | export const runtime = 'nodejs'; export const dynamic = 'force-dynamic'; |
| **GET Handler** | 18-199 | Main SSE endpoint |
| **Authentication** | 23-29 | Session check, 401 response |
| **Bid Ownership Verification** | 35-38 | Query + auth check |
| **Existing QuickScan Check** | 48-53 | 400 if no bid.quickScanId |
| **Completed Scan Replay** | 74-101 | Return cached activity log if completed |
| **Live Streaming** | 104-184 | Run actual scan with emit callbacks |
| **Extracted Requirements Parse** | 109-111 | JSON parse extractedRequirements |
| **runQuickScanWithStreaming Call** | 114-121 | Pass websiteUrl, extractedRequirements, bidId |
| **Debug Logging** | 124-130 | Log QuickScan 2.0 fields before DB save |
| **Database Update** | 133-162 | All JSON fields persisted |
| **Status Transition** | 165-171 | RFP: quick_scanning → bit_pending |
| **Completion Event** | 174-183 | Emit AGENT_COMPLETE with recommendation |
| **Error Handling** | 187-198 | 500 response with error message |

---

## 2. SERVER ACTIONS

### 2.1 startQuickScan
**Datei:** `/Users/marc.philipps/Sites/dealhunter/lib/quick-scan/actions.ts`

| Step | Zeilen | Aktion |
|------|--------|--------|
| **Server Action Marker** | 1 | 'use server' |
| **Function Signature** | 19 | export async function startQuickScan(bidId: string) |
| **Auth Check** | 20-23 | Get session, return error if not authenticated |
| **Fetch Bid** | 28-32 | SELECT from rfps WHERE id = bidId LIMIT 1 |
| **Bid Validation** | 34-40 | Check bid exists and user owns it |
| **Extract URL** | 43-52 | Get websiteUrl from extractedRequirements.websiteUrls[0] or fallback |
| **URL Validation** | 54-60 | Return error if no URL |
| **Create QuickScan** | 64-72 | INSERT with status='running', startedAt=now |
| **Update RFP** | 75-81 | UPDATE status='quick_scanning', quickScanId=new |
| **Return Result** | 85-89 | { success: true, quickScanId, status: 'running' } |
| **Error Handling** | 90-96 | Catch, log, return error message |

### 2.2 retriggerQuickScan
**Datei:** Lines 104-188

| Step | Zeilen | Aktion |
|------|--------|--------|
| **Function Signature** | 104 | export async function retriggerQuickScan(bidId: string) |
| **Auth Check** | 105-108 | Session validation |
| **Fetch Bid** | 113-117 | SELECT bid |
| **Delete Old Scan** | 128-130 | DELETE from quickScans WHERE id = bid.quickScanId |
| **Create New Scan** | 154-162 | INSERT new record |
| **Update RFP** | 165-174 | Update status, reset decision/evaluation data |
| **Return Result** | 176-180 | Success response |

### 2.3 getQuickScanResult
**Datei:** Lines 193-260

| Step | Zeilen | Aktion |
|------|--------|--------|
| **Function Signature** | 193 | export async function getQuickScanResult(bidId: string) |
| **Auth & Validation** | 194-217 | Session check, bid fetch, ownership verify, quickScanId check |
| **Query QuickScan** | 219-223 | SELECT quickScans WHERE id = bid.quickScanId |
| **Parse ALL Fields** | 230-254 | 15+ JSON field parsing! |
| **Return Result** | 230-255 | { success: true, quickScan: {...parsed} } |

**Fields Parsed (lines 235-252):**
```typescript
// Core
techStack, contentVolume, features, activityLog

// Enhanced Audits
navigationStructure, accessibilityAudit, seoAudit,
legalCompliance, performanceIndicators, screenshots,
companyIntelligence

// QuickScan 2.0
siteTree, contentTypes, migrationComplexity, decisionMakers

// Raw Data
rawScanData
```

---

## 3. AGENT ORCHESTRATION

### 3.1 Business Units Singleton Cache
**Datei:** `/Users/marc.philipps/Sites/dealhunter/lib/quick-scan/agent.ts`

| Element | Zeilen | Code |
|---------|--------|------|
| **Type Definition** | 63 | type CachedBusinessUnit = { name: string; keywords: string[] }; |
| **Cache Variable** | 64 | let cachedBusinessUnits: CachedBusinessUnit[] \| null = null; |
| **getBusinessUnitsOnce()** | 70-85 | Singleton loader with !cachedBusinessUnits check |
| **DB Query** | 73 | await db.select().from(businessUnitsTable) |
| **Mapping** | 74-77 | Map to { name, keywords: JSON.parse(...) } |
| **Logging** | 78 | console.log(`[QuickScan] Business Units loaded...`) |
| **Error Handling** | 79-82 | Catch, log, set to [] |
| **clearBusinessUnitsCache()** | 90-92 | function clearBusinessUnitsCache(): void { cachedBusinessUnits = null; } |

**CRITICAL PATTERN** (lines 66-92):
This is the ONLY way to access Business Units in QuickScan workflow!

### 3.2 Tech Stack Detection
**Datei:** Lines 100-200+

| Function | Zeilen | Purpose |
|----------|--------|---------|
| **runTechStackDetection** | 100+ | Main tech stack detection function |

---

## 4. UI COMPONENTS

### 4.1 Agent Activity View
**Datei:** `/Users/marc.philipps/Sites/dealhunter/components/ai-elements/agent-activity-view.tsx`

| Element | Zeilen | Details |
|---------|--------|---------|
| **Component Signature** | 39 | export function AgentActivityView({ events, isStreaming }: AgentActivityViewProps) |
| **Expected Agents** | 48-58 | Array of 8 agents with IAF agents |
| **Agent Grouping** | 43-106 | useMemo with agent name grouping + event processing |
| **Progress Calculation** | 109-113 | completed / max(total, 5) * 100 |
| **toggleAgent Function** | 115-125 | Set manipulation for expanded state |
| **getStatusIcon** | 127-138 | Map status to icon component |
| **getAgentColor** | 140-157 | Agent name → CSS classes mapping |
| **formatDuration** | 159-165 | (start, end) → "Xs" format |
| **formatTime** | 167-173 | timestamp → "HH:MM:SS" (de-DE) |
| **Main Render** | 175-281 | Card with header, progress bar, agent groups |
| **Card Header** | 177-187 | Title + Progress Badge + Progress Bar |
| **Agent Groups** | 203-262 | Map to Collapsible components |
| **Collapsible Trigger** | 209-239 | Status icon, badge, message count, duration, chevron |
| **Collapsible Content** | 241-260 | Timeline of events with timestamps |
| **Completion Message** | 264-277 | Green success banner when streaming done |

**Agent Color Scheme** (lines 142-157):
```typescript
Website Crawler: 'bg-cyan-500/10 text-cyan-700 border-cyan-200'
Tech Stack Analyzer: 'bg-violet-500/10 text-violet-700 border-violet-200'
Content Analyzer: 'bg-emerald-500/10 text-emerald-700 border-emerald-200'
Feature Detector: 'bg-amber-500/10 text-amber-700 border-amber-200'
Business Analyst: 'bg-rose-500/10 text-rose-700 border-rose-200'
// IAF Agents
Researcher: 'bg-sky-500/10 text-sky-700 border-sky-200'
Evaluator: 'bg-lime-500/10 text-lime-700 border-lime-200'
Optimizer: 'bg-orange-500/10 text-orange-700 border-orange-200'
```

### 4.2 Agent Message
**Datei:** `/Users/marc.philipps/Sites/dealhunter/components/ai-elements/agent-message.tsx`

| Element | Zeilen | Details |
|---------|--------|---------|
| **Component Signature** | 31 | export function AgentMessage({ event }: AgentMessageProps) |
| **Event Type Filter** | 36-41 | Only render AGENT_PROGRESS and AGENT_COMPLETE |
| **Data Extraction** | 43-59 | Type-safe data destructuring from event |
| **handleCopy** | 61-66 | Navigator.clipboard.writeText, 2s toast |
| **getAgentColor** | 68-94 | 15+ agent colors defined |
| **formatTime** | 96-102 | timestamp → "HH:MM:SS" (en-US) |
| **Main Render** | 104-201 | Group with flex layout |
| **Timestamp** | 108-110 | text-xs, font-mono, min-w-[70px] |
| **Agent Badge** | 113-118 | Badge component with getAgentColor() |
| **Message Content** | 121-132 | p.text-sm.font-medium |
| **Details/CoT** | 128-132 | text-xs, whitespace-pre-wrap |
| **Confidence Indicator** | 135-139 | ConfidenceIndicator component |
| **Tool Calls** | 142-156 | mt-2 space, text-xs p-2 bg-muted rounded |
| **Reasoning** | 159-179 | Collapsible with ChevronDown icon |
| **Sources** | 182 | Sources component |
| **Copy Button** | 186-197 | Ghost button, opacity-0 group-hover:opacity-100 |

---

## 5. SCHEMAS

### 5.1 Schema Definitions
**Datei:** `/Users/marc.philipps/Sites/dealhunter/lib/quick-scan/schema.ts`

| Schema | Zeilen | Fields | Purpose |
|--------|--------|--------|---------|
| **techStackSchema** | 6-52 | CMS, Framework, Backend, Hosting, CDN, Server, Libraries, Analytics, Marketing, JavaScript/CSS Frameworks, API Endpoints, Headless CMS, SSR, Build Tools, CDN Providers, Overall Confidence | Core Tech Detection |
| **contentVolumeSchema** | 59-77 | actualPageCount, estimatedPageCount, sitemapFound, sitemapUrl, contentTypes[], mediaAssets{}, languages[], complexity | Content Analysis |
| **accessibilityAuditSchema** | 84-119 | score, level (WCAG), issue counts, specific checks, top issues, recommendations | A11y |
| **screenshotsSchema** | 124-137 | homepage{desktop, mobile}, keyPages[], timestamp | Screenshots |
| **seoAuditSchema** | 142-167 | score, checks{}, issues[] | SEO |
| **legalComplianceSchema** | 172-197 | score, checks{}, gdprIndicators{}, issues[] | Legal/GDPR |
| **performanceIndicatorsSchema** | 202-222 | htmlSize, resourceCount{}, estimatedLoadTime, hasFeaturesX, renderBlockingResources | Performance |
| **featuresSchema** | 227-239 | ecommerce, userAccounts, search, multiLanguage, blog, forms, api, mobileApp, customFeatures[] | Features |
| **blRecommendationSchema** | 244-255 | primaryBusinessLine, confidence, reasoning, alternativeBusinessLines[], requiredSkills[] | BL Recommendation |
| **navigationStructureSchema** | 261-293 | mainNav[], footerNav[], hasFeatures{}, maxDepth, totalItems, pageTypesDetected[] | Navigation |
| **companyIntelligenceSchema** | 298-363 | basicInfo{}, financials{}, newsAndReputation{}, leadership{}, corporateStructure{}, dataQuality{} | Company Research |
| **extendedQuickScanSchema** | 368-385 | Core + Enhanced fields | QuickScan 1.0 |
| **siteTreeNodeSchema** | 394-406 | path, url?, count, children[] (recursive) | Hierarchical sitemap |
| **siteTreeSchema** | 408-442 | totalPages, maxDepth, crawledAt, sources{}, sections[], navigation{} | Full site structure |
| **contentTypeDistributionSchema** | 449-465 | pagesAnalyzed, distribution[], complexity, estimatedContentTypes, customFieldsNeeded, recommendations[] | Content classification |
| **migrationComplexitySchema** | 472-519 | score, recommendation, factors{cmsExportability, dataQuality, contentComplexity, integrationComplexity}, warnings[], opportunities[], estimatedEffort{} | Migration analysis |
| **decisionMakerSchema** | 524-535 | name, role, linkedInUrl, xingUrl, email, emailConfidence, phone, source | Single decision maker |
| **decisionMakersResearchSchema** | 539-559 | decisionMakers[], genericContacts{}, researchQuality{} | Decision makers research |
| **enhancedAccessibilityAuditSchema** | 566-596 | wcagLevel, targetLevel, score, pagesAudited, auditMethod, violations{}, topIssues[], passingRules, recommendations[] | Multi-page a11y |
| **extractedComponentsSchema** | 689-701 | navigation[], contentBlocks[], forms[], mediaElements[], interactiveElements[], summary{} | UI components |
| **multiPageAnalysisSchema** | 708-715 | pagesAnalyzed, analyzedUrls[], pageCategories{}, detectionMethod, analysisTimestamp | Analysis metadata |
| **extendedQuickScan2Schema** | 601-623 | All 1.0 fields + siteTree, contentTypes, migrationComplexity, decisionMakers, enhancedAccessibility | QuickScan 2.0 complete |

### 5.2 Type Definitions
**Datei:** `/Users/marc.philipps/Sites/dealhunter/lib/quick-scan/types.ts`

| Type | Zeilen | Purpose |
|------|--------|---------|
| **TechStackData** | 10-34 | Runtime type for tech stack |
| **ContentVolumeData** | 40-51 | Runtime type for content analysis |
| **FeaturesData** | 53-63 | Runtime type for features |
| **NavigationItem** | 69-73 | Recursive navigation item |
| **NavigationData** | 75-83 | Navigation structure |
| **AccessibilityAuditData** | 89-108 | A11y results |
| **SEOAuditData** | 110-125 | SEO results |
| **LegalComplianceData** | 127-142 | Legal/GDPR results |
| **PerformanceData** | 144-157 | Performance metrics |
| **ScreenshotsData** | 163-170 | Screenshot paths |
| **CompanyIntelligenceData** | 172-204 | Company research |
| **SiteTreeNodeData** | 210-215 | Hierarchical node |
| **SiteTreeData** | 217-239 | Site tree structure |
| **ContentTypesData** | 241-253 | Content type distribution |
| **MigrationComplexityData** | 255-300 | Migration complexity assessment |
| **DecisionMakerData** | 302-311 | Single decision maker |
| **DecisionMakersData** | 313-333 | Decision makers collection |
| **BlRecommendationData** | 339-345 | BL recommendation |
| **IntegrationsData** | 351-357 | Integrations found |
| **NavigationComponentData** | 363-368 | Navigation component type |
| **ContentBlockComponentData** | 370-376 | Content block type |
| **FormComponentData** | 378-384 | Form type |
| **MediaComponentData** | 386-390 | Media type |
| **DrupalMappingData** | 392-399 | DRUPAL MAPPING HINTS (NEW!) |
| **ExtractedComponentsData** | 401-422 | UI components WITH drupalMapping field |
| **MultiPageAnalysisData** | 424-430 | Multi-page analysis metadata |
| **QuickScanResultsData** | 436-458 | Combined results type |

**KEY FOR DRUPAL** (lines 392-422):
```typescript
// DrupalMappingData - NEW STRUCTURE!
export interface DrupalMappingData {
  suggestedParagraphTypes: string[];      // ["hero", "cards_grid", "accordion"]
  suggestedContentTypes: string[];        // ["article", "event", "product"]
  suggestedTaxonomies: string[];          // ["category", "tag", "location"]
  suggestedMediaTypes: string[];          // ["image", "video", "document"]
  estimatedViews: number;
}

// ExtractedComponentsData now includes:
export interface ExtractedComponentsData {
  // ... existing fields ...
  drupalMapping?: DrupalMappingData;
  summary: {
    // ... existing summary fields ...
    estimatedDrupalEntities?: {
      contentTypes: number;
      paragraphTypes: number;
      taxonomies: number;
      views: number;
    };
  };
}
```

---

## 6. DATABASE SCHEMA

### 6.1 Quick Scans Table
**Datei:** `/Users/marc.philipps/Sites/dealhunter/lib/db/schema.ts`

| Column | Type | Lines | Purpose |
|--------|------|-------|---------|
| **id** | text PK | 413-415 | Primary key |
| **rfpId** | text FK | 416-418 | References rfps.id |
| **websiteUrl** | text | 421 | Target website URL |
| **status** | enum | 424-426 | pending, running, completed, failed |
| **techStack** | text JSON | 429 | Detected technologies |
| **cms** | text | 430 | CMS name |
| **framework** | text | 431 | Framework name |
| **hosting** | text | 432 | Hosting provider |
| **pageCount** | integer | 435 | Page count |
| **contentVolume** | text JSON | 436 | Content analysis |
| **features** | text JSON | 437 | Detected features |
| **integrations** | text JSON | 438 | Detected integrations |
| **navigationStructure** | text JSON | 441 | Navigation analysis |
| **accessibilityAudit** | text JSON | 442 | A11y audit |
| **seoAudit** | text JSON | 443 | SEO audit |
| **legalCompliance** | text JSON | 444 | Legal/GDPR |
| **performanceIndicators** | text JSON | 445 | Performance metrics |
| **screenshots** | text JSON | 446 | Screenshot paths |
| **companyIntelligence** | text JSON | 447 | Company research |
| **siteTree** | text JSON | 450 | Hierarchical sitemap |
| **contentTypes** | text JSON | 451 | Content type distribution |
| **migrationComplexity** | text JSON | 452 | Migration complexity |
| **decisionMakers** | text JSON | 453 | Decision makers |
| **tenQuestions** | text JSON | 454 | Generated questions |
| **rawScanData** | text JSON | 455 | Raw debugging data |
| **recommendedBusinessUnit** | text | 458 | BU recommendation |
| **confidence** | integer | 459 | Confidence 0-100 |
| **reasoning** | text | 460 | Recommendation reason |
| **activityLog** | text JSON | 463 | Agent activity steps |
| **visualizationTree** | text JSON | 466 | Cached json-render tree |
| **cmsEvaluation** | text JSON | 469 | CMS matching result |
| **cmsEvaluationCompletedAt** | timestamp | 470 | When CMS eval finished |
| **startedAt** | timestamp | 473 | When scan started |
| **completedAt** | timestamp | 474 | When scan completed |
| **createdAt** | timestamp | 475-476 | Created timestamp |
| **Index rfpIdx** | - | 478 | index on rfpId |

---

## 7. TOOLS

### 7.1 Multi-Page Analyzer
**Datei:** `/Users/marc.philipps/Sites/dealhunter/lib/quick-scan/tools/multi-page-analyzer.ts`

| Element | Zeilen | Details |
|---------|--------|---------|
| **PageData Interface** | 9-15 | url, html, headers, fetchedAt, error |
| **PageTechResult Interface** | 17-23 | url, technologies[], cms, framework, rawWappalyzer |
| **TechnologyDetection Interface** | 25-31 | name, category, confidence, version, source |
| **CMSDetection Interface** | 33-38 | name, version, confidence, indicators[] |
| **FrameworkDetection Interface** | 40-45 | name, version, confidence, type |
| **WappalyzerTech Interface** | 47-53 | name, categories[], version, confidence, website |
| **AggregatedTechResult Interface** | 55-80 | cms, framework, backend[], hosting, cdn, server, libraries[], analytics[], marketing[], overallConfidence, pagesAnalyzed, detectionMethod |
| **CMS_PATTERNS** | 85-150+ | Array of CMS detection objects with name, patterns[], version regex |
| **Drupal Patterns** | 87-100 | 8 patterns for Drupal detection |
| **WordPress Patterns** | 102-112 | 6 patterns for WordPress |
| **TYPO3 Patterns** | 114-124 | 7 patterns for TYPO3 |
| **Joomla Patterns** | 126-134 | 4 patterns for Joomla |
| **Contao Patterns** | 136-142 | 3 patterns for Contao |
| **Magento Patterns** | 144-150 | 4 patterns for Magento |

### 7.2 Migration Analyzer
**Datei:** `/Users/marc.philipps/Sites/dealhunter/lib/quick-scan/tools/migration-analyzer.ts`

| Element | Zeilen | Details |
|---------|--------|---------|
| **aiAnalysisResultSchema** | 11-21 | Zod schema for AI analysis result |
| **AIAnalysisResult Type** | 23 | z.infer<typeof aiAnalysisResultSchema> |
| **MigrationAnalysisInput Interface** | 25-38 | Input parameters |
| **CMS_EXPORT_CAPABILITIES** | 41-62 | Database of CMS export capabilities |
| **WordPress** | 49 | hasRestApi: true, hasCli: true, exportScore: 90 |
| **Drupal** | 50 | hasRestApi: true, hasCli: true, exportScore: 95 |
| **TYPO3** | 51 | hasRestApi: true, hasCli: true, exportScore: 85 |
| **Joomla** | 52 | hasRestApi: true, hasCli: false, exportScore: 70 |
| **Contao** | 53 | hasRestApi: false, hasCli: false, exportScore: 50 |
| **Shopify** | 54 | hasRestApi: true, hasCli: false, exportScore: 75 |
| **Wix** | 55 | hasRestApi: false, hasCli: false, exportScore: 20 |
| **Squarespace** | 56 | hasRestApi: false, hasCli: false, exportScore: 15 |
| **Sitecore** | 57 | hasRestApi: true, hasCli: true, exportScore: 80 |
| **Adobe AEM** | 58 | hasRestApi: true, hasCli: true, exportScore: 75 |
| **Contentful** | 59 | hasRestApi: true, hasCli: true, exportScore: 95 |
| **Strapi** | 60 | hasRestApi: true, hasCli: true, exportScore: 95 |
| **Custom** | 61 | All false, exportScore: 30 |
| **getCmsCapabilities()** | 67-95 | Get capabilities by CMS name |
| **estimateContentComplexity()** | 100-148 | Score calculation based on page count, features, content types |

### 7.3 Component Extractor
**Datei:** `/Users/marc.philipps/Sites/dealhunter/lib/quick-scan/tools/component-extractor.ts`

| Element | Zeilen | Details |
|---------|--------|---------|
| **NavigationComponent Interface** | 8-13 | type, features[], itemCount, maxDepth |
| **ContentBlockComponent Interface** | 15-21 | type, count, examples[], hasImages, hasLinks |
| **FormComponent Interface** | 23-29 | type, fields, hasValidation, hasFileUpload, hasCaptcha |
| **MediaComponent Interface** | 31-35 | type, count, providers[] |
| **ExtractedComponents Interface** | 37-49 | navigation[], contentBlocks[], forms[], mediaElements[], interactiveElements[], summary{} |
| **NAVIGATION_PATTERNS** | 54-92 | mega_menu, sticky_header, mobile_menu, sidebar, breadcrumbs, pagination |
| **CONTENT_BLOCK_PATTERNS** | 97-150+ | hero, cards, teaser, accordion, tabs, slider, testimonials, timeline, grid, list, cta, pricing, faq, team, stats, features |

### 7.4 Decision Maker Research
**Datei:** `/Users/marc.philipps/Sites/dealhunter/lib/quick-scan/tools/decision-maker-research.ts`

| Element | Zeilen | Details |
|---------|--------|---------|
| **DecisionMakerSource Type** | 7 | 'impressum', 'linkedin', 'xing', 'website', 'web_search', 'derived', 'team_page' |
| **extractedPersonSchema** | 22-29 | Zod schema for person extraction |
| **SEARCH_STRATEGIES** | 32-54 | 14 search query templates |
| **Direct Team Page Search** | 34-36 | Company name + team/management/leadership |
| **Role-Specific Searches** | 39-43 | CEO, IT-Leiter, Marketingleiter, etc. |
| **LinkedIn Searches** | 45-46 | site:linkedin.com/in |
| **Xing Searches** | 49 | site:xing.com |
| **Press Searches** | 52-53 | News and press releases |
| **EMAIL_PATTERNS** | 57-63 | 5 common email derivation patterns |
| **sleep()** | 68-70 | Async rate limiting |
| **extractDomain()** | 75-81 | Extract domain from URL |
| **deriveEmails()** | 86-100 | Generate email candidates with confidence |

---

## 8. QUICK REFERENCE: 2-PHASE IMPLEMENTATION

### Phase Events to Implement
```
PHASE 1: COLLECT
├─ emit({ type: PHASE_START, data: { phase: 'bootstrap', ... } })
├─ emit({ type: PHASE_START, data: { phase: 'multi_page', ... } })
├─ [parallel tasks: tech stack, navigation, components, etc.]
└─ emit({ type: ANALYSIS_COMPLETE, data: { analysis: 'collection', ... } })

PHASE 2: SYNTHESIZE
├─ emit({ type: PHASE_START, data: { phase: 'synthesis', ... } })
├─ [sequential tasks: BU recommendation, drupal mapping, etc.]
└─ emit({ type: ANALYSIS_COMPLETE, data: { analysis: 'synthesis', ... } })

FINAL
└─ emit({ type: COMPLETE })
```

### Drupal Mapping Output Structure
```typescript
// Input
{
  extractedComponents: ExtractedComponentsData,
  contentTypes: ContentTypeDistribution
}

// Output
{
  suggestedParagraphTypes: ['hero', 'cards_grid', 'accordion'],
  suggestedContentTypes: ['article', 'product', 'team_member'],
  suggestedTaxonomies: ['category', 'tag', 'product_category'],
  suggestedMediaTypes: ['image', 'video', 'document'],
  estimatedViews: 5,  // from content type distribution

  summary: {
    estimatedDrupalEntities: {
      contentTypes: 3,
      paragraphTypes: 8,
      taxonomies: 3,
      views: 5
    }
  }
}
```

---

**Erstellt:** 2026-01-20
**Zweck:** Schnelle Referenz für Implementierung
**Status:** FINAL
