'use client';

import { Fragment, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  CheckCircle2,
  XCircle,
  HelpCircle,
  Search,
  Loader2,
  Trophy,
  TrendingUp,
} from 'lucide-react';
import type { CMSMatchingResult, RequirementMatch } from '@/lib/cms-matching/schema';
import { REQUIREMENT_CATEGORIES } from '@/lib/cms-matching/schema';

interface CMSEvaluationMatrixProps {
  result: CMSMatchingResult;
  onSelectCMS?: (cmsId: string) => void;
  selectedCMS?: string;
  isLoading?: boolean;
  onResearchRequirement?: (cmsId: string, requirement: string) => void;
  /** Key format: `${cmsId}-${requirement}` */
  researchingCell?: string | null;
}

function getScoreColor(score: number): string {
  if (score >= 80) return 'text-green-600 bg-green-50';
  if (score >= 60) return 'text-yellow-600 bg-yellow-50';
  if (score >= 40) return 'text-orange-600 bg-orange-50';
  return 'text-red-600 bg-red-50';
}

function ScoreCell({
  score,
  confidence,
  notes,
  webSearchUsed,
  onResearch,
  isResearching,
}: {
  score: number;
  confidence: number;
  notes?: string;
  webSearchUsed?: boolean;
  onResearch?: () => void;
  isResearching?: boolean;
}) {
  // Zeige Loader wenn diese Zelle gerade recherchiert wird
  if (isResearching) {
    return (
      <div className="flex items-center justify-center px-2 py-1">
        <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
      </div>
    );
  }

  // 50% = keine Daten -> n/a anzeigen
  const isNoData = score === 50 && confidence <= 40;

  if (isNoData) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center justify-center gap-1 px-2 py-1 rounded bg-slate-100 text-slate-500">
              <span className="text-sm font-medium">n/a</span>
              {onResearch && (
                <button
                  onClick={e => {
                    e.stopPropagation();
                    onResearch();
                  }}
                  className="ml-1 p-0.5 hover:bg-slate-200 rounded"
                >
                  <Search className="h-3 w-3" />
                </button>
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <div className="text-xs">
              <p className="font-medium text-slate-600">Keine Daten</p>
              <p className="text-muted-foreground">Klicken Sie auf 🔍 zum Recherchieren</p>
              {notes && <p className="text-muted-foreground mt-1">{notes}</p>}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={`flex items-center justify-center gap-1 px-2 py-1 rounded ${getScoreColor(score)}`}
          >
            {score >= 70 ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : score >= 40 ? (
              <HelpCircle className="h-4 w-4" />
            ) : (
              <XCircle className="h-4 w-4" />
            )}
            <span className="font-medium">{score}%</span>
            {webSearchUsed && <Search className="h-3 w-3 ml-1 opacity-50" />}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <div className="text-xs">
            <p className="font-medium">Score: {score}%</p>
            <p>Confidence: {confidence}%</p>
            {notes && <p className="text-muted-foreground mt-1">{notes}</p>}
            {webSearchUsed && <p className="text-blue-500 mt-1">Via Web Search</p>}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function PriorityBadge({ priority }: { priority: RequirementMatch['priority'] }) {
  const variants = {
    'must-have': 'bg-red-100 text-red-800 border-red-200',
    'should-have': 'bg-yellow-100 text-yellow-800 border-yellow-200',
    'nice-to-have': 'bg-slate-100 text-slate-600 border-slate-200',
  };

  const labels = {
    'must-have': 'Muss',
    'should-have': 'Soll',
    'nice-to-have': 'Kann',
  };

  return (
    <Badge variant="outline" className={`text-xs ${variants[priority]}`}>
      {labels[priority]}
    </Badge>
  );
}

export function CMSEvaluationMatrix({
  result,
  onSelectCMS,
  selectedCMS,
  isLoading,
  onResearchRequirement,
  researchingCell,
}: CMSEvaluationMatrixProps) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(['functional', 'technical'])
  );

  // Group requirements by category
  const requirementsByCategory = result.requirements.reduce(
    (acc, req) => {
      if (!acc[req.category]) {
        acc[req.category] = [];
      }
      acc[req.category].push(req);
      return acc;
    },
    {} as Record<string, RequirementMatch[]>
  );

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-600 mb-4" />
          <p className="text-muted-foreground">CMS-Evaluation läuft...</p>
          <p className="text-sm text-muted-foreground mt-2">
            Anforderungen werden gegen verfügbare CMS-Systeme gematched
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Recommendation Header */}
      <Card className="border-green-200 bg-green-50">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-green-600" />
            <CardTitle className="text-lg text-green-800">CMS-Empfehlung</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-green-900">
                {result.recommendation.primaryCms}
              </p>
              <p className="text-sm text-green-700 mt-1">{result.recommendation.reasoning}</p>
              {result.recommendation.alternativeCms && (
                <p className="text-xs text-green-600 mt-2">
                  Alternative: {result.recommendation.alternativeCms} -{' '}
                  {result.recommendation.alternativeReasoning}
                </p>
              )}
            </div>
            <div className="text-right">
              <div className="flex items-center gap-2">
                <Progress value={result.recommendation.confidence} className="h-3 w-32" />
                <span className="font-bold text-green-800">
                  {result.recommendation.confidence}%
                </span>
              </div>
              <p className="text-xs text-green-600 mt-1">Confidence</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* CMS Comparison Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">CMS-Vergleich</CardTitle>
          <CardDescription>
            {result.metadata.totalRequirements} Anforderungen, davon {result.metadata.mustHaveCount}{' '}
            Must-Have
            {result.metadata.webSearchUsed && ' (mit Web Search)'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {result.comparedTechnologies.map(cms => (
              <button
                key={cms.id}
                onClick={() => onSelectCMS?.(cms.id)}
                className={`p-4 rounded-lg border-2 transition-all text-left ${
                  selectedCMS === cms.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-slate-200 hover:border-slate-300'
                } ${cms.id === result.comparedTechnologies[0].id ? 'ring-2 ring-green-500 ring-offset-2' : ''}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">{cms.name}</span>
                  {cms.isBaseline && (
                    <Badge variant="secondary" className="text-xs">
                      Baseline
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Progress value={cms.overallScore} className="h-2 flex-1" />
                  <span
                    className={`text-sm font-bold ${getScoreColor(cms.overallScore).split(' ')[0]}`}
                  >
                    {cms.overallScore}%
                  </span>
                </div>
                {cms.id === result.comparedTechnologies[0].id && (
                  <div className="flex items-center gap-1 mt-2 text-green-600 text-xs">
                    <TrendingUp className="h-3 w-3" />
                    Beste Übereinstimmung
                  </div>
                )}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Requirements Matrix */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Anforderungs-Matrix</CardTitle>
          <CardDescription>Detaillierter Vergleich aller erkannten Anforderungen</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[200px]">Anforderung</TableHead>
                  <TableHead className="w-20">Priorität</TableHead>
                  {result.comparedTechnologies.map(cms => (
                    <TableHead key={cms.id} className="text-center min-w-[100px]">
                      {cms.name}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.entries(requirementsByCategory).map(([category, requirements]) => (
                  <Fragment key={category}>
                    {/* Category Header */}
                    <TableRow
                      className="bg-slate-50 cursor-pointer hover:bg-slate-100"
                      onClick={() => toggleCategory(category)}
                    >
                      <TableCell colSpan={2 + result.comparedTechnologies.length}>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            {REQUIREMENT_CATEGORIES[category as keyof typeof REQUIREMENT_CATEGORIES]
                              ?.label || category}
                          </span>
                          <Badge variant="outline" className="text-xs">
                            {requirements.length}
                          </Badge>
                          <span className="text-xs text-muted-foreground ml-auto">
                            {expandedCategories.has(category) ? 'Einklappen' : 'Ausklappen'}
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>

                    {/* Requirements in Category */}
                    {expandedCategories.has(category) &&
                      requirements.map((req, idx) => (
                        <TableRow key={`${category}-${idx}`}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span className="text-sm">{req.requirement}</span>
                              {req.source === 'researched' && (
                                <Search className="h-3 w-3 text-blue-500" />
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <PriorityBadge priority={req.priority} />
                          </TableCell>
                          {result.comparedTechnologies.map(cms => {
                            const scoreData = req.cmsScores[cms.id];
                            const cellKey = `${cms.id}-${req.requirement}`;
                            return (
                              <TableCell key={cms.id} className="text-center">
                                {scoreData ? (
                                  <ScoreCell
                                    score={scoreData.score}
                                    confidence={scoreData.confidence}
                                    notes={scoreData.notes}
                                    webSearchUsed={scoreData.webSearchUsed}
                                    onResearch={
                                      onResearchRequirement
                                        ? () => onResearchRequirement(cms.id, req.requirement)
                                        : undefined
                                    }
                                    isResearching={researchingCell === cellKey}
                                  />
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      ))}
                  </Fragment>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Metadata */}
      <Card className="bg-slate-50">
        <CardContent className="py-4">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <div className="flex items-center gap-4">
              <span>Evaluiert: {new Date(result.metadata.matchedAt).toLocaleString('de-DE')}</span>
              {result.metadata.webSearchUsed && (
                <span className="flex items-center gap-1 text-blue-600">
                  <Search className="h-3 w-3" />
                  Mit Web Search
                </span>
              )}
            </div>
            <div>Durchschnittlicher Match-Score: {result.metadata.averageMatchScore}%</div>
          </div>
        </CardContent>
      </Card>

      {/* Selection Button */}
      {onSelectCMS && (
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="py-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-orange-900">CMS auswählen</h3>
                <p className="text-sm text-orange-700">
                  {selectedCMS
                    ? `Ausgewählt: ${result.comparedTechnologies.find(c => c.id === selectedCMS)?.name}`
                    : 'Wählen Sie das CMS für dieses Projekt'}
                </p>
              </div>
              <Button disabled={!selectedCMS} className="bg-orange-600 hover:bg-orange-700">
                Mit{' '}
                {selectedCMS
                  ? result.comparedTechnologies.find(c => c.id === selectedCMS)?.name
                  : 'CMS'}{' '}
                fortfahren
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
