---
title: "VitePress Audit Documentation Generation from JSON Data"
category: documentation-generation
date: 2025-11-27
status: solved
problem_type: workflow
component: website-audit-skill
symptoms:
  - VitePress site with navigation config but empty pages
  - Audit data in JSON format not rendered as documentation
  - Missing markdown files for all sidebar sections
root_cause: VitePress config had navigation defined but corresponding markdown files were never generated from audit data
solution_verified: true
prevention_possible: true
tags:
  - vitepress
  - documentation
  - audit
  - drupal
  - netlify
  - website-audit-skill
related_issues: []
---

# VitePress Audit Documentation Generation from JSON Data

## Problem Symptom

VitePress documentation site had:
- Complete navigation configuration in `.vitepress/config.ts`
- Sidebar with all sections defined (Content Architecture, Features, Performance, etc.)
- Empty folders for each section
- No actual markdown content files
- Audit data available in `audit_data/audit_report.json` and `audit_data/entities.json`

User reported: "Da fehlt doch alles in der Vitepress. Haben kein Navigation, etc..."

## Investigation Steps

1. **Checked VitePress config** - Navigation was properly defined in `config.ts`
2. **Examined directory structure** - Found empty folders for each section
3. **Read audit data files** - Complete audit data existed in JSON format
4. **Identified gap** - Script to generate markdown from JSON was missing or not run

## Root Cause

The VitePress site was created with:
- Full navigation configuration
- Directory structure
- But the markdown generation step was skipped

The `generate_vitepress_site.py` script from the website-audit skill should populate all sections, but in this case only partial files existed.

## Working Solution

### Step 1: Analyze Existing Data

Read the audit data files to understand available content:

```bash
# Key files with audit data
audit_data/audit_report.json  # Full audit findings
audit_data/entities.json      # Entity breakdown for estimation
audit_data/estimation_report.md  # Estimation calculations
```

### Step 2: Generate Missing Markdown Files

Create markdown files for each section based on audit data:

**Directory Structure:**
```
docs/docs/
├── index.md                    # Homepage with project overview
├── key-findings.md             # Executive summary
├── recommendations.md          # Strategic recommendations
├── current-site/
│   ├── technology.md           # Technology stack analysis
│   ├── volume.md               # Content volume metrics
│   └── structure.md            # Site structure analysis
├── content-architecture/
│   ├── index.md                # Overview
│   ├── page-types.md           # Content types
│   ├── components.md           # Paragraph components
│   ├── taxonomies.md           # Vocabularies
│   └── media.md                # Media types
├── features/
│   ├── index.md                # Overview
│   ├── interactive.md          # Interactive features
│   ├── navigation.md           # Navigation patterns
│   └── listings.md             # Views and listings
├── performance/
│   ├── index.md                # Overview
│   ├── core-web-vitals.md      # CWV metrics
│   ├── assets.md               # Asset optimization
│   └── recommendations.md      # Performance recommendations
├── accessibility/
│   ├── index.md                # Overview
│   ├── wcag-audit.md           # WCAG 2.1 audit
│   ├── issues.md               # Found issues
│   └── remediation.md          # Remediation plan
├── integrationen/
│   ├── index.md                # System landscape
│   ├── apis.md                 # External APIs
│   ├── sso.md                  # Authentication
│   ├── cdn.md                  # CDN setup
│   └── search.md               # Search integration
├── migration/
│   ├── index.md                # Overview
│   ├── approach.md             # Migration approach
│   ├── cleanup.md              # Content cleanup
│   └── complexity.md           # Complexity assessment
├── drupal/
│   ├── index.md                # Architecture overview
│   ├── content-types.md        # Content type definitions
│   ├── paragraphs.md           # Paragraph types
│   ├── views.md                # View configurations
│   └── modules.md              # Required modules
├── estimation/
│   ├── index.md                # Overview
│   ├── breakdown.md            # Detailed breakdown
│   ├── comparison.md           # Baseline comparison
│   ├── timeline.md             # Project timeline
│   └── risks.md                # Risk assessment
└── appendices/
    ├── screenshots.md          # Visual documentation
    ├── data-tables.md          # Complete data tables
    └── assumptions.md          # Project assumptions
```

### Step 3: Update Homepage with Correct Values

Fix placeholder values (0s) in `index.md`:

```yaml
features:
  - icon: 📊
    title: Content Architecture
    details: 9 content types mapped to Drupal entities  # Was: 0
  - icon: 🧩
    title: Component Library
    details: 18 reusable Paragraph components identified  # Was: 0
  - icon: 💰
    title: Project Estimation
    details: Detailed breakdown of 2,168 estimated hours  # Was: 0
```

### Step 4: Fix Screenshot References

Remove references to non-existent screenshot files that cause build failures:

```markdown
# Instead of:
![Homepage](/screenshots/homepage-desktop.png)

# Use:
::: info Screenshot-Hinweis
Screenshots werden während des Live-Audits mit Chrome DevTools MCP erfasst.
:::
```

### Step 5: Build and Deploy

```bash
# Build VitePress
cd docs
npm run docs:build

# Deploy to Netlify
npx netlify deploy --prod --dir=docs/.vitepress/dist
```

## Key Data Points (VfL Bochum Example)

| Metric | Value |
|--------|-------|
| Website | https://www.vfl-bochum.de |
| Current CMS | BloomReach Experience Manager |
| Target CMS | Drupal CMS 2.0 |
| Content Types | 9 |
| Paragraph Types | 18 |
| Taxonomies | 4 |
| Views | 9 |
| Custom Modules | 4 |
| Estimated Hours | 2,168 |

## Prevention Strategies

### 1. Use Complete Generation Script

Always run the full generation pipeline:

```bash
python scripts/generate_vitepress_site.py audit_data docs --with-theme
```

### 2. Validate Before Deploy

Check that all navigation links have corresponding files:

```bash
# Extract links from config.ts and verify files exist
grep -oP "link: '[^']+'" docs/.vitepress/config.ts | \
  sed "s/link: '//g; s/'//g" | \
  while read link; do
    file="docs${link%.html}.md"
    [ -f "$file" ] || echo "Missing: $file"
  done
```

### 3. Use Build as Validation

The VitePress build will fail on missing referenced files:

```bash
npm run docs:build  # Catches missing images, broken links
```

## Related Documentation

- [website-audit skill](/Users/marc.philipps/.claude/skills/website-audit/README.md)
- [VitePress Documentation](https://vitepress.dev/)
- [Netlify CLI](https://docs.netlify.com/cli/get-started/)

## Deployment Result

**Live URL:** https://vfl-bochum-audit.netlify.app

**Files Generated:** 40+ markdown pages
**Build Time:** ~90 seconds
**Deploy Time:** ~30 seconds
