import { db } from './index';
import { users, businessUnits, technologies } from './schema';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';

async function seed() {
  console.log('Starting database seed...');

  // Check if admin user exists
  const existingAdmin = await db.query.users.findFirst({
    where: eq(users.role, 'admin'),
  });

  if (!existingAdmin) {
    const hashedPassword = await bcrypt.hash('admin123', 10);
    await db.insert(users).values({
      email: 'admin@adesso.de',
      password: hashedPassword,
      name: 'System Administrator',
      role: 'admin',
    });
    console.log('Admin user created: admin@adesso.de (password: admin123)');
  } else {
    console.log('Admin user already exists, skipping...');
  }

  // Seed Business Lines from EPICS.md specification
  const existingBL = await db.query.businessUnits.findFirst();

  if (!existingBL) {
    const phpBL = await db
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
        ]),
      })
      .returning();

    const wemBL = await db
      .insert(businessUnits)
      .values({
        name: 'WEM',
        leaderName: 'Michael Rittinghaus',
        leaderEmail: 'michael.rittinghaus@adesso.de',
        keywords: JSON.stringify(['magnolia', 'firstspirit', 'wem', 'java', 'enterprise']),
      })
      .returning();

    console.log('Business Lines created: PHP, WEM');

    // Seed Technologies for PHP Business Line
    if (phpBL[0]) {
      await db.insert(technologies).values([
        {
          name: 'Drupal',
          businessUnitId: phpBL[0].id,
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
        },
        {
          name: 'Ibexa',
          businessUnitId: phpBL[0].id,
          baselineHours: 500,
          baselineName: 'Ibexa Standard',
          baselineEntityCounts: JSON.stringify({
            contentTypes: 12,
            blocks: 8,
          }),
          isDefault: false,
        },
        {
          name: 'Sulu',
          businessUnitId: phpBL[0].id,
          baselineHours: 400,
          baselineName: 'Sulu Standard',
          baselineEntityCounts: JSON.stringify({
            contentTypes: 10,
            snippets: 5,
          }),
          isDefault: false,
        },
      ]);
      console.log('Technologies created for PHP: Drupal, Ibexa, Sulu');
    }

    // Seed Technologies for WEM Business Line
    if (wemBL[0]) {
      await db.insert(technologies).values([
        {
          name: 'Magnolia',
          businessUnitId: wemBL[0].id,
          baselineHours: 600,
          baselineName: 'Magnolia Enterprise',
          baselineEntityCounts: JSON.stringify({
            contentTypes: 14,
            templates: 18,
            apps: 6,
          }),
          isDefault: true,
        },
        {
          name: 'FirstSpirit',
          businessUnitId: wemBL[0].id,
          baselineHours: 700,
          baselineName: 'FirstSpirit Standard',
          baselineEntityCounts: JSON.stringify({
            contentTypes: 16,
            templates: 20,
            modules: 8,
          }),
          isDefault: false,
        },
      ]);
      console.log('Technologies created for WEM: Magnolia, FirstSpirit');
    }
  } else {
    console.log('Business Lines already exist, skipping...');
  }

  console.log('Database seed completed!');
}

seed()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Seed failed:', error);
    process.exit(1);
  });
