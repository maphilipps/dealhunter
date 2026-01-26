import { redirect } from 'next/navigation';

import { SectionPageTemplate } from '@/components/qualifications/section-page-template';
import { auth } from '@/lib/auth';

export default async function SummaryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/login');
  }

  return (
    <SectionPageTemplate
      leadId={id}
      sectionId="detailed-summary"
      title="Detaillierte Zusammenfassung"
      description="Vollständige Zusammenfassung aller Analyseergebnisse"
    />
  );
}
