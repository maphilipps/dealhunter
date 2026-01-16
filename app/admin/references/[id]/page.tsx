import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getReferenceById } from '@/lib/references/actions';
import { ReferenceValidationButton } from '@/components/references/reference-validation-button';

export default async function AdminReferenceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/login');
  }

  // Only admins can access this page
  if (session.user.role !== 'admin') {
    redirect('/dashboard');
  }

  const { id } = await params;
  const result = await getReferenceById(id);

  if (!result.success || !result.reference) {
    return (
      <div className="container mx-auto py-8">
        <div className="max-w-4xl mx-auto">
          <p className="text-muted-foreground">Referenz nicht gefunden</p>
        </div>
      </div>
    );
  }

  const reference = result.reference;

  return (
    <div className="container mx-auto py-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <a
            href="/admin/references"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← Zurück zur Übersicht
          </a>
        </div>

        <div className="rounded-lg border bg-card p-8">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h1 className="text-3xl font-bold mb-2">{reference.projectName}</h1>
              <p className="text-xl text-muted-foreground">{reference.customerName}</p>
            </div>
            <span
              className={`px-4 py-2 rounded-full text-sm font-medium ${
                reference.isValidated
                  ? 'bg-green-100 text-green-800'
                  : 'bg-yellow-100 text-yellow-800'
              }`}
            >
              {reference.isValidated ? 'Validiert' : 'Ausstehend'}
            </span>
          </div>

          <div className="space-y-8">
            {/* Project Details */}
            <div>
              <h2 className="text-lg font-semibold mb-4">Projektdetails</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <span className="text-sm text-muted-foreground">Branche</span>
                  <p className="font-medium">{reference.industry}</p>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Budget</span>
                  <p className="font-medium">{reference.budgetRange}</p>
                </div>
              </div>
            </div>

            {/* Technical Details */}
            <div>
              <h2 className="text-lg font-semibold mb-4">Technische Details</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <span className="text-sm text-muted-foreground">Teamgröße</span>
                  <p className="font-medium">{reference.teamSize} Personen</p>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Projektdauer</span>
                  <p className="font-medium">{reference.durationMonths} Monate</p>
                </div>
              </div>
              <div className="mt-4">
                <span className="text-sm text-muted-foreground">Projektumfang</span>
                <p className="mt-1 whitespace-pre-wrap">{reference.scope}</p>
              </div>
              <div className="mt-4">
                <span className="text-sm text-muted-foreground">Technologien</span>
                <div className="flex flex-wrap gap-2 mt-2">
                  {JSON.parse(reference.technologies || '[]').map((tech: string, i: number) => (
                    <span
                      key={i}
                      className="inline-flex rounded-full bg-primary/10 px-3 py-1 text-sm"
                    >
                      {tech}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Business Details */}
            <div>
              <h2 className="text-lg font-semibold mb-4">Ergebnis</h2>
              <div>
                <span className="text-sm text-muted-foreground">Projektergebnis</span>
                <p className="font-medium mt-1">
                  {reference.outcome === 'success' && 'Erfolgreich abgeschlossen'}
                  {reference.outcome === 'on_track' && 'Im Zeitplan und im Budget'}
                  {reference.outcome === 'delayed' && 'Mit Verzögerungen abgeschlossen'}
                  {reference.outcome === 'over_budget' && 'Über Budget abgeschlossen'}
                </p>
              </div>
            </div>

            {/* Highlights */}
            {reference.highlights && (
              <div>
                <h2 className="text-lg font-semibold mb-4">Highlights</h2>
                <ul className="space-y-2">
                  {JSON.parse(reference.highlights || '[]').map((highlight: string, i: number) => (
                    <li
                      key={i}
                      className="flex items-start gap-2 rounded-lg bg-muted p-3"
                    >
                      <span className="text-primary">✓</span>
                      <span className="text-sm">{highlight}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Validation Info */}
            {reference.isValidated && (
              <div className="rounded-lg bg-green-50 border border-green-200 p-4">
                <h3 className="font-semibold text-green-900 mb-2">Validiert</h3>
                <p className="text-sm text-green-700">
                  Validiert am {new Date(reference.validatedAt!).toLocaleDateString('de-DE')}{' '}
                  um {new Date(reference.validatedAt!).toLocaleTimeString('de-DE')}
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-4 pt-6 border-t">
              <ReferenceValidationButton
                referenceId={reference.id}
                isValidated={reference.isValidated}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
