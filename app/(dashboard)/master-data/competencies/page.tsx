import Link from 'next/link';

import { CompetencyList } from '@/components/admin/competency-list';
import { Button } from '@/components/ui/button';
import { getUserCompetencies } from '@/lib/master-data/actions';

export default async function CompetenciesPage() {
  const competencies = await getUserCompetencies();

  return (
    <div className="container py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Kompetenzen</h1>
          <p className="text-muted-foreground">
            Crowdsourced Kompetenzdatenbank mit Admin-Validierung
          </p>
        </div>
        <Button asChild>
          <Link href="/master-data/competencies/new">Neue Kompetenz</Link>
        </Button>
      </div>

      <CompetencyList competencies={competencies} />
    </div>
  );
}
