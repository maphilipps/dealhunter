import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { db } from '../lib/db';
import {
  users,
  businessUnits,
  technologies,
  accounts,
  rfps,
  references,
  competencies,
  competitors,
  employees,
  quickScans,
} from '../lib/db/schema';

// DAX-Konzerne für Mock-Daten
const daxCompanies = [
  {
    name: 'BMW AG',
    industry: 'Automotive',
    website: 'https://www.bmw.de',
    description: 'Premium-Automobilhersteller mit Fokus auf Innovation und Nachhaltigkeit',
  },
  {
    name: 'Volkswagen AG',
    industry: 'Automotive',
    website: 'https://www.volkswagen.de',
    description: 'Weltweit führender Automobilkonzern mit vielfältigem Markenportfolio',
  },
  {
    name: 'Siemens AG',
    industry: 'Industrial Technology',
    website: 'https://www.siemens.de',
    description: 'Globales Technologieunternehmen für Industrie, Infrastruktur und Gesundheit',
  },
  {
    name: 'Allianz SE',
    industry: 'Insurance & Finance',
    website: 'https://www.allianz.de',
    description: 'Führender Versicherungs- und Finanzdienstleister',
  },
  {
    name: 'Deutsche Bank AG',
    industry: 'Banking & Finance',
    website: 'https://www.deutsche-bank.de',
    description: 'Internationale Großbank mit umfassendem Finanzdienstleistungsangebot',
  },
  {
    name: 'SAP SE',
    industry: 'Software & Technology',
    website: 'https://www.sap.com',
    description: 'Weltweit führender Anbieter von Unternehmenssoftware',
  },
  {
    name: 'Bayer AG',
    industry: 'Pharmaceuticals & Life Sciences',
    website: 'https://www.bayer.de',
    description: 'Global führendes Unternehmen in Pharma, Gesundheit und Agrarwirtschaft',
  },
  {
    name: 'BASF SE',
    industry: 'Chemicals',
    website: 'https://www.basf.de',
    description: 'Weltweit führendes Chemieunternehmen',
  },
  {
    name: 'Deutsche Telekom AG',
    industry: 'Telecommunications',
    website: 'https://www.telekom.de',
    description: 'Führender europäischer Telekommunikationsanbieter',
  },
  {
    name: 'adidas AG',
    industry: 'Sporting Goods',
    website: 'https://www.adidas.de',
    description: 'Weltweit führender Sportartikelhersteller',
  },
  {
    name: 'Mercedes-Benz Group AG',
    industry: 'Automotive',
    website: 'https://www.mercedes-benz.de',
    description: 'Premium-Automobilhersteller und Mobilitätsanbieter',
  },
  {
    name: 'Deutsche Post DHL Group',
    industry: 'Logistics',
    website: 'https://www.dhl.de',
    description: 'Weltweit führender Logistikkonzern',
  },
];

