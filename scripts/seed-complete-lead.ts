import 'dotenv/config';
import { createId } from '@paralleldrive/cuid2';
import bcrypt from 'bcryptjs';

import { db } from '../lib/db';
import {
  users,
  businessUnits,
  technologies,
  employees,
  accounts,
  preQualifications,
  quickScans,
  qualifications,
  qualificationSectionData,
  websiteAudits,
  cmsMatchResults,
  baselineComparisons,
  ptEstimations,
  references,
  referenceMatches,
  competitors,
  competitorMatches,
  pitchdecks,
  pitchdeckDeliverables,
  pitchdeckTeamMembers,
} from '../lib/db/schema';

async function seedCompleteLead() {
  console.log('🌱 Starting Complete Lead Seed...\n');

  // ===========================================
  // 1. Business Units
  // ===========================================
  console.log('🏢 Creating Business Units...');

  const [phpBU] = await db
    .insert(businessUnits)
    .values({
      name: 'PHP',
      leaderName: 'Francesco Raaphorst',
      leaderEmail: 'francesco.raaphorst@adesso.de',
      keywords: JSON.stringify([
        'drupal',
        'php',
        'symfony',
        'laravel',
        'wordpress',
        'typo3',
        'cms',
        'ibexa',
        'sulu',
      ]),
    })
    .returning();

  const [wemBU] = await db
    .insert(businessUnits)
    .values({
      name: 'WEM',
      leaderName: 'Michael Rittinghaus',
      leaderEmail: 'michael.rittinghaus@adesso.de',
      keywords: JSON.stringify(['magnolia', 'firstspirit', 'wem', 'java', 'enterprise', 'dxp']),
    })
    .returning();

  console.log('  ✓ Business Units: PHP, WEM\n');

  // ===========================================
  // 2. Technologies
  // ===========================================
  console.log('💻 Creating Technologies...');

  const [drupalTech] = await db
    .insert(technologies)
    .values({
      name: 'Drupal',
      businessUnitId: phpBU.id,
      baselineHours: 693,
      baselineName: 'adessoCMS Drupal',
      baselineEntityCounts: JSON.stringify({
        contentTypes: 15,
        paragraphs: 20,
        taxonomies: 8,
        views: 12,
        blocks: 10,
      }),
      isDefault: true,
      logoUrl: 'https://www.drupal.org/files/Wordmark_blue_RGB.png',
      websiteUrl: 'https://www.drupal.org',
      description:
        'Enterprise-grade Open Source CMS mit starker Community und umfangreichen Erweiterungsmöglichkeiten.',
      category: 'CMS',
      license: 'GPL-2.0',
      latestVersion: '10.2',
      githubUrl: 'https://github.com/drupal/drupal',
      githubStars: 4200,
      communitySize: 'large',
      pros: JSON.stringify([
        'Sehr flexible Content-Architektur',
        'Starke Enterprise-Features',
        'Große Community und Module-Ecosystem',
        'Multi-Site & Multi-Language out-of-the-box',
        'Layout Builder für redaktionelle Flexibilität',
      ]),
      cons: JSON.stringify([
        'Steilere Lernkurve als WordPress',
        'Performance-Optimierung erforderlich',
        'Update-Prozess kann komplex sein',
      ]),
      usps: JSON.stringify([
        'API-First Architektur',
        'Headless/Decoupled ready',
        'Enterprise Security Standards',
      ]),
      adessoExpertise: 'Expert',
      adessoReferenceCount: 45,
      features: JSON.stringify({
        multiLanguage: { supported: true, score: 95, notes: 'Native multi-language support' },
        headless: { supported: true, score: 90, notes: 'JSON:API + GraphQL modules' },
        layoutBuilder: { supported: true, score: 85, notes: 'Drag & Drop page building' },
        mediaMgmt: { supported: true, score: 88, notes: 'Media Library module' },
        workflows: { supported: true, score: 92, notes: 'Content Moderation workflows' },
        personalization: { supported: true, score: 70, notes: 'Via contrib modules' },
        ecommerce: { supported: true, score: 85, notes: 'Drupal Commerce' },
        accessibility: { supported: true, score: 90, notes: 'WCAG 2.1 AA focus' },
      }),
      lastResearchedAt: new Date(),
      researchStatus: 'completed',
    })
    .returning();

  const [ibexaTech] = await db
    .insert(technologies)
    .values({
      name: 'Ibexa',
      businessUnitId: phpBU.id,
      baselineHours: 500,
      baselineName: 'Ibexa Standard',
      baselineEntityCounts: JSON.stringify({
        contentTypes: 12,
        blocks: 8,
      }),
      isDefault: false,
      websiteUrl: 'https://www.ibexa.co',
      description: 'Modern DXP Platform mit starkem Fokus auf B2B und Personalisierung.',
      category: 'DXP',
      license: 'Proprietary',
      adessoExpertise: 'Advanced',
      adessoReferenceCount: 12,
    })
    .returning();

  const [magnoliaTech] = await db
    .insert(technologies)
    .values({
      name: 'Magnolia',
      businessUnitId: wemBU.id,
      baselineHours: 600,
      baselineName: 'Magnolia Enterprise',
      baselineEntityCounts: JSON.stringify({
        contentTypes: 14,
        templates: 18,
        apps: 6,
      }),
      isDefault: true,
      websiteUrl: 'https://www.magnolia-cms.com',
      description: 'Enterprise Java CMS mit intuitivem Editing und headless Capabilities.',
      category: 'CMS',
      license: 'Proprietary',
      adessoExpertise: 'Expert',
      adessoReferenceCount: 25,
    })
    .returning();

  console.log('  ✓ Technologies: Drupal, Ibexa, Magnolia\n');

  // ===========================================
  // 3. Employees
  // ===========================================
  console.log('👤 Creating Employees...');

  const employeesData = [
    // PHP Team
    {
      name: 'Anna Schmidt',
      email: 'anna.schmidt@adesso.de',
      businessUnitId: phpBU.id,
      skills: ['Drupal', 'PHP', 'Symfony', 'React'],
      roles: ['architect', 'developer'],
      availabilityStatus: 'available' as const,
    },
    {
      name: 'Max Weber',
      email: 'max.weber@adesso.de',
      businessUnitId: phpBU.id,
      skills: ['Drupal', 'PHP', 'JavaScript', 'DevOps'],
      roles: ['developer', 'lead'],
      availabilityStatus: 'available' as const,
    },
    {
      name: 'Lisa Müller',
      email: 'lisa.mueller@adesso.de',
      businessUnitId: phpBU.id,
      skills: ['UX Design', 'UI Design', 'Figma', 'Accessibility'],
      roles: ['designer'],
      availabilityStatus: 'available' as const,
    },
    {
      name: 'Thomas Klein',
      email: 'thomas.klein@adesso.de',
      businessUnitId: phpBU.id,
      skills: ['Project Management', 'Scrum', 'PRINCE2'],
      roles: ['pm'],
      availabilityStatus: 'available' as const,
    },
    {
      name: 'Sarah Hoffmann',
      email: 'sarah.hoffmann@adesso.de',
      businessUnitId: phpBU.id,
      skills: ['QA', 'Testing', 'Cypress', 'Accessibility Testing'],
      roles: ['qa'],
      availabilityStatus: 'available' as const,
    },
    // WEM Team
    {
      name: 'Peter Richter',
      email: 'peter.richter@adesso.de',
      businessUnitId: wemBU.id,
      skills: ['Magnolia', 'Java', 'Spring Boot'],
      roles: ['architect', 'developer'],
      availabilityStatus: 'available' as const,
    },
    {
      name: 'Julia Becker',
      email: 'julia.becker@adesso.de',
      businessUnitId: wemBU.id,
      skills: ['FirstSpirit', 'Java', 'JavaScript'],
      roles: ['developer'],
      availabilityStatus: 'on_project' as const,
    },
  ];

  const createdEmployees = await db
    .insert(employees)
    .values(
      employeesData.map(e => ({
        ...e,
        skills: JSON.stringify(e.skills),
        roles: JSON.stringify(e.roles),
      }))
    )
    .returning();

  console.log(`  ✓ ${createdEmployees.length} Employees created\n`);

  // ===========================================
  // 4. Users
  // ===========================================
  console.log('🔐 Creating Users...');
  const hashedPassword = await bcrypt.hash('test123', 10);

  const [adminUser] = await db
    .insert(users)
    .values({
      email: 'admin@adesso.de',
      password: hashedPassword,
      name: 'System Administrator',
      role: 'admin',
    })
    .returning();

  const [bdUser] = await db
    .insert(users)
    .values({
      email: 'bd@adesso.de',
      password: hashedPassword,
      name: 'Max Mustermann',
      role: 'bd',
    })
    .returning();

  const [blUserPHP] = await db
    .insert(users)
    .values({
      email: 'bl-php@adesso.de',
      password: hashedPassword,
      name: 'Francesco Raaphorst',
      role: 'bl',
      businessUnitId: phpBU.id,
    })
    .returning();

  const [blUserWEM] = await db
    .insert(users)
    .values({
      email: 'bl-wem@adesso.de',
      password: hashedPassword,
      name: 'Michael Rittinghaus',
      role: 'bl',
      businessUnitId: wemBU.id,
    })
    .returning();

  console.log('  ✓ Users: admin, bd, bl-php, bl-wem\n');

  // ===========================================
  // 5. Account
  // ===========================================
  console.log('🏦 Creating Account...');

  const [account] = await db
    .insert(accounts)
    .values({
      userId: bdUser.id,
      name: 'Schweizer Tourismus Verband',
      industry: 'Tourism & Hospitality',
      website: 'https://www.stv-fst.ch',
      notes:
        'Großer Verband mit 30+ Kantonsverbänden. Bestehender Kunde mit guter Beziehung. Relaunch der Hauptwebsite plus Microsites.',
    })
    .returning();

  console.log(`  ✓ Account: ${account.name}\n`);

  // ===========================================
  // 6. References (für späteres Matching)
  // ===========================================
  console.log('📚 Creating References...');

  const [reference1] = await db
    .insert(references)
    .values({
      userId: bdUser.id,
      projectName: 'Österreich Werbung Website Relaunch',
      customerName: 'Österreich Werbung',
      industry: 'Tourism & Hospitality',
      technologies: JSON.stringify(['Drupal 10', 'React', 'AWS', 'Elasticsearch']),
      scope: 'Full website relaunch with 15 language versions, 50+ content types',
      teamSize: 12,
      durationMonths: 18,
      budgetRange: '1.5M - 2M EUR',
      outcome: 'Successfully launched on time with 200% traffic increase',
      highlights: JSON.stringify([
        'Multi-language support for 15 languages',
        'Headless architecture with React frontend',
        'Advanced personalization features',
        'WCAG 2.1 AA compliance',
      ]),
      status: 'approved',
      isValidated: true,
      validatedAt: new Date(),
      validatedByUserId: adminUser.id,
    })
    .returning();

  const [reference2] = await db
    .insert(references)
    .values({
      userId: bdUser.id,
      projectName: 'Schweiz Tourismus Portal',
      customerName: 'Schweiz Tourismus',
      industry: 'Tourism & Hospitality',
      technologies: JSON.stringify(['Drupal 9', 'Vue.js', 'Azure', 'Solr']),
      scope: 'Multi-site tourism portal with booking integration',
      teamSize: 8,
      durationMonths: 12,
      budgetRange: '800k - 1.2M EUR',
      outcome: 'Award-winning platform with exceptional user experience',
      highlights: JSON.stringify([
        'Multi-site architecture for regional sites',
        'Booking system integration',
        'Interactive map features',
        'Mobile-first responsive design',
      ]),
      status: 'approved',
      isValidated: true,
      validatedAt: new Date(),
      validatedByUserId: adminUser.id,
    })
    .returning();

  console.log('  ✓ 2 References created\n');

  // ===========================================
  // 7. Competitors
  // ===========================================
  console.log('🎯 Creating Competitors...');

  const [competitor1] = await db
    .insert(competitors)
    .values({
      userId: bdUser.id,
      companyName: 'Namics / Merkle',
      website: 'https://www.merkle.com',
      industry: JSON.stringify(['Digital Agencies', 'Enterprise CMS']),
      description:
        'Große Full-Service Digitalagentur mit starkem Fokus auf Enterprise-Projekte. Jetzt Teil von Dentsu.',
      strengths: JSON.stringify([
        'Starke Marke im DACH-Raum',
        'Große Teams verfügbar',
        'Adobe Partner',
        'Full-Service Angebot',
      ]),
      weaknesses: JSON.stringify([
        'Teuer durch große Overhead-Struktur',
        'Weniger agil als kleinere Agenturen',
        'Fokus auf Adobe-Stack',
      ]),
      typicalMarkets: JSON.stringify(['Enterprise', 'Finance', 'Pharma']),
      encounterNotes: JSON.stringify([
        {
          date: '2023-06',
          project: 'Helvetia Insurance',
          outcome: 'lost',
          notes: 'Preis und Adobe-Fokus ausschlaggebend',
        },
        {
          date: '2023-11',
          project: 'Credit Suisse',
          outcome: 'won',
          notes: 'Open Source Strategie überzeugte',
        },
      ]),
      status: 'approved',
      isValidated: true,
      validatedAt: new Date(),
      validatedByUserId: adminUser.id,
    })
    .returning();

  const [competitor2] = await db
    .insert(competitors)
    .values({
      userId: bdUser.id,
      companyName: 'Unic AG',
      website: 'https://www.unic.com',
      industry: JSON.stringify(['Digital Agencies', 'E-Commerce']),
      description: 'Schweizer Digitalagentur mit starkem Fokus auf E-Commerce und Magnolia CMS.',
      strengths: JSON.stringify([
        'Lokale Präsenz in der Schweiz',
        'Magnolia Gold Partner',
        'Starke E-Commerce Kompetenz',
      ]),
      weaknesses: JSON.stringify([
        'Kleineres Team als adesso',
        'Weniger international aufgestellt',
        'Drupal-Kompetenz limitiert',
      ]),
      typicalMarkets: JSON.stringify(['Retail', 'Tourism', 'Manufacturing']),
      encounterNotes: JSON.stringify([
        {
          date: '2024-02',
          project: 'Mammut Sports',
          outcome: 'lost',
          notes: 'Lokale Referenzen ausschlaggebend',
        },
      ]),
      status: 'approved',
      isValidated: true,
      validatedAt: new Date(),
      validatedByUserId: adminUser.id,
    })
    .returning();

  console.log('  ✓ 2 Competitors created\n');

  // ===========================================
  // 8. RFP
  // ===========================================
  console.log('📝 Creating RFP...');

  const extractedRequirements = {
    projectName: 'Schweizer Tourismus Verband - Website Relaunch 2025',
    description:
      'Kompletter Relaunch der Verbandswebsite inklusive Member-Portal, Event-Management und Integration mit bestehenden Systemen. Multi-Language Support für DE/FR/IT/EN erforderlich.',
    budget: '800.000 - 1.200.000 EUR',
    timeline: 'Q2 2025 - Q4 2025',
    technologies: ['Enterprise CMS', 'Multi-Language', 'Member Portal', 'Event Management'],
    requirements: [
      'Responsive Design (Mobile First)',
      'WCAG 2.1 AA Accessibility',
      'Multi-Language (DE/FR/IT/EN)',
      'Member-Portal mit Self-Service',
      'Event-Management System',
      'Integration mit CRM (Salesforce)',
      'SSO für Mitgliederbereich',
      'Newsletter-Integration (Mailchimp)',
      'Headless-ready Architektur',
    ],
    decisionMakers: [
      { name: 'Dr. Martin Nydegger', role: 'Direktor', email: 'nydegger@stv.ch' },
      { name: 'Sandra Meier', role: 'Leiterin Kommunikation', email: 'meier@stv.ch' },
      { name: 'Thomas Berger', role: 'IT-Leiter', email: 'berger@stv.ch' },
    ],
    deadline: '2025-01-31',
    submissionRequirements: [
      'Technisches Konzept',
      'Referenzen',
      'Preisindikation',
      'Team-Vorstellung',
    ],
  };

  const quickScanData = {
    cms: 'WordPress',
    framework: 'PHP',
    hosting: 'Shared Hosting',
    techStack: ['WordPress', 'PHP 7.4', 'MySQL', 'jQuery'],
    pageCount: 450,
    recommendedBusinessUnit: 'PHP',
    confidence: 88,
    reasoning:
      'PHP Business Line hat umfangreiche Erfahrung mit Drupal-Migrationen von WordPress. Tourismus-Branche ist Kernkompetenz mit mehreren erfolgreichen Referenzen. Technischer Fit ist sehr gut.',
    timeline: {
      estimatedDuration: 9,
      phases: [
        { name: 'Discovery & Konzept', duration: 2, confidence: 'high' },
        { name: 'Design & UX', duration: 2, confidence: 'high' },
        { name: 'Development', duration: 4, confidence: 'medium' },
        { name: 'Testing & Launch', duration: 1, confidence: 'high' },
      ],
      risks: [
        'Member-Portal Komplexität',
        'Legacy-Daten Migration',
        'Multi-Stakeholder Koordination',
      ],
    },
  };

  const [preQualification] = await db
    .insert(preQualifications)
    .values({
      userId: bdUser.id,
      source: 'reactive',
      stage: 'preQualification',
      inputType: 'pdf',
      rawInput: JSON.stringify(extractedRequirements),
      extractedRequirements: JSON.stringify(extractedRequirements),
      metadata: JSON.stringify({
        from: 'sandra.meier@stv.ch',
        subject: 'RFP: Website Relaunch Schweizer Tourismus Verband',
        date: '2025-01-10',
      }),
      status: 'routed',
      decision: 'bid',
      accountId: account.id,
      websiteUrl: 'https://www.stv-fst.ch',
      assignedBusinessUnitId: phpBU.id,
      quickScanResults: JSON.stringify(quickScanData),
    })
    .returning();

  console.log(`  ✓ RFP created: ${preQualification.id}\n`);

  // ===========================================
  // 9. Quick Scan
  // ===========================================
  console.log('🔍 Creating Quick Scan...');

  const tenQuestions = [
    {
      id: 1,
      question: 'Welche bestehenden Systeme müssen integriert werden (CRM, ERP, Newsletter)?',
      category: 'integration',
      priority: 'high',
    },
    {
      id: 2,
      question: 'Wie viele Mitglieder nutzen aktuell das Portal und welche Funktionen?',
      category: 'scope',
      priority: 'high',
    },
    {
      id: 3,
      question: 'Gibt es bestehende Design-Guidelines oder Brand-Vorgaben?',
      category: 'design',
      priority: 'medium',
    },
    {
      id: 4,
      question: 'Welche Inhalte werden migriert vs. neu erstellt?',
      category: 'content',
      priority: 'high',
    },
    {
      id: 5,
      question: 'Wie sieht der Redaktions-Workflow aus? Wer pflegt welche Inhalte?',
      category: 'workflow',
      priority: 'medium',
    },
    {
      id: 6,
      question: 'Gibt es Performance-Anforderungen (Ladezeiten, Traffic-Peaks)?',
      category: 'technical',
      priority: 'medium',
    },
    {
      id: 7,
      question: 'Welche Events werden über das System verwaltet (Größe, Frequenz)?',
      category: 'scope',
      priority: 'high',
    },
    {
      id: 8,
      question: 'Ist eine Headless/Decoupled Architektur gewünscht für zukünftige Apps?',
      category: 'architecture',
      priority: 'medium',
    },
    {
      id: 9,
      question: 'Welche Accessibility-Zertifizierung wird angestrebt (WCAG Level)?',
      category: 'compliance',
      priority: 'high',
    },
    {
      id: 10,
      question: 'Wie ist der Timeline-Druck? Gibt es kritische Milestones?',
      category: 'timeline',
      priority: 'high',
    },
  ];

  const [quickScan] = await db
    .insert(quickScans)
    .values({
      preQualificationId: preQualification.id,
      websiteUrl: 'https://www.stv-fst.ch',
      status: 'completed',
      cms: 'WordPress',
      framework: 'PHP',
      hosting: 'Shared Hosting (Infomaniak)',
      techStack: JSON.stringify(['WordPress 6.1', 'PHP 7.4', 'MySQL 5.7', 'jQuery', 'Bootstrap 4']),
      pageCount: 450,
      contentVolume: JSON.stringify({
        pages: 450,
        posts: 1200,
        mediaItems: 3500,
        categories: 45,
        tags: 320,
      }),
      features: JSON.stringify([
        'Blog',
        'Events',
        'Member Directory',
        'Newsletter Signup',
        'Contact Forms',
        'Gallery',
        'Document Downloads',
      ]),
      integrations: JSON.stringify(['Mailchimp', 'Google Analytics', 'YouTube Embeds']),
      navigationStructure: JSON.stringify({
        mainNav: ['Über uns', 'Mitgliedschaft', 'Events', 'News', 'Kontakt'],
        footerNav: ['Impressum', 'Datenschutz', 'AGB'],
        depth: 3,
      }),
      accessibilityAudit: JSON.stringify({
        score: 62,
        issues: [
          { type: 'contrast', count: 45, severity: 'serious' },
          { type: 'alt-text', count: 120, severity: 'moderate' },
          { type: 'form-labels', count: 8, severity: 'serious' },
        ],
        wcagLevel: 'A (partial)',
      }),
      seoAudit: JSON.stringify({
        score: 71,
        issues: ['Missing meta descriptions', 'Duplicate H1 tags', 'No structured data'],
      }),
      legalCompliance: JSON.stringify({
        gdpr: 'partial',
        cookieBanner: true,
        privacyPolicy: true,
        impressum: true,
      }),
      performanceIndicators: JSON.stringify({
        lcp: 4200,
        fid: 180,
        cls: 0.25,
        mobileScore: 45,
        desktopScore: 68,
      }),
      screenshots: JSON.stringify({
        homepage: '/screenshots/stv/homepage.png',
        mobile: '/screenshots/stv/mobile.png',
        memberArea: '/screenshots/stv/member.png',
      }),
      companyIntelligence: JSON.stringify({
        founded: 1893,
        employees: 45,
        members: 2800,
        revenue: 'n/a',
        headquarters: 'Bern, Switzerland',
        socialMedia: {
          linkedin: 'https://linkedin.com/company/stv-fst',
          twitter: '@stv_fst',
        },
      }),
      siteTree: JSON.stringify({
        name: 'Root',
        children: [
          {
            name: 'Über uns',
            pages: 12,
            children: [
              { name: 'Team', pages: 5 },
              { name: 'Geschichte', pages: 3 },
            ],
          },
          { name: 'Mitgliedschaft', pages: 8, children: [{ name: 'Vorteile', pages: 4 }] },
          { name: 'Events', pages: 85, children: [] },
          { name: 'News', pages: 320, children: [] },
        ],
      }),
      contentTypes: JSON.stringify({
        news: 320,
        events: 85,
        pages: 45,
        members: 2800,
        documents: 450,
      }),
      migrationComplexity: JSON.stringify({
        overall: 'medium',
        factors: [
          { name: 'Content Volume', complexity: 'medium', notes: '450 pages + 1200 posts' },
          { name: 'Member Data', complexity: 'high', notes: '2800 members with profiles' },
          {
            name: 'Custom Functionality',
            complexity: 'medium',
            notes: 'Event management, member portal',
          },
          { name: 'Multi-Language', complexity: 'high', notes: '4 languages required' },
        ],
      }),
      decisionMakers: JSON.stringify(extractedRequirements.decisionMakers),
      tenQuestions: JSON.stringify(tenQuestions),
      recommendedBusinessUnit: 'PHP',
      confidence: 88,
      reasoning: quickScanData.reasoning,
      activityLog: JSON.stringify([
        {
          timestamp: new Date().toISOString(),
          step: 'tech_detection',
          status: 'completed',
          duration: 12,
        },
        {
          timestamp: new Date().toISOString(),
          step: 'content_analysis',
          status: 'completed',
          duration: 45,
        },
        {
          timestamp: new Date().toISOString(),
          step: 'performance_audit',
          status: 'completed',
          duration: 30,
        },
        {
          timestamp: new Date().toISOString(),
          step: 'accessibility_audit',
          status: 'completed',
          duration: 25,
        },
        {
          timestamp: new Date().toISOString(),
          step: 'recommendation',
          status: 'completed',
          duration: 5,
        },
      ]),
      timeline: JSON.stringify(quickScanData.timeline),
      timelineGeneratedAt: new Date(),
      startedAt: new Date(Date.now() - 1000 * 60 * 60),
      completedAt: new Date(Date.now() - 1000 * 60 * 30),
    })
    .returning();

  // Update RFP with Quick Scan ID
  await db
    .update(preQualifications)
    .set({ quickScanId: quickScan.id })
    .where(eq(preQualifications.id, preQualification.id));

  console.log(`  ✓ Quick Scan completed\n`);

  // ===========================================
  // 10. Lead
  // ===========================================
  console.log('🎯 Creating Lead...');

  const [lead] = await db
    .insert(qualifications)
    .values({
      preQualificationId: preQualification.id,
      status: 'bl_reviewing',
      customerName: 'Schweizer Tourismus Verband',
      websiteUrl: 'https://www.stv-fst.ch',
      industry: 'Tourism & Hospitality',
      projectDescription: extractedRequirements.description,
      budget: extractedRequirements.budget,
      requirements: JSON.stringify(extractedRequirements.requirements),
      quickScanId: quickScan.id,
      decisionMakers: JSON.stringify(extractedRequirements.decisionMakers),
      businessUnitId: phpBU.id,
      deepScanStatus: 'completed',
      deepScanStartedAt: new Date(Date.now() - 1000 * 60 * 45),
      deepScanCompletedAt: new Date(Date.now() - 1000 * 60 * 5),
      selectedCmsId: drupalTech.id,
      routedAt: new Date(Date.now() - 1000 * 60 * 60 * 2),
    })
    .returning();

  console.log(`  ✓ Lead created: ${lead.id}\n`);

  // ===========================================
  // 11. Lead Section Data (Deep Scan Results)
  // ===========================================
  console.log('📊 Creating Lead Section Data...');

  const sectionDataEntries = [
    {
      qualificationId: lead.id,
      sectionId: 'technology',
      content: JSON.stringify({
        currentStack: {
          cms: 'WordPress 6.1',
          php: '7.4',
          database: 'MySQL 5.7',
          frontend: ['jQuery', 'Bootstrap 4'],
          hosting: 'Shared Hosting (Infomaniak)',
        },
        recommendedStack: {
          cms: 'Drupal 10',
          php: '8.2',
          database: 'MariaDB 10.6',
          frontend: ['React', 'Tailwind CSS'],
          hosting: 'AWS (EC2 + RDS + CloudFront)',
        },
        migrationPath: {
          complexity: 'medium',
          estimatedEffort: '280 hours',
          keyConsiderations: [
            'WordPress Plugin-Funktionalität in Drupal-Module migrieren',
            'Custom Post Types → Drupal Content Types',
            'ACF Fields → Drupal Paragraphs',
            'User Migration mit Rollen-Mapping',
          ],
        },
      }),
      confidence: 92,
      sources: JSON.stringify(['Wappalyzer', 'BuiltWith', 'Manual Inspection']),
    },
    {
      qualificationId: lead.id,
      sectionId: 'website-analysis',
      content: JSON.stringify({
        structure: {
          totalPages: 450,
          contentTypes: ['Pages', 'Posts', 'Events', 'Members', 'Documents'],
          languages: ['DE', 'FR'],
          missingLanguages: ['IT', 'EN'],
        },
        performance: {
          currentScores: { mobile: 45, desktop: 68 },
          targetScores: { mobile: 85, desktop: 95 },
          improvements: [
            'Image optimization (WebP)',
            'Caching strategy',
            'CDN implementation',
            'Code splitting',
          ],
        },
        accessibility: {
          currentLevel: 'A (partial)',
          targetLevel: 'AA',
          issueCount: 173,
          estimatedFixHours: 80,
        },
      }),
      confidence: 88,
      sources: JSON.stringify(['Lighthouse', 'axe-core', 'Wave']),
    },
    {
      qualificationId: lead.id,
      sectionId: 'cms-comparison',
      content: JSON.stringify({
        evaluated: ['Drupal', 'Ibexa', 'Magnolia'],
        winner: 'Drupal',
        reasoning: [
          'Beste Multi-Language Unterstützung für 4 Sprachen',
          'Starke Member-Portal Features mit Groups/Organic Groups',
          'Event Management via contrib modules',
          'adesso hat 45+ Tourismus-Referenzen mit Drupal',
          'Open Source passt zur Verbands-DNA',
        ],
        comparisonMatrix: {
          multiLanguage: { drupal: 95, ibexa: 85, magnolia: 80 },
          memberPortal: { drupal: 88, ibexa: 90, magnolia: 75 },
          eventMgmt: { drupal: 82, ibexa: 75, magnolia: 70 },
          tco: { drupal: 90, ibexa: 70, magnolia: 65 },
          adessoExpertise: { drupal: 95, ibexa: 75, magnolia: 80 },
        },
      }),
      confidence: 90,
      sources: JSON.stringify(['CMS Feature Matrix', 'adesso Knowledge Base']),
    },
    {
      qualificationId: lead.id,
      sectionId: 'legal-check',
      content: JSON.stringify({
        gdprCompliance: {
          status: 'review_required',
          findings: [
            'Cookie Banner implementiert, aber Consent-Management unvollständig',
            'Datenschutzerklärung vorhanden, aber nicht aktuell',
            'Datenverarbeitungsverträge mit Dienstleistern prüfen',
          ],
          recommendations: [
            'Consent Management Platform (CMP) implementieren',
            'Privacy Policy Update mit Rechtsanwalt',
            'Datenminimierung bei Mitgliederdaten',
          ],
        },
        accessibility: {
          currentLevel: 'A (partial)',
          targetLevel: 'AA',
          legalRequirement: 'CH-Accessibility Law ab 2025',
          riskLevel: 'medium',
        },
        contracts: {
          rfpConditions: 'Standard',
          liabilityRisks: 'low',
          ipRights: 'clear',
        },
      }),
      confidence: 85,
      sources: JSON.stringify(['Legal Review', 'Privacy Audit']),
    },
    {
      qualificationId: lead.id,
      sectionId: 'references',
      content: JSON.stringify({
        matched: [
          {
            id: reference1.id,
            projectName: 'Österreich Werbung Website Relaunch',
            matchScore: 94,
            matchReasons: [
              'Same industry (Tourism)',
              'Same tech (Drupal)',
              'Similar scope (Multi-language)',
            ],
          },
          {
            id: reference2.id,
            projectName: 'Schweiz Tourismus Portal',
            matchScore: 91,
            matchReasons: ['Same country', 'Same industry', 'Member portal features'],
          },
        ],
        keyTakeaways: [
          'Multi-language setup ist Kernkompetenz',
          'Tourismus-Branche verstanden',
          'Member-Portal Erfahrung vorhanden',
        ],
      }),
      confidence: 94,
      sources: JSON.stringify(['adesso Reference Database']),
    },
  ];

  await db.insert(qualificationSectionData).values(sectionDataEntries);
  console.log(`  ✓ ${sectionDataEntries.length} Section Data entries created\n`);

  // ===========================================
  // 12. Website Audit
  // ===========================================
  console.log('🔬 Creating Website Audit...');

  const [websiteAudit] = await db
    .insert(websiteAudits)
    .values({
      qualificationId: lead.id,
      status: 'completed',
      websiteUrl: 'https://www.stv-fst.ch',
      homepage: JSON.stringify({
        title: 'Schweizer Tourismus-Verband | STV-FST',
        description: 'Der Dachverband der Schweizer Tourismuswirtschaft',
        heroContent: 'Welcome banner with latest news',
      }),
      cms: 'WordPress',
      cmsVersion: '6.1',
      framework: 'PHP',
      hosting: 'Infomaniak',
      server: 'Apache',
      techStack: JSON.stringify(['WordPress', 'PHP 7.4', 'MySQL', 'jQuery', 'Bootstrap']),
      performanceScore: 56,
      lcp: 4200,
      fid: 180,
      cls: '0.25',
      ttfb: 850,
      performanceBottlenecks: JSON.stringify([
        'Large unoptimized images',
        'No caching headers',
        'Render-blocking JavaScript',
        'No CDN',
      ]),
      accessibilityScore: 62,
      wcagLevel: 'A',
      a11yViolations: JSON.stringify([
        { rule: 'color-contrast', count: 45, impact: 'serious' },
        { rule: 'image-alt', count: 120, impact: 'critical' },
        { rule: 'label', count: 8, impact: 'critical' },
        { rule: 'link-name', count: 12, impact: 'serious' },
      ]),
      a11yIssueCount: 185,
      estimatedFixHours: 80,
      pageCount: 450,
      contentTypes: JSON.stringify({
        pages: 45,
        posts: 320,
        events: 85,
        members: 2800,
      }),
      navigationStructure: JSON.stringify({
        levels: 3,
        mainItems: 5,
        totalLinks: 127,
      }),
      siteTree: JSON.stringify({
        root: { children: ['about', 'membership', 'events', 'news', 'contact'] },
      }),
      contentVolume: JSON.stringify({
        totalWords: 125000,
        avgWordsPerPage: 280,
        mediaFiles: 3500,
        documents: 450,
      }),
      migrationComplexity: 'medium',
      complexityScore: 65,
      complexityFactors: JSON.stringify([
        'Multi-language content (2 → 4 languages)',
        'Member data migration (2800 profiles)',
        'Custom event system',
        'Document library migration',
      ]),
      migrationRisks: JSON.stringify([
        'URL structure changes affecting SEO',
        'Member login migration',
        'Event booking system compatibility',
      ]),
      screenshots: JSON.stringify({
        homepage: '/screenshots/audit/stv-home.png',
        mobile: '/screenshots/audit/stv-mobile.png',
      }),
      seoScore: 71,
      seoIssues: JSON.stringify([
        'Missing meta descriptions on 40% of pages',
        'Duplicate H1 tags',
        'No structured data (Schema.org)',
        'Missing hreflang tags',
      ]),
      legalCompliance: JSON.stringify({
        gdpr: 'partial',
        cookieBanner: true,
        privacyPolicy: true,
        impressum: true,
        notes: 'Cookie consent needs improvement',
      }),
      startedAt: new Date(Date.now() - 1000 * 60 * 40),
      completedAt: new Date(Date.now() - 1000 * 60 * 10),
    })
    .returning();

  console.log(`  ✓ Website Audit completed\n`);

  // ===========================================
  // 13. CMS Match Results
  // ===========================================
  console.log('📈 Creating CMS Match Results...');

  await db.insert(cmsMatchResults).values([
    {
      qualificationId: lead.id,
      technologyId: drupalTech.id,
      totalScore: 92,
      featureScore: 94,
      industryScore: 95,
      sizeScore: 88,
      budgetScore: 90,
      migrationScore: 85,
      matchedFeatures: JSON.stringify([
        'Multi-language (native)',
        'Member Portal (Groups module)',
        'Event Management (contrib)',
        'Content Workflows',
        'API-first (JSON:API)',
      ]),
      reasoning:
        'Drupal ist die beste Wahl für dieses Projekt. Native Multi-Language Unterstützung, starke Community-Features und adesso hat exzellente Tourismus-Referenzen.',
      rank: 1,
      isRecommended: true,
    },
    {
      qualificationId: lead.id,
      technologyId: ibexaTech.id,
      totalScore: 78,
      featureScore: 82,
      industryScore: 75,
      sizeScore: 80,
      budgetScore: 70,
      migrationScore: 78,
      matchedFeatures: JSON.stringify([
        'Multi-language',
        'Personalization',
        'B2B Features',
        'E-Commerce Integration',
      ]),
      reasoning:
        'Ibexa ist eine gute Alternative mit starken DXP-Features, aber weniger Referenzen im Tourismus-Bereich und höhere Lizenzkosten.',
      rank: 2,
      isRecommended: false,
    },
    {
      qualificationId: lead.id,
      technologyId: magnoliaTech.id,
      totalScore: 72,
      featureScore: 75,
      industryScore: 70,
      sizeScore: 75,
      budgetScore: 65,
      migrationScore: 72,
      matchedFeatures: JSON.stringify(['Intuitive Editing', 'Headless Ready', 'Multi-Site']),
      reasoning:
        'Magnolia hat gute Enterprise-Features, aber höhere TCO und weniger PHP-Expertise im Team.',
      rank: 3,
      isRecommended: false,
    },
  ]);

  console.log(`  ✓ 3 CMS Match Results created\n`);

  // ===========================================
  // 14. Baseline Comparison
  // ===========================================
  console.log('📊 Creating Baseline Comparison...');

  await db.insert(baselineComparisons).values({
    qualificationId: lead.id,
    technologyId: drupalTech.id,
    baselineName: 'adessoCMS Drupal',
    baselineHours: 693,
    baselineEntityCounts: JSON.stringify({
      contentTypes: 15,
      paragraphs: 20,
      taxonomies: 8,
      views: 12,
      blocks: 10,
    }),
    deltaContentTypes: 8,
    deltaParagraphs: 5,
    deltaTaxonomies: 4,
    deltaViews: 6,
    deltaCustomModules: 3,
    additionalPT: 180,
    totalEstimatedPT: 873,
    category: 'above_baseline',
    complexityFactors: JSON.stringify([
      'Member Portal mit erweiterten Rollen (+60h)',
      'Event Management System (+45h)',
      'Multi-Language 4 statt 2 Sprachen (+40h)',
      'CRM Integration Salesforce (+35h)',
    ]),
    recommendations: JSON.stringify([
      'Contrib-Module für Event-Management evaluieren',
      'Salesforce Integration über Drupal Salesforce Suite',
      'Phasenweiser Rollout der Sprachen',
    ]),
  });

  console.log(`  ✓ Baseline Comparison created\n`);

  // ===========================================
  // 15. PT Estimation
  // ===========================================
  console.log('💰 Creating PT Estimation...');

  await db.insert(ptEstimations).values({
    qualificationId: lead.id,
    totalPT: 873,
    totalCost: 960000,
    durationMonths: 9,
    phases: JSON.stringify([
      { name: 'Discovery & Konzept', hours: 80, cost: 88000, duration: 6 },
      { name: 'Design & UX', hours: 120, cost: 132000, duration: 8 },
      { name: 'Backend Development', hours: 280, cost: 308000, duration: 12 },
      { name: 'Frontend Development', hours: 200, cost: 220000, duration: 10 },
      { name: 'Integration & Migration', hours: 120, cost: 132000, duration: 6 },
      { name: 'Testing & QA', hours: 53, cost: 58300, duration: 4 },
      { name: 'Launch & Support', hours: 20, cost: 22000, duration: 2 },
    ]),
    disciplines: JSON.stringify({
      projectManagement: { hours: 80, percentage: 9 },
      uxDesign: { hours: 100, percentage: 11 },
      uiDesign: { hours: 60, percentage: 7 },
      backendDev: { hours: 280, percentage: 32 },
      frontendDev: { hours: 200, percentage: 23 },
      qa: { hours: 80, percentage: 9 },
      devOps: { hours: 40, percentage: 5 },
      consulting: { hours: 33, percentage: 4 },
    }),
    timeline: JSON.stringify({
      milestones: [
        { name: 'Kickoff', date: '2025-04-01', status: 'planned' },
        { name: 'Konzept Abnahme', date: '2025-05-15', status: 'planned' },
        { name: 'Design Freeze', date: '2025-06-30', status: 'planned' },
        { name: 'MVP Launch', date: '2025-09-30', status: 'planned' },
        { name: 'Full Launch', date: '2025-11-30', status: 'planned' },
      ],
    }),
    startDate: '2025-04-01',
    endDate: '2025-12-31',
    riskBuffer: 15,
    confidenceLevel: 'medium',
    assumptions: JSON.stringify([
      'Kunde liefert Content rechtzeitig',
      'Keine größeren Scope-Änderungen',
      'Salesforce API ist dokumentiert und zugänglich',
      'Max 2 Iterationen im Design',
      'Bestehende Member-Daten sind sauber exportierbar',
    ]),
  });

  console.log(`  ✓ PT Estimation created\n`);

  // ===========================================
  // 16. Reference Matches
  // ===========================================
  console.log('🔗 Creating Reference Matches...');

  await db.insert(referenceMatches).values([
    {
      qualificationId: lead.id,
      referenceId: reference1.id,
      totalScore: 94,
      techStackScore: 95,
      industryScore: 92,
      matchedTechnologies: JSON.stringify(['Drupal', 'React', 'Multi-Language']),
      matchedIndustries: JSON.stringify(['Tourism']),
      reasoning:
        'Sehr hohe Übereinstimmung: Gleiche Branche, gleiches CMS, ähnlicher Scope mit Multi-Language Setup.',
      rank: 1,
    },
    {
      qualificationId: lead.id,
      referenceId: reference2.id,
      totalScore: 91,
      techStackScore: 88,
      industryScore: 95,
      matchedTechnologies: JSON.stringify(['Drupal', 'Multi-Language']),
      matchedIndustries: JSON.stringify(['Tourism', 'Switzerland']),
      reasoning:
        'Sehr gute Übereinstimmung: Schweizer Tourismus-Projekt mit ähnlichen Anforderungen.',
      rank: 2,
    },
  ]);

  console.log(`  ✓ 2 Reference Matches created\n`);

  // ===========================================
  // 17. Competitor Matches
  // ===========================================
  console.log('⚔️ Creating Competitor Matches...');

  await db.insert(competitorMatches).values([
    {
      qualificationId: lead.id,
      competitorId: competitor1.id,
      source: 'database',
      relevanceScore: 85,
      reasoning:
        'Namics/Merkle ist im Schweizer Markt aktiv und hat Tourismus-Referenzen. Wahrscheinlich im Bieterkreis.',
      likelyInvolved: true,
      encounterHistory: JSON.stringify([
        { date: '2023-11', project: 'Similar scope', outcome: 'won against' },
      ]),
    },
    {
      qualificationId: lead.id,
      competitorId: competitor2.id,
      source: 'database',
      relevanceScore: 78,
      reasoning:
        'Unic ist lokaler Wettbewerber mit Tourismus-Erfahrung, aber fokussiert auf Magnolia.',
      likelyInvolved: true,
      encounterHistory: JSON.stringify([]),
    },
  ]);

  console.log(`  ✓ 2 Competitor Matches created\n`);

  // ===========================================
  // 18. Pitchdeck with Deliverables and Team
  // ===========================================
  console.log('📑 Creating Pitchdeck...');

  const [pitchdeck] = await db
    .insert(pitchdecks)
    .values({
      qualificationId: lead.id,
      status: 'team_proposed',
    })
    .returning();

  // Pitchdeck Team Members
  const phpEmployees = createdEmployees.filter(e => e.businessUnitId === phpBU.id);
  const teamRoles = [
    { role: 'pm' as const, employee: phpEmployees.find(e => e.name === 'Thomas Klein')! },
    { role: 'ux' as const, employee: phpEmployees.find(e => e.name === 'Lisa Müller')! },
    { role: 'backend' as const, employee: phpEmployees.find(e => e.name === 'Anna Schmidt')! },
    { role: 'frontend' as const, employee: phpEmployees.find(e => e.name === 'Max Weber')! },
    { role: 'qa' as const, employee: phpEmployees.find(e => e.name === 'Sarah Hoffmann')! },
  ];

  await db.insert(pitchdeckTeamMembers).values(
    teamRoles.map(({ role, employee }) => ({
      pitchdeckId: pitchdeck.id,
      employeeId: employee.id,
      role,
    }))
  );

  // Pitchdeck Deliverables
  const deliverables = [
    {
      deliverableName: 'Management Summary',
      status: 'open' as const,
      outline: 'Zusammenfassung des Angebots für Entscheidungsträger',
    },
    {
      deliverableName: 'Technisches Konzept',
      status: 'open' as const,
      outline: 'Architektur, Tech Stack, Migration, Integrationen',
    },
    {
      deliverableName: 'UX/Design Konzept',
      status: 'open' as const,
      outline: 'Design-Ansatz, Wireframes, Style Guide Vorschlag',
    },
    {
      deliverableName: 'Projektplan & Timeline',
      status: 'open' as const,
      outline: 'Phasen, Milestones, Ressourcen, Risiken',
    },
    {
      deliverableName: 'Preiskalkulation',
      status: 'open' as const,
      outline: 'Detaillierte Aufwandsschätzung, Optionen',
    },
    {
      deliverableName: 'Team-Vorstellung',
      status: 'open' as const,
      outline: 'CVs, Erfahrungen, Verfügbarkeiten',
    },
    {
      deliverableName: 'Referenzen',
      status: 'open' as const,
      outline: 'Relevante Projekte, Lessons Learned',
    },
  ];

  await db.insert(pitchdeckDeliverables).values(
    deliverables.map(d => ({
      pitchdeckId: pitchdeck.id,
      deliverableName: d.deliverableName,
      status: d.status,
      outline: d.outline,
      internalDeadline: new Date('2025-01-25'),
    }))
  );

  console.log(
    `  ✓ Pitchdeck with ${teamRoles.length} team members and ${deliverables.length} deliverables\n`
  );

  // ===========================================
  // Summary
  // ===========================================
  console.log('═══════════════════════════════════════════');
  console.log('✅ Complete Lead Seed finished!\n');
  console.log('📊 Created:');
  console.log('  - 2 Business Units (PHP, WEM)');
  console.log('  - 3 Technologies (Drupal, Ibexa, Magnolia)');
  console.log(`  - ${createdEmployees.length} Employees`);
  console.log('  - 4 Users (admin, bd, bl-php, bl-wem)');
  console.log('  - 1 Account');
  console.log('  - 2 References');
  console.log('  - 2 Competitors');
  console.log('  - 1 RFP with Quick Scan');
  console.log('  - 1 Lead with complete Deep Scan data:');
  console.log(`    • ${sectionDataEntries.length} Section Data entries`);
  console.log('    • Website Audit');
  console.log('    • 3 CMS Match Results');
  console.log('    • Baseline Comparison');
  console.log('    • PT Estimation');
  console.log('    • 2 Reference Matches');
  console.log('    • 2 Competitor Matches');
  console.log('    • Pitchdeck with Team & Deliverables');
  console.log('\n🔐 Login Credentials:');
  console.log('  admin@adesso.de / test123');
  console.log('  bd@adesso.de / test123');
  console.log('  bl-php@adesso.de / test123');
  console.log('  bl-wem@adesso.de / test123');
  console.log('\n📍 Lead ID:', lead.id);
  console.log('═══════════════════════════════════════════\n');
}

// Import eq for update
import { eq } from 'drizzle-orm';

seedCompleteLead()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  });
