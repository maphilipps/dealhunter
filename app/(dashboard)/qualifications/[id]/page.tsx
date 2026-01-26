import { cache } from 'react';

import { desc, eq } from 'drizzle-orm';
import { AlertTriangle, CheckCircle2, FileText, Globe, Package, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { AuditStatusBadge } from '@/components/qualifications/audit-status-badge';
import { BulkVisualizationGenerator } from '@/components/qualifications/bulk-visualization-generator';
import { CustomerDeepDive } from '@/components/qualifications/customer-deep-dive';
import { DeleteQualificationButton } from '@/components/qualifications/delete-qualification-button';
import { DeepScanOverviewClient } from '@/components/qualifications/deep-scan-overview-client';
import { ExecutiveSummaryCard } from '@/components/qualifications/executive-summary-card';
import { LeadOverviewClient } from '@/components/qualifications/qualification-overview-client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import {
  LEAD_PUBLIC_FIELDS,
  PreQualification_PUBLIC_FIELDS,
  BUSINESS_UNIT_PUBLIC_FIELDS,
  WEBSITE_AUDIT_PUBLIC_FIELDS,
  PT_ESTIMATION_PUBLIC_FIELDS,
} from '@/lib/db/projections';
import {
  qualifications,
  preQualifications,
  businessUnits,
  websiteAudits,
  cmsMatchResults,
  ptEstimations,
  referenceMatches,
  technologies,
  references,
} from '@/lib/db/schema';

// Cached function for fetching lead with all related data in parallel
const getLeadWithDetails = cache(async (id: string) => {
  // Phase 1: Fetch lead first (dependency root) - only select public fields
  const [lead] = await db
    .select(LEAD_PUBLIC_FIELDS)
    .from(qualifications)
    .where(eq(qualifications.id, id))
    .limit(1);

  if (!lead) {
    return null;
  }

  // Phase 2: Parallel fetch for all independent queries - select only needed fields
  const [preQualification, businessUnit, websiteAudit, cmsMatches, ptEstimation, refMatches] = await Promise.all(
    [
      // Get related Pre-Qualification (depends on lead.preQualificationId) - only public fields
      lead.preQualificationId
        ? db
            .select(PreQualification_PUBLIC_FIELDS)
            .from(preQualifications)
            .where(eq(preQualifications.id, lead.preQualificationId))
            .limit(1)
            .then(r => r[0])
        : Promise.resolve(null),

      // Get business unit (depends on lead.businessUnitId) - only public fields
      db
        .select(BUSINESS_UNIT_PUBLIC_FIELDS)
        .from(businessUnits)
        .where(eq(businessUnits.id, lead.businessUnitId))
        .limit(1)
        .then(r => r[0]),

      // Get Website Audit data (depends on lead.id) - only public fields
      db
        .select(WEBSITE_AUDIT_PUBLIC_FIELDS)
        .from(websiteAudits)
        .where(eq(websiteAudits.qualificationId, id))
        .limit(1)
        .then(r => r[0]),

      // Get CMS Match Results (depends on lead.id) - select specific fields
      db
        .select({
          match: cmsMatchResults,
          technology: technologies,
        })
        .from(cmsMatchResults)
        .leftJoin(technologies, eq(cmsMatchResults.technologyId, technologies.id))
        .where(eq(cmsMatchResults.qualificationId, id))
        .orderBy(desc(cmsMatchResults.rank))
        .limit(3),

      // Get PT Estimation (depends on lead.id) - only public fields
      db
        .select(PT_ESTIMATION_PUBLIC_FIELDS)
        .from(ptEstimations)
        .where(eq(ptEstimations.qualificationId, id))
        .limit(1)
        .then(r => r[0]),

      // Get Reference Matches (depends on lead.id) - select specific fields
      db
        .select({
          match: referenceMatches,
          reference: references,
        })
        .from(referenceMatches)
        .leftJoin(references, eq(referenceMatches.referenceId, references.id))
        .where(eq(referenceMatches.qualificationId, id))
        .orderBy(desc(referenceMatches.rank))
        .limit(5),
    ]
  );

  return {
    lead,
    preQualification,
    businessUnit,
    websiteAudit,
    cmsMatches,
    ptEstimation,
    refMatches,
  };
});

