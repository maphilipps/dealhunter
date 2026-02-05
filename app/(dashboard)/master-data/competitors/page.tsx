import Link from 'next/link';

import { CompetitorList } from '@/components/admin/competitor-list';
import { Button } from '@/components/ui/button';
import { getUserCompetitors } from '@/lib/master-data/actions';

export default async function CompetitorsPage() {
  const competitors = await getUserCompetitors();

  return (
    <div className="container py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Wettbewerber</h1>
          <p className="text-muted-foreground">
            Competitive Intelligence Datenbank für Pitch-Analysen
          </p>
        </div>
        <Button asChild>
          <Link href="/master-data/competitors/new">Neuer Wettbewerber</Link>
        </Button>
      </div>

      <CompetitorList competitors={competitors} />
    </div>
  );
}
