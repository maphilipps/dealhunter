/**
 * Seed Script: Locarno Festival Lead
 *
 * Creates a complete Lead for the Locarno Film Festival audit
 * for demo/presentation purposes.
 */

import { createId } from '@paralleldrive/cuid2';

import { db } from '../lib/db';
import {
  preQualifications,
  qualifications,
  quickScans,
  dealEmbeddings,
  websiteAudits,
} from '../lib/db/schema';

const USER_ID = 'eyfeoyanpr2ye2uhnr8edwqe'; // marc.philipps@adesso.de
const PHP_BU_ID = 'yt75ql93d7freq6zz9w6na2r'; // PHP Business Unit (Drupal)

// Hardcoded audit data extracted from AUDIT_SUMMARY.md
const AUDIT_DATA = {
  projectOverview: {
    name: 'Locarno Film Festival Website Relaunch',
    drupalVersion: '11.x',
    scale: {
      estimatedPages: '1700-2200',
      filmArchiveEntries: '10000+',
      languages: ['en', 'it', 'fr', 'de'],
      peakTraffic: '8000 requests/minute',
    },
    keyIntegrations: [
      'Shopify (merchandise)',
      'Vimeo/YouTube (video embeds)',
      'Film Archive Database',
    ],
  },
  performance: {
    coreWebVitals: { lcp: 364, cls: 0.0, ttfb: 53 },
    performanceGrade: 'B+',
    bottlenecks: [
      'Vimeo Video Auto-Load: 6 MB (68.7% der Seitengröße)',
      'Keine WebP-Bilder: 30-50% größer als nötig',
      'Font Loading blockiert Render: 235ms',
      'Shopify Buy Button: 227 KB',
    ],
  },
  accessibility: {
    overallScore: 75,
    wcagLevel: 'A',
    issues: { critical: 2, serious: 3 },
    remediationHours: 54,
  },
  costs: {
    year1: {
      development: 231400,
      hosting: 35400,
      support: 36000,
      training: 8000,
      monitoring: 3000,
      contingency: 15000,
      total: 328800,
    },
    tco5Years: 773520,
    budget: 250000,
    budgetDelta: 78800,
  },
  cmsComparison: {
    drupal: { score: 9.4, tco: 669638, license: 0, recommended: true },
    umbraco: { score: 8.8, tco: 667000, license: 70000, recommended: false },
    magnolia: { score: 7.2, tco: 864000, license: 345352, recommended: false },
  },
  timeline: {
    totalWeeks: 17,
    totalHours: 1760,
    startDate: '2025-01-06',
    endDate: '2025-04-15',
  },
};

