'use client';

import { Loader2, Play, RefreshCw, CheckCircle2, AlertCircle, Info, Zap } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { AgentEventType, type AgentEvent } from '@/lib/streaming/event-types';

interface MatrixCell {
  requirement: string;
  cmsId: string;
  cmsName: string;
  result?: {
    score: number;
    confidence: number;
    notes: string;
    supported: boolean;
    evidence: string[];
    sources: string[];
  };
  status: 'pending' | 'running' | 'complete' | 'cached' | 'error';
}

interface RequirementMatrix {
  requirements: Array<{
    name: string;
    category: string;
    priority: string;
    source: string;
  }>;
  technologies: Array<{
    id: string;
    name: string;
    isBaseline: boolean;
  }>;
  cells: MatrixCell[];
  metadata: {
    totalCells: number;
    completedCells: number;
    cachedCells: number;
    averageScore: number;
    startedAt: string;
    completedAt?: string;
    durationMs?: number;
  };
}

interface RequirementsMatrixProps {
  rfpId: string;
  initialMatrix?: RequirementMatrix | null;
}

/**
 * Score-basierte Farbcodierung
 */
function getScoreColor(score: number): string {
  if (score >= 80) return 'bg-green-500/20 text-green-700 border-green-300';
  if (score >= 60) return 'bg-lime-500/20 text-lime-700 border-lime-300';
  if (score >= 40) return 'bg-amber-500/20 text-amber-700 border-amber-300';
  if (score >= 20) return 'bg-orange-500/20 text-orange-700 border-orange-300';
  return 'bg-red-500/20 text-red-700 border-red-300';
}

/**
 * Priority Badge
 */
