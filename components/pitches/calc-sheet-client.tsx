'use client';

/**
 * Calc-Sheet Client Components
 *
 * Optimized following Vercel React Best Practices:
 * - client-swr-dedup: SWR for automatic request deduplication
 * - rendering-hoist-jsx: Static configs outside components
 * - js-cache-function-results: Module-level constants
 * - useMemo: Memoized expensive computations
 */

import {
  AlertTriangle,
  Calculator,
  CheckCircle2,
  Clock,
  FileText,
  RefreshCw,
  Sparkles,
  Users,
} from 'lucide-react';
import { useMemo } from 'react';
import useSWR from 'swr';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface CalcSheetFeature {
  id: string;
  name: string;
  description: string;
  type: 'content_type' | 'paragraph' | 'view' | 'module' | 'integration' | 'custom';
  complexity: 'H' | 'M' | 'L';
  hours: number;
}

interface CalcSheetTask {
  id: string;
  phase: string;
  description: string;
  role: string;
  hours: number;
}

interface CalcSheetRole {
  id: string;
  title: string;
  level: 'Junior' | 'Senior' | 'Lead' | 'Expert';
  responsibilities: string[];
  fte: number;
}

interface CalcSheetRisk {
  id: string;
  name: string;
  description: string;
  likelihood: 'low' | 'medium' | 'high';
  impact: 'low' | 'medium' | 'high';
  mitigation: string;
}

interface CalcSheetStart {
  projectName: string;
  client: string;
  partner?: string;
  date: string;
  cms: string;
}

interface CalcSheetSummary {
  totalFeatures: number;
  totalHours: number;
  totalFTE: number;
  estimatedBudget?: number;
  estimatedDuration?: string;
}

interface CalcSheet {
  start: CalcSheetStart;
  features: CalcSheetFeature[];
  tasks: CalcSheetTask[];
  roles: CalcSheetRole[];
  risks: CalcSheetRisk[];
  summary: CalcSheetSummary;
}

interface CalcSheetResponse {
  success: boolean;
  calcSheet: CalcSheet | null;
  source: 'rag' | 'ai_generated' | 'hybrid';
  confidence: number;
  error?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// HOISTED CONSTANTS (rendering-hoist-jsx, js-cache-function-results)
// ═══════════════════════════════════════════════════════════════════════════════

const SOURCE_CONFIG = {
  rag: { label: 'RAG Daten', variant: 'default' as const, icon: FileText },
  ai_generated: { label: 'KI-generiert', variant: 'secondary' as const, icon: Sparkles },
  hybrid: { label: 'Hybrid', variant: 'outline' as const, icon: Calculator },
} as const;

const COMPLEXITY_CONFIG = {
  H: { label: 'Hoch', className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' },
  M: {
    label: 'Mittel',
    className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  },
  L: {
    label: 'Niedrig',
    className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  },
} as const;

const TYPE_CONFIG = {
  content_type: { label: 'Content Type', className: 'bg-blue-100 text-blue-800' },
  paragraph: { label: 'Paragraph', className: 'bg-purple-100 text-purple-800' },
  view: { label: 'View', className: 'bg-cyan-100 text-cyan-800' },
  module: { label: 'Modul', className: 'bg-orange-100 text-orange-800' },
  integration: { label: 'Integration', className: 'bg-pink-100 text-pink-800' },
  custom: { label: 'Custom', className: 'bg-gray-100 text-gray-800' },
} as const;

const RISK_CONFIG = {
  low: { label: 'Niedrig', className: 'bg-green-100 text-green-800' },
  medium: { label: 'Mittel', className: 'bg-yellow-100 text-yellow-800' },
  high: { label: 'Hoch', className: 'bg-red-100 text-red-800' },
} as const;

const LEVEL_CONFIG = {
  Junior: { className: 'bg-gray-100 text-gray-800' },
  Senior: { className: 'bg-blue-100 text-blue-800' },
  Lead: { className: 'bg-purple-100 text-purple-800' },
  Expert: { className: 'bg-orange-100 text-orange-800' },
} as const;

// Risk score calculation constant
const RISK_SCORE_MAP = { low: 1, medium: 2, high: 3 } as const;

// Complexity order for display
const COMPLEXITY_ORDER = ['H', 'M', 'L'] as const;
const RISK_LEVEL_ORDER = ['high', 'medium', 'low'] as const;

// ═══════════════════════════════════════════════════════════════════════════════
// SWR FETCHER (client-swr-dedup)
// ═══════════════════════════════════════════════════════════════════════════════

async function calcSheetFetcher(url: string): Promise<CalcSheetResponse> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`API Error ${response.status}: ${response.statusText}`);
  }
  return response.json() as Promise<CalcSheetResponse>;
}

