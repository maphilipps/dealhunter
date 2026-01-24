/**
 * Backfill Lead Embeddings
 *
 * Generates embeddings for all lead_embeddings chunks that are missing them.
 *
 * Run: npx tsx scripts/backfill-lead-embeddings.ts
 */

import 'dotenv/config';

import { eq, isNull, or } from 'drizzle-orm';
import OpenAI from 'openai';

import { db } from '../lib/db';
import { dealEmbeddings } from '../lib/db/schema';

const EMBEDDING_MODEL = 'text-embedding-3-large';
const EMBEDDING_DIMENSIONS = 3072;
const BATCH_SIZE = 5; // Smaller batches to avoid token limits
const MAX_CHUNK_SIZE = 8000; // Max characters per chunk (~2000 tokens)

async function main() {
  console.log('='.repeat(60));
  console.log('Backfill Lead Embeddings');
  console.log('='.repeat(60));

  // Check API key
  const apiKey = process.env.OPENAI_EMBEDDING_API_KEY;
  if (!apiKey) {
    console.error('❌ OPENAI_EMBEDDING_API_KEY not set!');
    process.exit(1);
  }
  console.log('✅ API Key found');

  // Initialize OpenAI client
  const openai = new OpenAI({
    apiKey,
    baseURL: 'https://api.openai.com/v1',
  });

  // Find chunks without embeddings
  const allChunksWithoutEmbeddings = await db
    .select()
    .from(dealEmbeddings)
    .where(or(isNull(dealEmbeddings.embedding), eq(dealEmbeddings.embedding, '')));

  console.log(`\nFound ${allChunksWithoutEmbeddings.length} chunks without embeddings`);

  // Filter out chunks that are too large
  const chunksWithoutEmbeddings = allChunksWithoutEmbeddings.filter(
    chunk => chunk.content.length <= MAX_CHUNK_SIZE
  );
  const skippedCount = allChunksWithoutEmbeddings.length - chunksWithoutEmbeddings.length;

  if (skippedCount > 0) {
    console.log(
      `⚠️  Skipping ${skippedCount} chunks that are too large (>${MAX_CHUNK_SIZE} chars)`
    );
  }
  console.log(`Processing ${chunksWithoutEmbeddings.length} chunks`);

  // Delete oversized chunks from DB (they're not useful for RAG)
  if (skippedCount > 0) {
    const oversizedIds = allChunksWithoutEmbeddings
      .filter(chunk => chunk.content.length > MAX_CHUNK_SIZE)
      .map(c => c.id);
    console.log(`🗑️  Deleting ${oversizedIds.length} oversized chunks from database...`);
    for (const id of oversizedIds) {
      await db.delete(dealEmbeddings).where(eq(dealEmbeddings.id, id));
    }
    console.log('✅ Deleted oversized chunks');
  }

  if (chunksWithoutEmbeddings.length === 0) {
    console.log('✅ All chunks have embeddings!');
    return;
  }

  // Process in batches
  let processed = 0;
  let errors = 0;

  for (let i = 0; i < chunksWithoutEmbeddings.length; i += BATCH_SIZE) {
    const batch = chunksWithoutEmbeddings.slice(i, i + BATCH_SIZE);
    console.log(
      `\nProcessing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(chunksWithoutEmbeddings.length / BATCH_SIZE)} (${batch.length} chunks)...`
    );

    try {
      // Generate embeddings
      const texts = batch.map(chunk => chunk.content);
      const response = await openai.embeddings.create({
        model: EMBEDDING_MODEL,
        input: texts,
        dimensions: EMBEDDING_DIMENSIONS,
      });

      // Update database
      for (let j = 0; j < batch.length; j++) {
        const chunk = batch[j];
        const embedding = response.data[j].embedding;

        await db
          .update(dealEmbeddings)
          .set({ embedding: JSON.stringify(embedding) })
          .where(eq(dealEmbeddings.id, chunk.id));

        processed++;
      }

      console.log(`  ✅ Updated ${batch.length} chunks`);
    } catch (error) {
      console.error(`  ❌ Batch failed:`, error);
      errors += batch.length;
    }

    // Rate limiting - small delay between batches
    if (i + BATCH_SIZE < chunksWithoutEmbeddings.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`Done! Processed: ${processed}, Errors: ${errors}`);
  console.log('='.repeat(60));
}

main().catch(console.error);
