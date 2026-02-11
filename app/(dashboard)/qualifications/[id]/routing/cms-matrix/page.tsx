import { Info, Target } from 'lucide-react';

import { Loader } from '@/components/ai-elements/loader';
import { notFound, redirect } from 'next/navigation';

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
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { auth } from '@/lib/auth';
import type { CMSMatchingResult } from '@/lib/cms-matching/schema';
import { getCachedPreQualificationWithRelations } from '@/lib/qualifications/cached-queries';

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

  const { preQualification, qualificationScan } = await getCachedPreQualificationWithRelations(id);

  if (!preQualification) {
    notFound();
  }

  if (preQualification.userId !== session.user.id) {
    notFound();
  }

  // Parse CMS evaluation data
  let cmsEvaluation: CMSMatchingResult | null = null;
  if (qualificationScan?.cmsEvaluation) {
    try {
      const parsed = JSON.parse(qualificationScan.cmsEvaluation) as
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
  type ComparedTechnology = NonNullable<CMSMatchingResult['comparedTechnologies']>[number];
  type TechGroup = ComparedTechnology & { ids: string[] };

  const techGroups = new Map<string, ComparedTechnology[]>();
  for (const tech of cmsEvaluation?.comparedTechnologies ?? []) {
    const key = tech.name.trim().toLowerCase();
    const arr = techGroups.get(key) ?? [];
    arr.push(tech);
    techGroups.set(key, arr);
  }

  const technologies: TechGroup[] = [...techGroups.values()]
    .map(group => {
      const best = [...group].sort((a, b) => b.overallScore - a.overallScore)[0];
      return { ...best, ids: group.map(t => t.id) };
    })
    .sort((a, b) => b.overallScore - a.overallScore);

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
              <Loader size="md" className="text-muted-foreground" />
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
                          const candidates = tech.ids
                            .map(id => req.cmsScores[id])
                            .filter(Boolean) as Array<{
                            score: number;
                            confidence: number;
                            notes?: string;
                            webSearchUsed?: boolean;
                          }>;
                          const scoreData = [...candidates].sort((a, b) => {
                            if (b.score !== a.score) return b.score - a.score;
                            return (b.confidence ?? 0) - (a.confidence ?? 0);
                          })[0];
                          const score = scoreData?.score ?? 0;
                          const confidence = scoreData?.confidence ?? 0;
                          const notes = scoreData?.notes;
                          const webSearchUsed = Boolean(scoreData?.webSearchUsed);

                          return (
                            <TableCell key={tech.id} className="text-center">
                              <div className="flex items-center justify-center gap-1">
                                <span className={`font-bold ${getScoreColor(score)}`}>
                                  {score}%
                                </span>
                                {scoreData && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <button
                                        type="button"
                                        className="text-muted-foreground hover:text-foreground"
                                        aria-label="Details anzeigen"
                                      >
                                        <Info className="h-3.5 w-3.5" />
                                      </button>
                                    </TooltipTrigger>
                                    <TooltipContent
                                      sideOffset={6}
                                      className="max-w-xs whitespace-pre-wrap"
                                    >
                                      <div className="space-y-1">
                                        <div>
                                          <span className="font-medium">Score:</span> {score}%
                                        </div>
                                        <div>
                                          <span className="font-medium">Confidence:</span>{' '}
                                          {confidence}%
                                        </div>
                                        <div>
                                          <span className="font-medium">Web Search:</span>{' '}
                                          {webSearchUsed ? 'ja' : 'nein'}
                                        </div>
                                        {notes && (
                                          <div>
                                            <span className="font-medium">Notes:</span> {notes}
                                          </div>
                                        )}
                                      </div>
                                    </TooltipContent>
                                  </Tooltip>
                                )}
                              </div>
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

          {/* Technology details */}
          <Card>
            <CardHeader>
              <CardTitle>Technology Details</CardTitle>
              <CardDescription>Stärken, Schwächen und Hinweise pro CMS</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                {technologies.map(tech => (
                  <div key={tech.id} className="rounded-lg border p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-base font-semibold">{tech.name}</div>
                        {tech.category && (
                          <div className="text-xs text-muted-foreground">{tech.category}</div>
                        )}
                      </div>
                      <Badge variant="secondary">{tech.overallScore}%</Badge>
                    </div>

                    {tech.strengths.length > 0 && (
                      <div>
                        <div className="text-xs font-medium text-muted-foreground">Stärken</div>
                        <ul className="mt-1 list-disc pl-5 text-sm">
                          {tech.strengths.slice(0, 6).map((s, idx) => (
                            <li key={idx}>{s}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {tech.weaknesses.length > 0 && (
                      <div>
                        <div className="text-xs font-medium text-muted-foreground">Schwächen</div>
                        <ul className="mt-1 list-disc pl-5 text-sm">
                          {tech.weaknesses.slice(0, 6).map((w, idx) => (
                            <li key={idx}>{w}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {tech.licenseCostNote && (
                      <div className="text-sm">
                        <div className="text-xs font-medium text-muted-foreground">
                          Lizenzkosten
                        </div>
                        <div className="mt-1">{tech.licenseCostNote}</div>
                      </div>
                    )}
                  </div>
                ))}
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
