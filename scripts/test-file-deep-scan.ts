import { createId } from '@paralleldrive/cuid2';

import { db } from '@/lib/db';
import { qualifications, preQualifications } from '@/lib/db/schema';
import { runFileBasedDeepScan } from '@/lib/deep-scan/file-orchestrator';

async function main() {
  console.log('🧪 Testing File-Based Deep Scan...');

  // 1. Create a dummy RFP & Lead
  const preQualificationId = createId();
  const qualificationId = createId();
  const websiteUrl = 'https://www.example.com';

  console.log(`📝 Creating test lead: ${qualificationId} (${websiteUrl})`);

  // We need a user ID for the RFP
  const user = await db.query.users.findFirst();
  if (!user) throw new Error('No user found in DB');

  // We need a Business Unit ID for the Lead
  const bu = await db.query.businessUnits.findFirst();
  if (!bu) throw new Error('No business unit found in DB');

  await db.insert(preQualifications).values({
    id: preQualificationId,
    userId: user.id,
    source: 'reactive',
    stage: 'preQualification',
    status: 'draft',
    decision: 'pending',
    inputType: 'freetext',
    rawInput: 'Test RFP',
  });

  await db.insert(qualifications).values({
    id: qualificationId,
    preQualificationId: preQualificationId,
    status: 'routed',
    customerName: 'Acme Corp',
    websiteUrl: websiteUrl,
    industry: 'Technology',
    projectDescription: 'Test Project',
    budget: '100k',
    businessUnitId: bu.id,
  });

  // 2. Run the Deep Scan
  console.log('🚀 Starting Deep Scan...');
  try {
    const result = await runFileBasedDeepScan(qualificationId);

    console.log('✅ Deep Scan Completed!');
    console.log(`📂 Output Path: ${result.auditPath}`);
    console.log(`📄 Files Generated: ${result.files.length}`);
    result.files.forEach(f => console.log(`   - ${f.filename}`));
    console.log(
      `📊 Visualization Root: ${JSON.stringify(result.visualizationTree).substring(0, 100)}...`
    );
  } catch (error) {
    console.error('❌ Deep Scan Failed:', error);
  } finally {
    // Cleanup (Optional - maybe keep it to check files)
    console.log('🧹 Done.');
    process.exit(0);
  }
}

main();
