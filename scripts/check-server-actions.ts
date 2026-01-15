/**
 * Server Action Protection Checker
 *
 * Automated test to verify that all Server Actions have proper
 * authorization checks. This prevents CVE-2025-29927 (middleware bypass).
 *
 * Usage:
 *   bun run scripts/check-server-actions.ts
 *
 * Exit codes:
 *   0 - All server actions have role checks
 *   1 - Unprotected server actions found
 *   2 - File system error
 *
 * @see /plans/feat-auth-004-role-based-access-control.md
 */

import { readdirSync, readFileSync, existsSync } from 'fs'
import { join } from 'path'

interface ActionResult {
  filePath: string
  actionName: string
  hasProtection: boolean
  hasMutations: boolean
  reason?: string
}

function findServerActions(): ActionResult[] {
  const actionsDir = join(process.cwd(), 'src/app/actions')

  if (!existsSync(actionsDir)) {
    console.log('ℹ️  No /src/app/actions directory found (no server actions to check)')
    return []
  }

  const results: ActionResult[] = []

  function walkDirectory(dir: string, baseDir: string) {
    const files = readdirSync(dir, { withFileTypes: true })

    for (const file of files) {
      const fullPath = join(dir, file.name)
      const relativePath = fullPath.replace(baseDir, '')

      if (file.isDirectory()) {
        walkDirectory(fullPath, baseDir)
      } else if (file.isFile() && file.name.endsWith('.ts')) {
        checkFile(fullPath, relativePath, results)
      }
    }
  }

  walkDirectory(actionsDir, actionsDir)

  return results
}

function checkFile(filePath: string, relativePath: string, results: ActionResult[]) {
  const content = readFileSync(filePath, 'utf-8')

  // Check if it's a server action file
  if (!content.includes("'use server'")) {
    return
  }

  // Find all exported async functions (potential server actions)
  const functionMatches = content.matchAll(
    /export\s+async\s+function\s+(\w+)/g
  )

  for (const match of functionMatches) {
    const actionName = match[1]

    // Skip certain functions that don't need protection
    if (actionName.startsWith('_') || actionName === 'revalidatePath') {
      continue
    }

    // Check if this function performs mutations
    const functionContent = extractFunctionContent(content, actionName)
    const hasMutations =
      functionContent.includes('.insert(') ||
      functionContent.includes('.update(') ||
      functionContent.includes('.delete(') ||
      functionContent.includes('.execute(')

    // Check if it has role protection
    const hasRoleCheck =
      functionContent.includes('withRole') ||
      functionContent.includes('requireRole') ||
      functionContent.includes('requireAuth') ||
      functionContent.includes('withAnyRole') ||
      functionContent.includes('withAuth') ||
      functionContent.includes('withOwnership')

    const result: ActionResult = {
      filePath: relativePath,
      actionName,
      hasProtection: hasRoleCheck,
      hasMutations,
    }

    if (hasMutations && !hasRoleCheck) {
      result.reason = 'Has mutations but no role check'
      results.push(result)
    }
  }
}

function extractFunctionContent(fullContent: string, functionName: string): string {
  // Find the function definition
  const functionRegex = new RegExp(
    `export\\s+async\\s+function\\s+${functionName}\\s*\\([^)]*\\)[^{]*\\{`,
    'g'
  )
  const match = functionRegex.exec(fullContent)

  if (!match) {
    return ''
  }

  const startIndex = match.index + match[0].length
  let braceCount = 1
  let endIndex = startIndex

  // Find matching closing brace
  for (let i = startIndex; i < fullContent.length; i++) {
    if (fullContent[i] === '{') {
      braceCount++
    } else if (fullContent[i] === '}') {
      braceCount--
      if (braceCount === 0) {
        endIndex = i
        break
      }
    }
  }

  return fullContent.substring(startIndex, endIndex)
}

function checkServerActions() {
  console.log('🔍 Checking server actions for authorization...\n')

  const results = findServerActions()

  if (results.length === 0) {
    console.log('✅ All server actions have role checks!\n')
    console.log('   CVE-2025-29927: Protected against middleware bypass')
    return 0
  }

  console.error('❌ UNPROTECTED SERVER ACTIONS FOUND:\n')
  console.error('The following server actions perform mutations without role checks:\n')

  results.forEach((result, index) => {
    console.error(`  ${index + 1}. ${result.filePath} → ${result.actionName}()`)
    console.error(`     ${result.reason}\n`)
  })

  console.error('⚠️  SECURITY RISK:')
  console.error('   These actions can be invoked directly from browser console,')
  console.error('   bypassing middleware protection (CVE-2025-29927).\n')

  console.error('   FIX: Wrap action logic with withRole(), requireRole(), or withAuth():')
  console.error('   ')
  console.error('   import { withRole, UserRole } from \'@/lib/auth/server-action-wrapper\'')
  console.error('   ')
  console.error('   export async function ${results[0].actionName}(...) {')
  console.error('     return withRole(UserRole.ADMIN, async (userId, userRole) => {')
  console.error('       // Your action logic here')
  console.error('     })')
  console.error('   }\n')

  return 1
}

// Run the check
try {
  const exitCode = checkServerActions()
  process.exit(exitCode)
} catch (error) {
  console.error('\n❌ ERROR:')
  console.error('   Failed to check server actions')
  console.error('   Error:', error)
  process.exit(2)
}
