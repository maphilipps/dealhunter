#!/usr/bin/env python3
"""
VitePress Site Generator for Website Audits

This script generates a VitePress documentation site from audit data.
It creates the necessary structure, config files, and markdown pages.

Usage:
    python generate_vitepress_site.py <audit_data_dir> <output_dir>

Audit data directory should contain:
    - audit_report.json (structured audit data)
    - screenshots/ (optional)
    - diagrams/ (optional)
"""

import json
import os
import sys
import shutil
from pathlib import Path
from datetime import datetime
from typing import Dict, Any, List


def create_vitepress_structure(output_dir: Path) -> None:
    """Create the basic VitePress directory structure."""
    docs_dir = output_dir / "docs"
    docs_dir.mkdir(parents=True, exist_ok=True)

    # Create subdirectories
    (docs_dir / "public").mkdir(exist_ok=True)
    (docs_dir / "public" / "screenshots").mkdir(exist_ok=True)
    (docs_dir / "public" / "diagrams").mkdir(exist_ok=True)
    (docs_dir / ".vitepress").mkdir(exist_ok=True)

    # Create sections
    sections = ["content-architecture", "features", "performance",
                "accessibility", "migration", "estimation"]
    for section in sections:
        (docs_dir / section).mkdir(exist_ok=True)


