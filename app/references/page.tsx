import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { references } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export default async function ReferencesPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/login');
  }

  const userReferences = await db
    .select()
    .from(references)
    .where(eq(references.userId, session.user.id))
    .orderBy(references.createdAt);

  return (
    <div className="container mx-auto py-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">Meine Referenzen</h1>
            <p className="text-muted-foreground">
              Verwalten Sie Ihre Projekt-Referenzen
            </p>
          </div>
          <a
            href="/references/new"
            className="rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Neue Referenz
          </a>
        </div>

        {userReferences.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground mb-4">
              Noch keine Referenzen erstellt
            </p>
            <a
              href="/references/new"
              className="text-primary hover:underline"
            >
              Erste Referenz erstellen →
            </a>
          </div>
        ) : (
          <div className="grid gap-4">
            {userReferences.map((ref) => (
              <div
                key={ref.id}
                className="rounded-lg border bg-card p-6"
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-xl font-semibold">{ref.projectName}</h3>
                    <p className="text-muted-foreground">{ref.customerName}</p>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-medium ${
                      ref.isValidated
                        ? 'bg-green-100 text-green-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}
                  >
                    {ref.isValidated ? 'Validiert' : 'Ausstehend'}
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
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
