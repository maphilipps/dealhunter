import { AlertCircle, Star, Target } from 'lucide-react';
import { notFound, redirect } from 'next/navigation';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
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
      cmsEvaluation = JSON.parse(quickScan.cmsEvaluation) as CMSMatchingResult;
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

      {/* No Evaluation Alert */}
      {!cmsEvaluation && (
        <Alert variant="default">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Noch nicht ausgewertet</AlertTitle>
          <AlertDescription>
            Die CMS-Entscheidungsmatrix wurde noch nicht generiert. Führen Sie zuerst die Qualification
            durch, um die Technologie-Empfehlungen zu erhalten.
          </AlertDescription>
        </Alert>
      )}

      {cmsEvaluation && (
        <>
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

          {/* Technology Comparison Table */}
          <Card>
            <CardHeader>
              <CardTitle>Technologie-Vergleich</CardTitle>
              <CardDescription>Gesamtbewertung aller analysierten CMS-Systeme</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>CMS</TableHead>
                    <TableHead className="text-right">Score</TableHead>
                    <TableHead>Stärken</TableHead>
                    <TableHead>Schwächen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {technologies.map((tech, idx) => (
                    <TableRow key={tech.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {idx === 0 && <Star className="h-4 w-4 text-yellow-500" />}
                          {tech.name}
                          {tech.isBaseline && (
                            <Badge variant="outline" className="text-xs">
                              Baseline
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Progress value={tech.overallScore} className="w-16 h-2" />
                          <span className={`font-bold ${getScoreColor(tech.overallScore)}`}>
                            {tech.overallScore}%
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {tech.strengths.slice(0, 3).map((s, i) => (
                            <Badge key={i} variant="secondary" className="text-xs bg-green-100">
                              {s}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {tech.weaknesses.slice(0, 3).map((w, i) => (
                            <Badge key={i} variant="outline" className="text-xs text-red-600">
                              {w}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

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

          {/* Metadata Card */}
          <Card>
            <CardHeader>
              <CardTitle>Analyse-Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <p className="text-sm text-muted-foreground">Analysiert am</p>
                  <p className="font-medium">
                    {new Date(cmsEvaluation.metadata.matchedAt).toLocaleDateString('de-DE', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Anforderungen</p>
                  <p className="font-medium">
                    {cmsEvaluation.metadata.totalRequirements} (davon{' '}
                    {cmsEvaluation.metadata.mustHaveCount} Must-Have)
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Durchschnittlicher Match-Score</p>
                  <p className="font-medium">
                    {cmsEvaluation.metadata.averageMatchScore.toFixed(1)}%
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