def generate_config(output_dir: Path, project_name: str, audit_date: str) -> None:
    """Generate VitePress config file with adesso branding."""
    config_content = f"""import {{ defineConfig }} from 'vitepress'

export default defineConfig({{
  title: '{project_name} - Website Audit',
  description: 'Comprehensive website audit for Drupal relaunch',

  // Disable dark mode (adesso theme is light mode only)
  appearance: false,

  // Load Google Fonts for adesso corporate typography
  head: [
    ['link', {{ rel: 'preconnect', href: 'https://fonts.googleapis.com' }}],
    ['link', {{ rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' }}],
    ['link', {{
      rel: 'stylesheet',
      href: 'https://fonts.googleapis.com/css2?family=Fira+Sans:wght@400;600;700&family=Fira+Sans+Condensed:wght@400;600;700&display=swap'
    }}]
  ],

  themeConfig: {{
    logo: '/logo.svg',
    nav: [
      {{ text: 'Home', link: '/' }},
      {{ text: 'Architecture', link: '/content-architecture/' }},
      {{ text: 'Estimation', link: '/estimation/' }}
    ],
    sidebar: [
      {{
        text: 'Executive Summary',
        items: [
          {{ text: 'Overview', link: '/index' }},
          {{ text: 'Key Findings', link: '/key-findings' }},
          {{ text: 'Recommendations', link: '/recommendations' }}
        ]
      }},
      {{
        text: 'Current Site Analysis',
        items: [
          {{ text: 'Technology Stack', link: '/current-site/technology' }},
          {{ text: 'Content Volume', link: '/current-site/volume' }},
          {{ text: 'Site Structure', link: '/current-site/structure' }}
        ]
      }},
      {{
        text: 'Content Architecture',
        items: [
          {{ text: 'Overview', link: '/content-architecture/' }},
          {{ text: 'Page Types', link: '/content-architecture/page-types' }},
          {{ text: 'Components', link: '/content-architecture/components' }},
          {{ text: 'Taxonomies', link: '/content-architecture/taxonomies' }},
          {{ text: 'Media', link: '/content-architecture/media' }}
        ]
      }},
      {{
        text: 'Features & Functionality',
        items: [
          {{ text: 'Overview', link: '/features/' }},
          {{ text: 'Interactive Features', link: '/features/interactive' }},
          {{ text: 'Navigation', link: '/features/navigation' }},
          {{ text: 'Views & Listings', link: '/features/listings' }}
        ]
      }},
      {{
        text: 'Performance Analysis',
        items: [
          {{ text: 'Overview', link: '/performance/' }},
          {{ text: 'Core Web Vitals', link: '/performance/core-web-vitals' }},
          {{ text: 'Asset Optimization', link: '/performance/assets' }},
          {{ text: 'Recommendations', link: '/performance/recommendations' }}
        ]
      }},
      {{
        text: 'Accessibility Audit',
        items: [
          {{ text: 'Overview', link: '/accessibility/' }},
          {{ text: 'WCAG 2.1 Audit', link: '/accessibility/wcag-audit' }},
          {{ text: 'Issues Found', link: '/accessibility/issues' }},
          {{ text: 'Remediation Plan', link: '/accessibility/remediation' }}
        ]
      }},
      {{
        text: '🔌 Integrationen',
        items: [
          {{ text: 'Übersicht & Systemlandschaft', link: '/integrationen/' }},
          {{ text: 'SSO & Authentication', link: '/integrationen/sso' }},
          {{ text: 'APIs & External Systems', link: '/integrationen/apis' }},
          {{ text: 'CDN & Performance', link: '/integrationen/cdn' }},
          {{ text: 'Search & Analytics', link: '/integrationen/search' }}
        ]
      }},
      {{
        text: 'Migration Plan',
        items: [
          {{ text: 'Overview', link: '/migration/' }},
          {{ text: 'Approach', link: '/migration/approach' }},
          {{ text: 'Content Cleanup', link: '/migration/cleanup' }},
          {{ text: 'Complexity', link: '/migration/complexity' }}
        ]
      }},
      {{
        text: 'Drupal Architecture',
        items: [
          {{ text: 'Overview', link: '/drupal/' }},
          {{ text: 'Content Types', link: '/drupal/content-types' }},
          {{ text: 'Paragraph Types', link: '/drupal/paragraphs' }},
          {{ text: 'Views', link: '/drupal/views' }},
          {{ text: 'Modules', link: '/drupal/modules' }}
        ]
      }},
      {{
        text: 'Estimation',
        items: [
          {{ text: 'Overview', link: '/estimation/' }},
          {{ text: 'Detailed Breakdown', link: '/estimation/breakdown' }},
          {{ text: 'Baseline Comparison', link: '/estimation/comparison' }},
          {{ text: 'Timeline', link: '/estimation/timeline' }},
          {{ text: 'Risk Assessment', link: '/estimation/risks' }}
        ]
      }},
      {{
        text: 'Appendices',
        items: [
          {{ text: 'Screenshots', link: '/appendices/screenshots' }},
          {{ text: 'Data Tables', link: '/appendices/data-tables' }},
          {{ text: 'Assumptions', link: '/appendices/assumptions' }}
        ]
      }}
    ],
    socialLinks: [
      {{ icon: 'github', link: 'https://github.com/yourusername/project' }}
    ],
    footer: {{
      message: 'Audit conducted using Claude Code website-audit skill',
      copyright: 'Copyright © {datetime.now().year} - Audit Date: {audit_date}'
    }}
  }}
}})
"""

    config_path = output_dir / "docs" / ".vitepress" / "config.ts"
    config_path.write_text(config_content)


def generate_theme_files(output_dir: Path) -> None:
    """Copy adesso SE corporate theme files from template."""
    # Get the skill directory (script is in scripts/, theme is in assets/)
    script_dir = Path(__file__).parent
    skill_dir = script_dir.parent
    theme_template_dir = skill_dir / "assets" / "vitepress-theme" / ".vitepress" / "theme"

    # Target directory
    theme_dir = output_dir / "docs" / ".vitepress" / "theme"
    theme_dir.mkdir(parents=True, exist_ok=True)

    # Copy theme files from template
    if theme_template_dir.exists():
        for file in theme_template_dir.glob("*"):
            if file.is_file():
                shutil.copy2(file, theme_dir / file.name)
    else:
        print(f"⚠️  Warning: Theme template not found at {theme_template_dir}")
        print("   Falling back to inline theme generation...")

        # Fallback: Generate theme inline if template not found
        (theme_dir / "index.js").write_text("""import DefaultTheme from 'vitepress/theme'
import './custom.css'

export default DefaultTheme
""")

        (theme_dir / "custom.css").write_text("""/* adesso SE Corporate Theme - Fallback */
:root {
  --vp-c-brand-1: #006EC7;
  --vp-font-family-base: 'Fira Sans', sans-serif;
  font-size: 17px;
}
.VPNav, .VPNavBar { background: linear-gradient(135deg, #006EC7 0%, #461EBE 100%) !important; }
.VPNavBar * { color: #FFFFFF !important; }
.VPSidebar { background: linear-gradient(180deg, #006EC7 0%, #461EBE 100%) !important; }
.VPSidebar * { color: #FFFFFF !important; }
""")


