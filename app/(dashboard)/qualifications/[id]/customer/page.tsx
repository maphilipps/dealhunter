import { notFound, redirect } from 'next/navigation';

import { CustomerIntelligencePanel } from '@/components/customer-intelligence/customer-intelligence-panel';
import { auth } from '@/lib/auth';
import type { ExtractedRequirements } from '@/lib/extraction/schema';
import { getCachedPreQualificationWithRelations } from '@/lib/qualifications/cached-queries';
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

export default async function QualificationCustomerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/login');
  }

  const { preQualification, qualificationScan } = await getCachedPreQualificationWithRelations(id);

  if (!preQualification) {
    notFound();
  }

  if (preQualification.userId !== session.user.id) {
    notFound();
  }

  const extracted = safeParseJson<ExtractedRequirements>(preQualification.extractedRequirements);
  const customerName = extracted?.customerName || null;

  const companyIntelligence = safeParseJson<CompanyIntelligence>(
    qualificationScan?.companyIntelligence
  );
  const decisionMakers = safeParseJson<DecisionMakersResearch>(qualificationScan?.decisionMakers);
  const techStack = safeParseJson<TechStack>(qualificationScan?.techStack);

  // Requirement: Website URL on /customer must always come from websearch discovery.
  const websiteUrl =
    companyIntelligence?.basicInfo.website && companyIntelligence.basicInfo.website !== 'unknown'
      ? companyIntelligence.basicInfo.website
      : null;

  return (
    <CustomerIntelligencePanel
      customerName={customerName}
      websiteUrl={websiteUrl}
      companyIntelligence={companyIntelligence}
      decisionMakers={decisionMakers}
      techStack={techStack}
    />
  );
}
