# Drupal Project Estimation Guidelines

This document provides systematic approaches to estimating Drupal relaunch projects based on website audits.

## Estimation Philosophy

**Goal:** Provide accurate, defensible estimates based on:
1. Baseline comparison (adessoCMS project)
2. Complexity analysis (Simple/Medium/Complex)
3. Risk factors and multipliers
4. Industry standards and historical data

**Approach:**
- Bottom-up estimation (sum of components)
- Comparison to known baseline
- Risk-adjusted timeline
- Buffer for unknowns (15-25%)

## Estimation Process

### Phase 1: Inventory (from audit)

Count all entities that need to be created:

```
Content Types: _____
Paragraph Types: _____
Taxonomies: _____
Media Types: _____
Views: _____
Webforms: _____
Blocks: _____
Theme Components: _____
Custom Modules: _____
```

### Phase 2: Complexity Classification

For each entity, classify as Simple/Medium/Complex:

**Content Type Example:**
- **Simple:** Basic page (title + paragraph field + SEO)
- **Medium:** News article (+ image, categories, tags, author, date)
- **Complex:** Event (+ date range, location, registration, capacity, custom workflow)

Apply classification to ALL entity types using patterns from `drupal_architecture_patterns.md`.

### Phase 3: Base Hour Calculation

Use the estimation table to calculate base hours:

| Component | Simple | Medium | Complex |
|-----------|--------|--------|---------|
| Content Type | 2-4h | 4-8h | 8-16h |
| Paragraph Type | 1-2h | 3-4h | 4-8h |
| Taxonomy | 1-2h | 2-4h | 4-8h |
| Media Type | 1-2h | 2-4h | 4-8h |
| View | 2-4h | 4-8h | 8-16h |
| Webform | 2-4h | 4-8h | 8-16h |
| Block | 1-2h | 2-4h | 4-8h |
| Custom Module | 8-16h | 16-40h | 40-100h+ |
| Theme Component | 2-4h | 4-8h | 8-16h |

**Formula:**
```
Base Hours = Σ (Entity Count × Complexity Hours)
```

**Example:**
```
4 Simple Content Types × 3h = 12h
2 Medium Content Types × 6h = 12h
1 Complex Content Type × 12h = 12h
Total Content Types: 36h
```

### Phase 4: Apply Multipliers

Apply appropriate multipliers based on project requirements:

#### Core Multipliers

**Testing (+20-30%):**
- Unit tests: +10%
- Integration tests: +10%
- E2E tests (Playwright): +10%
- Visual tests (Storybook): +5%

**Documentation (+10-15%):**
- API documentation: +5%
- User guides: +5%
- Developer documentation: +5%

**Quality Assurance (+15-20%):**
- Code reviews: +5%
- Manual testing: +10%
- Bug fixing: +10%

#### Feature Multipliers

**Multilingual (+30-50%):**
- 2 languages: +30%
- 3-5 languages: +40%
- 6+ languages: +50%
- Translation workflow: +10%

**Advanced Permissions (+20-30%):**
- Role-based access: +20%
- Content workflow: +10%
- Field-level permissions: +10%

**Custom Integrations (+50-100%):**
- Simple API: +50%
- Complex API with auth: +75%
- Multiple integrations: +100%

**High Security (+30-50%):**
- Security audit: +15%
- Penetration testing: +20%
- Custom security features: +15%

**Performance Optimization (+20-30%):**
- Caching strategy: +10%
- Query optimization: +10%
- CDN integration: +10%

**Accessibility (WCAG 2.1 AA) (+20-30%):**
- Audit: +10%
- Implementation: +15%
- Testing: +5%

#### Migration Complexity Multipliers

**Simple Migration (1x):**
- Structured data exports available
- Direct field mapping
- Minimal cleanup needed

**Medium Migration (2x):**
- HTML cleanup required
- Some custom parsing
- Taxonomy restructuring
- Media organization

**Complex Migration (3-4x):**
- Custom scrapers needed
- Legacy database
- Significant restructuring
- Multiple source systems
- No exports available

**Migration Hours:**
```
Base setup: 20-40h

Per content type (per 100 nodes):
- Simple: 8-12h × 1 = 8-12h
- Medium: 8-12h × 2 = 16-24h
- Complex: 8-12h × 3-4 = 24-48h
```

### Phase 5: Additional Effort

Add hours for project overhead:

**Setup & Infrastructure (40-80h):**
- DDEV setup: 8-16h
- Git workflow: 4-8h
- CI/CD pipeline: 16-32h
- Deployment automation: 12-24h

**Project Management (15-20% of total):**
- Meetings: 5%
- Planning: 5%
- Coordination: 5%

**Training & Handover (20-40h):**
- Admin training: 8-16h
- Documentation: 8-16h
- Knowledge transfer: 4-8h

**Buffer for Unknowns (15-25%):**
- Low risk: +15%
- Medium risk: +20%
- High risk: +25%

### Phase 6: Calculate Total

```
Total Hours =
  Base Hours
  + (Base Hours × Multipliers)
  + Additional Effort
  + (Total × Buffer)
```

**Example Calculation:**

