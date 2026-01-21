import { defineConfig } from 'vitepress'
import { withMermaid } from 'vitepress-plugin-mermaid'

export default withMermaid(
  defineConfig({
    title: 'VfL Bochum 1848 Website Relaunch - Website Audit',
    description: 'Comprehensive website audit for Drupal relaunch',

    // Disable dark mode (adesso theme is light mode only)
    appearance: false,

    // Ignore dead links during build
    ignoreDeadLinks: true,

    // Load Google Fonts for adesso corporate typography
    head: [
      ['link', { rel: 'preconnect', href: 'https://fonts.googleapis.com' }],
      ['link', { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' }],
      ['link', {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=Fira+Sans:wght@400;600;700&family=Fira+Sans+Condensed:wght@400;600;700&display=swap'
      }]
    ],

    themeConfig: {
      logo: '/logo.svg',
      nav: [
        { text: 'Home', link: '/' },
        { text: 'Architecture', link: '/content-architecture/' },
        { text: 'Estimation', link: '/estimation/' }
      ],
      sidebar: [
        {
          text: 'Executive Summary',
          items: [
            { text: 'Overview', link: '/index' },
            { text: 'Key Findings', link: '/key-findings' },
            { text: 'Recommendations', link: '/recommendations' }
          ]
        },
        {
          text: 'Current Site Analysis',
          items: [
            { text: 'Technology Stack', link: '/current-site/technology' },
            { text: 'Content Volume', link: '/current-site/volume' },
            { text: 'Site Structure', link: '/current-site/structure' }
          ]
        },
        {
          text: 'Content Architecture',
          items: [
            { text: 'Overview', link: '/content-architecture/' },
            { text: 'Page Types', link: '/content-architecture/page-types' },
            { text: 'Components', link: '/content-architecture/components' },
            { text: 'Taxonomies', link: '/content-architecture/taxonomies' },
            { text: 'Media', link: '/content-architecture/media' }
          ]
        },
        {
          text: 'Features & Functionality',
          items: [
            { text: 'Overview', link: '/features/' },
            { text: 'Interactive Features', link: '/features/interactive' },
            { text: 'Navigation', link: '/features/navigation' },
            { text: 'Views & Listings', link: '/features/listings' }
          ]
        },
        {
          text: 'Performance Analysis',
          items: [
            { text: 'Overview', link: '/performance/' },
            { text: 'Core Web Vitals', link: '/performance/core-web-vitals' },
            { text: 'Asset Optimization', link: '/performance/assets' },
            { text: 'Recommendations', link: '/performance/recommendations' }
          ]
        },
        {
          text: 'Accessibility Audit',
          items: [
            { text: 'Overview', link: '/accessibility/' },
            { text: 'WCAG 2.1 Audit', link: '/accessibility/wcag-audit' },
            { text: 'Issues Found', link: '/accessibility/issues' },
            { text: 'Remediation Plan', link: '/accessibility/remediation' }
          ]
        },
        {
          text: 'Integrationen',
          items: [
            { text: 'Übersicht & Systemlandschaft', link: '/integrationen/' },
            { text: 'SSO & Authentication', link: '/integrationen/sso' },
            { text: 'APIs & External Systems', link: '/integrationen/apis' },
            { text: 'CDN & Performance', link: '/integrationen/cdn' },
            { text: 'Search & Analytics', link: '/integrationen/search' }
          ]
        },
        {
          text: 'Migration Plan',
          items: [
            { text: 'Overview', link: '/migration/' },
            { text: 'Approach', link: '/migration/approach' },
            { text: 'Content Cleanup', link: '/migration/cleanup' },
            { text: 'Complexity', link: '/migration/complexity' }
          ]
        },
        {
          text: 'Drupal Architecture',
          items: [
            { text: 'Overview', link: '/drupal/' },
            { text: 'Content Types', link: '/drupal/content-types' },
            { text: 'Paragraph Types', link: '/drupal/paragraphs' },
            { text: 'Views', link: '/drupal/views' },
            { text: 'Modules', link: '/drupal/modules' }
          ]
        },
        {
          text: 'Estimation',
          items: [
            { text: 'Overview', link: '/estimation/' },
            { text: 'Detailed Breakdown', link: '/estimation/breakdown' },
            { text: 'Baseline Comparison', link: '/estimation/comparison' },
            { text: 'Timeline', link: '/estimation/timeline' },
            { text: 'Risk Assessment', link: '/estimation/risks' }
          ]
        },
        {
          text: 'Appendices',
          items: [
            { text: 'Screenshots', link: '/appendices/screenshots' },
            { text: 'Data Tables', link: '/appendices/data-tables' },
            { text: 'Assumptions', link: '/appendices/assumptions' }
          ]
        }
      ],
      socialLinks: [
        { icon: 'github', link: 'https://github.com/yourusername/project' }
      ],
      footer: {
        message: 'Audit conducted using Claude Code website-audit skill',
        copyright: 'Copyright © 2025 - Audit Date: 2025-11-26'
      }
    },

    // Mermaid configuration
    mermaid: {
      // Mermaid options
    },
    mermaidPlugin: {
      class: "mermaid my-class"
    }
  })
)
