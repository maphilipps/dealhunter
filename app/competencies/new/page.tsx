import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { CompetencyForm } from '@/components/competencies/competency-form';

export default async function NewCompetencyPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/login');
  }

  return (
    <div className="container mx-auto py-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Neue Kompetenz erstellen</h1>
        <p className="text-muted-foreground mb-8">
          Fügen Sie eine neue Kompetenz zur zentralen Datenbank hinzu
        </p>

        <div className="rounded-lg border bg-card p-6">
          <CompetencyForm />
        </div>
      </div>
    </div>
  );
}
