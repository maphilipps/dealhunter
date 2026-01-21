import { db } from '../lib/db';
import { users } from '../lib/db/schema';
import { hash } from 'bcryptjs';

async function seedTestUser() {
  console.log('🌱 Seeding test user...');

  const testEmail = 'test@adesso.de';
  const testPassword = 'password123';

  // Hash password
  const hashedPassword = await hash(testPassword, 10);

  // Check if user already exists
  const existingUser = await db
    .select()
    .from(users)
    .where(users => users.email === testEmail)
    .get();

  if (existingUser) {
    console.log('✓ Test user already exists:', testEmail);
    return;
  }

  // Create test user
  await db.insert(users).values({
    name: 'Test User',
    email: testEmail,
    password: hashedPassword,
    role: 'bd',
  });

  console.log('✓ Test user created successfully!');
  console.log('  Email:', testEmail);
  console.log('  Password:', testPassword);
  console.log('  Role: bd');
}

seedTestUser()
  .then(() => {
    console.log('✅ Seeding complete');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Error seeding test user:', error);
    process.exit(1);
  });
