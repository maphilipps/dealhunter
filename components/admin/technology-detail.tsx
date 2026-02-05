'use client';

import {
  ArrowLeft,
  RefreshCw,
  ExternalLink,
  Star,
  CheckCircle2,
  XCircle,
  Clock,
  Users,
  Target,
  Lightbulb,
  AlertTriangle,
  ThumbsUp,
  ThumbsDown,
  Search,
  HelpCircle,
} from 'lucide-react';

import { Loader } from '@/components/ai-elements/loader';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';

interface Technology {
  id: string;
  name: string;
  businessUnitId: string;
  baselineHours: number | null;
  baselineName: string | null;
  baselineEntityCounts: string | null;
  isDefault: boolean;
  createdAt: Date | null;
  updatedAt: Date | null;
  // Extended metadata
  logoUrl: string | null;
  websiteUrl: string | null;
  description: string | null;
  category: string | null;
  license: string | null;
  latestVersion: string | null;
  githubUrl: string | null;
  githubStars: number | null;
  lastRelease: string | null;
  communitySize: string | null;
  pros: string | null;
  cons: string | null;
  usps: string | null;
  targetAudiences: string | null;
  useCases: string | null;
  adessoExpertise: string | null;
  adessoReferenceCount: number | null;
  lastResearchedAt: Date | null;
  researchStatus: string | null;
  // Feature Support (auto-researched via CMS Evaluation)
  features: string | null;
}

interface TechnologyDetailProps {
  technology: Technology;
}

interface FeatureData {
  score: number;
  confidence: number;
  notes: string;
  researchedAt?: string;
  supportType?:
    | 'native'
    | 'module'
    | 'extension'
    | 'contrib'
    | 'third-party'
    | 'custom'
    | 'unknown';
  moduleName?: string;
  sourceUrls?: string[];
  reasoning?: string;
}

interface FeatureResearchResult {
  name: string;
  score: number;
}

interface FeatureResearchSummary {
  total: number;
  successful: number;
  failed: number;
}

interface FeatureResearchResponse {
  success: boolean;
  error?: string;
  summary: FeatureResearchSummary;
  results: FeatureResearchResult[];
  allFeatures: Record<string, FeatureData>;
}

interface OrchestratorEventData {
  agent: string;
  message: string;
  metadata?: {
    successfulResearch: number;
    featuresImproved: number;
    featuresFlagged: number;
    overallConfidence: number;
  };
  result?: {
    tasks: unknown[];
    metadata: {
      successfulResearch: number;
      featuresImproved: number;
      featuresFlagged: number;
      overallConfidence: number;
    };
  };
}

interface SSEEvent {
  type: string;
  timestamp: number;
  data: OrchestratorEventData;
}

interface FeatureReviewReview {
  featuresImproved: number;
  featuresFlagged: number;
  overallConfidence: number;
}

interface FeatureReviewResponse {
  success: boolean;
  error?: string;
  review: FeatureReviewReview;
  updatedFeatures: Record<string, FeatureData>;
}

