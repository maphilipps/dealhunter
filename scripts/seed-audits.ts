/**
 * Seed Pre-Qualifications and Qualifications from Audit Folders
 *
 * This script:
 * 1. Clears existing qualifications and pre-qualifications
 * 2. Creates pre-qualifications from audit folders
 * 3. Routes all to PHP business line
 * 4. Imports all MD and JSON files as RAG embeddings
 *
 * Run with: npx dotenv-cli -e .env -- npx tsx scripts/seed-audits.ts
 */

import { db } from '../lib/db';
import {
  preQualifications,
  qualifications,
  dealEmbeddings,
  businessUnits,
  users,
  backgroundJobs,
  baselineComparisons,
  cmsMatchResults,
  competitorMatches,
  deepMigrationAnalyses,
  documents,
  pitchdecks,
  ptEstimations,
  qualificationSectionData,
  quickScans,
  rawChunks,
  referenceMatches,
  subjectiveAssessments,
  teamAssignments,
  websiteAudits,
} from '../lib/db/schema';
import { generateQueryEmbedding } from '../lib/ai/embedding-config';
import { eq } from 'drizzle-orm';
import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { join, extname, basename, relative } from 'path';

// Audit folder configurations
interface AuditConfig {
  folderName: string;
  customerName: string;
  websiteUrl: string;
  industry: string;
  projectDescription: string;
}

const AUDIT_CONFIGS: AuditConfig[] = [
  {
    folderName: 'audit_lucarnofestival.ch',
    customerName: 'Locarno Film Festival',
    websiteUrl: 'https://www.locarnofestival.ch',
    industry: 'Entertainment & Media',
    projectDescription: 'Drupal 11 Relaunch für das internationale Filmfestival Locarno',
  },
  {
    folderName: 'audit_vfl-bochum.de',
    customerName: 'VfL Bochum 1848',
    websiteUrl: 'https://www.vfl-bochum.de',
    industry: 'Sports & Entertainment',
    projectDescription: 'Website Relaunch für den Bundesliga-Verein VfL Bochum',
  },
  {
    folderName: 'shop_sedus-audit',
    customerName: 'Sedus Stoll AG',
    websiteUrl: 'https://www.sedus.com',
    industry: 'Manufacturing & Retail',
    projectDescription: 'Migration von Shopware 6 zu Ibexa Commerce für Büromöbelhersteller',
  },
  {
    folderName: 'vhs-frankfurt',
    customerName: 'Volkshochschule Frankfurt',
    websiteUrl: 'https://www.vhs.frankfurt.de',
    industry: 'Education & Public Sector',
    projectDescription: 'CMS-Relaunch für die Volkshochschule Frankfurt am Main',
  },
];

// Chunk type mapping based on filename patterns
function getChunkType(filename: string): string {
  const name = filename.toLowerCase();

  if (name.includes('cost') || name.includes('estimation') || name.includes('kalkulation'))
    return 'cost_estimation';
  if (name.includes('cms_comparison') || name.includes('cms-vergleich')) return 'cms_comparison';
  if (name.includes('migration')) return 'migration_strategy';
  if (name.includes('architecture') || name.includes('architektur')) return 'architecture';
  if (name.includes('accessibility') || name.includes('barrierefreiheit')) return 'accessibility';
  if (name.includes('entities') || name.includes('content_type')) return 'content_types';
  if (name.includes('audit_report') || name.includes('audit_summary')) return 'audit_report';
  if (name.includes('gap') || name.includes('analyse')) return 'gap_analysis';
  if (name.includes('referenz') || name.includes('reference')) return 'references';
  if (name.includes('challenge') || name.includes('position')) return 'positioning';
  if (name.includes('azure') || name.includes('hosting') || name.includes('infrastructure'))
    return 'infrastructure';

  return 'audit_data';
}

// Get chunk category based on content/type
function getChunkCategory(
  chunkType: string
): 'fact' | 'elaboration' | 'recommendation' | 'risk' | 'estimate' {
  if (chunkType.includes('cost') || chunkType.includes('estimation')) return 'estimate';
  if (chunkType.includes('risk') || chunkType.includes('gap')) return 'risk';
  if (chunkType.includes('recommendation') || chunkType.includes('migration'))
    return 'recommendation';
  if (chunkType.includes('analysis') || chunkType.includes('comparison')) return 'elaboration';
  return 'fact';
}

// Directories to skip entirely
const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  '.venv',
  '.claude',
  '.playwright-mcp',
  '__pycache__',
  'dist',
  'build',
  '.next',
  'screenshots', // Usually binary data
  'adesso-extracted', // Likely presentation extracts
]);

