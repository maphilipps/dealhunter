import { redirect } from 'next/navigation';

import { SectionPageTemplate } from '@/components/leads/section-page-template';
import { auth } from '@/lib/auth';

export default async function CmsArchitecturePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/login');
  }

  return (
    <SectionPageTemplate
      leadId={id}
      sectionId="cms-architecture"
      title="CMS-Architektur"
      description="Content Model, Content Types und Konfigurationsanalyse"
    />
  );
}
