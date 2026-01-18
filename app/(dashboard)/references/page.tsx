import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { references } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus } from 'lucide-react';

export default async function ReferencesPage() {
  const session = await auth();

  const userReferences = await db
    .select()
    .from(references)
    .where(eq(references.userId, session!.user!.id))
    .orderBy(references.createdAt);

  return (
    <>
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold mb-2">Meine Referenzen</h1>
          <p className="text-muted-foreground">
            Verwalten Sie Ihre Projekt-Referenzen
          </p>
        </div>
        <Button asChild>
          <Link href="/references/new">
            <Plus className="h-4 w-4 mr-2" />
            Neue Referenz
          </Link>
        </Button>
      </div>

      {userReferences.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">
            Noch keine Referenzen erstellt
          </p>
          <Button asChild variant="link">
            <Link href="/references/new">
              Erste Referenz erstellen
            </Link>
          </Button>
        </div>
      ) : (
        <div className="grid gap-4">
          {userReferences.map((ref) => (
            <Card key={ref.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle>{ref.projectName}</CardTitle>
                    <p className="text-muted-foreground">{ref.customerName}</p>
                  </div>
                  <Badge variant={ref.isValidated ? 'default' : 'secondary'}>
                    {ref.isValidated ? 'Validiert' : 'Ausstehend'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
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
                      <Badge key={i} variant="outline">
                        {tech}
                      </Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
