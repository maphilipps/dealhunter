/**
 * Test Script: Lead RAG Retrieval
 *
 * Testet ob die RAG-Abfrage für Lead-Embeddings funktioniert.
 *
 * Run: npx tsx scripts/test-lead-rag.ts
 */

import 'dotenv/config';

import { queryRagForLead } from '../lib/rag/lead-retrieval-service';

console.log('OPENAI_EMBEDDING_API_KEY set:', !!process.env.OPENAI_EMBEDDING_API_KEY);

async function main() {
  const leadId = 's4i39tt1ystbewlzhkqgain1';
  const sectionId = 'technology';

  console.log('='.repeat(60));
  console.log('Test: Lead RAG Retrieval');
  console.log('='.repeat(60));
  console.log(`Lead ID: ${leadId}`);
  console.log(`Section ID: ${sectionId}`);
  console.log('');

  try {
    console.log('Querying RAG for lead...');
    const results = await queryRagForLead({
      leadId,
      sectionId,
      question: 'What is the current technology stack?',
      maxResults: 5,
    });

    console.log(`\nResults: ${results.length} chunks found`);
    console.log('-'.repeat(60));

    if (results.length === 0) {
      console.log('❌ No results found!');
      console.log('Check if lead_embeddings table has data for this lead.');
    } else {
      console.log('✅ Results found!');
      console.log('');

      results.forEach((result, i) => {
        console.log(`[${i + 1}] Agent: ${result.agentName}`);
        console.log(`    Type: ${result.chunkType}`);
        console.log(`    Similarity: ${Math.round(result.similarity * 100)}%`);
        console.log(`    Content: ${result.content.substring(0, 150)}...`);
        console.log('');
      });
    }
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

main();
