import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { CompetitorForm } from '@/components/competitors/competitor-form';

export default async function NewCompetitorPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/login');
  }

  return (
    <div className="container mx-auto py-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Neuen Wettbewerber erstellen</h1>
        <p className="text-muted-foreground mb-8">
          Fügen Sie Informationen über einen Wettbewerber hinzu, inklusive Stärken, Schwächen und Fokusgebiete.
        </p>

        <CompetitorForm />
      </div>
    </div>
  );
}
