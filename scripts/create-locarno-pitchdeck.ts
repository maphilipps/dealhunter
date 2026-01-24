/**
 * Script to create pitchdeck for Locarno lead
 */

import { createPitchdeck } from '../lib/pitchdeck/actions';

const LOCARNO_LEAD_ID = 'c3k4e4f0kb2djd7h4forj3z2';

async function main() {
  console.log('Creating pitchdeck for Locarno lead...');

  const result = await createPitchdeck(LOCARNO_LEAD_ID);

  if (result.success) {
    console.log('✅ Pitchdeck created successfully:', result.pitchdeckId);
  } else {
    console.error('❌ Failed to create pitchdeck:', result.error);
    process.exit(1);
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