export function TechnologyDetail({ technology }: TechnologyDetailProps) {
  const router = useRouter();
  const [isResearching, setIsResearching] = useState(false);
  const [featurePrompt, setFeaturePrompt] = useState('');
  const [isResearchingFeature, setIsResearchingFeature] = useState(false);
  const [isReviewingFeatures, setIsReviewingFeatures] = useState(false);
  const [localFeatures, setLocalFeatures] = useState<Record<string, FeatureData> | null>(null);
  const [lastReviewResult, setLastReviewResult] = useState<{
    featuresImproved: number;
    featuresFlagged: number;
    overallConfidence: number;
  } | null>(null);

  // Orchestrator State
  const [isOrchestratorRunning, setIsOrchestratorRunning] = useState(false);
  const [orchestratorEvents, setOrchestratorEvents] = useState<
    Array<{
      agent: string;
      message: string;
      timestamp: number;
      type: string;
    }>
  >([]);

  const handleResearch = async () => {
    setIsResearching(true);
    toast.info(`Starte AI-Recherche für ${technology.name}...`);

    try {
      const response = await fetch(`/api/admin/technologies/${technology.id}/research`, {
        method: 'POST',
      });

      const result = (await response.json()) as { success: boolean; error?: string };

      if (result.success) {
        toast.success('Recherche abgeschlossen');
        router.refresh();
      } else {
        toast.error(result.error || 'Recherche fehlgeschlagen');
      }
    } catch (error) {
      toast.error('Fehler bei der AI-Recherche');
      console.error('Research error:', error);
    } finally {
      setIsResearching(false);
    }
  };

  const handleFeatureResearch = async () => {
    if (!featurePrompt.trim()) {
      toast.error('Bitte Feature-Namen eingeben');
      return;
    }

    // Parse Features: Komma, Semikolon oder Newline getrennt
    const featureNames = featurePrompt
      .split(/[,;\n]+/)
      .map(f => f.trim())
      .filter(Boolean);

    if (featureNames.length === 0) {
      toast.error('Keine gültigen Feature-Namen gefunden');
      return;
    }

    setIsResearchingFeature(true);

    if (featureNames.length === 1) {
      toast.info(`Recherchiere "${featureNames[0]}" für ${technology.name}...`);
    } else {
      toast.info(`Recherchiere ${featureNames.length} Features parallel für ${technology.name}...`);
    }

    try {
      const response = await fetch(`/api/admin/technologies/${technology.id}/research-feature`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ featureNames }),
      });

      const result = (await response.json()) as FeatureResearchResponse;

      if (result.success) {
        const { summary } = result;
        if (summary.total === 1) {
          const feature = result.results[0];
          toast.success(`Feature "${feature.name}" recherchiert: ${feature.score}%`);
        } else {
          toast.success(`${summary.successful}/${summary.total} Features erfolgreich recherchiert`);
          if (summary.failed > 0) {
            toast.warning(`${summary.failed} Features fehlgeschlagen`);
          }
        }
        setLocalFeatures(result.allFeatures);
        setFeaturePrompt('');
      } else {
        toast.error(result.error || 'Recherche fehlgeschlagen');
      }
    } catch (error) {
      toast.error('Fehler bei der Feature-Recherche');
      console.error('Feature research error:', error);
    } finally {
      setIsResearchingFeature(false);
    }
  };

  // Orchestrator: Research + Review in einem Workflow
  const handleOrchestratorResearch = async (reviewMode: 'quick' | 'deep' = 'quick') => {
    if (!featurePrompt.trim()) {
      toast.error('Bitte Feature-Namen eingeben');
      return;
    }

    const featureNames = featurePrompt
      .split(/[,;\n]+/)
      .map(f => f.trim())
      .filter(Boolean);

    if (featureNames.length === 0) {
      toast.error('Keine gültigen Feature-Namen gefunden');
      return;
    }

    setIsOrchestratorRunning(true);
    setOrchestratorEvents([]);
    toast.info(
      `Orchestrator startet: ${featureNames.length} Features recherchieren + ${reviewMode} Review`
    );

    try {
      const response = await fetch(`/api/admin/technologies/${technology.id}/orchestrator`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          featureNames,
          autoReview: true,
          reviewMode,
        }),
      });

      if (!response.ok) {
        throw new Error('Orchestrator-Start fehlgeschlagen');
      }

      // SSE Stream lesen
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('Stream nicht verfügbar');
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const event = JSON.parse(line.slice(6)) as SSEEvent;
              if (event.data?.agent && event.data?.message) {
                setOrchestratorEvents(prev => [
                  ...prev,
                  {
                    agent: event.data.agent,
                    message: event.data.message,
                    timestamp: event.timestamp,
                    type: event.type,
                  },
                ]);
              }

              // Bei AGENT_COMPLETE mit result: Features aktualisieren
              if (event.type === 'agent-complete' && event.data?.result?.tasks) {
                const result = event.data.result;
                toast.success(
                  `Workflow abgeschlossen: ${result.metadata.successfulResearch} recherchiert, ${result.metadata.featuresImproved} verbessert`
                );

                // Reload features
                const techResponse = await fetch(`/api/admin/technologies/${technology.id}`);
                if (techResponse.ok) {
                  const techData = (await techResponse.json()) as { features?: string };
                  if (techData.features) {
                    setLocalFeatures(JSON.parse(techData.features));
                  }
                }

                setLastReviewResult({
                  featuresImproved: result.metadata.featuresImproved,
                  featuresFlagged: result.metadata.featuresFlagged,
                  overallConfidence: result.metadata.overallConfidence,
                });
              }
            } catch {
              // Ignore parse errors
            }
          }
        }
      }

      setFeaturePrompt('');
      router.refresh();
    } catch (error) {
      toast.error('Orchestrator fehlgeschlagen');
      console.error('Orchestrator error:', error);
    } finally {
      setIsOrchestratorRunning(false);
    }
  };

  const handleReviewFeatures = async (mode: 'quick' | 'deep' = 'quick') => {
    setIsReviewingFeatures(true);
    toast.info(`Starte ${mode === 'deep' ? 'Deep' : 'Quick'} Review der Features...`);

    try {
      const response = await fetch(`/api/admin/technologies/${technology.id}/review-features`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode }),
      });

      const result = (await response.json()) as FeatureReviewResponse;

      if (result.success) {
        const { review } = result;
        setLastReviewResult({
          featuresImproved: review.featuresImproved,
          featuresFlagged: review.featuresFlagged,
          overallConfidence: review.overallConfidence,
        });
        setLocalFeatures(result.updatedFeatures);

        if (review.featuresImproved > 0) {
          toast.success(`Review: ${review.featuresImproved} Features verbessert`);
        }
        if (review.featuresFlagged > 0) {
          toast.warning(`${review.featuresFlagged} Features zur manuellen Prüfung markiert`);
        }
        if (review.featuresImproved === 0 && review.featuresFlagged === 0) {
          toast.success('Alle Features OK - keine Korrekturen nötig');
        }
      } else {
        toast.error(result.error || 'Review fehlgeschlagen');
      }
    } catch (error) {
      toast.error('Fehler beim Feature-Review');
      console.error('Feature review error:', error);
    } finally {
      setIsReviewingFeatures(false);
    }
  };

  // Parse JSON fields safely
  const parseJsonArray = (json: string | null): string[] => {
    if (!json) return [];
    try {
      const parsed: unknown = JSON.parse(json);
      return parsed as string[];
    } catch {
      return [];
    }
  };

  const parseJsonObject = (json: string | null): Record<string, number> => {
    if (!json) return {};
    try {
      const parsed: unknown = JSON.parse(json);
      return parsed as Record<string, number>;
    } catch {
      return {};
    }
  };

  const parseFeatures = (json: string | null): Record<string, FeatureData> => {
    if (!json) return {};
    try {
      return JSON.parse(json) as Record<string, FeatureData>;
    } catch {
      return {};
    }
  };

  // Support-Type Badge Farben
  const getSupportTypeBadge = (type?: string, moduleName?: string) => {
    if (!type || type === 'unknown') return null;

    const config: Record<
      string,
      { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }
    > = {
      native: { label: 'Nativ', variant: 'default' },
      module: { label: moduleName ? `Modul: ${moduleName}` : 'Modul', variant: 'secondary' },
      contrib: { label: moduleName ? `Contrib: ${moduleName}` : 'Contrib', variant: 'secondary' },
      extension: { label: moduleName ? `Plugin: ${moduleName}` : 'Plugin', variant: 'secondary' },
      'third-party': { label: 'Drittanbieter', variant: 'outline' },
      custom: { label: 'Custom', variant: 'destructive' },
    };

    const cfg = config[type];
    if (!cfg) return null;

    return (
      <Badge variant={cfg.variant} className="text-xs">
        {cfg.label}
      </Badge>
    );
  };

  const pros = parseJsonArray(technology.pros);
  const cons = parseJsonArray(technology.cons);
  const usps = parseJsonArray(technology.usps);
  const targetAudiences = parseJsonArray(technology.targetAudiences);
  const useCases = parseJsonArray(technology.useCases);
  const entityCounts = parseJsonObject(technology.baselineEntityCounts);
  // Verwende localFeatures falls vorhanden (nach manueller Recherche), sonst aus Props
  const features = localFeatures ?? parseFeatures(technology.features);
  const hasBaseline = technology.baselineHours && technology.baselineHours > 0;
  const hasFeatures = Object.keys(features).length > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/master-data/technologies">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex items-center gap-4">
            {technology.logoUrl ? (
              <img
                src={technology.logoUrl}
                alt={`${technology.name} logo`}
                className="h-12 w-12 object-contain"
                onError={e => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            ) : (
              <div className="h-12 w-12 rounded bg-muted flex items-center justify-center text-lg font-medium">
                {technology.name.substring(0, 2).toUpperCase()}
              </div>
            )}
            <div>
              <h1 className="text-2xl font-bold">{technology.name}</h1>
              <div className="flex items-center gap-2 mt-1">
                {technology.category && <Badge variant="outline">{technology.category}</Badge>}
                {technology.latestVersion && (
                  <Badge variant="secondary">v{technology.latestVersion}</Badge>
                )}
                {technology.license && <Badge variant="secondary">{technology.license}</Badge>}
              </div>
            </div>
          </div>
        </div>
        <Button onClick={handleResearch} disabled={isResearching}>
          {isResearching ? (
            <>
              <Loader size="sm" className="mr-2" />
              Recherchiert...
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
              AI-Recherche
            </>
          )}
        </Button>
      </div>

      {/* Description */}
      {technology.description && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">{technology.description}</p>
          </CardContent>
        </Card>
      )}

      {/* Quick Info */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <ExternalLink className="h-4 w-4" />
              Website
            </div>
            {technology.websiteUrl ? (
              <a
                href={technology.websiteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline text-sm mt-1 block truncate"
              >
                {technology.websiteUrl}
              </a>
            ) : (
              <p className="text-sm mt-1 text-muted-foreground">Nicht verfügbar</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Star className="h-4 w-4" />
              GitHub Stars
            </div>
            <p className="text-lg font-semibold mt-1">
              {technology.githubStars?.toLocaleString() || '-'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="h-4 w-4" />
              Community
            </div>
            <p className="text-lg font-semibold mt-1 capitalize">
              {technology.communitySize || '-'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              Letztes Release
            </div>
            <p className="text-lg font-semibold mt-1">{technology.lastRelease || '-'}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Pros & Cons */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ThumbsUp className="h-5 w-5 text-green-500" />
              Vorteile
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pros.length > 0 ? (
              <ul className="space-y-2">
                {pros.map((pro, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                    {pro}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Keine Daten verfügbar</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ThumbsDown className="h-5 w-5 text-red-500" />
              Nachteile
            </CardTitle>
          </CardHeader>
          <CardContent>
            {cons.length > 0 ? (
              <ul className="space-y-2">
                {cons.map((con, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <XCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                    {con}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Keine Daten verfügbar</p>
            )}
          </CardContent>
        </Card>

        {/* USPs */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-yellow-500" />
              Unique Selling Points
            </CardTitle>
            <CardDescription>Für Verkaufsgespräche</CardDescription>
          </CardHeader>
          <CardContent>
            {usps.length > 0 ? (
              <ul className="space-y-2">
                {usps.map((usp, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span className="font-bold text-primary">{i + 1}.</span>
                    {usp}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Keine Daten verfügbar</p>
            )}
          </CardContent>
        </Card>

        {/* Target Audiences */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-blue-500" />
              Zielgruppen
            </CardTitle>
          </CardHeader>
          <CardContent>
            {targetAudiences.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {targetAudiences.map((audience, i) => (
                  <Badge key={i} variant="secondary">
                    {audience}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Keine Daten verfügbar</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Use Cases */}
      {useCases.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Typische Anwendungsfälle</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-2 md:grid-cols-2">
              {useCases.map((useCase, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  {useCase}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* adesso Expertise */}
      {technology.adessoExpertise && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle>adesso Expertise</CardTitle>
            <CardDescription>Positionierung und Kompetenz</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{technology.adessoExpertise}</p>
          </CardContent>
        </Card>
      )}

      {/* Feature Support (researched via CMS Evaluation) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5 text-blue-500" />
            Feature-Recherche
          </CardTitle>
          <CardDescription>
            Automatisch recherchierte Feature-Unterstützung aus CMS-Evaluationen
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Feature-Recherche via Prompt - unterstützt mehrere Features */}
          <div className="space-y-2">
            <Textarea
              placeholder="Features eingeben (kommasepariert oder je Zeile):&#10;Mehrsprachigkeit&#10;E-Commerce&#10;GraphQL API&#10;Benutzerkonten"
              value={featurePrompt}
              onChange={e => setFeaturePrompt(e.target.value)}
              disabled={isResearchingFeature}
              className="min-h-[80px] resize-y"
              rows={3}
            />
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Mehrere Features mit Komma, Semikolon oder Zeilenumbruch trennen
              </p>
              <div className="flex gap-2">
                {/* Einfache Recherche (ohne Review) */}
                <Button
                  variant="outline"
                  onClick={handleFeatureResearch}
                  disabled={isResearchingFeature || isOrchestratorRunning || !featurePrompt.trim()}
                >
                  {isResearchingFeature ? (
                    <>
                      <Loader size="sm" className="mr-2" />
                      Recherchiert...
                    </>
                  ) : (
                    <>
                      <Search className="mr-2 h-4 w-4" />
                      Nur Recherche
                    </>
                  )}
                </Button>
                {/* Orchestrator: Research + Quick Review */}
                <Button
                  onClick={() => handleOrchestratorResearch('quick')}
                  disabled={isOrchestratorRunning || isResearchingFeature || !featurePrompt.trim()}
                >
                  {isOrchestratorRunning ? (
                    <>
                      <Loader size="sm" className="mr-2" />
                      Orchestrator läuft...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Research + Review
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>

          {/* Orchestrator Event Log */}
          {orchestratorEvents.length > 0 && (
            <div className="border rounded-lg p-3 bg-slate-50 dark:bg-slate-900 max-h-48 overflow-y-auto">
              <p className="text-xs font-medium mb-2 text-muted-foreground">Orchestrator Log:</p>
              <div className="space-y-1">
                {orchestratorEvents.map((event, i) => (
                  <div key={i} className="text-xs flex gap-2">
                    <Badge
                      variant={
                        event.type === 'error'
                          ? 'destructive'
                          : event.type === 'agent-complete'
                            ? 'default'
                            : 'secondary'
                      }
                      className="text-[10px] shrink-0"
                    >
                      {event.agent}
                    </Badge>
                    <span className="text-muted-foreground">{event.message}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Review Actions (nur bei bestehenden Features) */}
          {hasFeatures && (
            <div className="flex items-center justify-between border-t pt-4">
              <div className="text-sm text-muted-foreground">
                {lastReviewResult ? (
                  <span>
                    Letzter Review: {lastReviewResult.featuresImproved} verbessert,{' '}
                    {lastReviewResult.featuresFlagged} markiert, Confidence:{' '}
                    {lastReviewResult.overallConfidence}%
                  </span>
                ) : (
                  <span>Bestehende Features auf Plausibilität prüfen</span>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleReviewFeatures('quick')}
                  disabled={isReviewingFeatures || isOrchestratorRunning}
                >
                  {isReviewingFeatures ? (
                    <>
                      <Loader size="sm" className="mr-2" />
                      Reviewt...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Quick Review
                    </>
                  )}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleReviewFeatures('deep')}
                  disabled={isReviewingFeatures || isOrchestratorRunning}
                >
                  {isReviewingFeatures ? (
                    <>
                      <Loader size="sm" className="mr-2" />
                      Deep Review...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Deep Review (AI)
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {hasFeatures ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Feature</TableHead>
                    <TableHead className="w-24 text-center">Score</TableHead>
                    <TableHead className="w-32">Support</TableHead>
                    <TableHead>Details</TableHead>
                    <TableHead className="w-32">Recherchiert</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(features)
                    .sort(([, a], [, b]) => b.score - a.score)
                    .map(([featureName, data]) => {
                      const isNoData = data.score === 50 && data.confidence <= 40;
                      // Extrahiere Notizen ohne URLs für bessere Lesbarkeit
                      const notesWithoutUrls =
                        data.notes?.split(' | Quellen:')[0] || data.notes || '';
                      return (
                        <TableRow key={featureName}>
                          <TableCell className="font-medium">{featureName}</TableCell>
                          <TableCell className="text-center">
                            {isNoData ? (
                              <span className="text-muted-foreground">n/a</span>
                            ) : (
                              <div className="flex items-center justify-center gap-1">
                                {data.score >= 70 ? (
                                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                                ) : data.score >= 40 ? (
                                  <HelpCircle className="h-4 w-4 text-yellow-500" />
                                ) : (
                                  <XCircle className="h-4 w-4 text-red-500" />
                                )}
                                <span
                                  className={
                                    data.score >= 70
                                      ? 'text-green-600'
                                      : data.score >= 40
                                        ? 'text-yellow-600'
                                        : 'text-red-600'
                                  }
                                >
                                  {data.score}%
                                </span>
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            {getSupportTypeBadge(data.supportType, data.moduleName)}
                          </TableCell>
                          <TableCell className="text-sm">
                            <div className="space-y-1">
                              <p className="text-muted-foreground">{notesWithoutUrls || '-'}</p>
                              {/* Begründung für Score */}
                              {data.reasoning && (
                                <p className="text-xs text-slate-500 italic">
                                  Begründung: {data.reasoning}
                                </p>
                              )}
                              {data.sourceUrls && data.sourceUrls.length > 0 && (
                                <div className="flex flex-wrap gap-1">
                                  {data.sourceUrls.slice(0, 3).map((url, i) => (
                                    <a
                                      key={i}
                                      href={url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-xs text-blue-500 hover:underline flex items-center gap-0.5"
                                    >
                                      <ExternalLink className="h-3 w-3" />
                                      Quelle {i + 1}
                                    </a>
                                  ))}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {data.researchedAt
                              ? new Date(data.researchedAt).toLocaleDateString('de-DE')
                              : '-'}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
              <AlertTriangle className="h-4 w-4" />
              Keine Feature-Recherche-Daten vorhanden. Features werden automatisch bei
              CMS-Evaluationen recherchiert.
            </div>
          )}
        </CardContent>
      </Card>

      <Separator />

      {/* Baseline Information */}
      <Card>
        <CardHeader>
          <CardTitle>Baseline-Daten</CardTitle>
          <CardDescription>Für PT-Schätzungen</CardDescription>
        </CardHeader>
        <CardContent>
          {hasBaseline ? (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <p className="text-sm text-muted-foreground">Baseline Name</p>
                  <p className="font-medium">{technology.baselineName}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Baseline Stunden</p>
                  <p className="font-medium">{technology.baselineHours}h</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Default</p>
                  <p className="font-medium">{technology.isDefault ? 'Ja' : 'Nein'}</p>
                </div>
              </div>
              {Object.keys(entityCounts).length > 0 && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Entity Counts</p>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(entityCounts).map(([entity, count]) => (
                      <Badge key={entity} variant="outline">
                        {entity}: {count}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <AlertTriangle className="h-4 w-4" />
              Keine Baseline-Daten konfiguriert
            </div>
          )}
        </CardContent>
      </Card>

      {/* Metadata */}
      <Card>
        <CardHeader>
          <CardTitle>Metadaten</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3 text-sm">
            <div>
              <p className="text-muted-foreground">Erstellt am</p>
              <p>
                {technology.createdAt
                  ? new Date(technology.createdAt).toLocaleDateString('de-DE')
                  : '-'}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Aktualisiert am</p>
              <p>
                {technology.updatedAt
                  ? new Date(technology.updatedAt).toLocaleDateString('de-DE')
                  : '-'}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Letzte AI-Recherche</p>
              <p>
                {technology.lastResearchedAt
                  ? new Date(technology.lastResearchedAt).toLocaleDateString('de-DE')
                  : '-'}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Recherche-Status</p>
              {technology.researchStatus ? (
                <Badge
                  variant={
                    technology.researchStatus === 'completed'
                      ? 'default'
                      : technology.researchStatus === 'pending'
                        ? 'secondary'
                        : 'destructive'
                  }
                >
                  {technology.researchStatus === 'completed'
                    ? 'Abgeschlossen'
                    : technology.researchStatus === 'pending'
                      ? 'Läuft...'
                      : 'Fehlgeschlagen'}
                </Badge>
              ) : (
                <span>-</span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
