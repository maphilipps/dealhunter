import { db } from '../lib/db';
import { businessUnits } from '../lib/db/schema';

async function seedBusinessLines() {
  console.log('🌱 Seeding business lines...');

  const bls = [
    {
      name: 'Banking & Insurance',
      leaderName: 'Thomas Müller',
      leaderEmail: 'thomas.mueller@adesso.de',
      keywords: JSON.stringify([
        'banking',
        'finance',
        'insurance',
        'fintech',
        'payments',
        'compliance',
        'regulatory',
        'risk management',
      ]),
    },
    {
      name: 'Automotive',
      leaderName: 'Stefan Schmidt',
      leaderEmail: 'stefan.schmidt@adesso.de',
      keywords: JSON.stringify([
        'automotive',
        'mobility',
        'connected car',
        'telematics',
        'fleet management',
        'electric vehicle',
        'autonomous driving',
      ]),
    },
    {
      name: 'Energy & Utilities',
      leaderName: 'Michael Weber',
      leaderEmail: 'michael.weber@adesso.de',
      keywords: JSON.stringify([
        'energy',
        'utilities',
        'smart grid',
        'renewable energy',
        'metering',
        'billing',
        'power generation',
      ]),
    },
    {
      name: 'Retail & E-Commerce',
      leaderName: 'Julia Fischer',
      leaderEmail: 'julia.fischer@adesso.de',
      keywords: JSON.stringify([
        'retail',
        'e-commerce',
        'online shop',
        'marketplace',
        'pos',
        'inventory',
        'customer experience',
      ]),
    },
    {
      name: 'Healthcare',
      leaderName: 'Dr. Anna Becker',
      leaderEmail: 'anna.becker@adesso.de',
      keywords: JSON.stringify([
        'healthcare',
        'medical',
        'hospital',
        'patient',
        'health data',
        'telemedicine',
        'clinical',
      ]),
    },
    {
      name: 'Public Sector',
      leaderName: 'Frank Hoffmann',
      leaderEmail: 'frank.hoffmann@adesso.de',
      keywords: JSON.stringify([
        'government',
        'public sector',
        'administration',
        'citizen services',
        'e-government',
        'municipality',
      ]),
    },
    {
      name: 'Manufacturing',
      leaderName: 'Klaus Richter',
      leaderEmail: 'klaus.richter@adesso.de',
      keywords: JSON.stringify([
        'manufacturing',
        'industry 4.0',
        'production',
        'supply chain',
        'logistics',
        'iot',
        'factory',
      ]),
    },
    {
      name: 'Technology & Innovation',
      leaderName: 'Sarah Klein',
      leaderEmail: 'sarah.klein@adesso.de',
      keywords: JSON.stringify([
        'technology',
        'innovation',
        'ai',
        'machine learning',
        'cloud',
        'platform',
        'saas',
      ]),
    },
  ];

  for (const bl of bls) {
    await db.insert(businessUnits).values(bl).onConflictDoNothing();
  }

  console.log('✅ Business lines seeded successfully!');
}

seedBusinessLines()
  .catch(error => {
    console.error('❌ Error seeding business lines:', error);
    process.exit(1);
  })
  .finally(() => {
    process.exit(0);
  });
