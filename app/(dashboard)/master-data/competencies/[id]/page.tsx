import { notFound } from 'next/navigation';

import { CompetencyForm } from '@/components/admin/competency-form';
import { getCompetency } from '@/lib/master-data/actions';

export default async function EditCompetencyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const competency = await getCompetency(id);

  if (!competency) {
    notFound();
  }

  return (
    <div className="container mx-auto py-8">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Kompetenz bearbeiten</h1>
          <p className="text-muted-foreground">
            Bearbeiten Sie die Kompetenz &quot;{competency.name}&quot;
          </p>
        </div>

        <CompetencyForm initialData={competency} />
      </div>
    </div>
  );
}
