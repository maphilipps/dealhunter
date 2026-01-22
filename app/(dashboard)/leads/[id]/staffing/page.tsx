import { redirect } from 'next/navigation';

import { SectionPageTemplate } from '@/components/leads/section-page-template';
import { auth } from '@/lib/auth';

export default async function StaffingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/login');
  }

  return (
    <SectionPageTemplate
      leadId={id}
      sectionId="staffing"
      title="Staffing & Timeline"
      description="Ressourcen-Planung und Projekt-Timeline"
    />
  );
}
