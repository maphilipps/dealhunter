import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { Plus } from 'lucide-react';
import { getTechnologies } from '@/lib/admin/technologies-actions';
import { TechnologyList } from '@/components/admin/technology-list';

export default async function TechnologiesPage() {
  const session = await auth();

  if (!session?.user || session.user.role !== 'admin') {
    redirect('/dashboard');
  }

  const result = await getTechnologies();
  const technologies = result.success ? result.technologies : [];

  return (
    <div className="container mx-auto py-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">Technologien</h1>
            <p className="text-muted-foreground">
              Verwalten Sie die Technologien mit Baselines
            </p>
          </div>
          <a
            href="/admin/technologies/new"
            className="rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Neue Technologie
          </a>
        </div>

        <TechnologyList technologies={technologies} />
      </div>
    </div>
  );
}