```
Base Hours: 400h

Multipliers:
+ Testing (25%): 100h
+ Documentation (15%): 60h
+ QA (20%): 80h
+ Multilingual (30%): 120h

Subtotal: 760h

Additional:
+ Setup: 60h
+ PM (18%): 137h
+ Training: 30h

Subtotal: 987h

Buffer (20%): 197h

Total: 1,184h
```

## Baseline Comparison Method

Use the adessoCMS baseline for comparative estimation.

### Step 1: Calculate Project Scale

```
Scale Factor = (Project Entities / Baseline Entities)
```

**Example:**
```
Baseline (adessoCMS):
- Content Types: 6
- Paragraph Types: 32
- Views: 27
- Total Config: 1,136

New Project:
- Content Types: 4
- Paragraph Types: 20
- Views: 15
- Total Config: ~700 (estimated)

Scale Factor: 700 / 1,136 = 0.62 (62% of baseline)
```

### Step 2: Adjust Baseline Hours

```
Estimated Hours = Baseline Hours × Scale Factor × Complexity Factor
```

**Baseline Total:** 693 hours

**Complexity Factors:**
- Lower complexity: 0.7-0.9
- Similar complexity: 1.0
- Higher complexity: 1.1-1.5

**Example:**
```
If new project is 62% of baseline with similar complexity:
693h × 0.62 × 1.0 = 430h

If slightly more complex:
693h × 0.62 × 1.2 = 516h
```

### Step 3: Validate Against Bottom-Up

Compare baseline-derived estimate with bottom-up calculation:

- **Difference < 15%:** Estimates align well
- **Difference 15-30%:** Review assumptions
- **Difference > 30%:** Significant complexity difference, investigate

Use the more conservative (higher) estimate, or average the two.

## Size Categories

### Small Project (40-60% of baseline)
**Scale:** 400-600 config files

**Typical features:**
- 3-4 content types
- 10-15 paragraph types
- 2 taxonomies
- 30-40 theme components
- 10-15 views

**Estimated hours:** 300-450h
**Timeline:** 8-11 weeks @ 40h/week

### Medium Project (baseline)
**Scale:** 700-1,000 config files

**Typical features:**
- 4-6 content types
- 15-25 paragraph types
- 3-4 taxonomies
- 40-60 theme components
- 15-25 views

**Estimated hours:** 550-850h
**Timeline:** 14-21 weeks @ 40h/week

### Large Project (140-200% of baseline)
**Scale:** 1,400-2,500 config files

**Typical features:**
- 8-12+ content types
- 40-60+ paragraph types
- 6-10+ taxonomies
- 80-120+ theme components
- 30-50+ views

**Estimated hours:** 1,000-1,600h
**Timeline:** 25-40 weeks @ 40h/week

## Risk Assessment

### Low Risk (Buffer: +15%)
- ✅ Clear requirements
- ✅ Structured source data
- ✅ Standard Drupal patterns
- ✅ Experienced team
- ✅ Similar past projects

### Medium Risk (Buffer: +20%)
- ⚠️ Some unclear requirements
- ⚠️ Moderate data complexity
- ⚠️ Some custom development
- ⚠️ Mixed team experience
- ⚠️ New domain for team

### High Risk (Buffer: +25%)
- 🔴 Unclear requirements
- 🔴 Complex data migration
- 🔴 Significant custom code
- 🔴 Inexperienced team
- 🔴 New technology stack
- 🔴 Tight deadlines

## Effort Distribution

Typical distribution across project phases:

| Phase | % of Total | Description |
|-------|-----------|-------------|
| Discovery & Planning | 5-10% | Requirements, architecture, planning |
| Infrastructure Setup | 5-8% | DDEV, CI/CD, deployment |
| Content Architecture | 15-20% | Content types, fields, taxonomies |
| Component Development | 25-35% | Paragraphs, views, blocks |
| Theme Development | 20-30% | SDC, Tailwind, Storybook |
| Migration | 10-20% | Content migration (if applicable) |
| Testing | 10-15% | Unit, integration, E2E, accessibility |
| Documentation | 5-8% | User guides, dev docs, API docs |
| Training & Handover | 5-8% | Admin training, knowledge transfer |

## Team Composition

### Small Project (300-450h)
- 1 Developer: 60-70%
- 1 Frontend Dev: 30-40%
- PM: 10-15% (part-time)

**Timeline:** 8-11 weeks

### Medium Project (550-850h)
- 1-2 Backend Devs: 50-60%
- 1 Frontend Dev: 30-40%
- PM: 10-15%

**Timeline:** 14-21 weeks

### Large Project (1,000-1,600h)
- 2-3 Backend Devs: 50-60%
- 1-2 Frontend Devs: 30-40%
- 1 PM: 10-15%
- 1 QA: 5-10%

**Timeline:** 25-40 weeks

## Deliverables Checklist

Include effort for these deliverables:

### Technical Deliverables
- [ ] Drupal installation configured
- [ ] All content types created
- [ ] All paragraph types implemented
- [ ] Taxonomies configured
- [ ] Views created
- [ ] Webforms implemented
- [ ] Theme components (SDC)
- [ ] Custom modules (if any)
- [ ] Migration scripts
- [ ] Tests (unit, integration, E2E)

