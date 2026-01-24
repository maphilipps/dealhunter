import { eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';

import { CMSComparisonView } from '@/components/leads/cms-comparison-client';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { leads, technologies } from '@/lib/db/schema';

export default async function CmsComparisonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/login');
  }

  // Fetch lead with selected CMS info
  const [lead] = await db
    .select({
      selectedCmsId: leads.selectedCmsId,
      selectedCmsName: technologies.name,
    })
    .from(leads)
    .leftJoin(technologies, eq(leads.selectedCmsId, technologies.id))
    .where(eq(leads.id, id))
    .limit(1);

  return (
    <CMSComparisonView
      leadId={id}
      selectedCmsId={lead?.selectedCmsId}
      selectedCmsName={lead?.selectedCmsName}
    />
  );
}
