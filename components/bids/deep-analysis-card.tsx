'use client';

import {
  Loader2,
  Play,
  CheckCircle2,
  XCircle,
  FileText,
  Accessibility,
  Clock,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Progress } from '@/components/ui/progress';

interface DeepAnalysisCardProps {
  bidId: string;
  websiteUrl: string | null;
  existingAnalysis?: {
    id: string;
    status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
    contentArchitecture?: string | null;
    migrationComplexity?: string | null;
    accessibilityAudit?: string | null;
    ptEstimation?: string | null;
    errorMessage?: string | null;
    startedAt?: Date | null;
    completedAt?: Date | null;
  } | null;
}

export function DeepAnalysisCard({ bidId, websiteUrl, existingAnalysis }: DeepAnalysisCardProps) {
  const router = useRouter();
  const [isStarting, setIsStarting] = useState(false);
  const [analysis, setAnalysis] = useState(existingAnalysis);
  const [isPolling, setIsPolling] = useState(existingAnalysis?.status === 'running');
  const [contentOpen, setContentOpen] = useState(false);
  const [complexityOpen, setComplexityOpen] = useState(false);
  const [accessibilityOpen, setAccessibilityOpen] = useState(false);

  // Poll for status updates when running
  useEffect(() => {
    if (!isPolling || !analysis) return;

    const pollInterval = setInterval(() => {
      void (async () => {
        try {
          const response = await fetch(`/api/pre-qualifications/${bidId}/deep-analysis/status`);
          const result = await response.json();

          if (result.success && result.analysis) {
            setAnalysis(result.analysis);

            if (result.analysis.status === 'completed') {
              setIsPolling(false);
              toast.success('Deep Analysis abgeschlossen!');
              router.refresh();
            } else if (result.analysis.status === 'failed') {
              setIsPolling(false);
              toast.error('Deep Analysis fehlgeschlagen');
            }
          }
        } catch (error) {
          console.error('Error polling analysis status:', error);
        }
      })();
    }, 3000);

    return () => clearInterval(pollInterval);
  }, [isPolling, analysis, bidId, router]);

  const handleStartAnalysis = async () => {
    if (!websiteUrl) {
      toast.error('Keine Website-URL vorhanden - Deep Analysis nicht möglich');
      return;
    }

    setIsStarting(true);
    toast.info('Starte Deep Analysis - dies dauert ca. 25-30 Minuten...');

    try {
      const response = await fetch(`/api/pre-qualifications/${bidId}/deep-analysis/trigger`, {
        method: 'POST',
      });

      const result = await response.json();

      if (result.success) {
        toast.success('Deep Analysis gestartet!');
        setIsPolling(true);
        // Fetch initial status
        const statusResponse = await fetch(`/api/pre-qualifications/${bidId}/deep-analysis/status`);
        const statusResult = await statusResponse.json();
        if (statusResult.success && statusResult.analysis) {
          setAnalysis(statusResult.analysis);
        }
      } else {
        toast.error(result.error || 'Konnte Deep Analysis nicht starten');
      }
    } catch (error) {
      toast.error('Ein Fehler ist aufgetreten');
    } finally {
      setIsStarting(false);
    }
  };

  // Parse JSON results safely
  const parseResult = <T,>(json: string | null | undefined): T | null => {
    if (!json) return null;
    try {
      return JSON.parse(json) as T;
    } catch {
      return null;
    }
  };

  const contentArchitecture = parseResult<{
    totalPages: number;
    paragraphEstimate: number;
    pageTypes: Array<{ type: string; count: number }>;
    contentTypeMapping: Array<{ pageType: string; drupalContentType: string; confidence: number }>;
  }>(analysis?.contentArchitecture);

  const migrationComplexity = parseResult<{
    score: number;
    factors: {
      sourceCMSType: string;
      hasStandardExport: boolean;
      apiAvailable: boolean;
      contentTypeCount: number;
      customPlugins: number;
      thirdPartyIntegrations: number;
    };
    exportCapabilities: {
      restAPI: boolean;
      xmlExport: boolean;
      cliTool: boolean;
      databaseAccess: boolean;
    };
    dataQuality: {
      brokenLinks: number;
      duplicateContent: boolean;
      inconsistentStructure: boolean;
    };
  }>(analysis?.migrationComplexity);

  const accessibilityAudit = parseResult<{
    wcagLevel: string;
    overallScore: number;
    pagesAudited: number;
    violations: Array<{ id: string; impact: string; count: number; description: string }>;
  }>(analysis?.accessibilityAudit);

  const ptEstimation = parseResult<{
    totalHours: number;
    confidence: number;
    breakdown: {
      baselineHours: number;
      contentTypeHours: number;
      paragraphHours: number;
      complexityMultiplier: number;
      bufferHours: number;
    };
    assumptions: string[];
  }>(analysis?.ptEstimation);

  // No analysis yet - show start button
  if (!analysis) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Deep Migration Analysis
          </CardTitle>
          <CardDescription>
            Detaillierte Analyse der Migration: Content-Architektur, Komplexität, Barrierefreiheit
            und PT-Schätzung
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!websiteUrl ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
              Keine Website-URL vorhanden. Deep Analysis benötigt eine Website zum Crawlen.
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Die Deep Analysis crawlt die Website und analysiert:
              </p>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>• Content-Architektur und Page-Types</li>
                <li>• Migration-Komplexität und Export-Möglichkeiten</li>
                <li>• Barrierefreiheit (WCAG 2.1)</li>
                <li>• PT-Schätzung basierend auf Baseline</li>
              </ul>
              <Button onClick={handleStartAnalysis} disabled={isStarting}>
                {isStarting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Wird gestartet...
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" />
                    Deep Analysis starten
                  </>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // Running state
  if (analysis.status === 'running' || analysis.status === 'pending') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            Deep Analysis läuft
          </CardTitle>
          <CardDescription>Bitte warten - dies dauert ca. 25-30 Minuten</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              {contentArchitecture ? (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              ) : (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              <span className={contentArchitecture ? 'text-green-700' : ''}>
                Content-Architektur
              </span>
            </div>
            <div className="flex items-center gap-2">
              {migrationComplexity ? (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              ) : (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              )}
              <span className={migrationComplexity ? 'text-green-700' : 'text-muted-foreground'}>
                Migration-Komplexität
              </span>
            </div>
            <div className="flex items-center gap-2">
              {accessibilityAudit ? (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              ) : (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              )}
              <span className={accessibilityAudit ? 'text-green-700' : 'text-muted-foreground'}>
                Barrierefreiheit
              </span>
            </div>
            <div className="flex items-center gap-2">
              {ptEstimation ? (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              ) : (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              )}
              <span className={ptEstimation ? 'text-green-700' : 'text-muted-foreground'}>
                PT-Schätzung
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Failed state
  if (analysis.status === 'failed') {
    return (
      <Card className="border-red-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-700">
            <XCircle className="h-5 w-5" />
            Deep Analysis fehlgeschlagen
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-red-600">{analysis.errorMessage || 'Unbekannter Fehler'}</p>
          <Button onClick={handleStartAnalysis} disabled={isStarting} variant="outline">
            {isStarting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Wird gestartet...
              </>
            ) : (
              <>
                <Play className="mr-2 h-4 w-4" />
                Erneut starten
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Completed state - show results
  return (
    <div className="space-y-4">
      {/* Header with re-trigger button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-green-600" />
          <h3 className="text-lg font-semibold">Deep Analysis Ergebnisse</h3>
        </div>
        <Button variant="outline" size="sm" onClick={handleStartAnalysis} disabled={isStarting}>
          {isStarting ? (
            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
          ) : (
            <RotateCcw className="h-4 w-4 mr-1" />
          )}
          Erneut analysieren
        </Button>
      </div>

      {/* PT Estimation Summary */}
      {ptEstimation && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              PT-Schätzung
            </CardTitle>
            <CardDescription>Geschätzte Personentage für die Migration</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="text-center">
                <p className="text-4xl font-bold text-primary">
                  {Math.round(ptEstimation.totalHours / 8)}
                </p>
                <p className="text-sm text-muted-foreground">Personentage</p>
              </div>
              <div className="text-center">
                <p className="text-4xl font-bold">{ptEstimation.totalHours}h</p>
                <p className="text-sm text-muted-foreground">Gesamtstunden</p>
              </div>
              <div className="text-center">
                <p className="text-4xl font-bold">{ptEstimation.confidence}%</p>
                <p className="text-sm text-muted-foreground">Konfidenz</p>
              </div>
            </div>

            <div className="mt-4 space-y-2">
              <p className="text-sm font-medium">Aufschlüsselung:</p>
              <div className="grid gap-2 md:grid-cols-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Baseline:</span>
                  <span>{ptEstimation.breakdown.baselineHours}h</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Content Types:</span>
                  <span>{ptEstimation.breakdown.contentTypeHours}h</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Paragraphs:</span>
                  <span>{ptEstimation.breakdown.paragraphHours}h</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Buffer:</span>
                  <span>{ptEstimation.breakdown.bufferHours}h</span>
                </div>
              </div>
            </div>

            {ptEstimation.assumptions.length > 0 && (
              <div className="mt-4">
                <p className="text-sm font-medium mb-2">Annahmen:</p>
                <ul className="text-sm text-muted-foreground space-y-1">
                  {ptEstimation.assumptions.map((assumption, i) => (
                    <li key={i}>• {assumption}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Content Architecture */}
      {contentArchitecture && (
        <Collapsible open={contentOpen} onOpenChange={setContentOpen}>
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    <CardTitle>Content-Architektur</CardTitle>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex gap-2">
                      <Badge variant="secondary">{contentArchitecture.totalPages} Seiten</Badge>
                      <Badge variant="secondary">
                        {contentArchitecture.contentTypeMapping.length} Content Types
                      </Badge>
                      <Badge variant="secondary">
                        {contentArchitecture.paragraphEstimate} Paragraphs
                      </Badge>
                    </div>
                    {contentOpen ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </div>
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm font-medium mb-2">Page Types:</p>
                  <div className="space-y-2">
                    {contentArchitecture.pageTypes.map((pt, i) => (
                      <div key={i} className="flex justify-between text-sm">
                        <span>{pt.type}</span>
                        <Badge variant="outline">{pt.count}</Badge>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-sm font-medium mb-2">Content Type Mapping:</p>
                  <div className="space-y-2">
                    {contentArchitecture.contentTypeMapping.map((mapping, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between text-sm p-2 rounded bg-muted/50"
                      >
                        <span>{mapping.pageType}</span>
                        <span className="text-muted-foreground">→</span>
                        <span className="font-medium">{mapping.drupalContentType}</span>
                        <Badge variant={mapping.confidence >= 80 ? 'default' : 'secondary'}>
                          {mapping.confidence}%
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}

      {/* Migration Complexity */}
      {migrationComplexity && (
        <Collapsible open={complexityOpen} onOpenChange={setComplexityOpen}>
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    <CardTitle>Migration-Komplexität</CardTitle>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Score:</span>
                      <Badge
                        variant={
                          migrationComplexity.score >= 70
                            ? 'destructive'
                            : migrationComplexity.score >= 40
                              ? 'secondary'
                              : 'default'
                        }
                      >
                        {migrationComplexity.score}/100
                      </Badge>
                    </div>
                    {complexityOpen ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </div>
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <p className="text-sm font-medium mb-2">Faktoren:</p>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Source CMS:</span>
                        <span className="capitalize">
                          {migrationComplexity.factors.sourceCMSType}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Content Types:</span>
                        <span>{migrationComplexity.factors.contentTypeCount}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Custom Plugins:</span>
                        <span>{migrationComplexity.factors.customPlugins}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">3rd Party Integrations:</span>
                        <span>{migrationComplexity.factors.thirdPartyIntegrations}</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <p className="text-sm font-medium mb-2">Export-Möglichkeiten:</p>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">REST API:</span>
                        <Badge
                          variant={
                            migrationComplexity.exportCapabilities.restAPI ? 'default' : 'secondary'
                          }
                        >
                          {migrationComplexity.exportCapabilities.restAPI ? 'Ja' : 'Nein'}
                        </Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">XML Export:</span>
                        <Badge
                          variant={
                            migrationComplexity.exportCapabilities.xmlExport
                              ? 'default'
                              : 'secondary'
                          }
                        >
                          {migrationComplexity.exportCapabilities.xmlExport ? 'Ja' : 'Nein'}
                        </Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">CLI Tool:</span>
                        <Badge
                          variant={
                            migrationComplexity.exportCapabilities.cliTool ? 'default' : 'secondary'
                          }
                        >
                          {migrationComplexity.exportCapabilities.cliTool ? 'Ja' : 'Nein'}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <p className="text-sm font-medium mb-2">Datenqualität:</p>
                  <div className="flex gap-2">
                    <Badge
                      variant={
                        migrationComplexity.dataQuality.brokenLinks > 10
                          ? 'destructive'
                          : 'secondary'
                      }
                    >
                      {migrationComplexity.dataQuality.brokenLinks} Broken Links
                    </Badge>
                    {migrationComplexity.dataQuality.duplicateContent && (
                      <Badge variant="destructive">Duplicate Content</Badge>
                    )}
                    {migrationComplexity.dataQuality.inconsistentStructure && (
                      <Badge variant="destructive">Inkonsistente Struktur</Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}

      {/* Accessibility Audit */}
      {accessibilityAudit && (
        <Collapsible open={accessibilityOpen} onOpenChange={setAccessibilityOpen}>
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Accessibility className="h-5 w-5" />
                    <CardTitle>Barrierefreiheit (WCAG)</CardTitle>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex gap-2">
                      <Badge variant="secondary">Level {accessibilityAudit.wcagLevel}</Badge>
                      <Badge
                        variant={
                          accessibilityAudit.overallScore >= 80
                            ? 'default'
                            : accessibilityAudit.overallScore >= 50
                              ? 'secondary'
                              : 'destructive'
                        }
                      >
                        {accessibilityAudit.overallScore}/100
                      </Badge>
                    </div>
                    {accessibilityOpen ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </div>
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4">
                  <Progress value={accessibilityAudit.overallScore} className="flex-1" />
                  <span className="text-sm font-medium">{accessibilityAudit.overallScore}%</span>
                </div>

                <p className="text-sm text-muted-foreground">
                  {accessibilityAudit.pagesAudited} Seiten analysiert
                </p>

                {accessibilityAudit.violations.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-2">Verstöße:</p>
                    <div className="space-y-2">
                      {accessibilityAudit.violations.map((violation, i) => (
                        <div key={i} className="p-2 rounded bg-muted/50 text-sm">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-medium">{violation.id}</span>
                            <div className="flex gap-2">
                              <Badge
                                variant={
                                  violation.impact === 'critical'
                                    ? 'destructive'
                                    : violation.impact === 'serious'
                                      ? 'destructive'
                                      : violation.impact === 'moderate'
                                        ? 'secondary'
                                        : 'outline'
                                }
                              >
                                {violation.impact}
                              </Badge>
                              <Badge variant="outline">{violation.count}x</Badge>
                            </div>
                          </div>
                          <p className="text-muted-foreground">{violation.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {accessibilityAudit.violations.length === 0 && (
                  <div className="flex items-center gap-2 text-green-700">
                    <CheckCircle2 className="h-4 w-4" />
                    <span className="text-sm">Keine kritischen Verstöße gefunden</span>
                  </div>
                )}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}
    </div>
  );
}