def generate_index(output_dir: Path, audit_data: Dict[str, Any]) -> None:
    """Generate the main index page."""
    project_name = audit_data.get("project_name", "Website")
    audit_date = audit_data.get("audit_date", datetime.now().strftime("%Y-%m-%d"))
    current_cms = audit_data.get("current_cms", "Unknown")
    url = audit_data.get("url", "")

    summary = audit_data.get("summary", {})
    content_types = summary.get("content_types", 0)
    paragraphs = summary.get("paragraphs", 0)
    total_pages = summary.get("total_pages", 0)
    estimated_hours = summary.get("estimated_hours", 0)

    content = f"""---
layout: home

hero:
  name: "{project_name}"
  text: "Website Audit Report"
  tagline: Comprehensive analysis for Drupal relaunch
  actions:
    - theme: brand
      text: View Executive Summary
      link: /key-findings
    - theme: alt
      text: See Estimation
      link: /estimation/

features:
  - icon: 📊
    title: Content Architecture
    details: {content_types} content types mapped to Drupal entities
    link: /content-architecture/
  - icon: 🧩
    title: Component Library
    details: {paragraphs} reusable components identified
    link: /content-architecture/components
  - icon: ⚡
    title: Performance Analysis
    details: Core Web Vitals assessment and optimization recommendations
    link: /performance/
  - icon: ♿
    title: Accessibility Audit
    details: WCAG 2.1 Level AA compliance review
    link: /accessibility/
  - icon: 🚀
    title: Migration Plan
    details: Structured approach for {total_pages:,} pages
    link: /migration/
  - icon: 💰
    title: Project Estimation
    details: Detailed breakdown of {estimated_hours:,} estimated hours
    link: /estimation/
---

## Project Overview

| Property | Value |
|----------|-------|
| **Website** | [{url}]({url}) |
| **Current CMS** | {current_cms} |
| **Audit Date** | {audit_date} |
| **Total Pages** | {total_pages:,} |
| **Estimated Effort** | {estimated_hours:,} hours |

## Quick Links

- [📋 Key Findings](/key-findings)
- [🏗️ Drupal Architecture](/drupal/)
- [📈 Estimation Breakdown](/estimation/breakdown)
- [⚠️ Risk Assessment](/estimation/risks)
- [🎯 Recommendations](/recommendations)

## Audit Methodology

This audit was conducted using the **website-audit** skill for Claude Code, which provides:

- ✅ **AI-first analysis** using Chrome DevTools MCP, Puppeteer, and Accessibility tools
- ✅ **Baseline comparison** against adessoCMS reference project
- ✅ **Drupal-native thinking** - all features mapped to Content Types, Paragraphs, Taxonomies
- ✅ **Comprehensive estimation** - bottom-up calculation with baseline validation
- ✅ **Risk-adjusted planning** - buffers for unknowns and complexity factors

## Navigation

Use the sidebar to navigate through the complete audit report, or jump to key sections:

### Analysis Sections
1. **Current Site Analysis** - Technology stack, content volume, structure
2. **Content Architecture** - Page types, components, taxonomies, media
3. **Features & Functionality** - Interactive features, navigation, listings
4. **Performance Analysis** - Core Web Vitals, asset optimization
5. **Accessibility Audit** - WCAG 2.1 compliance, remediation plan

### Planning Sections
6. **Migration Plan** - Approach, complexity, cleanup requirements
7. **Drupal Architecture** - Content types, paragraphs, views, modules
8. **Estimation** - Detailed breakdown, timeline, risks

---

::: tip Audit conducted with Claude Code
This audit report was generated using AI-powered analysis tools to provide comprehensive, accurate insights for your Drupal relaunch project.
:::
"""

    index_path = output_dir / "docs" / "index.md"
    index_path.write_text(content)


