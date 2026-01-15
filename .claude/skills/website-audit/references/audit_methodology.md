# Website Audit Methodology

This document outlines the comprehensive methodology for auditing websites in preparation for Drupal relaunches.

## Audit Philosophy

**Goal:** Create a complete, actionable analysis of the existing website to:
1. Map all features to Drupal architecture
2. Identify content structures and volumes
3. Assess technical requirements
4. Evaluate performance and accessibility
5. Estimate migration complexity
6. Provide accurate project estimates

**Approach:** AI-first, using available tools (Chrome DevTools MCP, Puppeteer, Accessibility tools) to automate data collection and analysis.

## Audit Phases

### Phase 1: Discovery & Initial Analysis

#### 1.1 Website Access & Navigation

**Tools:** Chrome DevTools MCP, Puppeteer

**Tasks:**
1. Navigate to the website
2. Take initial screenshots (homepage, key pages)
3. Extract site structure (navigation menus, footer links)
4. Identify main sections and page types

**MCP Commands:**
```
mcp__chrome-devtools__navigate_page (url)
mcp__chrome-devtools__take_screenshot (fullPage: true)
mcp__chrome-devtools__take_snapshot
```

**Deliverable:** Site structure overview with screenshots

#### 1.2 Technology Stack Analysis

**Tools:** Chrome DevTools MCP, WebFetch

**Tasks:**
1. Inspect page source for CMS indicators
2. Check meta tags, generators, frameworks
3. Analyze CSS/JS assets (libraries, frameworks)
4. Identify hosting/CDN information
5. Check for common CMS patterns (WordPress, Joomla, Typo3, etc.)

**Detection patterns:**
- WordPress: `/wp-content/`, `<meta name="generator" content="WordPress">`
- Joomla: `/components/`, `/modules/`
- Typo3: `typo3temp/`, `typo3conf/`
- Drupal: `/sites/default/files/`, `Drupal.settings`
- Custom CMS: Look for unique patterns

**MCP Commands:**
```
mcp__chrome-devtools__evaluate_script
```

**Deliverable:** Technology stack summary

#### 1.3 Content Volume Analysis

**Tools:** Chrome DevTools MCP, Sitemap parsing

**Tasks:**
1. Find and parse sitemap.xml (if available)
2. Extract all page URLs
3. Categorize pages by type (articles, pages, products, etc.)
4. Count pages per category
5. Identify URL patterns

**Sitemap locations to check:**
- `/sitemap.xml`
- `/sitemap_index.xml`
- `/robots.txt` (sitemap reference)
- `/sitemap/`

**MCP Commands:**
```
mcp__chrome-devtools__navigate_page (url: 'https://example.com/sitemap.xml')
mcp__chrome-devtools__take_snapshot
```

**Deliverable:** Content volume breakdown by page type

### Phase 2: Content Architecture Analysis

#### 2.1 Page Type Identification

**Tools:** Chrome DevTools MCP, AI analysis

**Tasks:**
1. Sample pages from each category
2. Analyze page structure and content patterns
3. Identify distinct page types
4. Document fields/components per page type

**Page types to identify:**
- Homepage
- Standard pages
- News/Blog articles
- Events
- Team/People pages
- Product/Service pages
- Landing pages
- Contact pages
- Search results

**For each page type, document:**
- Title/heading structure
- Body content (rich text, plain text)
- Images (hero, gallery, inline)
- Metadata (author, date, categories, tags)
- Custom fields (location, price, etc.)
- Related content
- CTAs and forms

**MCP Commands:**
```
mcp__chrome-devtools__navigate_page
mcp__chrome-devtools__take_snapshot (verbose: true)
mcp__chrome-devtools__take_screenshot
```

**Deliverable:** Page type catalog with field mappings

#### 2.2 Content Component Inventory

**Tools:** Visual analysis, Chrome DevTools

