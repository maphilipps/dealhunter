/**
 * @deprecated These tool registrations are deprecated aliases.
 * Use the canonical tools from './qualification-scan-crud.ts' instead:
 * - qualificationScan.create
 * - qualificationScan.list
 * - qualificationScan.get
 * - qualificationScan.get_by_pre_qualification
 * - qualificationScan.update
 * - qualificationScan.append_activity
 * - qualificationScan.delete
 *
 * These aliases are kept for backward compatibility with agents
 * that may still reference the old scan.quickscan.* or leadScan.* names.
 */

import { registry } from '../registry';

// ============================================================================
// Deprecated aliases: scan.quickscan.* → qualificationScan.*
// Also: leadScan.* → qualificationScan.*
// These delegate to the canonical tools registered in qualification-scan-crud.ts
// ============================================================================

// Register aliases synchronously. qualification-scan-crud.ts is imported before this module in index.ts,
// so the canonical tools are already registered when this module executes.
const DEPRECATED_ALIASES: Array<[string, string]> = [
  ['scan.quickscan.create', 'qualificationScan.create'],
  ['scan.quickscan.list', 'qualificationScan.list'],
  ['scan.quickscan.get', 'qualificationScan.get'],
  ['scan.quickscan.getByPreQualification', 'qualificationScan.get_by_pre_qualification'],
  ['scan.quickscan.update', 'qualificationScan.update'],
  ['scan.quickscan.appendActivity', 'qualificationScan.append_activity'],
  ['scan.quickscan.delete', 'qualificationScan.delete'],
  ['leadScan.create', 'qualificationScan.create'],
  ['leadScan.list', 'qualificationScan.list'],
  ['leadScan.get', 'qualificationScan.get'],
  ['leadScan.get_by_pre_qualification', 'qualificationScan.get_by_pre_qualification'],
  ['leadScan.update', 'qualificationScan.update'],
  ['leadScan.append_activity', 'qualificationScan.append_activity'],
  ['leadScan.delete', 'qualificationScan.delete'],
];

for (const [oldName, newName] of DEPRECATED_ALIASES) {
  const canonicalTool = registry.get(newName);
  if (!canonicalTool) {
    throw new Error(
      `Cannot create alias "${oldName}": canonical tool "${newName}" not found. Check import order in index.ts`
    );
  }
  registry.alias(oldName, newName);
}