function PriorityBadge({ priority }: { priority: string }) {
  const colors: Record<string, string> = {
    'must-have': 'bg-red-500/10 text-red-700 border-red-200',
    'should-have': 'bg-amber-500/10 text-amber-700 border-amber-200',
    'nice-to-have': 'bg-blue-500/10 text-blue-700 border-blue-200',
  };

  const labels: Record<string, string> = {
    'must-have': 'M',
    'should-have': 'S',
    'nice-to-have': 'N',
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger>
          <Badge variant="outline" className={`${colors[priority] || ''} text-xs px-1.5`}>
            {labels[priority] || '?'}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          {priority === 'must-have' && 'Must-Have: Kritische Anforderung'}
          {priority === 'should-have' && 'Should-Have: Wichtige Anforderung'}
          {priority === 'nice-to-have' && 'Nice-to-Have: Optionale Anforderung'}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * Matrix Cell Component
 */
function MatrixCellDisplay({ cell }: { cell: MatrixCell | undefined }) {
  if (!cell) {
    return <div className="text-muted-foreground text-center">-</div>;
  }

  if (cell.status === 'running') {
    return (
      <div className="flex items-center justify-center">
        <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
      </div>
    );
  }

  if (cell.status === 'pending') {
    return <div className="text-muted-foreground text-center">...</div>;
  }

  if (cell.status === 'error') {
    return (
      <div className="flex items-center justify-center">
        <AlertCircle className="h-4 w-4 text-red-500" />
      </div>
    );
  }

  if (!cell.result) {
    return <div className="text-muted-foreground text-center">-</div>;
  }

  const { score, confidence, notes, evidence } = cell.result;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger className="w-full">
          <div
            className={`px-2 py-1 rounded border text-center font-medium ${getScoreColor(score)}`}
          >
            {score}
            {cell.status === 'cached' && (
              <Zap className="inline-block h-3 w-3 ml-1 text-amber-500" />
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <div className="space-y-1.5">
            <p className="font-medium">{notes}</p>
            <p className="text-xs text-muted-foreground">Confidence: {confidence}%</p>
            {evidence && evidence.length > 0 && (
              <div className="text-xs">
                <p className="font-medium">Evidenz:</p>
                <ul className="list-disc list-inside">
                  {evidence.map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * Requirements Matrix Component
 *
 * Zeigt die Anforderungsmatrix mit CMS-Vergleich
 */
export function RequirementsMatrix({ rfpId, initialMatrix }: RequirementsMatrixProps) {
  const [matrix, setMatrix] = useState<RequirementMatrix | null>(initialMatrix || null);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');

  // Load existing matrix on mount
  useEffect(() => {
    if (!initialMatrix) {
      void loadMatrix();
    }
  }, [rfpId, initialMatrix]);

  const loadMatrix = async () => {
    try {
      const res = await fetch(`/api/pre-qualifications/${rfpId}/cms-matrix/stream`);
      if (res.ok) {
        const data = await res.json();
        if (data.matrix) {
          setMatrix(data.matrix);
        }
      }
    } catch (error) {
      console.error('Error loading matrix:', error);
    }
  };

  const startResearch = useCallback(async () => {
    setIsLoading(true);
    setProgress(0);
    setStatusMessage('Starte Matrix-Recherche...');

    try {
      const res = await fetch(`/api/pre-qualifications/${rfpId}/cms-matrix/stream`, {
        method: 'POST',
      });

      if (!res.ok) {
        throw new Error('Failed to start research');
      }

      const reader = res.body?.getReader();
      if (!reader) return;

      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const event: AgentEvent = JSON.parse(line.slice(6));

              // Update UI based on event
              if (event.type === AgentEventType.AGENT_PROGRESS) {
                const data = event.data as { message?: string };
                setStatusMessage(data.message || '');

                // Extract progress percentage if available
                const progressMatch = data.message?.match(/(\d+)%/);
                if (progressMatch) {
                  setProgress(parseInt(progressMatch[1], 10));
                }
              }

              if (event.type === AgentEventType.COMPLETE) {
                const data = event.data as { result?: { matrix?: RequirementMatrix } };
                if (data.result?.matrix) {
                  setMatrix(data.result.matrix);
                }
                setProgress(100);
              }
            } catch {
              // Ignore parse errors
            }
          }
        }
      }
    } catch (error) {
      console.error('Error during research:', error);
      setStatusMessage('Fehler bei der Recherche');
    } finally {
      setIsLoading(false);
    }
  }, [rfpId]);

  // Calculate overall scores per CMS
  const cmsScores = matrix?.technologies.map(tech => {
    const techCells = matrix.cells.filter(c => c.cmsId === tech.id && c.result);

    const totalScore = techCells.reduce((sum, c) => sum + (c.result?.score || 0), 0);
    const avgScore = techCells.length > 0 ? Math.round(totalScore / techCells.length) : 0;

    return { ...tech, avgScore };
  });

  // Sort by average score
  cmsScores?.sort((a, b) => b.avgScore - a.avgScore);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Info className="h-5 w-5" />
              Anforderungsmatrix
            </CardTitle>
            <CardDescription>
              Parallele CMS-Recherche für alle erkannten Anforderungen
            </CardDescription>
          </div>
          <Button
            onClick={startResearch}
            disabled={isLoading}
            variant={matrix ? 'outline' : 'default'}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Recherchiere...
              </>
            ) : matrix ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Neu recherchieren
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Matrix starten
              </>
            )}
          </Button>
        </div>

        {isLoading && (
          <div className="mt-4 space-y-2">
            <Progress value={progress} className="h-2" />
            <p className="text-sm text-muted-foreground">{statusMessage}</p>
          </div>
        )}

        {matrix && !isLoading && (
          <div className="mt-4 flex items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              {matrix.metadata.completedCells} Kombinationen
            </span>
            {matrix.metadata.cachedCells > 0 && (
              <span className="flex items-center gap-1">
                <Zap className="h-4 w-4 text-amber-500" />
                {matrix.metadata.cachedCells} aus Cache
              </span>
            )}
            {matrix.metadata.durationMs && (
              <span>{Math.round(matrix.metadata.durationMs / 1000)}s Recherche</span>
            )}
          </div>
        )}
      </CardHeader>

      <CardContent>
        {!matrix && !isLoading && (
          <div className="text-center py-12 text-muted-foreground">
            <Info className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Noch keine Matrix-Recherche durchgeführt.</p>
            <p className="text-sm">Klicke auf "Matrix starten" um parallele Agenten zu starten.</p>
          </div>
        )}

        {matrix && (
          <div className="space-y-6">
            {/* CMS Ranking */}
            {cmsScores && cmsScores.length > 0 && (
              <div className="flex flex-wrap gap-3">
                {cmsScores.map((cms, index) => (
                  <div
                    key={cms.id}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${
                      index === 0 ? 'bg-green-50 border-green-200' : 'bg-muted/50'
                    }`}
                  >
                    <span className="font-medium text-lg">{index + 1}.</span>
                    <span className="font-medium">{cms.name}</span>
                    {cms.isBaseline && (
                      <Badge variant="secondary" className="text-xs">
                        Baseline
                      </Badge>
                    )}
                    <Badge variant="outline" className={`${getScoreColor(cms.avgScore)} font-mono`}>
                      {cms.avgScore}%
                    </Badge>
                  </div>
                ))}
              </div>
            )}

            {/* Matrix Table */}
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[200px]">Anforderung</TableHead>
                    <TableHead className="w-10">Prio</TableHead>
                    {matrix.technologies.map(tech => (
                      <TableHead key={tech.id} className="text-center min-w-[100px]">
                        {tech.name}
                        {tech.isBaseline && (
                          <Badge variant="secondary" className="ml-1 text-xs">
                            B
                          </Badge>
                        )}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {matrix.requirements.map(req => (
                    <TableRow key={req.name}>
                      <TableCell className="font-medium">{req.name}</TableCell>
                      <TableCell>
                        <PriorityBadge priority={req.priority} />
                      </TableCell>
                      {matrix.technologies.map(tech => {
                        const cell = matrix.cells.find(
                          c => c.requirement === req.name && c.cmsId === tech.id
                        );
                        return (
                          <TableCell key={tech.id} className="text-center p-2">
                            <MatrixCellDisplay cell={cell} />
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <div className={`w-4 h-4 rounded ${getScoreColor(90)}`} />
                80-100: Exzellent
              </span>
              <span className="flex items-center gap-1">
                <div className={`w-4 h-4 rounded ${getScoreColor(70)}`} />
                60-79: Gut
              </span>
              <span className="flex items-center gap-1">
                <div className={`w-4 h-4 rounded ${getScoreColor(50)}`} />
                40-59: Mittel
              </span>
              <span className="flex items-center gap-1">
                <div className={`w-4 h-4 rounded ${getScoreColor(30)}`} />
                20-39: Schwach
              </span>
              <span className="flex items-center gap-1">
                <div className={`w-4 h-4 rounded ${getScoreColor(10)}`} />
                0-19: Kritisch
              </span>
              <span className="flex items-center gap-1">
                <Zap className="h-4 w-4 text-amber-500" />
                Aus Cache
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