async function seedLocarnoLead() {
  console.log('🎬 Creating Locarno Film Festival Lead...\n');

  // Generate IDs
  const preQualificationId = createId();
  const qualificationId = createId();
  const quickScanId = createId();
  const websiteAuditId = createId();

  // 1. Create RFP
  console.log('\n📄 Creating RFP...');
  await db.insert(preQualifications).values({
    id: preQualificationId,
    userId: USER_ID,
    source: 'proactive',
    stage: 'pre-qualification',
    inputType: 'freetext',
    rawInput: `Locarno Film Festival Website Relaunch

Das Locarno Film Festival benötigt einen kompletten Relaunch ihrer Website von Magnolia CMS 6.3 auf Drupal 11.

Umfang:
- 1.700-2.200 Seiten + 10.000+ Film-Archive-Einträge
- 4 Sprachen: EN, IT, FR, DE
- Peak-Last: 8.000 Anfragen/Minute während des Festivals
- Hosting: Microsoft Azure

Budget: CHF 250.000

Zeitplan: Go-Live Mitte April 2025`,
    extractedRequirements: JSON.stringify({
      customerName: 'Locarno Film Festival',
      projectName: 'Website Relaunch Drupal 11',
      projectDescription:
        'Migration von Magnolia CMS 6.3 auf Drupal 11 mit umfangreichem Film-Archiv (10.000+ Einträge), mehrsprachig (EN/IT/FR/DE), High-Traffic (8.000 req/min)',
      industry: 'Kultur & Entertainment',
      budget: 'CHF 250.000 - 330.000',
      deadline: '2025-04-15',
      websiteUrls: [{ url: 'https://www.locarnofestival.ch', type: 'primary' }],
      requirements: [
        'Migration von Magnolia CMS 6.3 auf Drupal 11',
        'Film-Archiv mit 10.000+ Einträgen',
        '4 Sprachen (EN, IT, FR, DE)',
        'Peak-Last 8.000 req/min',
        'Azure Hosting',
        '23 Content Types, 35 Components',
        'Shopify Integration für Merchandise',
        'Vimeo/YouTube Video Embeds',
      ],
      technologies: ['Drupal 11', 'PHP 8.3', 'MySQL 8.0', 'Redis', 'Solr', 'Azure'],
      estimatedPages: AUDIT_DATA.projectOverview.scale.estimatedPages,
      estimatedFilmArchive: AUDIT_DATA.projectOverview.scale.filmArchiveEntries,
      languages: AUDIT_DATA.projectOverview.scale.languages,
      integrations: AUDIT_DATA.projectOverview.keyIntegrations,
    }),
    status: 'routed',
    decision: 'bid',
    decisionData: JSON.stringify({
      recommendation: 'BID',
      confidence: 94,
      reasoning:
        'Drupal 11 ist die beste Wahl: Keine Lizenzkosten, beste Multilingual-Unterstützung, skalierbar für 8.000 req/min, adessoCMS Baseline-Vorteil von 480h',
    }),
    websiteUrl: 'https://www.locarnofestival.ch',
    assignedBusinessUnitId: PHP_BU_ID,
    quickScanId: quickScanId,
  });
  console.log('✅ RFP created:', preQualificationId);

  // 2. Create QuickScan with audit data
  console.log('\n🔍 Creating QuickScan...');
  await db.insert(quickScans).values({
    id: quickScanId,
    preQualificationId: preQualificationId,
    websiteUrl: 'https://www.locarnofestival.ch',
    status: 'completed',
    techStack: JSON.stringify({
      cms: 'Magnolia CMS 6.3',
      framework: 'Java/JCR',
      hosting: 'Azure',
      frontend: 'Custom JS',
      detected: ['Magnolia', 'Java', 'Azure', 'Vimeo', 'Shopify'],
    }),
    cms: 'Magnolia CMS 6.3',
    framework: 'Java/JCR',
    hosting: 'Microsoft Azure',
    pageCount: 2000,
    contentVolume: JSON.stringify({
      pages: '1700-2200',
      filmArchive: '10000+',
      mediaAssets: '260 GB',
    }),
    features: JSON.stringify({
      multilingual: true,
      languages: ['en', 'it', 'fr', 'de'],
      ecommerce: 'Shopify Integration',
      video: 'Vimeo/YouTube',
      search: 'Required (10k+ entries)',
      contentTypes: 23,
      components: 35,
    }),
    navigationStructure: JSON.stringify({
      mainNav: ['Program', 'Films', 'Archive', 'Pro', 'About', 'Visit'],
      depth: 4,
      footer: true,
    }),
    accessibilityAudit: JSON.stringify(AUDIT_DATA.accessibility),
    performanceIndicators: JSON.stringify(AUDIT_DATA.performance),
    recommendedBusinessUnit: 'PHP',
    confidence: 94,
    reasoning:
      'Drupal 11 empfohlen: Beste Wirtschaftlichkeit (CHF 669k TCO), keine Lizenzkosten, beste Multilingual-Unterstützung, adessoCMS Baseline-Vorteil von 480h (CHF 72k)',
    cmsEvaluation: JSON.stringify(AUDIT_DATA.cmsComparison),
    cmsEvaluationCompletedAt: new Date(),
    timeline: JSON.stringify({
      totalWeeks: 17,
      phases: [
        { name: 'Discovery & Planning', weeks: 2, hours: 80 },
        { name: 'Infrastructure Setup', weeks: 2, hours: 80 },
        { name: 'Content Architecture', weeks: 3, hours: 320 },
        { name: 'Theme Development', weeks: 3, hours: 280 },
        { name: 'Custom Development', weeks: 4, hours: 400 },
        { name: 'Migration', weeks: 4, hours: 320 },
        { name: 'Testing & QA', weeks: 2, hours: 200 },
        { name: 'Go-Live', weeks: 1, hours: 80 },
      ],
      startDate: '2025-01-06',
      endDate: '2025-04-15',
    }),
    timelineGeneratedAt: new Date(),
    completedAt: new Date(),
  });
  console.log('✅ QuickScan created:', quickScanId);

  // 3. Create Lead
  console.log('\n👤 Creating Lead...');
  await db.insert(qualifications).values({
    id: qualificationId,
    preQualificationId: preQualificationId,
    status: 'bl_reviewing',
    customerName: 'Locarno Film Festival',
    websiteUrl: 'https://www.locarnofestival.ch',
    industry: 'Kultur & Entertainment',
    projectDescription:
      'Migration von Magnolia CMS 6.3 auf Drupal 11 mit umfangreichem Film-Archiv (10.000+ Einträge), mehrsprachig (EN/IT/FR/DE), High-Traffic-fähig (8.000 req/min)',
    budget: 'CHF 250.000 - 330.000',
    requirements: JSON.stringify([
      'Migration von Magnolia CMS 6.3 auf Drupal 11',
      'Film-Archiv mit 10.000+ Einträgen (Solr erforderlich)',
      '4 Sprachen (EN, IT, FR, DE) - Native Drupal Translation',
      'Peak-Last 8.000 req/min - Azure App Service Auto-Scaling',
      'Microsoft Azure Hosting (Switzerland North)',
      '23 Content Types, 35 Paragraph Types',
      'Shopify Integration für Merchandise',
      'Vimeo/YouTube Video Embeds',
      'WCAG 2.1 AA Konformität',
    ]),
    businessUnitId: PHP_BU_ID,
    quickScanId: quickScanId,
    decisionMakers: JSON.stringify([
      { name: 'Festival Director', role: 'Entscheider' },
      { name: 'IT Manager', role: 'Technischer Ansprechpartner' },
      { name: 'Marketing Director', role: 'Stakeholder' },
    ]),
    deepScanStatus: 'completed',
    deepScanCompletedAt: new Date(),
  });
  console.log('✅ Lead created:', qualificationId);

  // 4. Create WebsiteAudit
  console.log('\n🌐 Creating Website Audit...');
  const perfData = AUDIT_DATA.performance;
  const a11yData = AUDIT_DATA.accessibility;

  await db.insert(websiteAudits).values({
    id: websiteAuditId,
    qualificationId: qualificationId,
    status: 'completed',
    websiteUrl: 'https://www.locarnofestival.ch',
    cms: 'Magnolia CMS 6.3',
    cmsVersion: '6.3',
    framework: 'Java/JCR',
    hosting: 'Microsoft Azure',
    techStack: JSON.stringify({
      cms: 'Magnolia CMS 6.3',
      backend: 'Java/JCR',
      hosting: 'Azure',
      cdn: 'Azure CDN',
      video: ['Vimeo', 'YouTube'],
      ecommerce: 'Shopify',
    }),
    performanceScore: 85,
    lcp: perfData.coreWebVitals.lcp,
    cls: '0.0',
    ttfb: perfData.coreWebVitals.ttfb,
    performanceBottlenecks: JSON.stringify(perfData.bottlenecks),
    accessibilityScore: a11yData.overallScore,
    wcagLevel: a11yData.wcagLevel,
    a11yViolations: JSON.stringify([]),
    a11yIssueCount: a11yData.issues.critical + a11yData.issues.serious,
    estimatedFixHours: a11yData.remediationHours,
    pageCount: 2000,
    contentTypes: JSON.stringify({
      pageTypes: 23,
      components: 35,
      taxonomies: 10,
      views: 12,
    }),
    navigationStructure: JSON.stringify({
      mainNav: ['Program', 'Films', 'Archive', 'Pro', 'About', 'Visit'],
      depth: 4,
      breadcrumbs: true,
      footer: true,
      megaMenu: true,
    }),
    siteTree: JSON.stringify({
      totalNodes: 12200,
      standardPages: '1700-2200',
      filmArchive: '10000+',
      mediaAssets: '260 GB',
    }),
    migrationComplexity: 'high',
    complexityScore: 75,
    complexityFactors: JSON.stringify([
      'Film Archive 10.000+ Einträge (Solr erforderlich)',
      '4 Sprachen (EN, IT, FR, DE)',
      '23 Content Types → 17 Drupal Content Types',
      '35 Components → 35 Paragraph Types',
      'Peak-Last 8.000 req/min',
      'Magnolia JCR → MySQL Migration',
    ]),
    migrationRisks: JSON.stringify([
      'Film Archive Migration kritisch (10.000+ Einträge)',
      'JCR zu MySQL Datenkonvertierung',
      'Peak-Last während Festival',
      'Budget-Überschreitung Jahr 1 (+31.5%)',
    ]),
    screenshots: JSON.stringify({
      homepage: '/screenshots/01-homepage-fullpage.webp',
      filmDetail: '/screenshots/02-film-detail-vod.webp',
      newsArticle: '/screenshots/03-news-article.webp',
      palmares: '/screenshots/04-palmares.webp',
      filmArchive: '/screenshots/05-film-archive.webp',
      about: '/screenshots/06-about-organization.webp',
      industry: '/screenshots/07-pro-industry.webp',
      homepageIT: '/screenshots/08-homepage-italian.webp',
    }),
    rawAuditData: JSON.stringify({
      projectOverview: AUDIT_DATA.projectOverview,
      performance: AUDIT_DATA.performance,
      accessibility: AUDIT_DATA.accessibility,
      costs: AUDIT_DATA.costs,
      cmsComparison: AUDIT_DATA.cmsComparison,
      timeline: AUDIT_DATA.timeline,
    }),
    completedAt: new Date(),
  });
  console.log('✅ Website Audit created:', websiteAuditId);

  // 5. Create RAG Embeddings for Lead
  console.log('\n🧠 Creating RAG Embeddings...');

  const embeddings = [
    {
      agentName: 'audit_summary',
      chunkType: 'executive_summary',
      content: `Locarno Film Festival Website Relaunch - Executive Summary

Website: https://www.locarnofestival.ch
Aktuelles CMS: Magnolia CMS 6.3 (Java/JCR)
Ziel-CMS: Drupal 11 (PHP/MySQL) - EMPFOHLEN
Umfang: 1.700-2.200 Seiten + 10.000+ Film-Archive-Einträge
Sprachen: EN, IT, FR, DE (mehrsprachig)
Peak-Last: 8.000 Anfragen/Minute (Festival-Zeitraum)
Hosting: Microsoft Azure

Budget: CHF 250.000
Reale Jahr 1 Kosten: CHF 328.800
Differenz: +CHF 78.800 (+31,5%)

CMS-Empfehlung: Drupal 11 (Score 9.4/10)
- 5-Jahres TCO: CHF 669.638
- Keine Lizenzkosten (vs. CHF 345k Magnolia)
- adessoCMS Baseline: 480h (CHF 72.000) gespart
- Beste Multilingual-Unterstützung`,
      metadata: JSON.stringify({
        category: 'overview',
        sections: ['executive_summary', 'budget', 'recommendation'],
        sectionData: {
          overview: {
            title: 'Executive Summary',
            content: 'Drupal 11 Relaunch für Locarno Film Festival',
          },
        },
      }),
    },
    {
      agentName: 'audit_tech',
      chunkType: 'technology_analysis',
      content: `Technologie-Analyse Locarno Film Festival

Aktueller Tech Stack:
- CMS: Magnolia CMS 6.3 (Java/JCR)
- Backend: Java
- Hosting: Microsoft Azure

Empfohlener Tech Stack (Drupal 11):
- CMS: Drupal 11.x
- PHP: 8.3
- Database: MySQL 8.0
- Cache: Redis 7.x
- Search: Solr 8.11+ (MANDATORY für Film Archive)
- Hosting: Azure App Service Premium P2v3

Drupal Architektur:
- Content Types: 17
- Paragraph Types: 35
- Taxonomies: 10
- Views: 12
- Contrib Modules: 51
- Custom Modules: 6

Entwicklungs-Aufwand:
- Gesamt: 2.230 Stunden
- Mit adessoCMS Baseline: 1.870 Stunden
- Ersparnis: 360 Stunden`,
      metadata: JSON.stringify({
        category: 'technology',
        sections: ['tech_stack', 'drupal_architecture', 'development_effort'],
        sectionData: {
          technology: {
            title: 'Technologie-Analyse',
            content: 'Drupal 11 mit PHP 8.3, MySQL, Redis, Solr',
          },
        },
      }),
    },
    {
      agentName: 'audit_cost',
      chunkType: 'cost_estimation',
      content: `Kostenschätzung Locarno Film Festival

Jahr 1 Kosten:
- Entwicklung: CHF 231.400 (1.760 Stunden)
- Azure Hosting: CHF 35.400
- Support & Wartung: CHF 36.000
- Training: CHF 8.000
- Monitoring: CHF 3.000
- Kontingenz (15%): CHF 15.000
TOTAL: CHF 328.800

5-Jahres TCO:
- Jahr 1: CHF 302.800
- Jahr 2-5: je CHF 117.680
- TOTAL: CHF 773.520

CMS-Vergleich (5Y TCO):
- Drupal 11: CHF 669.638 (keine Lizenz)
- Umbraco: CHF 667.000 (CHF 70k Lizenz)
- Magnolia: CHF 864.000 (CHF 345k Lizenz)

ROI: 99,2%
Payback Period: 3,5 Jahre`,
      metadata: JSON.stringify({
        category: 'cost',
        sections: ['year1_costs', 'tco', 'cms_comparison', 'roi'],
        sectionData: {
          cost: {
            title: 'Kostenschätzung',
            content: 'Jahr 1: CHF 328.800, 5-Jahres TCO: CHF 773.520',
          },
        },
      }),
    },
    {
      agentName: 'audit_migration',
      chunkType: 'migration_strategy',
      content: `Migrations-Strategie Locarno Film Festival

Quelle: Magnolia CMS 6.3 (JCR/Java)
Ziel: Drupal 11 (MySQL/PHP)
Daten: 1.700-2.200 Seiten + 10.000+ Film-Archive
Aufwand: 692 Stunden (17 Wochen)

Approach: Hybrid Migration

Automated Migration (180h):
- Film Archive: 10.000+ Einträge (KRITISCH)
- News Articles: 100-200 Artikel
- Press Releases: 50-80 Releases
- People: 1.000+ Profile
Total: 11.680-12.630 Nodes

Manual Recreation (60h):
- Homepage, Landing Pages
- About/Organization Pages
- Custom/Complex Pages
Total: 24-36 Nodes

Kritisch: Film Archive
- Challenge: 10.000+ Einträge aus JCR
- Solution: Custom Drupal Migrate Plugin
- Process: Batch Processing (500 Filme/Batch)
- Search: Solr Integration (MANDATORY)

Timeline:
- Start: 6. Januar 2025
- Go-Live: Mitte April 2025`,
      metadata: JSON.stringify({
        category: 'migration',
        sections: ['strategy', 'film_archive', 'timeline'],
        sectionData: {
          migration: {
            title: 'Migrations-Strategie',
            content: 'Hybrid Migration, 692h, 17 Wochen',
          },
        },
      }),
    },
    {
      agentName: 'audit_infrastructure',
      chunkType: 'azure_architecture',
      content: `Azure High-Scale Architektur für 8.000 req/min

Compute:
- Azure App Service Premium P2v3
- Auto-Scaling: 3-12 Instanzen
- CPU: 2 vCores pro Instanz
- RAM: 7 GB pro Instanz

Database:
- Azure MySQL Business Critical (Flexible Server)
- 4 vCores, 16 GB RAM
- Read Replica (70% Queries)

Caching:
- Azure Redis Premium P1 (6 GB)
- Drupal Cache Backend + Sessions

CDN:
- Azure Front Door Premium
- WAF (OWASP 3.2)
- DDoS Protection Standard
- 98% Hit Ratio Target

Storage:
- Azure Blob Storage Hot Tier
- 260 GB (Media Assets)
- Private Endpoint (Security)

Search:
- Azure Cognitive Search Standard S1

Monatliche Kosten: CHF 4.200
Mit Reserved Instances: CHF 2.950/Monat (-30%)

Performance-Erwartungen:
- Response Time: < 100ms (mit CDN)
- Capacity: 8.000 req/min sustained
- Concurrent Users: 200+
- Uptime: 99,9% SLA`,
      metadata: JSON.stringify({
        category: 'infrastructure',
        sections: ['azure', 'scaling', 'costs'],
        sectionData: {
          infrastructure: {
            title: 'Azure Architektur',
            content: 'High-Scale für 8.000 req/min, CHF 4.200/Monat',
          },
        },
      }),
    },
  ];

  for (const embedding of embeddings) {
    await db.insert(dealEmbeddings).values({
      id: createId(),
      qualificationId: qualificationId,
      agentName: embedding.agentName,
      chunkType: embedding.chunkType,
      content: embedding.content,
      metadata: embedding.metadata,
    });
  }
  console.log(`✅ Created ${embeddings.length} RAG embeddings`);

  // 6. Summary
  console.log('\n' + '='.repeat(60));
  console.log('🎉 Locarno Film Festival Lead erfolgreich erstellt!\n');
  console.log('IDs:');
  console.log(`  - RFP ID:          ${preQualificationId}`);
  console.log(`  - Lead ID:         ${qualificationId}`);
  console.log(`  - QuickScan ID:    ${quickScanId}`);
  console.log(`  - WebsiteAudit ID: ${websiteAuditId}`);
  console.log('\nZugriff:');
  console.log(`  - Lead Details:  http://localhost:3000/qualifications/${qualificationId}`);
  console.log(`  - Lead Audit:    http://localhost:3000/qualifications/${qualificationId}/audit`);
  console.log('='.repeat(60));
}

// Run
seedLocarnoLead()
  .then(() => {
    console.log('\n✅ Done!');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  });
