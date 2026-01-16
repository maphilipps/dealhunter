import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getPendingReferences } from '@/lib/references/actions';

export default async function AdminReferencesPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/login');
  }

  // Only admins can access this page
  if (session.user.role !== 'admin') {
    redirect('/dashboard');
  }

  const result = await getPendingReferences();

  if (!result.success || !result.references) {
    return (
      <div className="container mx-auto py-8">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-3xl font-bold mb-2">Referenz-Validierung</h1>
          <p className="text-muted-foreground">
            Fehler beim Laden der ausstehenden Referenzen
          </p>
        </div>
      </div>
    );
  }

  const pendingReferences = result.references;

  return (
    <div className="container mx-auto py-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Referenz-Validierung</h1>
          <p className="text-muted-foreground">
            Überprüfen und validieren Sie eingereichte Projekt-Referenzen
          </p>
        </div>

        {pendingReferences.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">
              Keine ausstehenden Referenzen zu validieren
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {pendingReferences.map((ref) => (
              <a
                key={ref.id}
                href={`/admin/references/${ref.id}`}
                className="block rounded-lg border bg-card p-6 hover:bg-accent transition-colors"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold">{ref.projectName}</h3>
                    <p className="text-muted-foreground">{ref.customerName}</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Eingereicht am {new Date(ref.createdAt!).toLocaleDateString('de-DE')}
                    </p>
                  </div>
                  <span className="px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                    Ausstehend
                  </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Branche:</span>
                    <p className="font-medium">{ref.industry}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Teamgröße:</span>
                    <p className="font-medium">{ref.teamSize} Personen</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Dauer:</span>
                    <p className="font-medium">{ref.durationMonths} Monate</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Budget:</span>
                    <p className="font-medium">{ref.budgetRange}</p>
                  </div>
                </div>

                <div className="mt-4">
                  <span className="text-muted-foreground text-sm">Technologien:</span>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {JSON.parse(ref.technologies || '[]').map((tech: string, i: number) => (
                      <span
                        key={i}
                        className="inline-flex rounded-full bg-primary/10 px-3 py-1 text-xs"
                      >
                        {tech}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t">
                  <p className="text-sm text-muted-foreground">Klicken zum Überprüfen und Validieren →</p>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
