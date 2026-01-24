import { redirect } from 'next/navigation';

import { SectionPageTemplate } from '@/components/qualifications/section-page-template';
import { auth } from '@/lib/auth';

export default async function AccessibilityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/login');
  }

  return (
    <SectionPageTemplate
      leadId={id}
      sectionId="accessibility"
      title="Accessibility-Audit"
      description="WCAG 2.1 Compliance, ARIA-Labels und Barrierefreiheits-Empfehlungen"
    />
  );
}