/**
 * SWR hook for calc-sheet data with automatic deduplication
 * Multiple component instances share the same request
 */
function useCalcSheet(leadId: string) {
  const { data, error, isLoading, mutate } = useSWR<CalcSheetResponse, Error>(
    `/api/pitches/${leadId}/calc-sheet`,
    calcSheetFetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000, // Dedupe requests within 60s
    }
  );

  return {
    data,
    loading: isLoading,
    error: error?.message ?? (data && !data.success ? data.error : null),
    refresh: () => mutate(),
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER COMPONENTS (rendering-hoist-jsx applied)
// ═══════════════════════════════════════════════════════════════════════════════

function SourceBadge({ source }: { source: 'rag' | 'ai_generated' | 'hybrid' }) {
  const config = SOURCE_CONFIG[source];
  const Icon = config.icon;

  return (
    <Badge variant={config.variant}>
      <Icon className="mr-1 h-3 w-3" />
      {config.label}
    </Badge>
  );
}

function ComplexityBadge({ complexity }: { complexity: 'H' | 'M' | 'L' }) {
  const config = COMPLEXITY_CONFIG[complexity];
  return <Badge className={config.className}>{config.label}</Badge>;
}

function TypeBadge({ type }: { type: CalcSheetFeature['type'] }) {
  const config = TYPE_CONFIG[type];
  return <Badge className={config.className}>{config.label}</Badge>;
}

function RiskBadge({ level }: { level: 'low' | 'medium' | 'high' }) {
  const config = RISK_CONFIG[level];
  return <Badge className={config.className}>{config.label}</Badge>;
}

function LevelBadge({ level }: { level: CalcSheetRole['level'] }) {
  return <Badge className={LEVEL_CONFIG[level].className}>{level}</Badge>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ERROR DISPLAY
// ═══════════════════════════════════════════════════════════════════════════════

function CalcSheetError({
  error,
  onRetry,
}: {
  error: string | null | undefined;
  onRetry: () => void;
}) {
  return (
    <Alert variant="destructive">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>Fehler</AlertTitle>
      <AlertDescription>
        {error || 'Keine Kalkulationsdaten verfügbar'}
        <Button variant="link" className="ml-2 h-auto p-0" onClick={onRetry}>
          Erneut versuchen
        </Button>
      </AlertDescription>
    </Alert>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// OVERVIEW
// ═══════════════════════════════════════════════════════════════════════════════

export function CalcSheetOverview({ leadId }: { leadId: string }) {
  const { loading, error, data, refresh } = useCalcSheet(leadId);

  // Memoize complexity distribution calculation
  const complexityDistribution = useMemo(() => {
    if (!data?.calcSheet?.features) return null;
    const features = data.calcSheet.features;
    const total = features.length;
    if (total === 0) return null;

    return COMPLEXITY_ORDER.map(complexity => {
      const count = features.filter(f => f.complexity === complexity).length;
      return {
        complexity,
        count,
        percentage: Math.round((count / total) * 100),
      };
    });
  }, [data?.calcSheet?.features]);

  // Memoize risk overview
  const riskOverview = useMemo(() => {
    if (!data?.calcSheet?.risks) return null;
    const risks = data.calcSheet.risks;

    return RISK_LEVEL_ORDER.map(level => ({
      level,
      count: risks.filter(r => r.impact === level).length,
    }));
  }, [data?.calcSheet?.risks]);

  if (loading) {
    return <CalcSheetSkeleton />;
  }

  if (error || !data?.calcSheet) {
    return <CalcSheetError error={error} onRetry={refresh} />;
  }

  const { calcSheet, source, confidence } = data;
  const { start, summary } = calcSheet;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Kalkulation</h1>
          <p className="text-muted-foreground mt-1">
            Projektschätzung basierend auf adesso Calculator 2.01
          </p>
        </div>
        <div className="flex items-center gap-3">
          <SourceBadge source={source} />
          <Badge variant="outline">
            <CheckCircle2 className="mr-1 h-3 w-3" />
            {confidence}% Konfidenz
          </Badge>
          <Button variant="outline" size="sm" onClick={refresh}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Aktualisieren
          </Button>
        </div>
      </div>

      {/* Project Info Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {start.projectName}
          </CardTitle>
          <CardDescription>Projektübersicht</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div>
              <p className="text-muted-foreground text-sm">Kunde</p>
              <p className="font-medium">{start.client}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-sm">CMS</p>
              <p className="font-medium">{start.cms}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-sm">Datum</p>
              <p className="font-medium">{start.date}</p>
            </div>
            {start.partner ? (
              <div>
                <p className="text-muted-foreground text-sm">Partner</p>
                <p className="font-medium">{start.partner}</p>
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Features</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalFeatures}</div>
            <p className="text-muted-foreground text-xs">Identifizierte Features</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Stunden</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalHours.toLocaleString()}h</div>
            <p className="text-muted-foreground text-xs">Geschätzte Gesamtstunden</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Team</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalFTE} FTE</div>
            <p className="text-muted-foreground text-xs">Vollzeitäquivalent</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Dauer</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.estimatedDuration || 'TBD'}</div>
            <p className="text-muted-foreground text-xs">Geschätzte Projektdauer</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Feature-Verteilung nach Komplexität</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {complexityDistribution?.map(({ complexity, count, percentage }) => (
                <div key={complexity} className="flex items-center gap-3">
                  <ComplexityBadge complexity={complexity} />
                  <Progress value={percentage} className="flex-1" />
                  <span className="text-muted-foreground w-16 text-right text-sm">
                    {count} ({percentage}%)
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Risiko-Übersicht</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {riskOverview?.map(({ level, count }) => (
                <div key={level} className="flex items-center justify-between">
                  <RiskBadge level={level} />
                  <span className="text-muted-foreground text-sm">
                    {count} {count === 1 ? 'Risiko' : 'Risiken'}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// FEATURES TABLE
// ═══════════════════════════════════════════════════════════════════════════════

export function CalcSheetFeaturesTable({ leadId }: { leadId: string }) {
  const { loading, error, data, refresh } = useCalcSheet(leadId);

  // Memoize grouped features and total (rerender-derived-state)
  const { groupedFeatures, totalHours } = useMemo(() => {
    if (!data?.calcSheet?.features) {
      return { groupedFeatures: {}, totalHours: 0 };
    }

    const features = data.calcSheet.features;
    const grouped = features.reduce(
      (acc, feature) => {
        const type = feature.type;
        if (!acc[type]) {
          acc[type] = [];
        }
        acc[type].push(feature);
        return acc;
      },
      {} as Record<string, CalcSheetFeature[]>
    );

    return {
      groupedFeatures: grouped,
      totalHours: features.reduce((sum, f) => sum + f.hours, 0),
    };
  }, [data?.calcSheet?.features]);

  if (loading) {
    return <CalcSheetSkeleton />;
  }

  if (error || !data?.calcSheet) {
    return <CalcSheetError error={error} onRetry={refresh} />;
  }

  const featuresCount = data.calcSheet.features.length;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Features</h1>
          <p className="text-muted-foreground mt-1">
            {featuresCount} Features | {totalHours.toLocaleString()} Stunden gesamt
          </p>
        </div>
        <div className="flex items-center gap-3">
          <SourceBadge source={data.source} />
          <Button variant="outline" size="sm" onClick={refresh}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Aktualisieren
          </Button>
        </div>
      </div>

      {Object.entries(groupedFeatures).map(([type, typeFeatures]) => {
        const groupHours = typeFeatures.reduce((sum, f) => sum + f.hours, 0);

        return (
          <Card key={type}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TypeBadge type={type as CalcSheetFeature['type']} />
                <span>
                  {typeFeatures.length} {type.replace('_', ' ')}
                </span>
                <span className="text-muted-foreground ml-auto text-sm font-normal">
                  {groupHours}h
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead className="hidden md:table-cell">Beschreibung</TableHead>
                    <TableHead className="w-24">Komplexität</TableHead>
                    <TableHead className="w-20 text-right">Stunden</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {typeFeatures.map(feature => (
                    <TableRow key={feature.id}>
                      <TableCell className="text-muted-foreground font-mono text-sm">
                        {feature.id}
                      </TableCell>
                      <TableCell className="font-medium">{feature.name}</TableCell>
                      <TableCell className="text-muted-foreground hidden max-w-xs truncate md:table-cell">
                        {feature.description}
                      </TableCell>
                      <TableCell>
                        <ComplexityBadge complexity={feature.complexity} />
                      </TableCell>
                      <TableCell className="text-right font-mono">{feature.hours}h</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TASKS TABLE
// ═══════════════════════════════════════════════════════════════════════════════

export function CalcSheetTasksTable({ leadId }: { leadId: string }) {
  const { loading, error, data, refresh } = useCalcSheet(leadId);

  // Memoize grouped tasks and total
  const { groupedTasks, totalHours } = useMemo(() => {
    if (!data?.calcSheet?.tasks) {
      return { groupedTasks: {}, totalHours: 0 };
    }

    const tasks = data.calcSheet.tasks;
    const grouped = tasks.reduce(
      (acc, task) => {
        const phase = task.phase;
        if (!acc[phase]) {
          acc[phase] = [];
        }
        acc[phase].push(task);
        return acc;
      },
      {} as Record<string, CalcSheetTask[]>
    );

    return {
      groupedTasks: grouped,
      totalHours: tasks.reduce((sum, t) => sum + t.hours, 0),
    };
  }, [data?.calcSheet?.tasks]);

  if (loading) {
    return <CalcSheetSkeleton />;
  }

  if (error || !data?.calcSheet) {
    return <CalcSheetError error={error} onRetry={refresh} />;
  }

  const tasksCount = data.calcSheet.tasks.length;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Aufgaben</h1>
          <p className="text-muted-foreground mt-1">
            {tasksCount} Aufgaben | {totalHours.toLocaleString()} Stunden gesamt
          </p>
        </div>
        <div className="flex items-center gap-3">
          <SourceBadge source={data.source} />
          <Button variant="outline" size="sm" onClick={refresh}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Aktualisieren
          </Button>
        </div>
      </div>

      {Object.entries(groupedTasks).map(([phase, phaseTasks]) => {
        const phaseHours = phaseTasks.reduce((sum, t) => sum + t.hours, 0);

        return (
          <Card key={phase}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                {phase}
                <span className="text-muted-foreground ml-auto text-sm font-normal">
                  {phaseHours}h
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">ID</TableHead>
                    <TableHead>Beschreibung</TableHead>
                    <TableHead className="w-32">Rolle</TableHead>
                    <TableHead className="w-20 text-right">Stunden</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {phaseTasks.map(task => (
                    <TableRow key={task.id}>
                      <TableCell className="text-muted-foreground font-mono text-sm">
                        {task.id}
                      </TableCell>
                      <TableCell>{task.description}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{task.role}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">{task.hours}h</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ROLES TABLE
// ═══════════════════════════════════════════════════════════════════════════════

export function CalcSheetRolesTable({ leadId }: { leadId: string }) {
  const { loading, error, data, refresh } = useCalcSheet(leadId);

  // Memoize total FTE
  const totalFTE = useMemo(() => {
    if (!data?.calcSheet?.roles) return 0;
    return data.calcSheet.roles.reduce((sum, r) => sum + r.fte, 0);
  }, [data?.calcSheet?.roles]);

  if (loading) {
    return <CalcSheetSkeleton />;
  }

  if (error || !data?.calcSheet) {
    return <CalcSheetError error={error} onRetry={refresh} />;
  }

  const { roles } = data.calcSheet;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Rollen</h1>
          <p className="text-muted-foreground mt-1">
            {roles.length} Rollen | {totalFTE.toFixed(1)} FTE gesamt
          </p>
        </div>
        <div className="flex items-center gap-3">
          <SourceBadge source={data.source} />
          <Button variant="outline" size="sm" onClick={refresh}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Aktualisieren
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {roles.map(role => (
          <Card key={role.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    {role.title}
                  </CardTitle>
                  <CardDescription className="mt-1">
                    <LevelBadge level={role.level} />
                  </CardDescription>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold">{role.fte}</div>
                  <p className="text-muted-foreground text-xs">FTE</p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <p className="text-muted-foreground text-sm font-medium">Verantwortlichkeiten:</p>
                <ul className="text-muted-foreground space-y-1 text-sm">
                  {role.responsibilities.map((resp, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-green-500" />
                      {resp}
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// RISKS TABLE
// ═══════════════════════════════════════════════════════════════════════════════

export function CalcSheetRisksTable({ leadId }: { leadId: string }) {
  const { loading, error, data, refresh } = useCalcSheet(leadId);

  // Memoize sorted risks by score
  const sortedRisks = useMemo(() => {
    if (!data?.calcSheet?.risks) return [];

    return [...data.calcSheet.risks].sort((a, b) => {
      const scoreA = RISK_SCORE_MAP[a.likelihood] * RISK_SCORE_MAP[a.impact];
      const scoreB = RISK_SCORE_MAP[b.likelihood] * RISK_SCORE_MAP[b.impact];
      return scoreB - scoreA;
    });
  }, [data?.calcSheet?.risks]);

  if (loading) {
    return <CalcSheetSkeleton />;
  }

  if (error || !data?.calcSheet) {
    return <CalcSheetError error={error} onRetry={refresh} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Risiken</h1>
          <p className="text-muted-foreground mt-1">
            {sortedRisks.length} identifizierte Projektrisiken
          </p>
        </div>
        <div className="flex items-center gap-3">
          <SourceBadge source={data.source} />
          <Button variant="outline" size="sm" onClick={refresh}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Aktualisieren
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        {sortedRisks.map(risk => {
          const riskScore = RISK_SCORE_MAP[risk.likelihood] * RISK_SCORE_MAP[risk.impact];
          const riskLevel = riskScore >= 6 ? 'high' : riskScore >= 3 ? 'medium' : 'low';

          return (
            <Card
              key={risk.id}
              className={
                riskLevel === 'high'
                  ? 'border-red-200 dark:border-red-900'
                  : riskLevel === 'medium'
                    ? 'border-yellow-200 dark:border-yellow-900'
                    : ''
              }
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <AlertTriangle
                        className={`h-4 w-4 ${
                          riskLevel === 'high'
                            ? 'text-red-500'
                            : riskLevel === 'medium'
                              ? 'text-yellow-500'
                              : 'text-green-500'
                        }`}
                      />
                      {risk.name}
                    </CardTitle>
                    <CardDescription className="mt-1">{risk.description}</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <div className="text-center">
                      <p className="text-muted-foreground mb-1 text-xs">Wahrscheinlichkeit</p>
                      <RiskBadge level={risk.likelihood} />
                    </div>
                    <div className="text-center">
                      <p className="text-muted-foreground mb-1 text-xs">Auswirkung</p>
                      <RiskBadge level={risk.impact} />
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-sm font-medium">Mitigationsstrategie:</p>
                  <p className="text-muted-foreground mt-1 text-sm">{risk.mitigation}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SKELETON
// ═══════════════════════════════════════════════════════════════════════════════

function CalcSheetSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <Skeleton className="h-9 w-48" />
          <Skeleton className="mt-2 h-5 w-72" />
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-9 w-32" />
        </div>
      </div>
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="mt-2 h-4 w-72" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </CardContent>
      </Card>
      <div className="grid gap-4 md:grid-cols-4">
        {[1, 2, 3, 4].map(i => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16" />
              <Skeleton className="mt-1 h-3 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
