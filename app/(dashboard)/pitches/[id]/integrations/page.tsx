import { redirect } from 'next/navigation';

import { SectionPageTemplate } from '@/components/pitches/section-page-template';
import { auth } from '@/lib/auth';

export default async function IntegrationsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/login');
  }

  return (
    <SectionPageTemplate
      leadId={id}
      sectionId="integrations"
      title="Integrationen"
      description="CRM, Marketing Automation, Analytics und weitere Integrationen"
    />
  );
}
