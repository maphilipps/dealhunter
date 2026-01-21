import { getCompetencies } from '@/lib/competencies/actions';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus } from 'lucide-react';

export default async function CompetenciesPage() {
  const result = await getCompetencies();
  const competencies = result.success && result.competencies ? result.competencies : [];

  return (
    <>
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold mb-2">Kompetenzen</h1>
          <p className="text-muted-foreground">Verwalten Sie die verfügbaren Kompetenzen</p>
        </div>
        <Button asChild>
          <Link href="/competencies/new">
            <Plus className="h-4 w-4 mr-2" />
            Neue Kompetenz
          </Link>
        </Button>
      </div>

      {competencies.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">Noch keine Kompetenzen erfasst</p>
          <Button asChild variant="link">
            <Link href="/competencies/new">Erste Kompetenz erstellen</Link>
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {competencies.map(comp => (
            <Card key={comp.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <CardTitle className="text-lg">{comp.name}</CardTitle>
                  <Badge
                    variant={
                      comp.level === 'expert'
                        ? 'default'
                        : comp.level === 'advanced'
                          ? 'secondary'
                          : 'outline'
                    }
                  >
                    {comp.level}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
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
                        <Badge key={i} variant="outline" className="text-xs">
                          {cert}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
