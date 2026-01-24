/**
 * Test deliverable generation for Locarno pitchdeck
 */

import { generateCompleteSolution } from '../lib/agents/solution-agent';

async function main() {
  console.log('🧪 Testing deliverable generation for Executive Summary...\n');

  const input = {
    deliverableName: 'Executive Summary',
    rfpId: 'ea11p7to4wpqpq600v3afkif',
    leadId: 'c3k4e4f0kb2djd7h4forj3z2',
    customerName: 'Locarno Film Festival',
    projectDescription:
      'Migration von Magnolia CMS 6.3 auf Drupal 11 mit umfangreichem Film-Archiv (10.000+ Einträge), mehrsprachig (EN/IT/FR/DE), High-Traffic (8.000 req/min)',
    requirements: [
      'Migration von Magnolia CMS 6.3 auf Drupal 11',
      'Film-Archiv mit 10.000+ Einträgen',
      '4 Sprachen (EN, IT, FR, DE)',
      'Peak-Last 8.000 req/min',
    ],
  };

  try {
    const solution = await generateCompleteSolution(input);

    console.log('✅ Solution generated successfully!\n');
    console.log('📝 Outline:');
    console.log(`   - Sections: ${solution.outline.outline.length}`);
    console.log(`   - Estimated Words: ${solution.outline.estimatedWordCount}`);

    console.log('\n📄 Draft:');
    console.log(`   - Word Count: ${solution.draft.wordCount}`);
    console.log(`   - Preview: ${solution.draft.draft.substring(0, 200)}...`);

    console.log('\n💬 Talking Points:');
    console.log(`   - Topics: ${solution.talkingPoints.talkingPoints.length}`);

    console.log('\n🎨 Visual Ideas:');
    console.log(`   - Ideas: ${solution.visualIdeas.visualIdeas.length}`);

    console.log('\n✅ All solution components generated successfully!');
  } catch (error) {
    console.error('\n❌ Error generating solution:', error);
    throw error;
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
