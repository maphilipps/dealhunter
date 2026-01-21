/* eslint-disable no-console */
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';

import { db } from '../lib/db';
import { users } from '../lib/db/schema';

async function createE2EUser() {
  console.log('🔧 Creating E2E test user...');

  const testEmail = 'e2e@test.com';
  const testPassword = 'test1234';

  // Delete existing user if exists
  const existing = await db.select().from(users).where(eq(users.email, testEmail));
  if (existing.length > 0) {
    await db.delete(users).where(eq(users.email, testEmail));
    console.log('✓ Deleted existing e2e user');
  }

  // Create password hash
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(testPassword, salt);

  console.log('Hash:', hashedPassword);

  // Insert user
  const result = await db
    .insert(users)
    .values({
      name: 'E2E Test User',
      email: testEmail,
      password: hashedPassword,
      role: 'admin',
    })
    .returning();

  console.log('✓ Created E2E user:');
  console.log('  ID:', result[0].id);
  console.log('  Email:', testEmail);
  console.log('  Password:', testPassword);
  console.log('  Role: admin');

  // Verify we can retrieve the user
  const verify = await db.select().from(users).where(eq(users.email, testEmail));
  console.log(
    '\n✓ Verification:',
    verify.length > 0 ? 'User exists in DB' : 'ERROR: User not found!'
  );
}

createE2EUser()
  .then(() => {
    console.log('\n✅ E2E user ready');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