// Recursively find all MD and JSON files (only in audit_data and root)
function findFiles(dir: string, extensions: string[], depth: number = 0): string[] {
  const files: string[] = [];

  if (!existsSync(dir)) return files;

  const entries = readdirSync(dir);

  for (const entry of entries) {
    // Skip hidden files/folders
    if (entry.startsWith('.')) continue;

    // Skip known non-content directories
    if (SKIP_DIRS.has(entry)) continue;

    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      // Only recurse into audit_data, docs, and similar content directories
      // Skip deep nesting (max 3 levels)
      if (depth < 3) {
        files.push(...findFiles(fullPath, extensions, depth + 1));
      }
    } else if (extensions.includes(extname(entry).toLowerCase())) {
      // Skip package.json, tsconfig, etc.
      if (
        entry === 'package.json' ||
        entry === 'package-lock.json' ||
        entry === 'tsconfig.json' ||
        entry === 'vite.config.ts'
      )
        continue;
      files.push(fullPath);
    }
  }

  return files;
}

// Split content into chunks (max ~2000 chars per chunk for good embedding quality)
function chunkContent(content: string, maxChunkSize: number = 2000): string[] {
  const chunks: string[] = [];

  // Split by double newlines (paragraphs) or headers
  const sections = content.split(/\n\n+|\n(?=#)/);

  let currentChunk = '';

  for (const section of sections) {
    if (currentChunk.length + section.length > maxChunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      currentChunk = section;
    } else {
      currentChunk += (currentChunk ? '\n\n' : '') + section;
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks.filter(c => c.length > 50); // Skip very short chunks
}

// Parse JSON file and extract meaningful content
function parseJsonContent(content: string, filename: string): string {
  try {
    const data = JSON.parse(content);

    // Convert to readable text
    const lines: string[] = [`# ${basename(filename, '.json')}\n`];

    function extractText(obj: unknown, prefix = ''): void {
      if (typeof obj === 'string') {
        lines.push(obj);
      } else if (typeof obj === 'number' || typeof obj === 'boolean') {
        lines.push(String(obj));
      } else if (Array.isArray(obj)) {
        obj.forEach((item, i) => {
          if (typeof item === 'string') {
            lines.push(`- ${item}`);
          } else if (typeof item === 'object' && item !== null) {
            extractText(item, prefix);
          }
        });
      } else if (typeof obj === 'object' && obj !== null) {
        for (const [key, value] of Object.entries(obj)) {
          if (typeof value === 'string' && value.length > 10) {
            lines.push(`**${key}**: ${value}`);
          } else if (typeof value === 'object') {
            lines.push(`\n## ${key}`);
            extractText(value, key);
          }
        }
      }
    }

    extractText(data);
    return lines.join('\n');
  } catch {
    return content; // Return as-is if parsing fails
  }
}

async function seedAudits() {
  console.log('🌱 Starting audit seeder with RAG import...\n');

  // Get PHP business unit
  const phpBU = await db.query.businessUnits.findFirst({
    where: eq(businessUnits.name, 'PHP'),
  });

  if (!phpBU) {
    console.error('❌ PHP business unit not found! Run seed-business-lines.ts first.');
    process.exit(1);
  }

  console.log(`✅ Found PHP business unit: ${phpBU.id}`);

  // Get admin user
  const adminUser = await db.query.users.findFirst({
    where: eq(users.email, 'admin@adesso.de'),
  });

  if (!adminUser) {
    console.error('❌ Admin user not found!');
    process.exit(1);
  }

  console.log(`✅ Found admin user: ${adminUser.id}\n`);

  // Clear existing data (in order due to FK constraints)
  console.log('🗑️  Clearing existing data...');

  // Tables referencing qualifications
  await db.delete(backgroundJobs);
  await db.delete(baselineComparisons);
  await db.delete(cmsMatchResults);
  await db.delete(competitorMatches);
  await db.delete(dealEmbeddings);
  await db.delete(pitchdecks);
  await db.delete(ptEstimations);
  await db.delete(qualificationSectionData);
  await db.delete(referenceMatches);
  await db.delete(websiteAudits);

  // Tables referencing pre_qualifications
  await db.delete(deepMigrationAnalyses);
  await db.delete(documents);
  await db.delete(rawChunks);
  await db.delete(subjectiveAssessments);
  await db.delete(teamAssignments);

  // Clear qualifications BEFORE quick_scans
  await db.delete(qualifications);
  await db.delete(quickScans);
  await db.delete(preQualifications);

  console.log('✅ All tables cleared\n');

  // Create pre-qualifications and qualifications for each audit
  const auditsDir = join(process.cwd(), 'audits');
  let totalChunks = 0;

  for (const config of AUDIT_CONFIGS) {
    const auditPath = join(auditsDir, config.folderName);

    if (!existsSync(auditPath)) {
      console.log(`⚠️  Skipping ${config.folderName} - folder not found`);
      continue;
    }

    console.log(`\n📁 Processing: ${config.customerName}`);
    console.log(`   Folder: ${config.folderName}`);

    // Read summary if exists
    let rawInput = `Audit für ${config.customerName}\n\nWebsite: ${config.websiteUrl}\nBranche: ${config.industry}\n\n${config.projectDescription}`;

    const summaryPath = join(auditPath, 'AUDIT_SUMMARY.md');
    const readmePath = join(auditPath, 'README.md');

    if (existsSync(summaryPath)) {
      rawInput = readFileSync(summaryPath, 'utf-8');
    } else if (existsSync(readmePath)) {
      rawInput = readFileSync(readmePath, 'utf-8');
    }

    // Create pre-qualification
    const [preQual] = await db
      .insert(preQualifications)
      .values({
        userId: adminUser.id,
        source: 'proactive',
        stage: 'pre-qualification',
        inputType: 'freetext',
        rawInput: rawInput.substring(0, 10000),
        status: 'routed',
        decision: 'bid',
        websiteUrl: config.websiteUrl,
        assignedBusinessUnitId: phpBU.id,
        extractedRequirements: JSON.stringify({
          customerName: config.customerName,
          industry: config.industry,
          projectType: 'CMS Relaunch',
        }),
      })
      .returning();

    console.log(`   ✅ Created pre-qualification: ${preQual.id}`);

    // Create qualification (routed to PHP)
    const [qual] = await db
      .insert(qualifications)
      .values({
        preQualificationId: preQual.id,
        customerName: config.customerName,
        websiteUrl: config.websiteUrl,
        industry: config.industry,
        projectDescription: config.projectDescription,
        businessUnitId: phpBU.id,
        status: 'bl_reviewing', // Set to bl_reviewing so deep scan can be triggered
        deepScanStatus: 'pending', // Allow deep scans to be triggered
      })
      .returning();

    console.log(`   ✅ Created qualification: ${qual.id}`);

    // Find all MD and JSON files
    const files = findFiles(auditPath, ['.md', '.json']);
    console.log(`   📄 Found ${files.length} files to import`);

    let auditChunks = 0;

    for (const filePath of files) {
      const filename = basename(filePath);
      const relativePath = relative(auditPath, filePath);
      const ext = extname(filePath).toLowerCase();

      // Skip very large files
      const stat = statSync(filePath);
      if (stat.size > 500000) {
        console.log(
          `   ⏭️  Skipping large file: ${relativePath} (${Math.round(stat.size / 1024)}KB)`
        );
        continue;
      }

      try {
        let content = readFileSync(filePath, 'utf-8');

        // Parse JSON to text
        if (ext === '.json') {
          content = parseJsonContent(content, filename);
        }

        // Skip empty or very short content
        if (content.length < 100) continue;

        // Chunk the content
        const chunks = chunkContent(content);
        const chunkType = getChunkType(filename);
        const category = getChunkCategory(chunkType);

        // Create embeddings and store
        for (let i = 0; i < chunks.length; i++) {
          const chunk = chunks[i];

          try {
            const embedding = await generateQueryEmbedding(chunk);

            await db.insert(dealEmbeddings).values({
              qualificationId: qual.id,
              preQualificationId: preQual.id,
              agentName: 'audit_import',
              chunkType,
              chunkIndex: i,
              chunkCategory: category,
              content: chunk,
              confidence: 85, // High confidence for imported data
              requiresValidation: false,
              embedding,
              metadata: JSON.stringify({
                source: relativePath,
                filename,
                importedAt: new Date().toISOString(),
              }),
            });

            auditChunks++;
            totalChunks++;
          } catch (embeddingError) {
            console.error(`   ❌ Embedding error for ${filename} chunk ${i}:`, embeddingError);
          }
        }

        process.stdout.write(
          `\r   📥 Imported ${auditChunks} chunks from ${relativePath.substring(0, 40)}...`
        );
      } catch (error) {
        console.error(`   ❌ Error reading ${relativePath}:`, error);
      }
    }

    console.log(`\n   ✅ Imported ${auditChunks} RAG chunks`);
    console.log(`   → Routed to: PHP`);
  }

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`🎉 Audit seeding completed!`);
  console.log(`   Total qualifications: ${AUDIT_CONFIGS.length}`);
  console.log(`   Total RAG chunks: ${totalChunks}`);
  console.log(`${'═'.repeat(60)}`);
}

seedAudits()
  .catch(error => {
    console.error('❌ Error seeding audits:', error);
    process.exit(1);
  })
  .finally(() => {
    process.exit(0);
  });
