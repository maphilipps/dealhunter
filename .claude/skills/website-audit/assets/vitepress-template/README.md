# VitePress Template for Website Audits

This directory contains template files for generating VitePress documentation sites for website audits.

## Structure

The generate_vitepress_site.py script creates the following structure:

```
output-dir/
├── README.md                      # Setup instructions
├── package.json                   # NPM dependencies
└── docs/
    ├── .vitepress/
    │   └── config.ts             # VitePress configuration
    ├── public/
    │   ├── screenshots/          # Screenshot images
    │   └── diagrams/             # Architecture diagrams
    ├── index.md                  # Homepage
    ├── key-findings.md           # Executive summary
    ├── recommendations.md         # Recommendations
    ├── current-site/             # Current site analysis
    │   ├── technology.md
    │   ├── volume.md
    │   └── structure.md
    ├── content-architecture/     # Content structure
    │   ├── index.md
    │   ├── page-types.md
    │   ├── components.md
    │   ├── taxonomies.md
    │   └── media.md
    ├── features/                 # Features & functionality
    │   ├── index.md
    │   ├── interactive.md
    │   ├── navigation.md
    │   └── listings.md
    ├── performance/              # Performance analysis
    │   ├── index.md
    │   ├── core-web-vitals.md
    │   ├── assets.md
    │   └── recommendations.md
    ├── accessibility/            # Accessibility audit
    │   ├── index.md
    │   ├── wcag-audit.md
    │   ├── issues.md
    │   └── remediation.md
    ├── migration/                # Migration planning
    │   ├── index.md
    │   ├── approach.md
    │   ├── cleanup.md
    │   └── complexity.md
    ├── drupal/                   # Drupal architecture
    │   ├── index.md
    │   ├── content-types.md
    │   ├── paragraphs.md
    │   ├── views.md
    │   └── modules.md
    ├── estimation/               # Project estimation
    │   ├── index.md
    │   ├── breakdown.md
    │   ├── comparison.md
    │   ├── timeline.md
    │   └── risks.md
    └── appendices/               # Supporting materials
        ├── screenshots.md
        ├── data-tables.md
        └── assumptions.md
```

## Usage

### 1. Prepare Audit Data

Create an `audit_report.json` file with the following structure:

```json
{
  "project_name": "Example Website",
  "url": "https://example.com",
  "current_cms": "WordPress",
  "audit_date": "2025-11-13",
  "summary": {
    "content_types": 6,
    "paragraphs": 25,
    "total_pages": 350,
    "estimated_hours": 650
  },
  "key_findings": {
    "executive_summary": "...",
    "strengths": ["..."],
    "opportunities": ["..."],
    "challenges": ["..."],
    "project_size": "Medium",
    "complexity": "Medium-High"
  }
}
```

### 2. Generate Site

```bash
python scripts/generate_vitepress_site.py <audit_data_dir> <output_dir>
```

### 3. Install and Run

```bash
cd output_dir
npm install
npm run docs:dev
```

### 4. Build for Production

```bash
npm run docs:build
```

## Customization

### Theme Colors

Edit `docs/.vitepress/config.ts` to customize colors:

```ts
themeConfig: {
  // ... other config
}
```

### Navigation

Modify the `sidebar` array in `config.ts` to add/remove sections.

### Styling

Add custom CSS by creating `docs/.vitepress/theme/custom.css` and importing it in `docs/.vitepress/theme/index.ts`.

## Content Guidelines

### Screenshots

- Save to `docs/public/screenshots/`
- Reference in markdown: `![Description](/screenshots/image.png)`
- Use descriptive filenames: `homepage-hero.png`, `news-listing.png`

### Diagrams

- Save to `docs/public/diagrams/`
- Use PlantUML, Mermaid, or exported images
- Reference: `![Diagram](/diagrams/architecture.svg)`

### Tables

Use markdown tables for data:

```markdown
| Entity | Count | Complexity |
|--------|-------|-----------|
| Content Types | 6 | Medium |
| Paragraphs | 25 | Medium-High |
```

### Code Blocks

Use syntax highlighting:

```markdown
```php
// Example Drupal code
function example_hook_entity_view() {
  // ...
}
` ``
```

### Callouts

VitePress supports special callouts:

```markdown
::: tip Performance Tip
Enable caching for better performance
:::

::: warning Migration Warning
This requires manual content cleanup
:::

::: danger Security Issue
Address this vulnerability immediately
:::

::: info Baseline Comparison
This is 62% of the adessoCMS baseline
:::
```

## Deployment

### Netlify

1. Build the site: `npm run docs:build`
2. Drag `docs/.vitepress/dist` folder to Netlify

### Vercel

1. Connect your Git repository
2. Set build command: `npm run docs:build`
3. Set output directory: `docs/.vitepress/dist`

### GitHub Pages

Add `.github/workflows/deploy.yml`:

```yaml
name: Deploy VitePress site

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - run: npm ci
      - run: npm run docs:build
      - uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: docs/.vitepress/dist
```

## Tips

1. **Use consistent naming** - Keep filenames lowercase with hyphens
2. **Organize by section** - Group related pages in directories
3. **Link liberally** - Cross-reference between pages
4. **Include visuals** - Screenshots and diagrams improve comprehension
5. **Keep pages focused** - One topic per page
6. **Use callouts** - Highlight important information
7. **Test locally** - Always preview before building

## Example Pages

See the generated files for complete examples of each page type.
