import { db } from '../lib/db';
import { users } from '../lib/db/schema';
import bcrypt from 'bcryptjs';

async function seedTestUsers() {
  console.log('Seeding test users...');

  const testUsers = [
    {
      email: 'bd@test.com',
      name: 'BD Manager Test',
      role: 'bd' as const,
      password: 'Test1234'
    },
    {
      email: 'bl@test.com',
      name: 'Bereichsleiter Test',
      role: 'bl' as const,
      password: 'Test1234'
    },
    {
      email: 'admin@test.com',
      name: 'Admin Test',
      role: 'admin' as const,
      password: 'Test1234'
    }
  ];

  for (const user of testUsers) {
    const hashedPassword = await bcrypt.hash(user.password, 10);

    await db.insert(users).values({
      email: user.email,
      name: user.name,
      role: user.role,
      password: hashedPassword
    }).onConflictDoNothing();

    console.log(`✓ Created ${user.role}: ${user.email}`);
  }

  console.log('\nTest users created successfully!');
  console.log('Login credentials:');
  console.log('- BD Manager: bd@test.com / Test1234');
  console.log('- BL: bl@test.com / Test1234');
  console.log('- Admin: admin@test.com / Test1234');
}

seedTestUsers()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error seeding users:', error);
    process.exit(1);
  });