async function seedDAXData() {
  console.log('🌱 Starting DAX Mock Data Seed...');

  // 1. Sicherstellen, dass Business Units existieren
  console.log('\n📋 Checking Business Units...');
  let phpBU = await db.query.businessUnits.findFirst({
    where: eq(businessUnits.name, 'PHP'),
  });

  let wemBU = await db.query.businessUnits.findFirst({
    where: eq(businessUnits.name, 'WEM'),
  });

  if (!phpBU || !wemBU) {
    console.log('⚠️  Business Units nicht gefunden. Bitte zuerst `npm run db:seed` ausführen.');
    process.exit(1);
  }

  // 2. Test-User erstellen (BD und BL)
  console.log('\n👥 Creating Test Users...');
  const hashedPassword = await bcrypt.hash('test123', 10);

  const bdUsers = [];
  const blUsers = [];

  // BD User
  const [bdUser] = await db
    .insert(users)
    .values({
      email: 'bd@adesso.de',
      password: hashedPassword,
      name: 'Business Developer',
      role: 'bd',
    })
    .onConflictDoNothing()
    .returning();

  if (bdUser) bdUsers.push(bdUser);
  console.log(`  ✓ BD User: bd@adesso.de (password: test123)`);

  // BL User für PHP
  const [blUserPHP] = await db
    .insert(users)
    .values({
      email: 'bl-php@adesso.de',
      password: hashedPassword,
      name: 'Business Line Lead PHP',
      role: 'bl',
      businessUnitId: phpBU.id,
    })
    .onConflictDoNothing()
    .returning();

  if (blUserPHP) blUsers.push(blUserPHP);
  console.log(`  ✓ BL User (PHP): bl-php@adesso.de (password: test123)`);

  // BL User für WEM
  const [blUserWEM] = await db
    .insert(users)
    .values({
      email: 'bl-wem@adesso.de',
      password: hashedPassword,
      name: 'Business Line Lead WEM',
      role: 'bl',
      businessUnitId: wemBU.id,
    })
    .onConflictDoNothing()
    .returning();

  if (blUserWEM) blUsers.push(blUserWEM);
  console.log(`  ✓ BL User (WEM): bl-wem@adesso.de (password: test123)`);

  const testUser = bdUsers[0] || (await db.query.users.findFirst({ where: eq(users.role, 'bd') }));
  if (!testUser) {
    console.error('❌ Kein Test-User gefunden');
    process.exit(1);
  }

  // 3. Accounts (DAX-Konzerne)
  console.log('\n🏢 Creating DAX Accounts...');
  const createdAccounts = [];

  for (const company of daxCompanies) {
    const [account] = await db
      .insert(accounts)
      .values({
        userId: testUser.id,
        name: company.name,
        industry: company.industry,
        website: company.website,
        notes: company.description,
      })
      .onConflictDoNothing()
      .returning();

    if (account) {
      createdAccounts.push(account);
      console.log(`  ✓ ${account.name}`);
    }
  }

  // 4. Employees (Team Members)
  console.log('\n👨‍💻 Creating Employees...');

  const phpEmployees = [
    {
      name: 'Anna Schmidt',
      email: 'anna.schmidt@adesso.de',
      skills: ['Drupal', 'PHP', 'Symfony', 'React'],
      roles: ['lead', 'architect'],
      businessUnitId: phpBU.id,
    },
    {
      name: 'Thomas Müller',
      email: 'thomas.mueller@adesso.de',
      skills: ['PHP', 'Laravel', 'Vue.js', 'MySQL'],
      roles: ['developer'],
      businessUnitId: phpBU.id,
    },
    {
      name: 'Sarah Weber',
      email: 'sarah.weber@adesso.de',
      skills: ['Drupal', 'Ibexa', 'Tailwind CSS'],
      roles: ['developer', 'designer'],
      businessUnitId: phpBU.id,
    },
  ];

  const wemEmployees = [
    {
      name: 'Michael Fischer',
      email: 'michael.fischer@adesso.de',
      skills: ['Magnolia', 'Java', 'Spring Boot', 'React'],
      roles: ['lead', 'architect'],
      businessUnitId: wemBU.id,
    },
    {
      name: 'Julia Becker',
      email: 'julia.becker@adesso.de',
      skills: ['FirstSpirit', 'Java', 'Angular'],
      roles: ['developer'],
      businessUnitId: wemBU.id,
    },
  ];

  for (const emp of [...phpEmployees, ...wemEmployees]) {
    await db
      .insert(employees)
      .values({
        ...emp,
        skills: JSON.stringify(emp.skills),
        roles: JSON.stringify(emp.roles),
      })
      .onConflictDoNothing();
    console.log(`  ✓ ${emp.name} (${emp.businessUnitId === phpBU.id ? 'PHP' : 'WEM'})`);
  }

  // 5. References (Erfolgreiche Projekte)
  console.log('\n📚 Creating References...');

  const referenceProjects = [
    {
      projectName: 'BMW Group Website Relaunch',
      customerName: 'BMW AG',
      industry: 'Automotive',
      technologies: ['Drupal 10', 'React', 'Headless CMS', 'AWS'],
      scope: 'Complete website relaunch with headless architecture',
      teamSize: 8,
      durationMonths: 12,
      budgetRange: '800k-1.2M EUR',
      outcome: 'Successful launch with 40% performance improvement',
      highlights: [
        'Multi-brand architecture',
        'Headless CMS with React frontend',
        'AWS cloud infrastructure',
        'WCAG 2.1 AA compliant',
      ],
    },
    {
      projectName: 'Siemens Digital Experience Platform',
      customerName: 'Siemens AG',
      industry: 'Industrial Technology',
      technologies: ['Magnolia CMS', 'Java', 'Spring Boot', 'Vue.js', 'Azure'],
      scope: 'Enterprise DXP for global product portfolio',
      teamSize: 12,
      durationMonths: 18,
      budgetRange: '1.5M-2M EUR',
      outcome: 'Global rollout across 40+ countries',
      highlights: [
        'Multi-language support (25 languages)',
        'Product catalog integration',
        'Personalization engine',
        'Azure cloud deployment',
      ],
    },
    {
      projectName: 'Deutsche Telekom Portal Migration',
      customerName: 'Deutsche Telekom AG',
      industry: 'Telecommunications',
      technologies: ['Drupal 10', 'Symfony', 'TypeScript', 'Kubernetes'],
      scope: 'Migration of legacy portal to modern stack',
      teamSize: 10,
      durationMonths: 15,
      budgetRange: '1M-1.5M EUR',
      outcome: 'Zero-downtime migration, 60% faster page loads',
      highlights: [
        'Legacy system integration',
        'Microservices architecture',
        'Kubernetes orchestration',
        'Progressive Web App',
      ],
    },
    {
      projectName: 'SAP Community Platform',
      customerName: 'SAP SE',
      industry: 'Software & Technology',
      technologies: ['Ibexa DXP', 'PHP', 'Elasticsearch', 'Redis', 'Docker'],
      scope: 'Developer community platform with forums and documentation',
      teamSize: 6,
      durationMonths: 9,
      budgetRange: '500k-800k EUR',
      outcome: 'Launched with 100k+ active users in first month',
      highlights: [
        'Real-time collaboration features',
        'Advanced search with Elasticsearch',
        'Content personalization',
        'Docker containerization',
      ],
    },
  ];

  for (const ref of referenceProjects) {
    await db
      .insert(references)
      .values({
        userId: testUser.id,
        ...ref,
        technologies: JSON.stringify(ref.technologies),
        highlights: JSON.stringify(ref.highlights),
        status: 'approved',
        isValidated: true,
        validatedAt: new Date(),
      })
      .onConflictDoNothing();
    console.log(`  ✓ ${ref.projectName}`);
  }

  // 6. Competencies
  console.log('\n🎓 Creating Competencies...');

  const competenciesData = [
    {
      name: 'Drupal',
      category: 'technology' as const,
      level: 'expert' as const,
      description: 'Drupal CMS Development, Architecture, Migration',
      certifications: ['Acquia Certified Developer', 'Acquia Certified Architect'],
    },
    {
      name: 'React',
      category: 'technology' as const,
      level: 'advanced' as const,
      description: 'React frontend development, hooks, state management',
      certifications: [],
    },
    {
      name: 'Agile/Scrum',
      category: 'methodology' as const,
      level: 'expert' as const,
      description: 'Agile project management, Scrum Master',
      certifications: ['Certified Scrum Master'],
    },
    {
      name: 'Automotive Industry',
      category: 'industry' as const,
      level: 'advanced' as const,
      description: 'Deep knowledge of automotive industry requirements',
      certifications: [],
    },
  ];

  for (const comp of competenciesData) {
    await db
      .insert(competencies)
      .values({
        userId: testUser.id,
        ...comp,
        certifications: JSON.stringify(comp.certifications),
        status: 'approved',
        isValidated: true,
        validatedAt: new Date(),
      })
      .onConflictDoNothing();
    console.log(`  ✓ ${comp.name} (${comp.category})`);
  }

  // 7. Competitors
  console.log('\n🏆 Creating Competitors...');

  const competitorData = [
    {
      companyName: 'Accenture',
      website: 'https://www.accenture.com',
      industry: ['Technology', 'Consulting'],
      description: 'Global professional services company',
      strengths: ['Global presence', 'Large project portfolio', 'Industry expertise'],
      weaknesses: ['High cost', 'Less flexible', 'Slower decision making'],
      typicalMarkets: ['Enterprise', 'Fortune 500', 'Government'],
      encounterNotes: [
        'BMW project 2023 - lost due to pricing',
        'Siemens project 2022 - won with better tech approach',
      ],
    },
    {
      companyName: 'Capgemini',
      website: 'https://www.capgemini.com',
      industry: ['Technology', 'Consulting'],
      description: 'Global leader in consulting, technology services and digital transformation',
      strengths: ['Strong European presence', 'Digital transformation expertise', 'Industry knowledge'],
      weaknesses: ['Medium pricing', 'Generic solutions'],
      typicalMarkets: ['Enterprise', 'Mid-market', 'Government'],
      encounterNotes: ['Deutsche Telekom project 2023 - competitive bid'],
    },
  ];

  for (const comp of competitorData) {
    await db
      .insert(competitors)
      .values({
        userId: testUser.id,
        ...comp,
        industry: JSON.stringify(comp.industry),
        strengths: JSON.stringify(comp.strengths),
        weaknesses: JSON.stringify(comp.weaknesses),
        typicalMarkets: JSON.stringify(comp.typicalMarkets),
        encounterNotes: JSON.stringify(comp.encounterNotes),
        status: 'approved',
        isValidated: true,
        validatedAt: new Date(),
      })
      .onConflictDoNothing();
    console.log(`  ✓ ${comp.companyName}`);
  }

  // 8. RFPs und Quick Scans
  console.log('\n📝 Creating RFPs with Quick Scans...');

  const rfpTemplates = [
    {
      account: createdAccounts.find(a => a.name === 'BMW AG'),
      source: 'reactive',
      stage: 'rfp',
      inputType: 'pdf',
      websiteUrl: 'https://www.bmw.de',
      extractedRequirements: {
        projectName: 'BMW Careers Portal Modernization',
        description:
          'Modernize the BMW careers portal with improved UX, better job search, and integration with HR systems',
        budget: '800k-1M EUR',
        timeline: 'Q2 2024 - Q1 2025',
        technologies: ['CMS', 'Job Board Integration', 'Applicant Tracking System'],
        requirements: [
          'Modern, mobile-first design',
          'Integration with SAP SuccessFactors',
          'Multi-language support (15 languages)',
          'Advanced job search and filtering',
          'Applicant tracking',
        ],
      },
      quickScanData: {
        cms: 'WordPress',
        framework: 'PHP',
        hosting: 'AWS',
        techStack: ['WordPress 6.x', 'PHP 8.1', 'MySQL', 'AWS EC2'],
        pageCount: 450,
        recommendedBusinessUnit: 'PHP',
        confidence: 85,
        reasoning:
          'PHP-based stack, WordPress migration expertise available, good fit for PHP Business Line',
        timeline: {
          estimatedDuration: 9,
          phases: [
            { name: 'Discovery & Planning', duration: 2, confidence: 'high' },
            { name: 'Design & Architecture', duration: 2, confidence: 'high' },
            { name: 'Development', duration: 4, confidence: 'medium' },
            { name: 'Testing & Launch', duration: 1, confidence: 'medium' },
          ],
          risks: ['SAP SuccessFactors integration complexity', 'Multi-language content migration'],
        },
      },
      decision: 'bid',
    },
    {
      account: createdAccounts.find(a => a.name === 'Deutsche Telekom AG'),
      source: 'proactive',
      stage: 'warm',
      inputType: 'crm',
      websiteUrl: 'https://www.telekom.de',
      extractedRequirements: {
        projectName: 'Telekom Business Customer Portal',
        description: 'New B2B customer portal for business customers with self-service capabilities',
        budget: '1.2M-1.5M EUR',
        timeline: 'Q3 2024 - Q2 2025',
        technologies: ['Enterprise CMS', 'Integration Platform', 'Customer Portal'],
        requirements: [
          'Self-service portal',
          'Contract management',
          'Billing integration',
          'Ticket system',
          'Document management',
        ],
      },
      quickScanData: {
        cms: 'Custom Legacy',
        framework: 'Java',
        hosting: 'On-Premise',
        techStack: ['Custom Java', 'Oracle DB', 'Legacy Infrastructure'],
        pageCount: 1200,
        recommendedBusinessUnit: 'WEM',
        confidence: 78,
        reasoning:
          'Enterprise-grade requirements, Java backend, good fit for WEM with Magnolia expertise',
        timeline: {
          estimatedDuration: 12,
          phases: [
            { name: 'Discovery & Planning', duration: 3, confidence: 'medium' },
            { name: 'Design & Architecture', duration: 3, confidence: 'medium' },
            { name: 'Development', duration: 5, confidence: 'low' },
            { name: 'Testing & Launch', duration: 1, confidence: 'medium' },
          ],
          risks: [
            'Legacy system integration',
            'Complex billing system integration',
            'High availability requirements',
          ],
        },
      },
      decision: 'pending',
    },
    {
      account: createdAccounts.find(a => a.name === 'Siemens AG'),
      source: 'reactive',
      stage: 'rfp',
      inputType: 'email',
      websiteUrl: 'https://www.siemens.de',
      extractedRequirements: {
        projectName: 'Siemens Product Catalog Portal',
        description: 'Global product catalog with e-commerce capabilities for industrial products',
        budget: '2M-2.5M EUR',
        timeline: 'Q1 2024 - Q4 2024',
        technologies: ['Enterprise DXP', 'E-Commerce', 'PIM Integration'],
        requirements: [
          'Product catalog with 50k+ SKUs',
          'PIM system integration',
          'E-commerce capabilities',
          'Multi-country deployment',
          'B2B pricing and quotes',
        ],
      },
      quickScanData: {
        cms: 'Sitecore',
        framework: 'ASP.NET',
        hosting: 'Azure',
        techStack: ['Sitecore 10.x', '.NET 6', 'Azure Cloud', 'SQL Server'],
        pageCount: 3500,
        recommendedBusinessUnit: 'WEM',
        confidence: 92,
        reasoning:
          'Enterprise DXP requirements, large-scale deployment, perfect fit for WEM Magnolia expertise',
        timeline: {
          estimatedDuration: 15,
          phases: [
            { name: 'Discovery & Planning', duration: 3, confidence: 'high' },
            { name: 'Design & Architecture', duration: 4, confidence: 'high' },
            { name: 'Development', duration: 6, confidence: 'medium' },
            { name: 'Testing & Launch', duration: 2, confidence: 'medium' },
          ],
          risks: ['Complex PIM integration', 'Multi-country rollout coordination', 'Data migration volume'],
        },
      },
      decision: 'bid',
    },
    {
      account: createdAccounts.find(a => a.name === 'adidas AG'),
      source: 'reactive',
      stage: 'rfp',
      inputType: 'pdf',
      websiteUrl: 'https://www.adidas.de',
      extractedRequirements: {
        projectName: 'adidas Community Platform',
        description: 'Sports community platform with user-generated content and e-commerce integration',
        budget: '600k-800k EUR',
        timeline: 'Q2 2024 - Q4 2024',
        technologies: ['CMS', 'Community Platform', 'E-Commerce Integration'],
        requirements: [
          'User profiles and social features',
          'Content creation tools',
          'E-commerce integration',
          'Mobile app API',
          'Gamification features',
        ],
      },
      quickScanData: {
        cms: 'Contentful',
        framework: 'Next.js',
        hosting: 'Vercel',
        techStack: ['Contentful', 'Next.js 14', 'React', 'Vercel Edge'],
        pageCount: 280,
        recommendedBusinessUnit: 'PHP',
        confidence: 70,
        reasoning: 'Modern headless stack, PHP team has React expertise, medium complexity',
        timeline: {
          estimatedDuration: 8,
          phases: [
            { name: 'Discovery & Planning', duration: 2, confidence: 'high' },
            { name: 'Design & Architecture', duration: 2, confidence: 'medium' },
            { name: 'Development', duration: 3, confidence: 'medium' },
            { name: 'Testing & Launch', duration: 1, confidence: 'high' },
          ],
          risks: ['E-commerce integration complexity', 'User-generated content moderation'],
        },
      },
      decision: 'pending',
    },
    {
      account: createdAccounts.find(a => a.name === 'SAP SE'),
      source: 'proactive',
      stage: 'cold',
      inputType: 'freetext',
      websiteUrl: 'https://www.sap.com',
      extractedRequirements: {
        projectName: 'SAP Developer Documentation Hub',
        description: 'Centralized documentation platform for all SAP developer resources',
        budget: '400k-600k EUR',
        timeline: 'Q3 2024 - Q1 2025',
        technologies: ['Documentation Platform', 'Search Engine', 'API Documentation'],
        requirements: [
          'API documentation',
          'Code samples',
          'Developer tutorials',
          'Advanced search',
          'Version management',
        ],
      },
      quickScanData: {
        cms: 'Confluence',
        framework: 'Java',
        hosting: 'AWS',
        techStack: ['Confluence', 'Java', 'Elasticsearch', 'AWS'],
        pageCount: 5000,
        recommendedBusinessUnit: 'PHP',
        confidence: 65,
        reasoning:
          'Documentation-heavy, could use Drupal or Ibexa, PHP team has relevant experience',
        timeline: {
          estimatedDuration: 10,
          phases: [
            { name: 'Discovery & Planning', duration: 2, confidence: 'medium' },
            { name: 'Design & Architecture', duration: 3, confidence: 'medium' },
            { name: 'Development', duration: 4, confidence: 'low' },
            { name: 'Testing & Launch', duration: 1, confidence: 'medium' },
          ],
          risks: ['Content migration volume', 'Search performance requirements', 'API integration'],
        },
      },
      decision: 'pending',
    },
  ];

  for (const rfpTemplate of rfpTemplates) {
    if (!rfpTemplate.account) continue;

    // Create RFP first (without quickScanId)
    const status = rfpTemplate.decision === 'bid' ? 'timeline_estimating' : 'bit_pending';

    const [rfp] = await db
      .insert(rfps)
      .values({
        userId: testUser.id,
        source: rfpTemplate.source as 'reactive' | 'proactive',
        stage: rfpTemplate.stage as 'cold' | 'warm' | 'rfp',
        inputType: rfpTemplate.inputType as 'pdf' | 'crm' | 'freetext' | 'email' | 'combined',
        rawInput: JSON.stringify(rfpTemplate.extractedRequirements),
        extractedRequirements: JSON.stringify(rfpTemplate.extractedRequirements),
        status: status as any,
        decision: rfpTemplate.decision as 'bid' | 'no_bid' | 'pending',
        accountId: rfpTemplate.account.id,
        websiteUrl: rfpTemplate.websiteUrl,
        assignedBusinessUnitId:
          rfpTemplate.quickScanData.recommendedBusinessUnit === 'PHP' ? phpBU.id : wemBU.id,
        quickScanResults: JSON.stringify(rfpTemplate.quickScanData),
      })
      .returning();

    // Create Quick Scan with RFP ID
    const [quickScan] = await db
      .insert(quickScans)
      .values({
        rfpId: rfp.id,
        websiteUrl: rfpTemplate.websiteUrl,
        status: 'completed',
        cms: rfpTemplate.quickScanData.cms,
        framework: rfpTemplate.quickScanData.framework,
        hosting: rfpTemplate.quickScanData.hosting,
        techStack: JSON.stringify(rfpTemplate.quickScanData.techStack),
        pageCount: rfpTemplate.quickScanData.pageCount,
        recommendedBusinessUnit: rfpTemplate.quickScanData.recommendedBusinessUnit,
        confidence: rfpTemplate.quickScanData.confidence,
        reasoning: rfpTemplate.quickScanData.reasoning,
        timeline: JSON.stringify(rfpTemplate.quickScanData.timeline),
        timelineGeneratedAt: new Date(),
        startedAt: new Date(Date.now() - 1000 * 60 * 30), // 30 minutes ago
        completedAt: new Date(Date.now() - 1000 * 60 * 5), // 5 minutes ago
      })
      .returning();

    // Update RFP with Quick Scan ID
    await db.update(rfps).set({ quickScanId: quickScan.id }).where(eq(rfps.id, rfp.id));

    console.log(`  ✓ ${rfpTemplate.extractedRequirements.projectName} (${rfpTemplate.account.name})`);
  }

  console.log('\n✨ DAX Mock Data Seed completed!');
  console.log('\n📊 Summary:');
  console.log(`  - ${createdAccounts.length} DAX Accounts`);
  console.log(`  - ${rfpTemplates.length} RFPs with Quick Scans`);
  console.log(`  - ${referenceProjects.length} Reference Projects`);
  console.log(`  - ${competenciesData.length} Competencies`);
  console.log(`  - ${competitorData.length} Competitors`);
  console.log(`  - ${phpEmployees.length + wemEmployees.length} Employees`);
  console.log('\n🔐 Login Credentials:');
  console.log('  BD User: bd@adesso.de / test123');
  console.log('  BL PHP: bl-php@adesso.de / test123');
  console.log('  BL WEM: bl-wem@adesso.de / test123');
}

seedDAXData()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  });
