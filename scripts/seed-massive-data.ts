import 'dotenv/config'; // Load .env first
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';

import { db } from '../lib/db';
import {
  users,
  businessUnits,
  accounts,
  preQualifications,
  qualifications,
  quickScans,
} from '../lib/db/schema';
import { embedAgentOutput } from '../lib/rag/embedding-service';

// Erweiterte DAX + MDAX Konzerne
const companies = [
  // DAX
  { name: 'BMW AG', industry: 'Automotive', website: 'https://www.bmw.de' },
  { name: 'Volkswagen AG', industry: 'Automotive', website: 'https://www.volkswagen.de' },
  {
    name: 'Mercedes-Benz Group AG',
    industry: 'Automotive',
    website: 'https://www.mercedes-benz.de',
  },
  { name: 'Siemens AG', industry: 'Industrial Technology', website: 'https://www.siemens.de' },
  { name: 'Allianz SE', industry: 'Insurance & Finance', website: 'https://www.allianz.de' },
  {
    name: 'Deutsche Bank AG',
    industry: 'Banking & Finance',
    website: 'https://www.deutsche-bank.de',
  },
  { name: 'SAP SE', industry: 'Software & Technology', website: 'https://www.sap.com' },
  { name: 'Bayer AG', industry: 'Pharmaceuticals', website: 'https://www.bayer.de' },
  { name: 'BASF SE', industry: 'Chemicals', website: 'https://www.basf.de' },
  {
    name: 'Deutsche Telekom AG',
    industry: 'Telecommunications',
    website: 'https://www.telekom.de',
  },
  { name: 'adidas AG', industry: 'Sporting Goods', website: 'https://www.adidas.de' },
  { name: 'Deutsche Post DHL Group', industry: 'Logistics', website: 'https://www.dhl.de' },
  {
    name: 'Infineon Technologies AG',
    industry: 'Semiconductors',
    website: 'https://www.infineon.com',
  },
  { name: 'Henkel AG', industry: 'Consumer Goods', website: 'https://www.henkel.de' },
  { name: 'Continental AG', industry: 'Automotive', website: 'https://www.continental.com' },
  // MDAX
  { name: 'Airbus SE', industry: 'Aerospace', website: 'https://www.airbus.com' },
  { name: 'Hugo Boss AG', industry: 'Fashion', website: 'https://www.hugoboss.com' },
  { name: 'Fresenius SE', industry: 'Healthcare', website: 'https://www.fresenius.de' },
  { name: 'Zalando SE', industry: 'E-Commerce', website: 'https://www.zalando.de' },
  {
    name: 'Deutsche Börse AG',
    industry: 'Financial Services',
    website: 'https://www.deutsche-boerse.com',
  },
  { name: 'Delivery Hero SE', industry: 'Food Delivery', website: 'https://www.deliveryhero.com' },
  {
    name: 'Rational AG',
    industry: 'Commercial Kitchen Equipment',
    website: 'https://www.rational-online.com',
  },
  {
    name: 'Knorr-Bremse AG',
    industry: 'Rail & Commercial Vehicles',
    website: 'https://www.knorr-bremse.com',
  },
  { name: 'Brenntag SE', industry: 'Chemical Distribution', website: 'https://www.brenntag.com' },
  { name: 'Fraport AG', industry: 'Airport Operations', website: 'https://www.fraport.com' },
];

// Project Templates für RFPs
const projectTemplates = [
  {
    type: 'website-relaunch',
    title: 'Website Relaunch',
    description: 'Complete website modernization with improved UX and performance',
    technologies: ['CMS', 'Frontend Framework', 'Cloud Hosting'],
    budgetRange: ['500k-800k', '800k-1.2M', '1.2M-1.8M'],
  },
  {
    type: 'portal',
    title: 'Customer Portal',
    description: 'Self-service customer portal with document management and ticketing',
    technologies: ['Enterprise CMS', 'Portal Solution', 'Integration Platform'],
    budgetRange: ['800k-1.2M', '1.2M-1.8M', '1.8M-2.5M'],
  },
  {
    type: 'ecommerce',
    title: 'E-Commerce Platform',
    description: 'B2B/B2C e-commerce platform with product catalog and checkout',
    technologies: ['E-Commerce Platform', 'Payment Gateway', 'PIM Integration'],
    budgetRange: ['1M-1.5M', '1.5M-2.5M', '2.5M-4M'],
  },
  {
    type: 'community',
    title: 'Community Platform',
    description: 'User community with forums, content creation, and social features',
    technologies: ['Community Platform', 'User Management', 'Content Moderation'],
    budgetRange: ['400k-700k', '700k-1M', '1M-1.5M'],
  },
  {
    type: 'intranet',
    title: 'Employee Intranet',
    description: 'Modern intranet with collaboration tools and document management',
    technologies: ['Intranet Solution', 'Collaboration Tools', 'Search Engine'],
    budgetRange: ['600k-900k', '900k-1.3M', '1.3M-2M'],
  },
  {
    type: 'documentation',
    title: 'Documentation Hub',
    description: 'Centralized documentation platform with API docs and tutorials',
    technologies: ['Documentation Platform', 'Search', 'Version Control'],
    budgetRange: ['300k-500k', '500k-800k', '800k-1.2M'],
  },
  {
    type: 'dxp',
    title: 'Digital Experience Platform',
    description: 'Enterprise DXP for multi-brand digital experiences',
    technologies: ['DXP', 'Personalization', 'Multi-Site Management'],
    budgetRange: ['1.5M-2.5M', '2.5M-4M', '4M-6M'],
  },
];