**Tasks:**
1. Identify reusable content components
2. Document component patterns
3. Count component usage
4. Map to Drupal paragraph types

**Components to identify:**
- Text blocks (WYSIWYG content)
- Image blocks (single, gallery, carousel)
- Video embeds (YouTube, Vimeo, uploaded)
- Quote/testimonials
- CTAs (buttons, links)
- Forms
- Tables
- Accordions/tabs
- Cards/teasers
- Hero sections
- Icon grids
- Team grids
- Statistics/counters
- Maps
- Social media embeds
- Newsletter signups

**For each component:**
- Visual appearance (screenshot)
- Content fields
- Layout variations
- Usage frequency
- Complexity (simple/medium/complex)

**Deliverable:** Component library with Drupal paragraph mapping

#### 2.3 Taxonomy & Classification

**Tools:** Navigation analysis, content sampling

**Tasks:**
1. Identify categories (news categories, product types)
2. Document tags/keywords
3. Analyze hierarchies
4. Count terms per vocabulary
5. Check for location/region classification

**Taxonomy types:**
- Categories (hierarchical organization)
- Tags (free-form keywords)
- Authors (if not user entities)
- Locations (geographic)
- Topics/industries
- Content types/formats

**For each taxonomy:**
- Vocabulary name
- Hierarchical or flat?
- Number of terms
- Usage across content types
- Mapping to Drupal vocabulary

**Deliverable:** Taxonomy structure document

#### 2.4 Media & File Analysis

**Tools:** Chrome DevTools, image analysis

**Tasks:**
1. Sample media usage across pages
2. Identify media types (images, documents, videos, audio)
3. Estimate media library size
4. Check file formats and sizes
5. Analyze image usage patterns

**Media types:**
- Images (JPG, PNG, SVG, WebP)
- Documents (PDF, DOC, XLS)
- Videos (MP4, YouTube, Vimeo)
- Audio (MP3, WAV)

**For each media type:**
- Usage frequency
- Typical file sizes
- Naming patterns
- Organization structure
- Metadata (alt text, captions, credits)

**Deliverable:** Media inventory and migration plan

### Phase 3: Functionality & Features Analysis

#### 3.1 Interactive Features

**Tools:** Chrome DevTools MCP, Puppeteer

**Tasks:**
1. Identify forms (contact, search, registration, etc.)
2. Document user interactions (login, comments, ratings)
3. Check for search functionality
4. Identify filters/facets
5. Check for e-commerce features
6. Document integrations (maps, social, analytics)

**Features to document:**
- Contact forms (fields, validation, submission)
- Search (full-text, filters, autocomplete)
- User accounts (registration, login, profiles)
- Comments/discussion
- Newsletter signups
- Event registration
- Booking/reservation systems
- E-commerce (products, cart, checkout)
- Payment gateways
- Social media integration
- Third-party APIs
- Live chat
- Analytics/tracking

**For each feature:**
- Description
- Complexity
- Required Drupal modules
- Custom development needed
- Integration requirements

**MCP Commands:**
```
mcp__chrome-devtools__click
mcp__chrome-devtools__fill
mcp__chrome-devtools__evaluate_script
```

**Deliverable:** Feature inventory with implementation notes

#### 3.2 Navigation & Menu Structure

**Tools:** Chrome DevTools snapshot

**Tasks:**
1. Document main navigation structure
2. Check for mega menus
3. Identify breadcrumbs
4. Document footer navigation
5. Check for utility menus (language, login, etc.)

**Deliverable:** Menu structure diagram

#### 3.3 Views & Listings

**Tools:** Page sampling

**Tasks:**
1. Identify content listing pages
2. Document listing types (grid, list, table, carousel)
3. Check pagination/infinite scroll
4. Identify filters and sorting
5. Document related content displays

**Listing types:**
- News/blog listings
- Event calendars
- Team directories
- Product catalogs
- Search results
- Archive pages
- Category/tag pages

