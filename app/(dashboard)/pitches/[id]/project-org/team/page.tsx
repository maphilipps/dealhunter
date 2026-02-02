import { redirect } from 'next/navigation';

import { SectionPageTemplate } from '@/components/pitches/section-page-template';
import { auth } from '@/lib/auth';

export default async function TeamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/login');
  }

  return (
    <SectionPageTemplate
      leadId={id}
      sectionId="team"
      title="Team & Ressourcen"
      description="Team-Zusammenstellung, Rollen und Ressourcen-Allokation für das Projekt"
    />
  );
}