def generate_key_findings(output_dir: Path, audit_data: Dict[str, Any]) -> None:
    """Generate key findings page."""
    findings = audit_data.get("key_findings", {})

    content = f"""# Key Findings

## Executive Summary

{findings.get('executive_summary', 'This section summarizes the key findings from the comprehensive website audit.')}

## Highlights

### Strengths ✅

{chr(10).join(f'- {item}' for item in findings.get('strengths', ['Strong content organization', 'Clear navigation structure', 'Good performance baseline']))}

### Opportunities 🎯

{chr(10).join(f'- {item}' for item in findings.get('opportunities', ['Improve accessibility compliance', 'Optimize asset loading', 'Enhance mobile experience']))}

### Challenges ⚠️

{chr(10).join(f'- {item}' for item in findings.get('challenges', ['Complex migration requirements', 'Legacy code cleanup needed', 'Performance optimization required']))}

## Project Scope

### Scale Classification

**Size:** {findings.get('project_size', 'Medium')}

This project is comparable to **{findings.get('baseline_percentage', '~60-80%')}** of the adessoCMS baseline project.

### Complexity Assessment

**Overall Complexity:** {findings.get('complexity', 'Medium')}

{findings.get('complexity_rationale', 'The project requires standard Drupal architecture patterns with moderate custom development.')}

## Critical Success Factors

1. **Content Migration Strategy**
   - {findings.get('migration_priority', 'Structured export approach with automated cleanup')}

2. **Performance Targets**
   - {findings.get('performance_target', 'Achieve Core Web Vitals: LCP < 2.5s, FID < 100ms, CLS < 0.1')}

3. **Accessibility Compliance**
   - {findings.get('accessibility_target', 'Full WCAG 2.1 Level AA compliance required')}

4. **Timeline Considerations**
   - {findings.get('timeline_note', 'Realistic timeline with appropriate buffers for risk mitigation')}

## Recommendations Summary

See [Detailed Recommendations](/recommendations) for full analysis.

### Immediate Actions

{chr(10).join(f'{i+1}. {item}' for i, item in enumerate(findings.get('immediate_actions', ['Finalize content type specifications', 'Set up development environment', 'Begin migration planning'])))}

### Strategic Decisions

{chr(10).join(f'{i+1}. {item}' for i, item in enumerate(findings.get('strategic_decisions', ['Choose paragraph architecture pattern', 'Select theme framework (Tailwind + SDC recommended)', 'Define testing strategy'])))}

## Next Steps

1. **Review this audit** with stakeholders
2. **Validate assumptions** documented in appendices
3. **Approve architecture** decisions
4. **Confirm budget and timeline**
5. **Proceed to implementation** planning

---

[View Detailed Estimation →](/estimation/)
"""

    path = output_dir / "docs" / "key-findings.md"
    path.write_text(content)


def generate_package_json(output_dir: Path, project_name: str) -> None:
    """Generate package.json for VitePress."""
    package_content = {
        "name": f"{project_name.lower().replace(' ', '-')}-audit",
        "version": "1.0.0",
        "description": f"Website audit documentation for {project_name}",
        "scripts": {
            "docs:dev": "vitepress dev docs",
            "docs:build": "vitepress build docs",
            "docs:preview": "vitepress preview docs"
        },
        "devDependencies": {
            "vitepress": "^1.0.0"
        }
    }

    path = output_dir / "package.json"
    path.write_text(json.dumps(package_content, indent=2))


def copy_assets(audit_data_dir: Path, output_dir: Path) -> None:
    """Copy screenshots and diagrams to public folder."""
    docs_public = output_dir / "docs" / "public"

    # Copy screenshots
    screenshots_src = audit_data_dir / "screenshots"
    if screenshots_src.exists():
        screenshots_dst = docs_public / "screenshots"
        if screenshots_dst.exists():
            shutil.rmtree(screenshots_dst)
        shutil.copytree(screenshots_src, screenshots_dst)

    # Copy diagrams
    diagrams_src = audit_data_dir / "diagrams"
    if diagrams_src.exists():
        diagrams_dst = docs_public / "diagrams"
        if diagrams_dst.exists():
            shutil.rmtree(diagrams_dst)
        shutil.copytree(diagrams_src, diagrams_dst)