**For each listing:**
- Content type displayed
- Layout (grid, list, table)
- Pagination style
- Filters available
- Sorting options
- Items per page

**Deliverable:** Views inventory with specifications

### Phase 4: Performance Analysis

#### 4.1 Performance Metrics

**Tools:** Chrome DevTools Performance

**Tasks:**
1. Record performance trace
2. Analyze Core Web Vitals (LCP, FID, CLS)
3. Check page load times
4. Identify performance bottlenecks
5. Assess image optimization
6. Check caching headers

**MCP Commands:**
```
mcp__chrome-devtools__performance_start_trace
mcp__chrome-devtools__performance_stop_trace
mcp__chrome-devtools__performance_analyze_insight
```

**Metrics to capture:**
- Largest Contentful Paint (LCP) - should be < 2.5s
- First Input Delay (FID) - should be < 100ms
- Cumulative Layout Shift (CLS) - should be < 0.1
- Time to First Byte (TTFB)
- Total page size
- Number of requests
- JavaScript execution time

**Deliverable:** Performance audit report with improvement recommendations

#### 4.2 Asset Analysis

**Tools:** Network panel, Chrome DevTools

**Tasks:**
1. Check image formats and sizes
2. Analyze CSS/JS bundles
3. Check for minification/compression
4. Identify unused assets
5. Check CDN usage

**MCP Commands:**
```
mcp__chrome-devtools__list_network_requests
mcp__chrome-devtools__get_network_request
```

**Deliverable:** Asset optimization recommendations

### Phase 5: Accessibility Analysis

#### 5.1 WCAG 2.1 Audit

**Tools:** Accessibility MCP (axe-core)

**Tasks:**
1. Test homepage for accessibility
2. Sample key pages
3. Check color contrast
4. Verify semantic HTML
5. Test keyboard navigation
6. Check ARIA usage
7. Verify alt text on images
8. Check form labels

**MCP Commands:**
```
mcp__a11y-accessibility__test_accessibility (url, tags: ['wcag2aa'])
mcp__a11y-accessibility__check_color_contrast
mcp__a11y-accessibility__check_aria_attributes
```

**Issues to identify:**
- Color contrast failures
- Missing alt text
- Invalid ARIA
- Missing form labels
- Poor heading structure
- Keyboard navigation issues
- Focus indicator problems

**Deliverable:** Accessibility audit report (WCAG 2.1 Level AA)

#### 5.2 Accessibility Remediation Planning

**Tasks:**
1. Categorize issues by severity
2. Estimate remediation effort
3. Plan implementation approach

**Deliverable:** Accessibility remediation plan with estimates

### Phase 6: Migration Analysis

#### 6.1 Content Export Assessment

**Tasks:**
1. Determine if CMS has export functionality
2. Check for database access
3. Evaluate API availability
4. Assess data structure/cleanliness
5. Identify migration challenges

**Migration approaches:**
- **Best:** Structured export (XML, JSON, CSV)
- **Good:** Database access with queries
- **Medium:** API with pagination
- **Challenging:** Scraping (last resort)

**Deliverable:** Migration approach recommendation

#### 6.2 Content Cleanup Requirements

**Tasks:**
1. Identify HTML cleanup needed
2. Check for broken links/images
3. Assess content quality
4. Document manual cleanup required

**Cleanup categories:**
- HTML tag cleanup (remove inline styles, deprecated tags)
- Image path corrections
- Broken link fixing
- Content deduplication
- Metadata normalization
- File organization

**Deliverable:** Content cleanup scope and effort estimate

#### 6.3 Migration Complexity

**Tasks:**
1. Classify migration complexity (simple/medium/complex)
2. Estimate effort per content type
3. Plan migration phases
4. Identify risks

**Complexity factors:**
- **Simple (1x):** Clean exports, direct field mapping
- **Medium (2x):** HTML cleanup, some restructuring
- **Complex (3-4x):** Custom parsing, significant restructuring

