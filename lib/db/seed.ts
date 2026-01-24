import { fakerDE as faker } from '@faker-js/faker';
import { createId } from '@paralleldrive/cuid2';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';

import {
  users,
  businessUnits,
  technologies,
  accounts,
  competitors,
  employees,
  rfps,
  leads,
  quickScans,
  websiteAudits,
  leadSectionData,
  cmsMatchResults,
  ptEstimations,
  references,
  referenceMatches,
  competitorMatches,
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
    const existing = await db.query.businessUnits.findFirst({
      where: eq(businessUnits.name, data.name),
    });
    if (!existing) {
      await db.insert(businessUnits).values({ ...data, keywords: JSON.stringify(data.keywords) });
    }
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
      },
      {
        name: 'Ibexa',
        baselineHours: 500,
        baselineName: 'Ibexa Standard',
        isDefault: false,
        baselineEntityCounts: JSON.stringify({ contentTypes: 12 }),
      },
      {
        name: 'Sulu',
        baselineHours: 400,
        baselineName: 'Sulu Standard',
        isDefault: false,
        baselineEntityCounts: JSON.stringify({ contentTypes: 10 }),
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
      },
      {
        name: 'FirstSpirit',
        baselineHours: 700,
        baselineName: 'FirstSpirit Standard',
        isDefault: false,
        baselineEntityCounts: JSON.stringify({ contentTypes: 16 }),
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
  const allTechs = await db.query.technologies.findMany();

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
  const allCompetitors = await db.query.competitors.findMany();

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
  const allReferences = await db.query.references.findMany();

  const leadScenarios = [
    { status: 'routed', decision: 'pending', blVote: null },
    { status: 'bl_reviewing', decision: 'pending', blVote: null },
    { status: 'bid_voted', decision: 'bid', blVote: 'BID' },
    { status: 'archived', decision: 'no_bid', blVote: 'NO-BID' },
  ];

  for (const scenario of leadScenarios) {
    const account = random(allAccounts);
    const bu = random(allBUs);

    const [rfp] = await db
      .insert(rfps)
      .values({
        userId: activeUserId,
        source: 'reactive',
        stage: 'rfp',
        inputType: 'pdf',
        rawInput: faker.lorem.paragraphs(2),
        status: scenario.status as any,
        decision: scenario.decision as any,
        accountId: account.id,
        assignedBusinessUnitId: bu.id,
      })
      .returning();

    const [qs] = await db
      .insert(quickScans)
      .values({
        rfpId: rfp.id,
        websiteUrl: account.website || faker.internet.url(),
        status: 'completed',
        techStack: JSON.stringify({ cms: 'Typo3', frontend: 'jQuery', server: 'Apache' }),
        cms: 'Typo3',
        confidence: 85,
        recommendedBusinessUnit: bu.name,
      })
      .returning();

    await db.update(rfps).set({ quickScanId: qs.id }).where(eq(rfps.id, rfp.id));

    const [lead] = await db
      .insert(leads)
      .values({
        rfpId: rfp.id,
        status: scenario.status as any,
        customerName: account.name,
        websiteUrl: account.website,
        industry: account.industry,
        projectDescription: `Comprehensive relaunch of the corporate website for ${account.name}. The goal is to modernize the tech stack, improve UX, and migrate from legacy systems.`,
        budget: '500.000€ - 800.000€',
        requirements: JSON.stringify([
          { id: 'req_1', text: 'Headless CMS Architecture', priority: 'high' },
          { id: 'req_2', text: 'SSO Integration with Azure AD', priority: 'critical' },
          { id: 'req_3', text: 'Multi-language support (DE, EN, FR)', priority: 'medium' },
          { id: 'req_4', text: 'WCAG 2.1 AA Accessibility', priority: 'high' },
        ]),
        quickScanId: qs.id,
        decisionMakers: JSON.stringify([
          { name: faker.person.fullName(), role: 'CTO', influence: 'high' },
          { name: faker.person.fullName(), role: 'Procurement Lead', influence: 'medium' },
        ]),
        businessUnitId: bu.id,
        blVote: scenario.blVote as any,
        blVotedAt: scenario.blVote ? new Date() : null,
        blVotedByUserId: scenario.blVote
          ? blUsers.find(u => u.businessUnitId === bu.id)?.id || adminUser.id
          : null,
        blReasoning:
          scenario.blVote === 'BID'
            ? 'Strong fit with our portfolio. We have resources available.'
            : scenario.blVote === 'NO-BID'
              ? 'Budget too low for the requirements.'
              : null,
        blConfidenceScore: scenario.blVote ? faker.number.int({ min: 70, max: 95 }) : null,
      })
      .returning();

    const sections = ['executive-summary', 'technology-fit', 'commercial-aspects'];
    for (const section of sections) {
      await db.insert(leadSectionData).values({
        leadId: lead.id,
        sectionId: section,
        content: JSON.stringify({
          summary: faker.lorem.paragraph(),
          points: [faker.lorem.sentence(), faker.lorem.sentence()],
        }),
        confidence: faker.number.int({ min: 60, max: 90 }),
      });
    }

    await db.insert(websiteAudits).values({
      leadId: lead.id,
      status: 'completed',
      websiteUrl: account.website || faker.internet.url(),
      performanceScore: faker.number.int({ min: 40, max: 90 }),
      accessibilityScore: faker.number.int({ min: 50, max: 95 }),
      seoScore: faker.number.int({ min: 60, max: 100 }),
      techStack: JSON.stringify(['Typo3', 'jQuery', 'Bootstrap']),
      migrationComplexity: 'medium',
    });

    if (allTechs.length > 0) {
      const tech = random(allTechs);
      await db.insert(cmsMatchResults).values({
        leadId: lead.id,
        technologyId: tech.id,
        totalScore: faker.number.int({ min: 70, max: 95 }),
        featureScore: 80,
        industryScore: 75,
        sizeScore: 90,
        budgetScore: 60,
        migrationScore: 70,
        rank: 1,
        isRecommended: true,
        reasoning: 'Best fit for enterprise requirements.',
      });
    }

    await db.insert(ptEstimations).values({
      leadId: lead.id,
      totalPT: faker.number.int({ min: 100, max: 1000 }),
      totalCost: faker.number.int({ min: 100000, max: 1000000 }),
      durationMonths: faker.number.int({ min: 3, max: 12 }),
      phases: JSON.stringify([
        { name: 'Discovery', weeks: 4 },
        { name: 'Implementation', weeks: 20 },
        { name: 'Go-Live', weeks: 2 },
      ]),
      confidenceLevel: 'medium',
    });

    if (allReferences.length > 0) {
      await db.insert(referenceMatches).values({
        leadId: lead.id,
        referenceId: random(allReferences).id,
        totalScore: 85,
        techStackScore: 90,
        industryScore: 80,
        rank: 1,
        reasoning: 'Similar industry and tech stack.',
      });
    }

    if (allCompetitors.length > 0) {
      await db.insert(competitorMatches).values({
        leadId: lead.id,
        competitorId: random(allCompetitors).id,
        source: 'database',
        relevanceScore: 90,
        likelyInvolved: true,
        reasoning: 'Incumbent provider.',
      });
    }
  }
}

seed()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  });
