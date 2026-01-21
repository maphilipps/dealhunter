import { db } from '../lib/db';
import { users } from '../lib/db/schema';
import { hash } from 'bcryptjs';
import { eq } from 'drizzle-orm';

async function resetTestUser() {
  console.log('🔄 Resetting test user...');

  const testEmail = 'test@adesso.de';
  const testPassword = 'password123';

  // Hash password
  const hashedPassword = await hash(testPassword, 10);

  // Delete existing user
  await db.delete(users).where(eq(users.email, testEmail));

  // Create test user
  await db.insert(users).values({
    name: 'Test User',
    email: testEmail,
    password: hashedPassword,
    role: 'bd',
  });

  console.log('✓ Test user reset successfully!');
  console.log('  Email:', testEmail);
  console.log('  Password:', testPassword);
  console.log('  Role: bd');
}

resetTestUser()
  .then(() => {
    console.log('✅ Reset complete');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Error resetting test user:', error);
    process.exit(1);
  });