// Tech Stack Varianten
const techStacks = [
  { cms: 'Drupal 10', framework: 'PHP', hosting: 'AWS', bu: 'PHP', confidence: 85 },
  { cms: 'Drupal 11', framework: 'PHP', hosting: 'Azure', bu: 'PHP', confidence: 90 },
  { cms: 'WordPress', framework: 'PHP', hosting: 'AWS', bu: 'PHP', confidence: 75 },
  { cms: 'Ibexa DXP', framework: 'PHP', hosting: 'Docker', bu: 'PHP', confidence: 88 },
  { cms: 'Magnolia', framework: 'Java', hosting: 'Azure', bu: 'WEM', confidence: 92 },
  { cms: 'FirstSpirit', framework: 'Java', hosting: 'On-Premise', bu: 'WEM', confidence: 85 },
  { cms: 'Sitecore', framework: 'ASP.NET', hosting: 'Azure', bu: 'WEM', confidence: 80 },
  { cms: 'Contentful', framework: 'Next.js', hosting: 'Vercel', bu: 'PHP', confidence: 70 },
  { cms: 'Strapi', framework: 'Node.js', hosting: 'AWS', bu: 'PHP', confidence: 65 },
  { cms: 'Contentstack', framework: 'React', hosting: 'AWS', bu: 'PHP', confidence: 72 },
];

