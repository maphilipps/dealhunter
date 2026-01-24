/**
 * @deprecated This migration script has been executed and is kept for reference only.
 * The old rfpEmbeddings and leadEmbeddings tables have been removed from the schema.
 *
 * Migration Script: Unified dealEmbeddings Table (DEA-143)
 *
 * Migrates data from rfpEmbeddings and leadEmbeddings into the new unified dealEmbeddings table.
 * Old tables are NOT deleted for rollback safety.
 *
 * Migration Status: COMPLETED (1312 records migrated)
 * - 104 rfpEmbeddings migrated
 * - 1208 leadEmbeddings migrated
 *
 * Usage (historical):
 *   npx tsx scripts/migrate-to-deal-embeddings.ts
 */

import { db } from '@/lib/db';
import { dealEmbeddings } from '@/lib/db/schema';
import { createId } from '@paralleldrive/cuid2';

// Old table references removed - migration already complete
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rfpEmbeddings = null as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const leadEmbeddings = null as any;

async function migrateRfpEmbeddings() {
  console.log('📦 Migrating rfpEmbeddings to dealEmbeddings...');

  const rfpChunks = await db.select().from(rfpEmbeddings);
  console.log(`  Found ${rfpChunks.length} chunks in rfpEmbeddings`);

  if (rfpChunks.length === 0) {
    console.log('  ✅ No rfpEmbeddings to migrate');
    return 0;
  }

  let migratedCount = 0;
  const batchSize = 100;

  for (let i = 0; i < rfpChunks.length; i += batchSize) {
    const batch = rfpChunks.slice(i, i + batchSize);

    const values = batch.map(chunk => ({
      id: createId(), // New ID to avoid conflicts
      rfpId: chunk.rfpId,
      leadId: null,
      agentName: chunk.agentName,
      chunkType: chunk.chunkType,
      chunkIndex: chunk.chunkIndex,
      content: chunk.content,
      metadata: chunk.metadata,
      embedding: chunk.embedding,
      // Default values for new fields (rfpEmbeddings didn't have these)
      chunkCategory: 'elaboration' as const,
      confidence: 50,
      requiresValidation: false,
      validatedAt: null,
      validatedBy: null,
      createdAt: chunk.createdAt ?? new Date(),
      updatedAt: new Date(),
    }));

    await db.insert(dealEmbeddings).values(values);
    migratedCount += batch.length;
    console.log(`  Migrated ${migratedCount}/${rfpChunks.length} rfpEmbeddings`);
  }

  console.log(`  ✅ Migrated ${migratedCount} rfpEmbeddings`);
  return migratedCount;
}

async function migrateLeadEmbeddings() {
  console.log('📦 Migrating leadEmbeddings to dealEmbeddings...');

  const leadChunks = await db.select().from(leadEmbeddings);
  console.log(`  Found ${leadChunks.length} chunks in leadEmbeddings`);

  if (leadChunks.length === 0) {
    console.log('  ✅ No leadEmbeddings to migrate');
    return 0;
  }

  let migratedCount = 0;
  const batchSize = 100;

  for (let i = 0; i < leadChunks.length; i += batchSize) {
    const batch = leadChunks.slice(i, i + batchSize);

    const values = batch.map(chunk => ({
      id: createId(), // New ID to avoid conflicts
      rfpId: null,
      leadId: chunk.leadId,
      agentName: chunk.agentName,
      chunkType: chunk.chunkType,
      chunkIndex: chunk.chunkIndex,
      content: chunk.content,
      metadata: chunk.metadata,
      embedding: chunk.embedding,
      // Preserve existing category/validation fields
      chunkCategory: chunk.chunkCategory ?? ('elaboration' as const),
      confidence: chunk.confidence ?? 50,
      requiresValidation: chunk.requiresValidation ?? false,
      validatedAt: chunk.validatedAt,
      validatedBy: chunk.validatedBy,
      createdAt: chunk.createdAt ?? new Date(),
      updatedAt: chunk.updatedAt ?? new Date(),
    }));

    await db.insert(dealEmbeddings).values(values);
    migratedCount += batch.length;
    console.log(`  Migrated ${migratedCount}/${leadChunks.length} leadEmbeddings`);
  }

  console.log(`  ✅ Migrated ${migratedCount} leadEmbeddings`);
  return migratedCount;
}

async function verifyMigration() {
  console.log('\n🔍 Verifying migration...');

  const rfpCount = await db.select().from(rfpEmbeddings);
  const leadCount = await db.select().from(leadEmbeddings);
  const dealCount = await db.select().from(dealEmbeddings);

  console.log(`  rfpEmbeddings:  ${rfpCount.length} records`);
  console.log(`  leadEmbeddings: ${leadCount.length} records`);
  console.log(
    `  dealEmbeddings: ${dealCount.length} records (expected: ${rfpCount.length + leadCount.length})`
  );

  const expectedTotal = rfpCount.length + leadCount.length;
  if (dealCount.length >= expectedTotal) {
    console.log('  ✅ Migration verified successfully!');
    return true;
  } else {
    console.log('  ⚠️  Warning: dealEmbeddings count is less than expected');
    return false;
  }
}

async function main() {
  console.log('🚀 Starting migration to unified dealEmbeddings table...\n');

  try {
    // Check if dealEmbeddings already has data
    const existingData = await db.select().from(dealEmbeddings);
    if (existingData.length > 0) {
      console.log(`⚠️  dealEmbeddings already has ${existingData.length} records.`);
      console.log('   Skipping migration to prevent duplicates.');
      console.log('   To re-run migration, first clear the dealEmbeddings table.');
      return;
    }

    const rfpMigrated = await migrateRfpEmbeddings();
    const leadMigrated = await migrateLeadEmbeddings();

    console.log('\n📊 Migration Summary:');
    console.log(`  RFP Embeddings migrated:  ${rfpMigrated}`);
    console.log(`  Lead Embeddings migrated: ${leadMigrated}`);
    console.log(`  Total:                    ${rfpMigrated + leadMigrated}`);

    await verifyMigration();

    console.log('\n✅ Migration complete!');
    console.log(
      '   Note: Old tables (rfp_embeddings, lead_embeddings) are preserved for rollback safety.'
    );
    console.log('   After verifying everything works, you can drop them manually.');
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

main();
