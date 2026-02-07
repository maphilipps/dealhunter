import { eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';

import { CustomerIntelligencePanel } from '@/components/customer-intelligence/customer-intelligence-panel';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { pitches, preQualifications, leadScans } from '@/lib/db/schema';
import type {
  CompanyIntelligence,
  DecisionMakersResearch,
  TechStack,
} from '@/lib/qualification-scan/schema';

function safeParseJson<T>(value: string | null | undefined): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

export default async function PitchCustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/login');
  }

  const [lead] = await db.select().from(pitches).where(eq(pitches.id, id)).limit(1);

  if (!lead) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">Lead nicht gefunden</h1>
        <p className="text-muted-foreground">Der angeforderte Lead konnte nicht gefunden werden.</p>
      </div>
    );
  }

  const [preQualification] = lead.preQualificationId
    ? await db
        .select()
        .from(preQualifications)
        .where(eq(preQualifications.id, lead.preQualificationId))
        .limit(1)
    : [null];

  const qualificationScanId = lead.qualificationScanId || preQualification?.qualificationScanId;
  const [scan] = qualificationScanId
    ? await db.select().from(leadScans).where(eq(leadScans.id, qualificationScanId)).limit(1)
    : [null];

  const companyIntelligence = safeParseJson<CompanyIntelligence>(scan?.companyIntelligence);
  const decisionMakers = safeParseJson<DecisionMakersResearch>(scan?.decisionMakers);
  const techStack = safeParseJson<TechStack>(scan?.techStack);

  return (
    <CustomerIntelligencePanel
      customerName={lead.customerName}
      websiteUrl={lead.websiteUrl || scan?.websiteUrl || null}
      companyIntelligence={companyIntelligence}
      decisionMakers={decisionMakers}
      techStack={techStack}
    />
  );
}
