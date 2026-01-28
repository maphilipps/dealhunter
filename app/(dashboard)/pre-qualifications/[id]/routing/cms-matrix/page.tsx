import { AlertCircle, Loader2, Target } from 'lucide-react';
import { notFound, redirect } from 'next/navigation';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { auth } from '@/lib/auth';
import type { CMSMatchingResult } from '@/lib/cms-matching/schema';
import { getCachedPreQualificationWithRelations } from '@/lib/pre-qualifications/cached-queries';

function getPriorityBadgeVariant(priority: string): 'default' | 'secondary' | 'outline' {
  switch (priority) {
    case 'must-have':
      return 'default';
    case 'should-have':
      return 'secondary';
    default:
      return 'outline';
  }
}

function getPriorityLabel(priority: string): string {
  switch (priority) {
    case 'must-have':
      return 'Must Have';
    case 'should-have':
      return 'Should Have';
    case 'nice-to-have':
      return 'Nice to Have';
    default:
      return priority;
  }
}

function getScoreColor(score: number): string {
  if (score >= 80) return 'text-green-600';
  if (score >= 60) return 'text-yellow-600';
  return 'text-red-600';
}

export default async function CMSMatrixPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/login');
  }

  const { preQualification, quickScan } = await getCachedPreQualificationWithRelations(id);

  if (!preQualification) {
    notFound();
  }

  if (preQualification.userId !== session.user.id) {
    notFound();
  }

  // Parse CMS evaluation data
  let cmsEvaluation: CMSMatchingResult | null = null;
  if (quickScan?.cmsEvaluation) {
    try {
      const parsed = JSON.parse(quickScan.cmsEvaluation) as
        | CMSMatchingResult
        | {
            cmsMatchingResult?: CMSMatchingResult;
          };
      cmsEvaluation =
        'cmsMatchingResult' in parsed && parsed.cmsMatchingResult
          ? parsed.cmsMatchingResult
          : (parsed as CMSMatchingResult);
    } catch {
      cmsEvaluation = null;
    }
  }

  // Get sorted technologies for table headers
  const technologies =
    cmsEvaluation?.comparedTechnologies?.sort((a, b) => b.overallScore - a.overallScore) || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">CMS Entscheidungsmatrix</h1>
        <p className="text-muted-foreground">Technologie-Empfehlung basierend auf Anforderungen</p>
      </div>

      {/* No Evaluation yet - still processing */}
      {!cmsEvaluation && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Loader2 className="h-6 w-6 text-muted-foreground animate-spin" />
              <div>
                <CardTitle>CMS-Matrix wird erstellt...</CardTitle>
                <CardDescription>
                  Die CMS-Entscheidungsmatrix wird während der Verarbeitung automatisch generiert.
                  Diese Seite aktualisiert sich automatisch, sobald die Analyse abgeschlossen ist.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
        </Card>
      )}

      {cmsEvaluation && (
        <>
          {/* Requirements Matrix */}
          <Card>
            <CardHeader>
              <CardTitle>Anforderungs-Matrix</CardTitle>
              <CardDescription>
                Bewertung jeder Anforderung pro CMS ({cmsEvaluation.metadata.totalRequirements}{' '}
                Anforderungen)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[200px]">Anforderung</TableHead>
                      <TableHead>Priorität</TableHead>
                      {technologies.map(tech => (
                        <TableHead key={tech.id} className="text-center min-w-[80px]">
                          {tech.name}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cmsEvaluation.requirements.map((req, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-medium">
                          <div>
                            <p>{req.requirement}</p>
                            <p className="text-xs text-muted-foreground">{req.category}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={getPriorityBadgeVariant(req.priority)}>
                            {getPriorityLabel(req.priority)}
                          </Badge>
                        </TableCell>
                        {technologies.map(tech => {
                          const scoreData = req.cmsScores[tech.id];
                          const score = scoreData?.score ?? 0;
                          return (
                            <TableCell key={tech.id} className="text-center">
                              <span className={`font-bold ${getScoreColor(score)}`}>{score}%</span>
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Recommendation Card */}
          <Card className="border-green-200 bg-green-50">
            <CardHeader>
              <div className="flex items-center gap-3">
                <Target className="h-6 w-6 text-green-600" />
                <div>
                  <CardTitle className="text-green-900">Empfehlung</CardTitle>
                  <CardDescription className="text-green-700">
                    AI-basierte Technologie-Empfehlung
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-lg bg-white p-4">
                  <p className="text-muted-foreground mb-2 text-sm font-medium">Empfohlenes CMS</p>
                  <p className="text-2xl font-bold text-green-700">
                    {cmsEvaluation.recommendation.primaryCms}
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <Badge variant="default" className="bg-green-600">
                      {cmsEvaluation.recommendation.confidence}% Konfidenz
                    </Badge>
                  </div>
                </div>
                <div className="rounded-lg bg-white p-4">
                  <p className="text-muted-foreground mb-2 text-sm font-medium">Begründung</p>
                  <p className="text-sm text-foreground">
                    {cmsEvaluation.recommendation.reasoning}
                  </p>
                  {cmsEvaluation.recommendation.alternativeCms && (
                    <div className="mt-3 pt-3 border-t">
                      <p className="text-xs text-muted-foreground">Alternative</p>
                      <p className="text-sm font-medium">
                        {cmsEvaluation.recommendation.alternativeCms}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
