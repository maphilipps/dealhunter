/**
 * Pre-Migration Role Validation Script
 *
 * Validates that all role values in the database are valid before
 * running the enum migration. This prevents migration failures
 * due to invalid role values.
 *
 * Usage:
 *   bun run scripts/validate-role-data.ts
 *
 * Exit codes:
 *   0 - All roles are valid
 *   1 - Invalid role values found
 *   2 - Database error
 *
 * @see /drizzle/0002_add_rbac_enums.sql
 */

import { db } from '../src/db'
import { users } from '../src/db/schema'

const VALID_ROLES = ['admin', 'bereichsleiter', 'bd_manager']

async function validateRoleData() {
  console.log('🔍 Validating role data before enum migration...\n')

  try {
    // Fetch all users from database
    const allUsers = await db.select().from(users)

    console.log(`📊 Found ${allUsers.length} users in database\n`)

    // Find users with invalid roles
    const invalidUsers = allUsers.filter(
      (user) => !VALID_ROLES.includes(user.role)
    )

    if (invalidUsers.length > 0) {
      console.error('❌ INVALID ROLE VALUES FOUND:\n')
      console.error('The following users have invalid role values:\n')

      invalidUsers.forEach((user, index) => {
        console.error(`  ${index + 1}. User ID: ${user.id}`)
        console.error(`     Email: ${user.email}`)
        console.error(`     Invalid Role: "${user.role}"`)
        console.error(`     Created: ${user.createdAt}\n`)
      })

      console.error('⚠️  MIGRATION BLOCKED:')
      console.error('   Please fix invalid role values before running migration.')
      console.error('   Valid roles are:', VALID_ROLES.join(', '))
      console.error('\n   SQL to fix manually:')
      console.error('   UPDATE users SET role = \'bd_manager\' WHERE role NOT IN (\'admin\', \'bereichsleiter\', \'bd_manager\');\n')

      process.exit(1)
    }

    // Show role distribution
    const roleDistribution = allUsers.reduce((acc, user) => {
      acc[user.role] = (acc[user.role] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    console.log('✅ All role values are valid!\n')
    console.log('📈 Role Distribution:')
    VALID_ROLES.forEach((role) => {
      const count = roleDistribution[role] || 0
      const percentage = ((count / allUsers.length) * 100).toFixed(1)
      console.log(`   ${role.padEnd(20)} ${count.toString().padStart(5)} users (${percentage}%)`)
    })

    console.log('\n✅ Validation passed! Safe to run migration.')
    console.log('   Next step: bun run db:push')
    console.log('   Migration file: /drizzle/0002_add_rbac_enums.sql\n')

    process.exit(0)
  } catch (error) {
    console.error('\n❌ DATABASE ERROR:')
    console.error('   Failed to validate role data')
    console.error('   Error:', error)
    console.error('\n   Troubleshooting:')
    console.error('   1. Check database connection string in .env')
    console.error('   2. Verify database is running')
    console.error('   3. Check database credentials\n')

    process.exit(2)
  }
}

// Run validation
validateRoleData()
