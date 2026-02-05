import { notFound } from 'next/navigation';

import { CompetitorForm } from '@/components/admin/competitor-form';
import { getCompetitor } from '@/lib/master-data/actions';

export default async function EditCompetitorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const competitor = await getCompetitor(id);

  if (!competitor) {
    notFound();
  }

  return (
    <div className="container mx-auto py-8">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Wettbewerber bearbeiten</h1>
          <p className="text-muted-foreground">
            Bearbeiten Sie &quot;{competitor.companyName}&quot;
          </p>
        </div>

        <CompetitorForm initialData={competitor} />
      </div>
    </div>
  );
}
