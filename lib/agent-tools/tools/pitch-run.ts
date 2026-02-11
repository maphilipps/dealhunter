/**
 * @deprecated These tool registrations are deprecated aliases.
 * Use the canonical tools from './pitch-scan-run.ts' instead:
 * - pitchScanRun.create
 * - pitchScanRun.list
 * - pitchScanRun.get
 * - pitchScanRun.update
 * - pitchScanRun.cancel
 * - pitchScanRun.get_latest
 * - pitchScanResult.list
 * - pitchScanResult.get
 * - pitchDocument.list
 * - pitchDocument.get
 *
 * These aliases are kept for backward compatibility with agents
 * that may still reference the old pitchRun.* / pitchAuditResult.* names.
 */

import { registry } from '../registry';

// ============================================================================
// Deprecated aliases: pitchRun.* → pitchScanRun.*
// These delegate to the canonical tools registered in pitch-scan-run.ts
// ============================================================================

const DEPRECATED_ALIASES: Array<[string, string]> = [
  ['pitchRun.create', 'pitchScanRun.create'],
  ['pitchRun.list', 'pitchScanRun.list'],
  ['pitchRun.get', 'pitchScanRun.get'],
  ['pitchRun.update', 'pitchScanRun.update'],
  ['pitchRun.cancel', 'pitchScanRun.cancel'],
  ['pitchRun.getLatest', 'pitchScanRun.get_latest'],
  ['pitchAuditResult.list', 'pitchScanResult.list'],
  ['pitchAuditResult.get', 'pitchScanResult.get'],
  // pitchDocument.list and pitchDocument.get keep their names
  // (already registered in pitch-scan-run.ts with the same names)
];

for (const [oldName, newName] of DEPRECATED_ALIASES) {
  const canonicalTool = registry.get(newName);
  if (!canonicalTool) {
    console.warn(
      `[agent-tools] Skipping alias "${oldName}": canonical tool "${newName}" not found. Check import order in index.ts`
    );
    continue;
  }
  registry.alias(oldName, newName);
}
