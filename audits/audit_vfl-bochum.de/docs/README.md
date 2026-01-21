# VfL Bochum 1848 Website Relaunch - Website Audit Documentation

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

- **Audit Date**: 2025-11-26
- **Method**: AI-powered analysis with MCP tools
- **Baseline**: adessoCMS Drupal 11 project