def generate_readme(output_dir: Path, project_name: str) -> None:
    """Generate README with instructions."""
    content = f"""# {project_name} - Website Audit Documentation

This is a VitePress site containing the comprehensive website audit report.

## Setup

Install dependencies:

```bash
npm install
```

## Development

Run the development server:

```bash
npm run docs:dev
```

Visit http://localhost:5173

## Build

Build the static site:

```bash
npm run docs:build
```

Output will be in `docs/.vitepress/dist/`

## Preview Production Build

```bash
npm run docs:preview
```

## Deployment

The built site in `docs/.vitepress/dist/` can be deployed to:

- **Netlify**: Drag & drop the dist folder
- **Vercel**: Connect repository and deploy
- **GitHub Pages**: Use GitHub Actions workflow
- **Any static host**: Upload dist folder contents

## Documentation Structure

```
docs/
├── index.md                    # Homepage
├── key-findings.md            # Executive summary
├── recommendations.md          # Strategic recommendations
├── current-site/              # Current site analysis
├── content-architecture/      # Content structure analysis
├── features/                  # Feature inventory
├── performance/               # Performance analysis
├── accessibility/             # Accessibility audit
├── migration/                 # Migration planning
├── drupal/                    # Drupal architecture design
├── estimation/                # Project estimation
└── appendices/                # Supporting materials
```

## About

This audit was generated using the **website-audit** skill for Claude Code.

- **Audit Date**: {datetime.now().strftime("%Y-%m-%d")}
- **Method**: AI-powered analysis with MCP tools
- **Baseline**: adessoCMS Drupal 11 project
"""

    path = output_dir / "README.md"
    path.write_text(content)


def main():
    """Main execution function."""
    if len(sys.argv) < 3:
        print("Usage: python generate_vitepress_site.py <audit_data_dir> <output_dir>")
        print("\nExample:")
        print("  python generate_vitepress_site.py ./audit_data ./site-audit-docs")
        sys.exit(1)

    audit_data_dir = Path(sys.argv[1])
    output_dir = Path(sys.argv[2])

    # Load audit data
    audit_json = audit_data_dir / "audit_report.json"
    if not audit_json.exists():
        print(f"Error: audit_report.json not found in {audit_data_dir}")
        sys.exit(1)

    with open(audit_json, 'r') as f:
        audit_data = json.load(f)

    project_name = audit_data.get("project_name", "Website Audit")
    audit_date = audit_data.get("audit_date", datetime.now().strftime("%Y-%m-%d"))

    print(f"🚀 Generating VitePress site for: {project_name}")
    print(f"📅 Audit date: {audit_date}")
    print(f"📁 Output directory: {output_dir}")

    # Create structure
    print("\n📂 Creating directory structure...")
    create_vitepress_structure(output_dir)

    # Generate config
    print("⚙️  Generating VitePress config...")
    generate_config(output_dir, project_name, audit_date)

    # Generate adesso theme
    print("🎨 Generating adesso SE corporate theme...")
    generate_theme_files(output_dir)

    # Generate pages
    print("📄 Generating pages...")
    generate_index(output_dir, audit_data)
    generate_key_findings(output_dir, audit_data)

    # Generate package.json
    print("📦 Generating package.json...")
    generate_package_json(output_dir, project_name)

    # Copy assets
    print("🖼️  Copying assets...")
    copy_assets(audit_data_dir, output_dir)

    # Generate README
    print("📝 Generating README...")
    generate_readme(output_dir, project_name)

    print("\n✅ VitePress site generated successfully!")
    print(f"\nNext steps:")
    print(f"  cd {output_dir}")
    print(f"  npm install")
    print(f"  npm run docs:dev")
    print(f"\n📚 Documentation will be available at http://localhost:5173")


if __name__ == "__main__":
    main()
