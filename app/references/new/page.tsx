import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { ReferenceForm } from '@/components/references/reference-form';

export default async function NewReferencePage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/login');
  }

  return (
    <div className="container mx-auto py-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Neue Referenz erstellen</h1>
        <p className="text-muted-foreground mb-8">
          Füllen Sie die Details des Projekt-Referenzen aus. Diese werden nach Erstellung von einem Admin validiert.
        </p>

        <div className="rounded-lg border bg-card p-6">
          <ReferenceForm userId={session.user.id} />
        </div>
      </div>
    </div>
  );
}
