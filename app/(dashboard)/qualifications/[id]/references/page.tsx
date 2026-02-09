import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';

import { PreQualificationSectionPageTemplate } from '@/components/qualifications/section-page-template';
import { Button } from '@/components/ui/button';
import { auth } from '@/lib/auth';
import { getCachedPreQualification } from '@/lib/qualifications/cached-queries';

export default async function ReferencesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/login');
  }

  // Get Qualification (cached - shares query with layout)
  const preQualification = await getCachedPreQualification(id);

  if (!preQualification) {
    notFound();
  }

  // Check ownership
  if (preQualification.userId !== session.user.id) {
    notFound();
  }

  return (
    <PreQualificationSectionPageTemplate
      preQualificationId={id}
      sectionId="references"
      title="Referenzen"
      description="Welche und wie viele Referenzen sind gefordert? Wie spitz sind die Kriterien (z.B. Branche)?"
    >
      <div className="flex justify-end">
        <Button asChild variant="outline" size="sm">
          <Link href={`/qualifications/${id}/rag-data`}>Quellen prüfen</Link>
        </Button>
      </div>
    </PreQualificationSectionPageTemplate>
  );
}
