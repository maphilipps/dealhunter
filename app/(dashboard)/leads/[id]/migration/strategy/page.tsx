import { redirect } from 'next/navigation';

import { SectionPageTemplate } from '@/components/leads/section-page-template';
import { auth } from '@/lib/auth';

export default async function StrategyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/login');
  }

  return (
    <SectionPageTemplate
      leadId={id}
      sectionId="strategy"
      title="Migrations-Strategie"
      description="Empfohlene Migrations-Strategie basierend auf Content-Analyse und Komplexitätsbewertung"
    />
  );
}
