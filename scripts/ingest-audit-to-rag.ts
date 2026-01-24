#!/usr/bin/env npx tsx
/**
 * Ingest Audit Data to RAG
 *
 * CLI script to ingest audit data from an audit directory into the RAG system.
 *
 * Usage:
 *   npx tsx scripts/ingest-audit-to-rag.ts --audit-path audits/audit_lucarnofestival.ch --lead-id <id>
 *
 * Options:
 *   --audit-path, -p  Path to the audit directory (required)
 *   --lead-id, -l     Lead ID to associate data with (required, or use --auto-match)
 *   --auto-match      Try to find a matching lead by project name
 *   --dry-run, -d     Show what would be done without making changes
 *   --help, -h        Show help
 */

// Load environment variables
import 'dotenv/config';

import { existsSync } from 'fs';
import { resolve } from 'path';
import { parseArgs } from 'util';

import { parseAuditDirectory, getAuditStats } from '@/lib/audit/audit-file-parser';
import {
  ingestAuditToRAG,
  findLeadByName,
  getAllLeads,
  type IngestionProgress,
} from '@/lib/audit/audit-rag-ingestion';

// Parse command line arguments
const { values } = parseArgs({
  options: {
    'audit-path': { type: 'string', short: 'p' },
    'lead-id': { type: 'string', short: 'l' },
    'auto-match': { type: 'boolean', default: false },
    'dry-run': { type: 'boolean', short: 'd', default: false },
    help: { type: 'boolean', short: 'h', default: false },
  },
});

function printHelp() {
  console.log(`
Ingest Audit Data to RAG

Usage:
  npx tsx scripts/ingest-audit-to-rag.ts --audit-path <path> --lead-id <id>
  npx tsx scripts/ingest-audit-to-rag.ts --audit-path <path> --auto-match

Options:
  --audit-path, -p  Path to the audit directory (required)
                    Example: audits/audit_lucarnofestival.ch
  --lead-id, -l     Lead ID to associate data with
  --auto-match      Try to find a matching lead by project name
  --dry-run, -d     Show what would be done without making changes
  --help, -h        Show this help message

Examples:
  npx tsx scripts/ingest-audit-to-rag.ts -p audits/audit_lucarnofestival.ch -l abc123
  npx tsx scripts/ingest-audit-to-rag.ts -p audits/audit_lucarnofestival.ch --auto-match
  npx tsx scripts/ingest-audit-to-rag.ts -p audits/audit_lucarnofestival.ch --dry-run
`);
}

function printProgress(progress: IngestionProgress) {
  const percentage = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;
  const bar = '█'.repeat(Math.floor(percentage / 5)) + '░'.repeat(20 - Math.floor(percentage / 5));

  process.stdout.write(`\r[${bar}] ${percentage}% - ${progress.message}`);

  if (progress.phase === 'done') {
    console.log('\n');
  }
}

async function main() {
  // Show help if requested
  if (values.help) {
    printHelp();
    process.exit(0);
  }

  // Validate audit path
  const auditPath = values['audit-path'];
  if (!auditPath) {
    console.error('❌ Error: --audit-path is required');
    printHelp();
    process.exit(1);
  }

  // Resolve and validate path
  const resolvedPath = resolve(process.cwd(), auditPath);
  const auditDataPath = resolve(resolvedPath, 'audit_data');

  if (!existsSync(resolvedPath)) {
    console.error(`❌ Error: Audit directory not found: ${resolvedPath}`);
    process.exit(1);
  }

  if (!existsSync(auditDataPath)) {
    console.error(`❌ Error: audit_data subdirectory not found: ${auditDataPath}`);
    process.exit(1);
  }

  console.log('🚀 Audit RAG Ingestion');
  console.log('═'.repeat(50));
  console.log(`📁 Audit Path: ${resolvedPath}`);

  // Parse audit to get project name
  const audit = await parseAuditDirectory(resolvedPath);
  console.log(`📋 Project: ${audit.projectName}`);

  // Determine lead ID
  let leadId = values['lead-id'];

  if (!leadId && values['auto-match']) {
    console.log(`🔍 Auto-matching lead by project name...`);
    leadId = (await findLeadByName(audit.projectName)) ?? undefined;

    if (!leadId) {
      console.error(`❌ Error: No matching lead found for "${audit.projectName}"`);
      console.log('\n📋 Available leads:');
      const allLeads = await getAllLeads();
      for (const lead of allLeads) {
        console.log(`   ${lead.id} - ${lead.customerName}`);
      }
      process.exit(1);
    }
    console.log(`✅ Found matching lead: ${leadId}`);
  }

  if (!leadId) {
    console.error('❌ Error: --lead-id is required (or use --auto-match)');
    console.log('\n📋 Available leads:');
    const allLeads = await getAllLeads();
    for (const lead of allLeads) {
      console.log(`   ${lead.id} - ${lead.customerName}`);
    }
    process.exit(1);
  }

  console.log(`🔗 Lead ID: ${leadId}`);
  console.log(`📊 Dry Run: ${values['dry-run'] ? 'Yes' : 'No'}`);
  console.log('');

  // Dry run - just show what would be done
  if (values['dry-run']) {
    console.log('📋 Analyzing audit data (dry run)...\n');

    const auditStats = getAuditStats(audit);

    console.log('📂 Audit Directory');
    console.log('─'.repeat(40));
    console.log(`   Project Name: ${audit.projectName}`);
    console.log(`   Total Files: ${auditStats.totalFiles}`);
    console.log(`   JSON Files: ${auditStats.jsonFiles}`);
    console.log(`   Markdown Files: ${auditStats.markdownFiles}`);
    console.log(`   Text Files: ${auditStats.textFiles}`);
    console.log(`   Total Size: ${(auditStats.totalSize / 1024).toFixed(1)} KB`);
    console.log(`   Categories: ${auditStats.categories.join(', ')}`);
    console.log('');

    console.log('📁 Files to Process (as raw chunks)');
    console.log('─'.repeat(40));
    for (const file of audit.files) {
      const sizeKB = (file.metadata.fileSize / 1024).toFixed(1);
      console.log(
        `   [${file.sourceType.toUpperCase().padEnd(4)}] ${file.filename} (${sizeKB} KB)`
      );
    }
    console.log('');

    console.log('✅ Dry run complete. Use without --dry-run to execute.');
    process.exit(0);
  }

  // Execute ingestion
  console.log('🔄 Starting ingestion...\n');

  const result = await ingestAuditToRAG(resolvedPath, leadId, printProgress);

  if (result.success) {
    console.log('✅ Ingestion Complete!');
    console.log('═'.repeat(50));
    console.log(`   Qualification ID: ${result.qualificationId}`);
    console.log(`   Project: ${result.projectName}`);
    console.log(`   Files Processed: ${result.stats.filesProcessed}`);
    console.log(`   Chunks Created: ${result.stats.chunksCreated}`);
    console.log(`   Total Tokens: ${result.stats.totalTokens.toLocaleString()}`);
    console.log(`   Embeddings Generated: ${result.stats.embeddingsGenerated}`);
    console.log('');
    console.log('🎉 Audit data is now available for RAG queries!');
    console.log(
      `📍 View at: http://localhost:3000/qualifications/${result.qualificationId}/rag-data`
    );
  } else {
    console.error('\n❌ Ingestion Failed!');
    console.error(`   Error: ${result.error}`);
    process.exit(1);
  }
}

main().catch(error => {
  console.error('❌ Unhandled error:', error);
  process.exit(1);
});
