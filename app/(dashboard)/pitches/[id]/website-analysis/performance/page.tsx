import { redirect } from 'next/navigation';

import { SectionPageTemplate } from '@/components/pitches/section-page-template';
import { auth } from '@/lib/auth';

export default async function PerformancePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/login');
  }

  return (
    <SectionPageTemplate
      leadId={id}
      sectionId="performance"
      title="Performance-Audit"
      description="Core Web Vitals, Ladezeiten und Performance-Optimierungsempfehlungen"
    />
  );
}
