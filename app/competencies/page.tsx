import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getCompetencies } from '@/lib/competencies/actions';

export default async function CompetenciesPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/login');
  }

  const result = await getCompetencies();

  const competencies = result.success ? result.competencies : [];

  return (
    <div className="container mx-auto py-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">Kompetenzen</h1>
            <p className="text-muted-foreground">
              Verwalten Sie die verfügbaren Kompetenzen
            </p>
          </div>
          <a
            href="/competencies/new"
            className="rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Neue Kompetenz
          </a>
        </div>

        {competencies.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground mb-4">
              Noch keine Kompetenzen erfasst
            </p>
            <a
              href="/competencies/new"
              className="text-primary hover:underline"
            >
              Erste Kompetenz erstellen →
            </a>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {competencies.map((comp) => (
              <div
                key={comp.id}
                className="rounded-lg border bg-card p-6"
              >
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-lg font-semibold">{comp.name}</h3>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-medium ${
                      comp.level === 'expert'
                        ? 'bg-purple-100 text-purple-800'
                        : comp.level === 'advanced'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {comp.level}
                  </span>
                </div>

                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Kategorie:</span>
                    <p className="font-medium capitalize">{comp.category.replace('_', ' ')}</p>
                  </div>

                  {comp.description && (
                    <div>
                      <span className="text-muted-foreground">Beschreibung:</span>
                      <p className="mt-1">{comp.description}</p>
                    </div>
                  )}

                  {comp.certifications && (
                    <div>
                      <span className="text-muted-foreground">Zertifizierungen:</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {JSON.parse(comp.certifications || '[]').map((cert: string, i: number) => (
                          <span
                            key={i}
                            className="inline-flex rounded-full bg-green-100 text-green-800 px-2 py-0.5 text-xs"
                          >
                            {cert}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