**Deliverable:** Migration plan with effort estimates

### Phase 7: Drupal Architecture Mapping

#### 7.1 Content Type Design

**Tasks:**
1. Map page types to Drupal content types
2. Design field structure for each
3. Plan taxonomy integrations
4. Design view modes

**For each content type:**
- Name and machine name
- Fields (type, cardinality, required/optional)
- Taxonomies attached
- Paragraph field for flexible content
- View modes (full, teaser, search result)
- Workflows (if needed)

**Deliverable:** Content type specifications

#### 7.2 Paragraph Type Design

**Tasks:**
1. Map components to paragraph types
2. Design fields for each paragraph
3. Plan nesting/relationships
4. Consider section wrapper pattern

**For each paragraph type:**
- Name and machine name
- Fields
- Allowed parent types
- Complexity (simple/medium/complex)
- Theme component mapping

**Deliverable:** Paragraph type specifications

#### 7.3 View Design

**Tasks:**
1. Map listings to Drupal Views
2. Design filters and sorting
3. Plan display formats
4. Configure pagination

**For each view:**
- Name and purpose
- Content type queried
- Display types (page, block, feed)
- Filters and contextual filters
- Sorting options
- Pagination style

**Deliverable:** View specifications

#### 7.4 Module Selection

**Tasks:**
1. Identify required contributed modules
2. Document custom module needs
3. Plan integration modules

**Module categories:**
- Core functionality (Paragraphs, Webform, Pathauto)
- Admin UX (Gin, Admin Toolbar)
- SEO (Yoast, Metatag)
- Media (Media, Focal Point)
- Performance (BigPipe, CSS/JS Aggregation)
- Search (Search API, Solr)
- Integrations (as needed)

**Deliverable:** Module requirements list

### Phase 8: Estimation

#### 8.1 Bottom-Up Estimation

**Tasks:**
1. Count all entities (content types, paragraphs, views, etc.)
2. Classify complexity for each
3. Calculate base hours using estimation table
4. Apply multipliers (testing, documentation, etc.)
5. Add migration effort
6. Add overhead (setup, PM, training)
7. Apply buffer

**Use estimation guidelines from:** `estimation_guidelines.md`

**Deliverable:** Detailed hour estimate breakdown

#### 8.2 Baseline Comparison

**Tasks:**
1. Compare to adessoCMS baseline
2. Calculate scale factor
3. Adjust for complexity differences
4. Validate against bottom-up estimate

**Use baseline from:** `baseline_adessocms.md`

**Deliverable:** Comparative estimate validation

#### 8.3 Risk Assessment

**Tasks:**
1. Identify project risks
2. Assign risk levels (low/medium/high)
3. Recommend appropriate buffer
4. Document assumptions

**Risk factors:**
- Unclear requirements
- Complex migration
- Custom development scope
- Team experience
- Timeline constraints
- Budget limitations

**Deliverable:** Risk assessment and mitigation plan

### Phase 9: Documentation Generation

#### 9.1 Compile Audit Report

**Tasks:**
1. Aggregate all audit findings
2. Structure documentation
3. Generate VitePress site
4. Include screenshots and diagrams
5. Export estimates

**Report sections:**
1. Executive Summary
2. Current Site Analysis
3. Content Architecture
4. Feature Inventory
5. Performance Analysis
6. Accessibility Audit
7. Migration Plan
8. Drupal Architecture Design
9. Effort Estimation
10. Risk Assessment
11. Recommendations
12. Appendices (screenshots, data tables)

**Deliverable:** Complete audit report as VitePress site

#### 9.2 Estimation Summary

**Tasks:**
1. Create estimate summary document
2. Present as ranges (optimistic/likely/pessimistic)
3. Include timeline projections
4. Document assumptions and risks

**Deliverable:** Client-ready estimation document

## Audit Workflow Summary

