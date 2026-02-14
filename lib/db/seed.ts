import { fakerDE as faker } from '@faker-js/faker';
import { createId } from '@paralleldrive/cuid2';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';

import {
  users,
  businessUnits,
  technologies,
  features,
  accounts,
  competitors,
  employees,
  preQualifications,
  leadScans,
  references,
} from './schema';

import { db } from './index';

const random = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const randomSubset = <T>(arr: T[], min = 1, max = 3): T[] => {
  const shuffled = [...arr].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, Math.floor(Math.random() * (max - min + 1)) + min);
};

async function seed() {
  const hashedPassword = await bcrypt.hash('admin123', 10);
  const adminUser = {
    email: 'admin@adesso.de',
    password: hashedPassword,
    name: 'System Administrator',
    role: 'admin' as const,
    id: createId(),
  };

  await db
    .insert(users)
    .values(adminUser)
    .onConflictDoUpdate({ target: users.email, set: { name: adminUser.name } });

  const buData = [
    {
      name: 'PHP',
      leaderName: 'Francesco Raaphorst',
      leaderEmail: 'francesco.raaphorst@adesso.de',
      keywords: ['drupal', 'php', 'symfony', 'laravel', 'wordpress', 'typo3', 'cms'],
    },
    {
      name: 'WEM',
      leaderName: 'Michael Rittinghaus',
      leaderEmail: 'michael.rittinghaus@adesso.de',
      keywords: ['magnolia', 'firstspirit', 'wem', 'java', 'enterprise'],
    },
  ];

  for (const data of buData) {
    await db
      .insert(businessUnits)
      .values({ ...data, keywords: JSON.stringify(data.keywords) })
      .onConflictDoNothing();
  }

  const allBUs = await db.query.businessUnits.findMany();

  const phpBL = allBUs.find(b => b.name === 'PHP');
  const wemBL = allBUs.find(b => b.name === 'WEM');

  if (phpBL) {
    const phpTechs = [
      {
        name: 'Drupal',
        baselineHours: 693,
        baselineName: 'adessoCMS Drupal',
        isDefault: true,
        baselineEntityCounts: JSON.stringify({ contentTypes: 15 }),
        annualLicenseCost: 0,
        requiresEnterprise: false,
      },
      {
        name: 'Ibexa',
        baselineHours: 500,
        baselineName: 'Ibexa Standard',
        isDefault: false,
        baselineEntityCounts: JSON.stringify({ contentTypes: 12 }),
        annualLicenseCost: 15000,
        requiresEnterprise: false,
      },
      {
        name: 'Sulu',
        baselineHours: 400,
        baselineName: 'Sulu Standard',
        isDefault: false,
        baselineEntityCounts: JSON.stringify({ contentTypes: 10 }),
        annualLicenseCost: 0,
        requiresEnterprise: false,
      },
    ];
    for (const tech of phpTechs) {
      const exists = await db.query.technologies.findFirst({
        where: eq(technologies.name, tech.name),
      });
      if (!exists) {
        await db.insert(technologies).values({ ...tech, businessUnitId: phpBL.id });
      }
    }
  }

  if (wemBL) {
    const wemTechs = [
      {
        name: 'Magnolia',
        baselineHours: 600,
        baselineName: 'Magnolia Enterprise',
        isDefault: true,
        baselineEntityCounts: JSON.stringify({ contentTypes: 14 }),
        annualLicenseCost: 30000,
        requiresEnterprise: true,
      },
      {
        name: 'FirstSpirit',
        baselineHours: 700,
        baselineName: 'FirstSpirit Standard',
        isDefault: false,
        baselineEntityCounts: JSON.stringify({ contentTypes: 16 }),
        annualLicenseCost: 50000,
        requiresEnterprise: true,
      },
    ];
    for (const tech of wemTechs) {
      const exists = await db.query.technologies.findFirst({
        where: eq(technologies.name, tech.name),
      });
      if (!exists) {
        await db.insert(technologies).values({ ...tech, businessUnitId: wemBL.id });
      }
    }
  }

  // Seed feature library (used by qualification scan + CMS matrix)
  const featureSeeds: Array<{
    name: string;
    slug: string;
    category: string;
    description: string;
    priority: number;
    isActive: boolean;
  }> = [
    {
      name: 'E-Commerce',
      slug: 'ecommerce',
      category: 'functional',
      description: 'Shop, Warenkorb, Checkout, Produktkatalog, Zahlungen.',
      priority: 85,
      isActive: true,
    },
    {
      name: 'Benutzerkonten / Login',
      slug: 'user-accounts',
      category: 'functional',
      description: 'Login/Register, Profil, Rollen/Rechte, Self-Service.',
      priority: 85,
      isActive: true,
    },
    {
      name: 'Suche',
      slug: 'search',
      category: 'functional',
      description: 'Site Search, ggf. Autocomplete, Facetten, Indexing (Solr/Elastic).',
      priority: 75,
      isActive: true,
    },
    {
      name: 'Mehrsprachigkeit (i18n)',
      slug: 'multilanguage',
      category: 'functional',
      description: 'Mehrere Sprachen, Übersetzungsworkflow, hreflang.',
      priority: 80,
      isActive: true,
    },
    {
      name: 'Formulare',
      slug: 'forms',
      category: 'functional',
      description: 'Kontaktformulare, Webforms, Validierung, Spam-Schutz.',
      priority: 70,
      isActive: true,
    },
    {
      name: 'Blog / News',
      slug: 'blog-news',
      category: 'content',
      description: 'News/Blog, Kategorien/Tags, Archiv, Autoren.',
      priority: 60,
      isActive: true,
    },
    {
      name: 'Mobile App Integration',
      slug: 'mobile-app',
      category: 'integration',
      description: 'App Store/Play Store Links, Deep Links, App-Content Integration.',
      priority: 40,
      isActive: true,
    },
    {
      name: 'API (REST/GraphQL)',
      slug: 'api',
      category: 'technical',
      description: 'REST/GraphQL Schnittstellen, Integrationen, Webhooks.',
      priority: 75,
      isActive: true,
    },
    {
      name: 'Headless / Content API',
      slug: 'headless',
      category: 'technical',
      description: 'Entkoppelte Ausspielung, Content API, Multi-Channel.',
      priority: 65,
      isActive: true,
    },
    {
      name: 'Editorial Workflow / Freigaben',
      slug: 'workflow-approval',
      category: 'functional',
      description: 'Redaktionelle Workflows, Freigaben, Publikationsplanung.',
      priority: 70,
      isActive: true,
    },
    {
      name: 'Rollen & Rechte (RBAC)',
      slug: 'rbac',
      category: 'security',
      description: 'Feingranulare Berechtigungen, Rollenmodelle, Mandanten.',
      priority: 70,
      isActive: true,
    },
    {
      name: 'Single Sign-On (SSO)',
      slug: 'sso',
      category: 'security',
      description: 'SAML/OIDC, Azure AD, Keycloak.',
      priority: 60,
      isActive: true,
    },
    {
      name: 'Barrierefreiheit (WCAG)',
      slug: 'accessibility-wcag',
      category: 'compliance',
      description: 'WCAG-Konformität, semantisches HTML, ARIA, Kontraste.',
      priority: 80,
      isActive: true,
    },
    {
      name: 'DSGVO / Privacy',
      slug: 'gdpr-privacy',
      category: 'compliance',
      description: 'Cookie Consent, Datenverarbeitung, Privacy Policy.',
      priority: 80,
      isActive: true,
    },
    {
      name: 'Analytics / Tracking',
      slug: 'analytics',
      category: 'marketing',
      description: 'Google Analytics, Matomo, Tag Manager, Consent Mode.',
      priority: 50,
      isActive: true,
    },
    {
      name: 'SEO (Technisch)',
      slug: 'seo',
      category: 'marketing',
      description: 'Meta, Canonicals, Sitemaps, Structured Data.',
      priority: 60,
      isActive: true,
    },
    {
      name: 'Performance / Caching',
      slug: 'performance-caching',
      category: 'performance',
      description: 'Caching, CDN, Bildoptimierung, CWV.',
      priority: 65,
      isActive: true,
    },
    {
      name: 'Medienverwaltung (DAM light)',
      slug: 'media-management',
      category: 'content',
      description: 'Asset Management, Bildvarianten, Metadaten, Video-Embeds.',
      priority: 55,
      isActive: true,
    },
    {
      name: 'Events / Kalender',
      slug: 'events-calendar',
      category: 'content',
      description: 'Eventlisten, Kalender, Registrierung, iCal.',
      priority: 45,
      isActive: true,
    },
    {
      name: 'Stellen / Karriere',
      slug: 'jobs-careers',
      category: 'content',
      description: 'Joblisten, Bewerbungsprozess, ATS-Integration.',
      priority: 45,
      isActive: true,
    },
    {
      name: 'Newsletter / Marketing Automation',
      slug: 'newsletter',
      category: 'marketing',
      description: 'Newsletter Signup, Double Opt-In, CRM/MA Integration.',
      priority: 45,
      isActive: true,
    },
    {
      name: 'Personalisierung',
      slug: 'personalization',
      category: 'marketing',
      description: 'Personalisierte Inhalte, Segmente, A/B Testing.',
      priority: 35,
      isActive: true,
    },
    {
      name: 'Multi-Site / Mandanten',
      slug: 'multisite',
      category: 'technical',
      description: 'Mehrere Sites/Brands aus einer Plattform betreiben.',
      priority: 60,
      isActive: true,
    },
    {
      name: 'Suche (Enterprise: Solr/Elastic)',
      slug: 'enterprise-search',
      category: 'technical',
      description: 'Integration von Solr/Elasticsearch, Facetten, Synonyme.',
      priority: 55,
      isActive: true,
    },
    {
      name: 'Content Migration',
      slug: 'content-migration',
      category: 'technical',
      description: 'Content-Import/Export, Migrationspfade, Tools/ETL.',
      priority: 70,
      isActive: true,
    },
    {
      name: 'Schnittstellen zu Drittsystemen',
      slug: 'integrations',
      category: 'integration',
      description: 'CRM/ERP, PIM, DAM, IAM, Payment, Search, etc.',
      priority: 70,
      isActive: true,
    },
    {
      name: 'Dokumente / Downloads',
      slug: 'documents-downloads',
      category: 'content',
      description: 'Download Center, PDFs, Versionierung, Metadaten.',
      priority: 50,
      isActive: true,
    },
    {
      name: 'Berechtigungen für Inhalte',
      slug: 'content-permissions',
      category: 'security',
      description: 'Content visibility, geschützte Bereiche, Mitgliedschaft.',
      priority: 55,
      isActive: true,
    },
    {
      name: 'Hosting (Cloud/On-Prem Vorgaben)',
      slug: 'hosting-requirements',
      category: 'technical',
      description: 'Hosting Constraints, Region/Compliance, Container/Kubernetes.',
      priority: 55,
      isActive: true,
    },
  ];

  for (const f of featureSeeds) {
    await db.insert(features).values(f).onConflictDoNothing({ target: features.slug });
  }

  const blUsers = [];
  for (const bu of allBUs) {
    const email = `bl-${bu.name.toLowerCase()}@adesso.de`;
    const user = {
      email,
      password: hashedPassword,
      name: `BL ${bu.name} Manager`,
      role: 'bl' as const,
      businessUnitId: bu.id,
      id: createId(),
    };
    await db.insert(users).values(user).onConflictDoNothing();
    const inserted = await db.query.users.findFirst({ where: eq(users.email, email) });
    if (inserted) blUsers.push(inserted);
  }

  const bdUser = {
    email: 'bd@adesso.de',
    password: hashedPassword,
    name: 'Business Developer',
    role: 'bd' as const,
    id: createId(),
  };
  await db.insert(users).values(bdUser).onConflictDoNothing();
  const bdUserRecord = await db.query.users.findFirst({ where: eq(users.email, 'bd@adesso.de') });
  const activeUserId = bdUserRecord?.id || adminUser.id;

  const roles = ['lead', 'architect', 'developer', 'designer', 'qa', 'pm', 'consultant'];
  const skills = ['React', 'Node.js', 'Java', 'PHP', 'Scrum', 'Testing', 'UI/UX', 'Cloud'];

  const employeesData = [];
  for (const bu of allBUs) {
    for (let i = 0; i < 5; i++) {
      employeesData.push({
        name: faker.person.fullName(),
        email: faker.internet.email({ provider: 'adesso.de' }),
        businessUnitId: bu.id,
        skills: JSON.stringify(randomSubset(skills, 2, 5)),
        roles: JSON.stringify(randomSubset(roles, 1, 2)),
        availabilityStatus: random(['available', 'on_project', 'unavailable'] as const),
      });
    }
  }

  for (const emp of employeesData) {
    await db.insert(employees).values(emp).onConflictDoNothing();
  }

  const accountNames = [
    'Deutsche Bahn AG',
    'Lufthansa Systems',
    'Allianz SE',
    'BMW Group',
    'Siemens AG',
  ];
  for (const name of accountNames) {
    await db
      .insert(accounts)
      .values({
        name,
        industry: random(['Transport', 'Aviation', 'Insurance', 'Automotive', 'Technology']),
        website: `https://www.${name.toLowerCase().replace(/\s/g, '')}.com`,
        userId: activeUserId,
        notes: faker.company.catchPhrase(),
      })
      .onConflictDoNothing();
  }
  const allAccounts = await db.query.accounts.findMany();

  const competitorNames = ['Accenture', 'Capgemini', 'T-Systems', 'IBM', 'Deloitte'];
  for (const name of competitorNames) {
    await db
      .insert(competitors)
      .values({
        companyName: name,
        industry: JSON.stringify(['Consulting', 'IT Services']),
        description: faker.company.catchPhrase(),
        strengths: JSON.stringify([faker.word.adjective(), faker.word.adjective()]),
        weaknesses: JSON.stringify([faker.word.adjective()]),
        status: 'approved',
        isValidated: true,
        userId: activeUserId,
      })
      .onConflictDoNothing();
  }

  const refProjects = [
    'Global Intranet Relaunch',
    'Customer Portal App',
    'IoT Data Platform',
    'E-Commerce Migration',
  ];
  for (const project of refProjects) {
    await db
      .insert(references)
      .values({
        projectName: project,
        customerName: random(accountNames),
        industry: random(['Transport', 'Automotive', 'Retail']),
        technologies: JSON.stringify(randomSubset(['React', 'Java', 'Azure', 'Drupal'], 2)),
        scope: faker.lorem.sentence(),
        teamSize: faker.number.int({ min: 3, max: 20 }),
        durationMonths: faker.number.int({ min: 3, max: 24 }),
        budgetRange: random(['50k-100k', '100k-500k', '500k-1M', '>1M']),
        outcome: faker.lorem.paragraph(),
        status: 'approved',
        isValidated: true,
        userId: activeUserId,
      })
      .onConflictDoNothing();
  }

  const leadScenarios = [
    { status: 'routed', decision: 'pending' },
    { status: 'bl_reviewing', decision: 'pending' },
    { status: 'bid_voted', decision: 'bid' },
    { status: 'archived', decision: 'no_bid' },
  ];

  for (const scenario of leadScenarios) {
    const account = random(allAccounts);
    const bu = random(allBUs);

    const [preQualification] = await db
      .insert(preQualifications)
      .values({
        userId: activeUserId,
        source: 'reactive',
        stage: 'pre-qualification',
        inputType: 'pdf',
        rawInput: faker.lorem.paragraphs(2),
        status: scenario.status as any,
        decision: scenario.decision as any,
        accountId: account.id,
        assignedBusinessUnitId: bu.id,
      })
      .returning();

    const [qs] = await db
      .insert(leadScans)
      .values({
        preQualificationId: preQualification.id,
        websiteUrl: account.website || faker.internet.url(),
        status: 'completed',
        techStack: JSON.stringify({ cms: 'Typo3', frontend: 'jQuery', server: 'Apache' }),
        cms: 'Typo3',
        confidence: 85,
        recommendedBusinessUnit: bu.name,
      })
      .returning();

    await db
      .update(preQualifications)
      .set({ qualificationScanId: qs.id })
      .where(eq(preQualifications.id, preQualification.id));
  }
}

seed()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Seed failed:', error);
    process.exit(1);
  });
