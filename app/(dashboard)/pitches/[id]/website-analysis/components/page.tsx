import { redirect } from 'next/navigation';

import { SectionPageTemplate } from '@/components/pitches/section-page-template';
import { auth } from '@/lib/auth';

export default async function ComponentsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/login');
  }

  return (
    <SectionPageTemplate
      leadId={id}
      sectionId="components"
      title="Components"
      description="UI-Komponenten-Bibliothek der aktuellen Website"
    />
  );
}
