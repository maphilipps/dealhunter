import { eq, and, like, count, desc } from 'drizzle-orm';

import { db } from '../lib/db';
import { dealEmbeddings } from '../lib/db/schema';

async function test() {
  const qualificationId = 's4i39tt1ystbewlzhkqgain1';
  const search = 'Locarno';

  console.log('Testing getQualificationEmbeddings logic for qualification:', qualificationId);
  console.log('Search term:', search);

  // Build where conditions (same as in the server action)
  const conditions = [eq(dealEmbeddings.qualificationId, qualificationId)];
  conditions.push(like(dealEmbeddings.content, '%' + search + '%'));

  const whereClause = and(...conditions);

  // Get total count
  const [totalResult] = await db.select({ count: count() }).from(dealEmbeddings).where(whereClause);

  console.log('Total count with search:', totalResult.count);

  // Get items
  const items = await db
    .select({
      id: dealEmbeddings.id,
      agentName: dealEmbeddings.agentName,
      chunkType: dealEmbeddings.chunkType,
      content: dealEmbeddings.content,
    })
    .from(dealEmbeddings)
    .where(whereClause)
    .orderBy(desc(dealEmbeddings.createdAt))
    .limit(20);

  console.log('Items found:', items.length);

  for (const item of items.slice(0, 3)) {
    console.log('\n---');
    console.log('Agent:', item.agentName);
    console.log('Type:', item.chunkType);
    console.log('Content preview:', item.content.slice(0, 100));
  }
}

test().catch(console.error);