### Documentation Deliverables
- [ ] Architecture Decision Records (ADRs)
- [ ] API documentation
- [ ] User guides
- [ ] Admin training materials
- [ ] Developer setup guide
- [ ] Deployment guide

### Quality Deliverables
- [ ] Code review completed
- [ ] Security audit
- [ ] Performance testing
- [ ] Accessibility audit (WCAG 2.1 AA)
- [ ] Cross-browser testing
- [ ] Mobile responsive testing

### Handover Deliverables
- [ ] Training sessions conducted
- [ ] Documentation provided
- [ ] Access credentials transferred
- [ ] Warranty period defined

## Common Estimation Pitfalls

### ❌ Underestimating
- Skipping migration complexity
- Not accounting for content cleanup
- Forgetting testing effort
- No buffer for unknowns
- Missing documentation time
- Not including training

### ✅ Realistic Estimation
- Account for all phases
- Include buffers
- Consider team experience
- Factor in communication overhead
- Plan for iterations
- Include PM time

## Estimation Template

```markdown
# Project: [Name]
# Date: [YYYY-MM-DD]
# Estimator: [Name]

## Project Overview
- Current CMS: _____
- Content volume: _____ pages
- Special requirements: _____

## Entity Inventory

### Content Types
| Name | Complexity | Hours | Notes |
|------|-----------|-------|-------|
| ... | Simple/Medium/Complex | X | ... |

**Subtotal:** _____ hours

### Paragraph Types
| Name | Complexity | Hours | Notes |
|------|-----------|-------|-------|
| ... | Simple/Medium/Complex | X | ... |

**Subtotal:** _____ hours

### Taxonomies
| Name | Complexity | Hours | Notes |
|------|-----------|-------|-------|
| ... | Simple/Medium/Complex | X | ... |

**Subtotal:** _____ hours

### Views
| Name | Complexity | Hours | Notes |
|------|-----------|-------|-------|
| ... | Simple/Medium/Complex | X | ... |

**Subtotal:** _____ hours

### Webforms
| Name | Complexity | Hours | Notes |
|------|-----------|-------|-------|
| ... | Simple/Medium/Complex | X | ... |

**Subtotal:** _____ hours

### Theme Components (SDC)
| Name | Complexity | Hours | Notes |
|------|-----------|-------|-------|
| ... | Simple/Medium/Complex | X | ... |

**Subtotal:** _____ hours

### Custom Modules
| Name | Description | Hours | Notes |
|------|-----------|-------|-------|
| ... | ... | X | ... |

**Subtotal:** _____ hours

## Base Total: _____ hours

## Multipliers

- [ ] Testing (+____%): _____ hours
- [ ] Documentation (+____%): _____ hours
- [ ] QA (+____%): _____ hours
- [ ] Multilingual (+____%): _____ hours
- [ ] Advanced Permissions (+____%): _____ hours
- [ ] Custom Integrations (+____%): _____ hours
- [ ] Security (+____%): _____ hours
- [ ] Performance (+____%): _____ hours
- [ ] Accessibility (+____%): _____ hours

**Multipliers Total:** _____ hours

## Additional Effort

- Infrastructure setup: _____ hours
- Project management (____%): _____ hours
- Training & handover: _____ hours

**Additional Total:** _____ hours

## Migration

- Content types to migrate: _____
- Volume: _____ nodes
- Complexity: Simple/Medium/Complex
- Estimated hours: _____ hours

## Subtotal: _____ hours

## Buffer

- Risk level: Low/Medium/High
- Buffer (%): _____%
- Buffer hours: _____ hours

## TOTAL ESTIMATE: _____ hours

## Timeline

- Hours per week: _____ h
- Team size: _____ developers
- Estimated weeks: _____ weeks
- Estimated months: _____ months

## Cost Estimate (Optional)

- Hourly rate: € _____ / hour
- **Total cost: € _____**

## Assumptions

1. _____
2. _____
3. _____

## Risks

1. _____
2. _____
3. _____

## Notes

_____
```

## Validation Checklist

Before finalizing estimate:

- [ ] All entity types inventoried
- [ ] Complexity classifications justified
- [ ] Multipliers applied correctly
- [ ] Migration effort included
- [ ] Setup/overhead included
- [ ] PM effort included
- [ ] Testing effort included
- [ ] Documentation effort included
- [ ] Buffer applied
- [ ] Timeline calculated
- [ ] Compared to baseline
- [ ] Assumptions documented
- [ ] Risks identified
- [ ] Client requirements validated

## Final Notes

**Remember:**
- Estimates are ranges, not guarantees
- Document all assumptions
- Communicate confidence levels
- Plan for iterations
- Buffer for unknowns
- Validate with team
- Review historical data
- Update estimates as needed

**Best Practice:**
Present estimates as ranges:
- Optimistic: Base estimate
- Likely: Base + 20% buffer
- Pessimistic: Base + 30% buffer

This gives clients realistic expectations and builds trust.
