import { db } from './index';
import { users } from './schema';
import bcrypt from 'bcryptjs';

async function seed() {
  console.log('Seeding database...');

  // Check if user already exists
  const existingUser = await db.query.users.findFirst({
    where: (users, { eq }) => eq(users.email, 'test@adesso.de'),
  });

  if (existingUser) {
    console.log('Test user already exists');
    process.exit(0);
  }

  // Create test user
  const hashedPassword = await bcrypt.hash('password123', 10);
  await db.insert(users).values({
    email: 'test@adesso.de',
    password: hashedPassword,
    name: 'Test User',
  });

  console.log('Test user created: test@adesso.de / password123');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed!', err);
  process.exit(1);
});
