import { auth } from '@/lib/auth';
import { ReferenceForm } from '@/components/references/reference-form';
import { Card, CardContent } from '@/components/ui/card';

export default async function NewReferencePage() {
  const session = await auth();

  return (
    <>
      <div>
        <h1 className="text-3xl font-bold mb-2">Neue Referenz erstellen</h1>
        <p className="text-muted-foreground">
          Füllen Sie die Details der Projekt-Referenz aus. Diese wird nach Erstellung von einem Admin validiert.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <ReferenceForm userId={session!.user!.id} />
        </CardContent>
      </Card>
    </>
  );
}