```
1. Discovery & Initial Analysis
   ├─ Navigate and screenshot site
   ├─ Analyze technology stack
   └─ Assess content volume

2. Content Architecture Analysis
   ├─ Identify page types
   ├─ Inventory content components
   ├─ Document taxonomies
   └─ Analyze media usage

3. Functionality & Features Analysis
   ├─ Identify interactive features
   ├─ Document navigation structure
   └─ Inventory views and listings

4. Performance Analysis
   ├─ Measure Core Web Vitals
   └─ Analyze asset optimization

5. Accessibility Analysis
   ├─ Run WCAG 2.1 audit
   └─ Plan remediation

6. Migration Analysis
   ├─ Assess export capabilities
   ├─ Document cleanup requirements
   └─ Estimate migration complexity

7. Drupal Architecture Mapping
   ├─ Design content types
   ├─ Design paragraph types
   ├─ Plan views
   └─ Select modules

8. Estimation
   ├─ Calculate bottom-up estimate
   ├─ Compare to baseline
   └─ Assess risks and apply buffer

9. Documentation Generation
   ├─ Compile audit report
   └─ Generate VitePress site
```

## Quality Checklist

Before finalizing audit:

- [ ] All page types documented
- [ ] All components mapped to paragraphs
- [ ] Taxonomies cataloged
- [ ] Media requirements documented
- [ ] Features inventoried
- [ ] Performance metrics captured
- [ ] Accessibility audit completed
- [ ] Migration approach defined
- [ ] Content types designed
- [ ] Paragraph types designed
- [ ] Views designed
- [ ] Module list compiled
- [ ] Bottom-up estimate calculated
- [ ] Baseline comparison done
- [ ] Risks identified and documented
- [ ] Assumptions documented
- [ ] Screenshots captured
- [ ] Documentation complete
- [ ] Client-ready format

## Audit Artifacts

**Required outputs:**
1. ✅ VitePress site with full audit
2. ✅ Estimation spreadsheet/document
3. ✅ Architecture diagrams
4. ✅ Screenshots (homepage, key pages, components)
5. ✅ Performance report
6. ✅ Accessibility report
7. ✅ Migration plan
8. ✅ Risk assessment
9. ✅ Module requirements list
10. ✅ Content type specifications

## Timeline for Audit

**Typical audit duration:**

| Audit Scope | Duration | Notes |
|-------------|----------|-------|
| Small site (10-30 pages) | 1-2 days | Limited features, simple structure |
| Medium site (30-100 pages) | 2-4 days | Multiple content types, moderate features |
| Large site (100-500 pages) | 4-8 days | Complex structure, many features |
| Enterprise site (500+ pages) | 1-2 weeks | Extensive features, multiple integrations |

**Audit phases timeline:**
- Discovery: 10%
- Content analysis: 25%
- Functionality analysis: 20%
- Performance/accessibility: 15%
- Migration analysis: 10%
- Architecture design: 15%
- Estimation: 5%

## Tips for Effective Audits

**Do:**
- ✅ Use automation (MCP tools) extensively
- ✅ Take screenshots liberally
- ✅ Document assumptions immediately
- ✅ Sample diverse page types
- ✅ Ask client for clarifications early
- ✅ Validate findings with stakeholders
- ✅ Use baseline for comparison
- ✅ Present estimates as ranges

**Don't:**
- ❌ Skip performance/accessibility analysis
- ❌ Underestimate migration complexity
- ❌ Forget to include testing effort
- ❌ Ignore content cleanup requirements
- ❌ Assume all pages fit one pattern
- ❌ Forget to apply buffers
- ❌ Present overly precise estimates

## Audit Report Template

See the VitePress template in `assets/vitepress-template/` for the complete report structure.

## Continuous Improvement

After each audit:
1. Review accuracy of estimates vs. actuals
2. Update baseline data
3. Refine estimation formulas
4. Document lessons learned
5. Update methodology as needed

This methodology is a living document and should be refined based on experience.