export default async function LeadOverviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/login');
  }

  // Fetch all data in parallel with React.cache() for per-request deduplication
  const data = await getLeadWithDetails(id);

  if (!data) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">Lead nicht gefunden</h1>
        <p className="text-muted-foreground">Der angeforderte Lead konnte nicht gefunden werden.</p>
      </div>
    );
  }

  const { lead, preQualification, businessUnit, websiteAudit, cmsMatches, ptEstimation, refMatches } = data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{lead.customerName}</h1>
          <p className="text-muted-foreground">Lead Overview & Deep Analysis Results</p>
        </div>
        <div className="flex items-center gap-2">
          <AuditStatusBadge leadId={id} variant="badge" />
          <DeleteQualificationButton leadId={id} label={lead.customerName} />
        </div>
      </div>

      {/* DeepScan Status Banner */}
      <DeepScanOverviewClient />

      {/* Bulk Visualization Generator */}
      <BulkVisualizationGenerator leadId={id} />

      {/* Executive Summary Card (Phase 1.1) - Prominent first element */}
      <ExecutiveSummaryCard
        leadId={id}
        customerName={lead.customerName}
        industry={lead.industry}
        budget={lead.budget}
        websiteUrl={lead.websiteUrl}
        projectDescription={lead.projectDescription}
      />

      {/* Status & Basic Info */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Status</CardTitle>
            <StatusBadge status={lead.status} />
          </div>
          <CardDescription>
            Erstellt am{' '}
            {lead.createdAt ? new Date(lead.createdAt).toLocaleDateString('de-DE') : 'Unbekannt'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <p className="text-sm text-muted-foreground">Business Unit</p>
              <p className="font-medium">{businessUnit?.name || 'Nicht zugewiesen'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Branche</p>
              <p className="font-medium">{lead.industry || 'Nicht bekannt'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Budget</p>
              <p className="font-medium">{lead.budget || 'Nicht spezifiziert'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Customer Deep Dive (Phase 1.2) - Quick Scan data */}
      <CustomerDeepDive leadId={id} quickScanId={lead.quickScanId} />

      {/* Audit Status Card (Phase 4.1) - Shows if audit data is available */}
      <AuditStatusBadge leadId={id} variant="card" />

      {/* Background Job Progress (Client Component with Polling) */}
      <LeadOverviewClient leadId={id} leadStatus={lead.status} />

      {/* Summary Cards Grid */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Website Audit Summary */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-muted-foreground" />
              <CardTitle>Website Audit</CardTitle>
            </div>
            <CardDescription>Technische Analyse der aktuellen Website</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {websiteAudit?.status === 'completed' ? (
              <>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Performance Score</span>
                    <span className="font-medium">{websiteAudit.performanceScore}/100</span>
                  </div>
                  {websiteAudit.performanceScore !== null && (
                    <Progress value={websiteAudit.performanceScore} />
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Accessibility Score</span>
                    <span className="font-medium">{websiteAudit.accessibilityScore}/100</span>
                  </div>
                  {websiteAudit.accessibilityScore !== null && (
                    <Progress value={websiteAudit.accessibilityScore} />
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4 pt-2 border-t">
                  <div>
                    <p className="text-xs text-muted-foreground">Aktuelles CMS</p>
                    <p className="font-medium">{websiteAudit.cms || 'Unbekannt'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Seiten</p>
                    <p className="font-medium">{websiteAudit.pageCount || 'N/A'}</p>
                  </div>
                </div>

                <div className="pt-2">
                  <div className="flex items-center gap-2 text-sm">
                    {websiteAudit.migrationComplexity === 'low' && (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    )}
                    {(websiteAudit.migrationComplexity === 'medium' ||
                      websiteAudit.migrationComplexity === 'high') && (
                      <AlertTriangle className="h-4 w-4 text-yellow-600" />
                    )}
                    {websiteAudit.migrationComplexity === 'very_high' && (
                      <AlertTriangle className="h-4 w-4 text-red-600" />
                    )}
                    <span className="text-muted-foreground">Migration Complexity:</span>
                    <Badge variant="outline">{websiteAudit.migrationComplexity || 'N/A'}</Badge>
                  </div>
                </div>

                <Button variant="outline" size="sm" className="w-full" asChild>
                  <Link href={`/qualifications/${id}/website-audit`}>Details ansehen</Link>
                </Button>
              </>
            ) : websiteAudit?.status === 'running' ? (
              <div className="space-y-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <p className="text-sm text-muted-foreground">Audit läuft...</p>
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-sm text-muted-foreground">Noch nicht verfügbar</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Audit wird nach Lead-Routing gestartet
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* PT Estimation Summary */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-muted-foreground" />
              <CardTitle>PT Estimation</CardTitle>
            </div>
            <CardDescription>Geschätzter Projektaufwand</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {ptEstimation ? (
              <>
                <div className="text-center py-4 border-b">
                  <p className="text-4xl font-bold">{ptEstimation.totalPT}</p>
                  <p className="text-sm text-muted-foreground">Person-Tage (gesamt)</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Dauer</p>
                    <p className="font-medium">
                      {ptEstimation.durationMonths
                        ? `${ptEstimation.durationMonths} Monate`
                        : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Confidence</p>
                    <Badge variant="outline">{ptEstimation.confidenceLevel || 'medium'}</Badge>
                  </div>
                </div>

                {ptEstimation.riskBuffer !== null && (
                  <div className="pt-2 border-t">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Risk Buffer</span>
                      <span className="font-medium">{ptEstimation.riskBuffer}%</span>
                    </div>
                  </div>
                )}

                <Button variant="outline" size="sm" className="w-full" asChild>
                  <Link href={`/qualifications/${id}/estimation`}>Details ansehen</Link>
                </Button>
              </>
            ) : (
              <div className="text-center py-4">
                <p className="text-sm text-muted-foreground">Noch nicht verfügbar</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Wird nach Website Audit berechnet
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* CMS Match Summary */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-muted-foreground" />
              <CardTitle>CMS Recommendation</CardTitle>
            </div>
            <CardDescription>Top 3 empfohlene CMS-Systeme</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {cmsMatches.length > 0 ? (
              <>
                {cmsMatches.map(({ match, technology }, idx) => (
                  <div
                    key={match.id}
                    className={`p-3 rounded-lg border ${idx === 0 ? 'bg-primary/5 border-primary' : ''}`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium">{technology?.name || 'Unknown'}</p>
                        {idx === 0 && (
                          <Badge variant="default" className="mt-1">
                            Top Match
                          </Badge>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold">{match.totalScore}</p>
                        <p className="text-xs text-muted-foreground">Score</p>
                      </div>
                    </div>
                  </div>
                ))}

                <Button variant="outline" size="sm" className="w-full" asChild>
                  <Link href={`/qualifications/${id}/cms-recommendation`}>Alle Details</Link>
                </Button>
              </>
            ) : (
              <div className="text-center py-4">
                <p className="text-sm text-muted-foreground">Noch nicht verfügbar</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Wird nach Website Audit berechnet
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Reference Matches Summary */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-muted-foreground" />
              <CardTitle>Relevante Referenzen</CardTitle>
            </div>
            <CardDescription>Top 5 passende Referenzprojekte</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {refMatches.length > 0 ? (
              <>
                {refMatches.slice(0, 3).map(({ match, reference }) => (
                  <div key={match.id} className="p-3 rounded-lg border">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <p className="font-medium text-sm">{reference?.projectName || 'Unknown'}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {reference?.customerName}
                        </p>
                      </div>
                      <div className="text-right ml-2">
                        <p className="font-bold">{match.totalScore}</p>
                        <p className="text-xs text-muted-foreground">Match</p>
                      </div>
                    </div>
                  </div>
                ))}

                <Button variant="outline" size="sm" className="w-full" asChild>
                  <Link href={`/qualifications/${id}/references`}>
                    Alle {refMatches.length} ansehen
                  </Link>
                </Button>
              </>
            ) : (
              <div className="text-center py-4">
                <p className="text-sm text-muted-foreground">Noch nicht verfügbar</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Wird nach Website Audit berechnet
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* BL Decision (if exists) */}
      {lead.blVote && (
        <Card>
          <CardHeader>
            <CardTitle>BL Entscheidung</CardTitle>
            <CardDescription>
              Entschieden am{' '}
              {lead.blVotedAt ? new Date(lead.blVotedAt).toLocaleDateString('de-DE') : 'Unbekannt'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Vote</p>
              <Badge variant={lead.blVote === 'BID' ? 'default' : 'destructive'} className="mt-1">
                {lead.blVote}
              </Badge>
            </div>

            {lead.blConfidenceScore !== null && lead.blConfidenceScore !== undefined && (
              <div>
                <p className="text-sm text-muted-foreground">Confidence Score</p>
                <p className="font-medium">{lead.blConfidenceScore}%</p>
              </div>
            )}

            {lead.blReasoning && (
              <div>
                <p className="text-sm text-muted-foreground">Begründung</p>
                <p className="mt-1 text-sm">{lead.blReasoning}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* BL Decision CTA (if in bl_reviewing status) */}
      {lead.status === 'bl_reviewing' && !lead.blVote && (
        <Card className="border-primary">
          <CardHeader>
            <CardTitle>BID/NO-BID Entscheidung</CardTitle>
            <CardDescription>Dieser Lead wartet auf Ihre Entscheidung</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href={`/qualifications/${id}/decision`}>Entscheidung treffen</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Navigieren Sie zu den verschiedenen Analysen</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild>
              <Link href={`/qualifications/${id}/quick-scan`}>Quick Scan ansehen</Link>
            </Button>
            {preQualification && (
              <Button variant="outline" asChild>
                <Link href={`/pre-qualifications/${preQualification.id}`}>Ursprüngliches Pre-Qualification</Link>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const statusConfig = {
    routed: { label: 'Weitergeleitet', variant: 'default' as const },
    full_scanning: { label: 'Full Scan läuft', variant: 'default' as const },
    bl_reviewing: { label: 'BL prüft', variant: 'default' as const },
    bid_voted: { label: 'Entschieden', variant: 'default' as const },
    archived: { label: 'Archiviert', variant: 'outline' as const },
  };

  const config = statusConfig[status as keyof typeof statusConfig] || {
    label: status,
    variant: 'secondary' as const,
  };

  return <Badge variant={config.variant}>{config.label}</Badge>;
}
