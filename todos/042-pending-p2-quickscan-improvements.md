# Quick Scan Improvements - Todos

## Priority Legend

- P0: Critical - Blocks deployment or causes data loss
- P1: High - Important feature or security issue
- P2: Medium - Enhancement or performance improvement
- P3: Low - Nice to have or cleanup

---

## Completed ✅

### P1 - AI Configuration Centralization

- [x] Create `/lib/ai/config.ts` with centralized OpenAI client
- [x] Add `generateStructuredOutput()` helper for Zod-validated AI responses
- [x] Configure adesso AI Hub with Claude models

### P1 - BIT Evaluation Sub-Agents Migration

- [x] Migrate `capability-agent.ts` to `generateStructuredOutput`
- [x] Migrate `deal-quality-agent.ts` to `generateStructuredOutput`
- [x] Migrate `strategic-fit-agent.ts` to `generateStructuredOutput`
- [x] Migrate `competition-agent.ts` to `generateStructuredOutput`
- [x] Migrate `legal-agent.ts` to `generateStructuredOutput`
- [x] Migrate `reference-agent.ts` to `generateStructuredOutput`

### P1 - Feature Detection Improvements

- [x] Improve E-Commerce detection (more permissive patterns)
- [x] Improve User Accounts detection
- [x] Improve Search detection
- [x] Improve Multi-Language detection
- [x] Fix Blog detection (removed restrictive AND condition)
- [x] Improve Forms detection
- [x] Improve API detection
- [x] Improve Mobile App detection

### P1 - Real-time Update Fix

- [x] Add `refreshKey` state variable to bid detail
- [x] Create `handleRefresh()` function
- [x] Update `useEffect` dependency array
- [x] Fix audit results requiring page reload

### P2 - Tech Stack Display Improvements

- [x] Extend `TechStackData` interface (cdn, server, analytics, marketing)
- [x] Add UI section for Analytics badges
- [x] Add UI section for Marketing & Compliance badges
- [x] Add UI section for CDN badges

### P2 - Wappalyzer Category Mapping

- [x] Map analytics category to TechStack.analytics
- [x] Map marketing category to TechStack.marketing
- [x] Map libraries category to TechStack.libraries
- [x] Ensure proper categorization in `detectTechStack()`

### P2 - Enhanced Tech Stack Detection (Playwright)

- [x] Create `detectEnhancedTechStack()` function in `playwright.ts`
- [x] Add JavaScript framework version detection (React, Vue, Angular, etc.)
- [x] Add CSS framework detection (Bootstrap, Tailwind, etc.)
- [x] Add API endpoint discovery (REST, GraphQL)
- [x] Add CDN provider detection (Cloudflare, AWS, etc.)
- [x] Add headless CMS detection (Contentful, Sanity, etc.)
- [x] Add server-side rendering detection
- [x] Add build tool detection (Webpack, Vite, etc.)
- [x] Extend QuickScan schema with enhanced tech fields
- [x] Integrate `detectEnhancedTechStack()` into Quick Scan agent
- [x] Merge enhanced tech results with existing tech stack
- [x] Update Quick Scan UI to display enhanced tech stack
- [x] Build verified successfully

---

## In Progress 🔄

_Keine Tasks in Bearbeitung_

---

## Pending ⏳

### P1 - Remaining Agent Migration

- [ ] Migrate Extraction Agent to `generateStructuredOutput`
- [ ] Migrate Tech Stack Agent to `generateStructuredOutput`
- [ ] Migrate Team Agent to `generateStructuredOutput`
- [ ] Migrate remaining agents as needed

### P2 - Lighthouse Report Integration

- [ ] Install `lighthouse` npm package
- [ ] Create Lighthouse audit tool
- [ ] Extend QuickScan schema for Lighthouse results
- [ ] Integrate Lighthouse into Quick Scan agent
- [ ] Create UI component for Lighthouse scores
- [ ] Add Core Web Vitals display (LCP, FID, CLS, TTI, SI, FCP)
- [ ] Test Lighthouse integration

### P2 - Web Search Integration (Customer Research)

- [ ] Research Vercel AI SDK Web Search capabilities
- [ ] Implement customer background search agent
- [ ] Extract company information (founded, size, industry, etc.)
- [ ] Extract customer references/testimonials
- [ ] Identify competitors and market position
- [ ] Extend QuickScan schema for customer data
- [ ] Create UI component for customer information

### P2 - Verification

- [ ] Verify all migrated agents work correctly
- [ ] Run integration tests
- [ ] Check for type errors
- [ ] Validate structured outputs match Zod schemas

---

## Notes

### WhatWeb Integration

- WhatWeb is a Ruby-based web scanner with 1800+ plugins
- Output formats: JSON, XML, Brief, Verbose
- Aggression levels: Stealthy (1), Aggressive (3), Heavy (4)
- Installation: `gem install whatweb` or `brew install whatweb`
- JSON output format preferred for parsing

### Lighthouse Integration

- Two approaches available:
  1. Full Lighthouse Report (15-30s per URL) - Complete scores
  2. Web Vitals via Playwright (faster) - Core metrics only
- User preference: Full Lighthouse Report
- Provides: Performance, Accessibility, Best Practices, SEO scores

### Web Search Integration

- Vercel AI SDK offers built-in web search tools
- Can search for company background, references, news
- Use for customer research and competitive analysis
- Requires API key configuration

### Tech Stack Enhancement Goals

- Better detection of frontend/backend technologies
- Improved categorization (analytics, marketing, CDN)
- Version detection where possible
- Integration with Wappalyzer and WhatWeb

### Performance Considerations

- WhatWeb scan time: 5-15s per URL (stealthy mode)
- Lighthouse scan time: 15-30s per URL
- Consider running scans in parallel for multiple URLs
- Cache results to avoid re-scanning
- Background job processing for long-running scans

---

## Related Files

- `/lib/ai/config.ts` - Centralized AI configuration
- `/lib/quick-scan/agent.ts` - Quick Scan main agent
- `/lib/bit-evaluation/agents/*.ts` - BIT evaluation sub-agents
- `/components/bids/bid-detail-client.tsx` - Real-time update fix
- `/components/bids/quick-scan-results.tsx` - UI for results
- `/lib/quick-scan/tools/playwright.ts` - Playwright-based audits
- `/lib/quick-scan/schema.ts` - Zod schemas
