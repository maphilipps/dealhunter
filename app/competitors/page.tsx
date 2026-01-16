import Link from 'next/link';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getCompetitors } from '@/lib/competitors-actions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

export default async function CompetitorsPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/login');
  }

  const result = await getCompetitors();
  const competitors = result.success ? result.competitors : [];

  return (
    <div className="container mx-auto py-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Wettbewerber</h1>
            <p className="text-muted-foreground">
              Verwalten Sie Wettbewerber-Informationen und Encounters
            </p>
          </div>
          <Button asChild>
            <Link href="/competitors/new">
              <Plus className="h-4 w-4 mr-2" />
              Neuer Wettbewerber
            </Link>
          </Button>
        </div>

        {!competitors || competitors.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground mb-4">Noch keine Wettbewerber vorhanden</p>
            <Button asChild>
              <Link href="/competitors/new">
                <Plus className="h-4 w-4 mr-2" />
                Ersten Wettbewerber erstellen
              </Link>
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {competitors.map((comp: any) => {
              const strengths = comp.strengths ? JSON.parse(comp.strengths) : [];
              const weaknesses = comp.weaknesses ? JSON.parse(comp.weaknesses) : [];
              const techFocus = comp.technologyFocus ? JSON.parse(comp.technologyFocus) : [];
              const industryFocus = comp.industryFocus ? JSON.parse(comp.industryFocus) : [];
              const encounters = comp.recentEncounters ? JSON.parse(comp.recentEncounters) : [];

              return (
                <Card key={comp.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-lg font-medium">{comp.name}</CardTitle>
                      <Badge
                        variant={
                          comp.priceLevel === 'high'
                            ? 'destructive'
                            : comp.priceLevel === 'medium'
                            ? 'default'
                            : 'secondary'
                        }
                      >
                        {comp.priceLevel === 'high' ? 'Hoch' : comp.priceLevel === 'medium' ? 'Mittel' : 'Niedrig'}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {strengths.length > 0 && (
                      <div>
                        <span className="text-muted-foreground text-sm">Stärken:</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {strengths.slice(0, 3).map((s: string, i: number) => (
                            <Badge key={i} variant="secondary" className="text-xs">
                              {s}
                            </Badge>
                          ))}
                          {strengths.length > 3 && (
                            <Badge variant="secondary" className="text-xs">+{strengths.length - 3}</Badge>
                          )}
                        </div>
                      </div>
                    )}

                    {weaknesses.length > 0 && (
                      <div>
                        <span className="text-muted-foreground text-sm">Schwächen:</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {weaknesses.slice(0, 3).map((w: string, i: number) => (
                            <Badge key={i} variant="outline" className="text-xs">
                              {w}
                            </Badge>
                          ))}
                          {weaknesses.length > 3 && (
                            <Badge variant="outline" className="text-xs">+{weaknesses.length - 3}</Badge>
                          )}
                        </div>
                      </div>
                    )}

                    {techFocus.length > 0 && (
                      <div>
                        <span className="text-muted-foreground text-sm">Tech-Fokus:</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {techFocus.slice(0, 4).map((t: string, i: number) => (
                            <Badge key={i} variant="secondary" className="text-xs">
                              {t}
                            </Badge>
                          ))}
                          {techFocus.length > 4 && (
                            <Badge variant="secondary" className="text-xs">+{techFocus.length - 4}</Badge>
                          )}
                        </div>
                      </div>
                    )}

                    {industryFocus.length > 0 && (
                      <div>
                        <span className="text-muted-foreground text-sm">Industrie-Fokus:</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {industryFocus.slice(0, 3).map((ind: string, i: number) => (
                            <Badge key={i} variant="outline" className="text-xs">
                              {ind}
                            </Badge>
                          ))}
                          {industryFocus.length > 3 && (
                            <Badge variant="outline" className="text-xs">+{industryFocus.length - 3}</Badge>
                          )}
                        </div>
                      </div>
                    )}

                    {encounters.length > 0 && (
                      <div className="pt-2 border-t">
                        <span className="text-muted-foreground text-sm">
                          {encounters.length} Encounter{encounters.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
