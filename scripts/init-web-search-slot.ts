/**
 * Initialize web-search model slot via direct SQL
 * Run with: npx tsx scripts/init-web-search-slot.ts
 */

import { sql } from 'drizzle-orm';

import { db } from '@/lib/db';

async function initWebSearchSlot() {
  console.log('🔍 Initializing web-search model slot...');

  try {
    // Check if slot already exists
    const existing = await db.execute(
      sql`SELECT id FROM ai_model_slot_configs WHERE slot = 'web-search'`
    );

    if (existing.rows.length > 0) {
      console.log('✅ web-search slot already exists');
      return;
    }

    // Get OpenAI provider ID
    const providerResult = await db.execute(
      sql`SELECT id FROM ai_provider_configs WHERE provider_key = 'openai' LIMIT 1`
    );

    if (providerResult.rows.length === 0) {
      console.error('❌ OpenAI provider not found in database.');
      console.log('Please ensure ai_provider_configs table is seeded first.');
      process.exit(1);
    }

    const providerId = providerResult.rows[0].id;

    // Insert web-search slot
    await db.execute(sql`
      INSERT INTO ai_model_slot_configs (id, slot, provider_id, model_name, is_overridden, created_at, updated_at)
      VALUES (
        gen_random_uuid()::text,
        'web-search',
        ${providerId},
        'gpt-4o-mini',
        false,
        NOW(),
        NOW()
      )
    `);

    console.log('✅ web-search slot created successfully');
    console.log('   Provider: openai');
    console.log('   Model: gpt-4o-mini');
    console.log('   Override: false');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

initWebSearchSlot()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Failed:', error);
    process.exit(1);
  });
