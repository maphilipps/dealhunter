import { redirect } from 'next/navigation';

import { SectionPageTemplate } from '@/components/qualifications/section-page-template';
import { auth } from '@/lib/auth';

export default async function HighScalePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/login');
  }

  return (
    <SectionPageTemplate
      leadId={id}
      sectionId="high-scale"
      title="High-Scale"
      description="Skalierungsoptionen für High-Traffic-Szenarien"
    />
  );
}
