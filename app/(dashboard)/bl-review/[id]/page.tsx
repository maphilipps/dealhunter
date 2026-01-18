import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { rfps, businessUnits, users, quickScans } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { redirect, notFound } from 'next/navigation';
import { safeJsonParseOrNull } from '@/lib/utils/parse';
import { getEnabledTabs, getWorkflowProgress } from '@/lib/workflow/bl-review-status';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  FileText,
  ListChecks,
  GitCompare,
  Calendar,
  Users,
  Building2,
  ChevronLeft,
  CheckCircle2,
  Circle,
  Loader2
} from 'lucide-react';
import type { BaselineComparisonResult } from '@/lib/baseline-comparison/schema';
import type { ProjectPlan } from '@/lib/project-planning/schema';
import type { TeamNotificationResult } from '@/lib/notifications/email';
import type { BitEvaluationResult } from '@/lib/bit-evaluation/schema';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { TenQuestionsTab } from '@/components/bl-review/ten-questions-tab';
import { BaselineComparisonCard } from '@/components/bids/baseline-comparison-card';
import { ProjectPlanningCard } from '@/components/bids/project-planning-card';
import { TeamBuilder } from '@/components/bids/team-builder';
import { NotificationCard } from '@/components/bids/notification-card';
import { BUMatchingTab } from '@/components/bl-review/bu-matching-tab';
import { OverviewSection } from '@/components/rfp-overview';
import type {
  TechStack,
  AccessibilityAudit,
  SEOAudit,
  PerformanceIndicators,
  ContentVolume,
  NavigationStructure,
  CompanyIntelligence,
} from '@/lib/quick-scan/schema';
import type { OverviewData } from '@/components/rfp-overview';

interface BLReviewDetailPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}

interface ExtractedData {
  customerName?: string;
  industry?: string;
  projectDescription?: string;
  technologies?: string[];
}

interface BitDecisionOverview {
  decision?: {
    overallConfidence?: number;
    reasoning?: string;
  };
}