async function seedMassiveData() {
  console.log('🌱 Starting Massive Data Seed...\n');

  // 1. Business Units holen
  const phpBU = await db.query.businessUnits.findFirst({
    where: eq(businessUnits.name, 'PHP'),
  });
  const wemBU = await db.query.businessUnits.findFirst({
    where: eq(businessUnits.name, 'WEM'),
  });

  if (!phpBU || !wemBU) {
    console.log('⚠️  Business Units nicht gefunden. Bitte zuerst `npm run db:seed` ausführen.');
    process.exit(1);
  }

  // 2. Test Users
  console.log('👥 Creating Test Users...');
  const hashedPassword = await bcrypt.hash('test123', 10);

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

  const [blUserPHP] = await db
    .insert(users)
    .values({
      email: 'bl-php@adesso.de',
      password: hashedPassword,
      name: 'BL Lead PHP',
      role: 'bl',
      businessUnitId: phpBU.id,
    })
    .onConflictDoNothing()
    .returning();

  const [blUserWEM] = await db
    .insert(users)
    .values({
      email: 'bl-wem@adesso.de',
      password: hashedPassword,
      name: 'BL Lead WEM',
      role: 'bl',
      businessUnitId: wemBU.id,
    })
    .onConflictDoNothing()
    .returning();

  const testUser =
    bdUser || (await db.query.users.findFirst({ where: eq(users.role, 'bd') })) || blUserPHP;
  console.log(`  ✓ Users created\n`);

  // 3. Accounts erstellen
  console.log(`🏢 Creating ${companies.length} Accounts...`);
  const createdAccounts = [];

  for (const company of companies) {
    const [account] = await db
      .insert(accounts)
      .values({
        userId: testUser.id,
        name: company.name,
        industry: company.industry,
        website: company.website,
        notes: `${company.industry} - ${company.name}`,
      })
      .onConflictDoNothing()
      .returning();

    if (account) createdAccounts.push(account);
  }
  console.log(`  ✓ ${createdAccounts.length} Accounts created\n`);

  // 4. RFPs + Quick Scans erstellen (30+)
  console.log('📝 Creating 30+ RFPs with Quick Scans...');
  const createdRFPs: any[] = [];

  let rfpCount = 0;
  for (const account of createdAccounts) {
    // 1-2 RFPs pro Account
    const numRFPs = Math.random() > 0.6 ? 2 : 1;

    for (let i = 0; i < numRFPs; i++) {
      const template = projectTemplates[Math.floor(Math.random() * projectTemplates.length)];
      const tech = techStacks[Math.floor(Math.random() * techStacks.length)];
      const budget = template.budgetRange[Math.floor(Math.random() * template.budgetRange.length)];

      const projectName = `${account.name.replace(' AG', '').replace(' SE', '')} ${template.title}`;

      const source = Math.random() > 0.5 ? 'reactive' : 'proactive';
      const stage = Math.random() > 0.7 ? 'preQualification' : Math.random() > 0.5 ? 'warm' : 'cold';
      const inputType = ['pdf', 'email', 'crm', 'freetext'][Math.floor(Math.random() * 4)];

      const confidence = tech.confidence + Math.floor((Math.random() - 0.5) * 20);
      const decision = confidence > 75 ? 'bid' : confidence < 60 ? 'no_bid' : 'pending';

      const quickScanData = {
        cms: tech.cms,
        framework: tech.framework,
        hosting: tech.hosting,
        techStack: [tech.cms, tech.framework, tech.hosting, 'MySQL', 'Redis'],
        pageCount: Math.floor(Math.random() * 5000) + 100,
        recommendedBusinessUnit: tech.bu,
        confidence,
        reasoning: `${tech.bu} Business Line has expertise in ${tech.cms} and ${tech.framework}. ${confidence > 80 ? 'Strong fit.' : confidence > 70 ? 'Good fit.' : 'Moderate fit.'}`,
        timeline: {
          estimatedDuration: Math.floor(Math.random() * 12) + 6,
          phases: [
            { name: 'Discovery', duration: 2, confidence: 'high' },
            {
              name: 'Development',
              duration: Math.floor(Math.random() * 6) + 3,
              confidence: 'medium',
            },
            { name: 'Launch', duration: 1, confidence: 'high' },
          ],
          risks: ['Integration complexity', 'Timeline constraints'],
        },
      };

      const extractedRequirements = {
        projectName,
        description: template.description,
        budget,
        timeline: `Q${Math.floor(Math.random() * 4) + 1} 2024 - Q${Math.floor(Math.random() * 4) + 1} 2025`,
        technologies: template.technologies,
        requirements: ['Modern design', 'Mobile-first', 'Accessibility', 'Performance'],
      };

      const status =
        decision === 'bid'
          ? 'timeline_estimating'
          : decision === 'no_bid'
            ? 'archived'
            : 'bit_pending';

      // Create RFP
      const [preQualification] = await db
        .insert(preQualifications)
        .values({
          userId: testUser.id,
          source: source as any,
          stage: stage as any,
          inputType: inputType as any,
          rawInput: JSON.stringify(extractedRequirements),
          extractedRequirements: JSON.stringify(extractedRequirements),
          status: status as any,
          decision: decision as any,
          accountId: account.id,
          websiteUrl: account.website,
          assignedBusinessUnitId: tech.bu === 'PHP' ? phpBU.id : wemBU.id,
          quickScanResults: JSON.stringify(quickScanData),
        })
        .returning();

      // Create Quick Scan
      const [quickScan] = await db
        .insert(quickScans)
        .values({
          preQualificationId: preQualification.id,
          websiteUrl: account.website || 'https://example.com',
          status: 'completed',
          cms: tech.cms,
          framework: tech.framework,
          hosting: tech.hosting,
          techStack: JSON.stringify(quickScanData.techStack),
          pageCount: quickScanData.pageCount,
          recommendedBusinessUnit: tech.bu,
          confidence,
          reasoning: quickScanData.reasoning,
          timeline: JSON.stringify(quickScanData.timeline),
          timelineGeneratedAt: new Date(),
          startedAt: new Date(Date.now() - 1000 * 60 * 60), // 1h ago
          completedAt: new Date(Date.now() - 1000 * 60 * 30), // 30min ago
        })
        .returning();

      // Update RFP with Quick Scan ID
      await db
        .update(preQualifications)
        .set({ quickScanId: quickScan.id })
        .where(eq(preQualifications.id, preQualification.id));

      createdRFPs.push({ preQualification, quickScan, decision, bu: tech.bu });
      rfpCount++;

      if (rfpCount % 10 === 0) {
        console.log(`  ✓ ${rfpCount} RFPs created...`);
      }
    }
  }

  console.log(`  ✓ ${createdRFPs.length} RFPs + Quick Scans created\n`);

  // 5. Leads erstellen (aus RFPs mit decision: 'bid')
  console.log('🎯 Creating Leads from BID RFPs...');
  const bidRFPs = createdRFPs.filter(r => r.decision === 'bid');
  const createdLeads: any[] = [];

  for (const { preQualification, quickScan, bu } of bidRFPs) {
    const requirements = JSON.parse(preQualification.extractedRequirements || '{}');

    const blVote = Math.random() > 0.2 ? 'BID' : 'NO-BID'; // 80% BID rate
    const blUser = bu === 'PHP' ? blUserPHP : blUserWEM;

    // Skip if BL user doesn't exist
    if (!blUser) {
      console.warn(`  ⚠️  Skipping lead for ${preQualification.id} - BL user for ${bu} not found`);
      continue;
    }

    const leadStatus = blVote === 'BID' ? 'bid_voted' : 'archived';

    const [lead] = await db
      .insert(qualifications)
      .values({
        preQualificationId: preQualification.id,
        status: leadStatus as any,
        customerName: requirements.projectName || 'Unknown Customer',
        websiteUrl: preQualification.websiteUrl,
        industry: preQualification.extractedRequirements ? JSON.parse(preQualification.extractedRequirements).industry : null,
        projectDescription: requirements.description,
        budget: requirements.budget,
        requirements: JSON.stringify(requirements.requirements),
        quickScanId: quickScan.id,
        businessUnitId: bu === 'PHP' ? phpBU.id : wemBU.id,
        blVote: blVote as any,
        blVotedAt: new Date(),
        blVotedByUserId: blUser.id,
        blReasoning:
          blVote === 'BID'
            ? 'Strong technical fit, good budget, strategic account'
            : 'Timeline too tight, resource conflicts',
        blConfidenceScore: Math.floor(Math.random() * 30) + 70,
        routedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2), // 2 days ago
      })
      .returning();

    createdLeads.push(lead);
  }

  console.log(`  ✓ ${createdLeads.length} Leads created\n`);

  // 6. RAG Embeddings generieren (optional - benötigt OPENAI_API_KEY)
  const hasApiKey = !!process.env.OPENAI_API_KEY;

  if (hasApiKey) {
    console.log('🧠 Generating RAG Embeddings for Agent Outputs...');
    let embeddingCount = 0;

    for (const { preQualification, quickScan } of createdRFPs) {
      try {
        // Embed Quick Scan Results
        await embedAgentOutput(preQualification.id, 'quick_scan', {
          cms: quickScan.cms,
          framework: quickScan.framework,
          hosting: quickScan.hosting,
          techStack: JSON.parse(quickScan.techStack || '[]'),
          pageCount: quickScan.pageCount,
          recommendedBusinessUnit: quickScan.recommendedBusinessUnit,
          confidence: quickScan.confidence,
          reasoning: quickScan.reasoning,
          timeline: JSON.parse(quickScan.timeline || '{}'),
        });

        // Embed RFP Requirements
        await embedAgentOutput(preQualification.id, 'extraction', JSON.parse(preQualification.extractedRequirements || '{}'));

        embeddingCount++;

        if (embeddingCount % 10 === 0) {
          console.log(`  ✓ ${embeddingCount} RFPs embedded...`);
        }
      } catch (error) {
        console.error(`  ⚠️  Failed to embed RFP ${preQualification.id}:`, error);
      }
    }

    console.log(`  ✓ ${embeddingCount} RFPs embedded in RAG\n`);
  } else {
    console.log('⚠️  Skipping RAG Embeddings (OPENAI_API_KEY not set)');
    console.log('   Set OPENAI_API_KEY in .env to enable RAG embeddings\n');
  }

  // Summary
  console.log('✨ Massive Data Seed completed!\n');
  console.log('📊 Summary:');
  console.log(`  - ${createdAccounts.length} Accounts`);
  console.log(`  - ${createdRFPs.length} RFPs with Quick Scans`);
  console.log(`  - ${createdLeads.length} Leads (from BID RFPs)`);
  if (hasApiKey) {
    console.log(`  - RAG Embeddings created ✓`);
  } else {
    console.log(`  - RAG Embeddings skipped (set OPENAI_API_KEY to enable)`);
  }
  console.log('\n🔐 Login Credentials:');
  console.log('  BD User: bd@adesso.de / test123');
  console.log('  BL PHP: bl-php@adesso.de / test123');
  console.log('  BL WEM: bl-wem@adesso.de / test123');
  console.log('\n📍 URLs:');
  console.log('  Pre-Qualifications: http://localhost:3000/pre-qualifications');
  console.log('  Leads: http://localhost:3000/leads');
}

seedMassiveData()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  });
