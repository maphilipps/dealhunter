import { config } from 'dotenv';
config({ path: '.env.local' });

import { eq } from 'drizzle-orm';

import { db } from '../lib/db';
import { dealEmbeddings } from '../lib/db/schema';

async function generateEmbedding(text: string): Promise<number[] | null> {
  const apiKey = process.env.OPENAI_EMBEDDING_API_KEY;
  const baseUrl = process.env.OPENAI_EMBEDDING_BASE_URL || 'https://api.openai.com/v1';

  if (!apiKey) {
    console.error('No OPENAI_EMBEDDING_API_KEY');
    return null;
  }

  const response = await fetch(`${baseUrl}/embeddings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'text-embedding-3-large',
      input: text,
    }),
  });

  const data = await response.json();
  return data.data?.[0]?.embedding || null;
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dotProduct = 0,
    normA = 0,
    normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

async function test() {
  const leadId = 's4i39tt1ystbewlzhkqgain1';
  const query = 'Locarno Film Festival';
  const threshold = 0.2;

  console.log('Query:', query);
  console.log('Threshold:', threshold * 100 + '%');

  const queryEmbedding = await generateEmbedding(query);
  if (!queryEmbedding) {
    console.error('Failed to generate embedding');
    return;
  }

  const chunks = await db
    .select({
      id: dealEmbeddings.id,
      agentName: dealEmbeddings.agentName,
      content: dealEmbeddings.content,
      embedding: dealEmbeddings.embedding,
    })
    .from(dealEmbeddings)
    .where(eq(dealEmbeddings.qualificationId, leadId));

  console.log('Total chunks:', chunks.length);

  const results = chunks
    .filter(c => c.embedding)
    .map(c => ({
      id: c.id,
      agentName: c.agentName,
      content: c.content.slice(0, 100),
      similarity: cosineSimilarity(queryEmbedding, JSON.parse(c.embedding!)),
    }))
    .filter(r => r.similarity >= threshold)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 10);

  console.log('\nResults above ' + threshold * 100 + '%:', results.length);
  results.forEach((r, i) => {
    console.log('\n' + (i + 1) + '. [' + (r.similarity * 100).toFixed(1) + '%] ' + r.agentName);
    console.log('   ' + r.content + '...');
  });
}

test().catch(console.error);
