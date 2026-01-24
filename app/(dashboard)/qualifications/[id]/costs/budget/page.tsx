import { redirect } from 'next/navigation';

import { SectionPageTemplate } from '@/components/qualifications/section-page-template';
import { auth } from '@/lib/auth';

export default async function BudgetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/login');
  }

  return (
    <SectionPageTemplate
      leadId={id}
      sectionId="budget"
      title="Budget-Analyse"
      description="Budget-Fit-Analyse mit Kundenbudget-Vergleich und Empfehlungen"
    />
  );
}
