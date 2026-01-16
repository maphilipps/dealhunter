import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { TechnologyForm } from '@/components/admin/technology-form';
import { getBusinessLinesForSelect } from '@/lib/admin/technologies-actions';

export default async function NewTechnologyPage() {
  const session = await auth();

  if (!session?.user || session.user.role !== 'admin') {
    redirect('/dashboard');
  }

  const blResult = await getBusinessLinesForSelect();
  const businessLines = blResult.success ? blResult.businessLines : [];

  return (
    <div className="container mx-auto py-8">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Neue Technologie</h1>
          <p className="text-muted-foreground">
            Erstellen Sie eine neue Technologie mit Baseline-Daten
          </p>
        </div>

        <div className="rounded-lg border bg-card p-6">
          <TechnologyForm businessLines={businessLines} />
        </div>
      </div>
    </div>
  );
}