export default async function BLReviewDetailPage({
  params,
  searchParams,
}: BLReviewDetailPageProps) {
  const { id } = await params;
  const { tab } = await searchParams;
  const session = await auth();

  if (
    !session?.user ||
    (session.user.role !== 'bl' && session.user.role !== 'admin')
  ) {
    redirect('/');
  }

  // Get the bid
  const [bid] = await db
    .select()
    .from(rfps)
    .where(eq(rfps.id, id))
    .limit(1);

  if (!bid) {
    notFound();
  }

  // Get the user's business unit for authorization check
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  // Authorization: Admin can see all, BL can only see their assigned bids
  if (session.user.role !== 'admin') {
    if (bid.assignedBusinessUnitId !== user?.businessUnitId) {
      redirect('/bl-review');
    }
  }

  // Get business unit info
  const businessUnit = bid.assignedBusinessUnitId
    ? await db
        .select()
        .from(businessUnits)
        .where(eq(businessUnits.id, bid.assignedBusinessUnitId))
        .then(rows => rows[0])
    : null;

  // Get quick scan if available
  const [quickScan] = bid.quickScanId
    ? await db
        .select()
        .from(quickScans)
        .where(eq(quickScans.id, bid.quickScanId))
        .limit(1)
    : [null];

  // Parse JSON data safely - using Record<string, unknown> for components that expect generic objects
  const extractedData = safeJsonParseOrNull<Record<string, unknown>>(
    bid.extractedRequirements
  );
  // Type-safe version for local rendering
  const extractedDataTyped = extractedData as ExtractedData | null;
  const decisionData = safeJsonParseOrNull<BitEvaluationResult>(
    bid.decisionData
  );
  // Extract overview-level decision data for display
  const decisionOverview: BitDecisionOverview | null = decisionData ? {
    decision: {
      overallConfidence: decisionData.decision?.overallConfidence,
      reasoning: decisionData.decision?.reasoning,
    }
  } : null;
  const baselineResult = safeJsonParseOrNull<BaselineComparisonResult>(
    bid.baselineComparisonResult
  );
  const projectPlan = safeJsonParseOrNull<ProjectPlan>(
    bid.projectPlanningResult
  );
  const teamNotifications = safeJsonParseOrNull<TeamNotificationResult[]>(
    bid.teamNotifications
  );

  // Parse QuickScan JSON data server-side for Overview section
  const overviewData: OverviewData | null = quickScan ? {
    companyIntelligence: safeJsonParseOrNull<CompanyIntelligence>(quickScan.companyIntelligence),
    techStack: safeJsonParseOrNull<TechStack>(quickScan.techStack),
    accessibilityAudit: safeJsonParseOrNull<AccessibilityAudit>(quickScan.accessibilityAudit),
    seoAudit: safeJsonParseOrNull<SEOAudit>(quickScan.seoAudit),
    performanceIndicators: safeJsonParseOrNull<PerformanceIndicators>(quickScan.performanceIndicators),
    contentVolume: safeJsonParseOrNull<ContentVolume>(quickScan.contentVolume),
    navigationStructure: safeJsonParseOrNull<NavigationStructure>(quickScan.navigationStructure),
  } : null;

  const defaultTab = tab || 'overview';

  // Determine which tabs are available based on status/data
  const hasDeepAnalysis = bid.deepMigrationAnalysisId !== null;
  const hasTeam = bid.assignedTeam !== null;

  // Get workflow progress and enabled tabs
  const enabledTabs = getEnabledTabs(bid);
  const workflowProgress = getWorkflowProgress(bid);

  return (
    <div className="space-y-6">
      {/* Breadcrumb & Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/bl-review">
            <ChevronLeft className="h-4 w-4 mr-1" />
            Zurück
          </Link>
        </Button>
      </div>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {extractedDataTyped?.customerName || 'Unbekannter Kunde'}
          </h1>
          <div className="flex items-center gap-3 mt-2 text-muted-foreground">
            {businessUnit && (
              <span className="flex items-center gap-1">
                <Building2 className="h-4 w-4" />
                {businessUnit.name}
              </span>
            )}
            <span>•</span>
            <StatusBadge status={bid.status} />
            <span>•</span>
            <span>
              Erstellt: {bid.createdAt
                ? new Date(bid.createdAt).toLocaleDateString('de-DE')
                : 'Unbekannt'}
            </span>
          </div>
        </div>
      </div>

      {/* Workflow Progress Indicator */}
      <div className="flex items-center gap-2 py-4 px-4 rounded-lg bg-muted/50">
        {workflowProgress.map((step, index) => (
          <div key={step.phase} className="flex items-center">
            <div className="flex items-center gap-2">
              {step.completed ? (
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              ) : step.current ? (
                <Loader2 className="h-5 w-5 text-primary animate-spin" />
              ) : (
                <Circle className="h-5 w-5 text-muted-foreground" />
              )}
              <span className={`text-sm ${step.current ? 'font-medium' : step.completed ? 'text-muted-foreground' : 'text-muted-foreground/60'}`}>
                {step.label}
              </span>
            </div>
            {index < workflowProgress.length - 1 && (
              <div className={`mx-3 h-px w-8 ${step.completed ? 'bg-green-600' : 'bg-muted-foreground/30'}`} />
            )}
          </div>
        ))}
      </div>

      {/* Tab Navigation */}
      <Tabs defaultValue={defaultTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger
            value="overview"
            disabled={!enabledTabs.includes('overview')}
            className="flex items-center gap-2"
          >
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Übersicht</span>
          </TabsTrigger>
          <TabsTrigger
            value="bu-matching"
            disabled={!enabledTabs.includes('bu-matching')}
            className="flex items-center gap-2"
          >
            <Building2 className="h-4 w-4" />
            <span className="hidden sm:inline">BU Matching</span>
          </TabsTrigger>
          <TabsTrigger
            value="questions"
            disabled={!enabledTabs.includes('questions')}
            className="flex items-center gap-2"
          >
            <ListChecks className="h-4 w-4" />
            <span className="hidden sm:inline">10 Fragen</span>
          </TabsTrigger>
          <TabsTrigger
            value="baseline"
            disabled={!enabledTabs.includes('baseline')}
            className="flex items-center gap-2"
          >
            <GitCompare className="h-4 w-4" />
            <span className="hidden sm:inline">Baseline</span>
          </TabsTrigger>
          <TabsTrigger
            value="planning"
            disabled={!enabledTabs.includes('planning')}
            className="flex items-center gap-2"
          >
            <Calendar className="h-4 w-4" />
            <span className="hidden sm:inline">Planung</span>
          </TabsTrigger>
          <TabsTrigger
            value="team"
            disabled={!enabledTabs.includes('team')}
            className="flex items-center gap-2"
          >
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Team</span>
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* BIT Decision Summary - Always visible at top */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* Customer Info (from extracted data) */}
            <Card>
              <CardHeader>
                <CardTitle>Kundeninformationen</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {extractedDataTyped?.customerName && (
                  <div>
                    <p className="text-sm text-muted-foreground">Kunde</p>
                    <p className="font-medium">{extractedDataTyped.customerName}</p>
                  </div>
                )}
                {extractedDataTyped?.industry && (
                  <div>
                    <p className="text-sm text-muted-foreground">Branche</p>
                    <p className="font-medium">{extractedDataTyped.industry}</p>
                  </div>
                )}
                {extractedDataTyped?.projectDescription && (
                  <div>
                    <p className="text-sm text-muted-foreground">Projektbeschreibung</p>
                    <p className="text-sm">{extractedDataTyped.projectDescription}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Decision Summary */}
            <Card>
              <CardHeader>
                <CardTitle>BIT Entscheidung</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2">
                  <Badge
                    variant={bid.decision === 'bid' ? 'default' : 'destructive'}
                    className="text-lg px-4 py-1"
                  >
                    {bid.decision === 'bid' ? 'BIT' : 'NO BIT'}
                  </Badge>
                  {decisionOverview?.decision?.overallConfidence && (
                    <span className="text-sm text-muted-foreground">
                      ({decisionOverview.decision.overallConfidence}% Konfidenz)
                    </span>
                  )}
                </div>
                {decisionOverview?.decision?.reasoning && (
                  <p className="text-sm text-muted-foreground">
                    {decisionOverview.decision.reasoning}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Enhanced Overview Section with QuickScan Data */}
          <OverviewSection data={overviewData} />

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Nächste Schritte</CardTitle>
              <CardDescription>
                Workflow-Aktionen für diesen Bid
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                {!hasDeepAnalysis && (
                  <Button variant="outline" asChild>
                    <Link href={`/bl-review/${id}?tab=baseline`}>
                      Deep Analysis starten
                    </Link>
                  </Button>
                )}
                {hasDeepAnalysis && !hasTeam && (
                  <Button asChild>
                    <Link href={`/bl-review/${id}?tab=team`}>
                      Team zuweisen
                    </Link>
                  </Button>
                )}
                {hasTeam && !bid.teamNotifiedAt && (
                  <Button asChild>
                    <Link href={`/bl-review/${id}?tab=team`}>
                      Team benachrichtigen
                    </Link>
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* BU Matching Tab */}
        <TabsContent value="bu-matching" className="space-y-6">
          <BUMatchingTab
            bidId={bid.id}
            quickScan={quickScan}
            currentBusinessUnitId={bid.assignedBusinessUnitId}
          />
        </TabsContent>

        {/* 10 Questions Tab */}
        <TabsContent value="questions" className="space-y-6">
          <TenQuestionsTab
            decisionData={decisionData}
            extractedData={extractedData}
            quickScan={quickScan}
          />
        </TabsContent>

        {/* Baseline Tab */}
        <TabsContent value="baseline" className="space-y-6">
          <BaselineComparisonCard
            bidId={bid.id}
            initialResult={baselineResult}
            hasDeepAnalysis={hasDeepAnalysis}
          />
        </TabsContent>

        {/* Planning Tab */}
        <TabsContent value="planning" className="space-y-6">
          <ProjectPlanningCard
            bidId={bid.id}
            initialPlan={projectPlan}
            hasDeepAnalysis={hasDeepAnalysis}
          />
        </TabsContent>

        {/* Team Tab */}
        <TabsContent value="team" className="space-y-6">
          {/* Team Builder */}
          <TeamBuilder bidId={bid.id} />

          {/* Team Assignment Summary (if assigned) */}
          {bid.assignedTeam && (
            <Card className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/20">
              <CardHeader>
                <CardTitle className="text-green-900 dark:text-green-100">
                  Team zugewiesen
                </CardTitle>
                <CardDescription className="text-green-700 dark:text-green-300">
                  Das Team wurde erfolgreich zugewiesen
                </CardDescription>
              </CardHeader>
              <CardContent>
                <pre className="text-sm overflow-auto">
                  {JSON.stringify(safeJsonParseOrNull(bid.assignedTeam), null, 2)}
                </pre>
              </CardContent>
            </Card>
          )}

          {/* Notification Card */}
          <NotificationCard
            bidId={bid.id}
            hasTeam={hasTeam}
            initialResults={teamNotifications}
            notifiedAt={bid.teamNotifiedAt}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
    routed: { label: 'Weitergeleitet', variant: 'default' },
    full_scanning: { label: 'Deep Analysis', variant: 'default' },
    bl_reviewing: { label: 'In Prüfung', variant: 'default' },
    team_assigned: { label: 'Team zugewiesen', variant: 'secondary' },
    notified: { label: 'Benachrichtigt', variant: 'outline' },
    handed_off: { label: 'Abgeschlossen', variant: 'outline' },
  };

  const config = statusConfig[status] || { label: status, variant: 'secondary' as const };

  return <Badge variant={config.variant}>{config.label}</Badge>;
}
