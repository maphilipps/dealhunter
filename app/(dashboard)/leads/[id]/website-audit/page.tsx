import { eq } from 'drizzle-orm';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  FileText,
  Globe,
  Gauge,
  Image,
  Layout,
  Server,
  Zap,
} from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { leads, websiteAudits } from '@/lib/db/schema';

export default async function WebsiteAuditDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/login');
  }

  // Get lead
  const [lead] = await db.select().from(leads).where(eq(leads.id, id)).limit(1);

  if (!lead) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">Lead nicht gefunden</h1>
        <p className="text-muted-foreground">Der angeforderte Lead konnte nicht gefunden werden.</p>
      </div>
    );
  }

  // Get website audit
  const [audit] = await db
    .select()
    .from(websiteAudits)
    .where(eq(websiteAudits.leadId, id))
    .limit(1);

  if (!audit) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/leads/${id}`}>← Zurück zu Lead Overview</Link>
          </Button>
        </div>

        <h1 className="text-3xl font-bold tracking-tight">Website Audit</h1>
        <Card>
          <CardHeader>
            <CardTitle>Noch keine Audit-Daten verfügbar</CardTitle>
            <CardDescription>
              Der Website Audit wird automatisch nach Lead-Routing gestartet.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Bitte warten Sie, bis der Full-Scan abgeschlossen ist.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Parse JSON fields with proper typing
  const techStack = audit.techStack ? (JSON.parse(audit.techStack) as string[]) : null;
  const performanceBottlenecks = audit.performanceBottlenecks
    ? (JSON.parse(audit.performanceBottlenecks) as string[])
    : [];
  const contentTypes = audit.contentTypes
    ? (JSON.parse(audit.contentTypes) as {
        name: string;
        pattern: string;
        estimatedCount: number;
      }[])
    : [];
  const navigationStructure = audit.navigationStructure
    ? (JSON.parse(audit.navigationStructure) as {
        depth: number;
        breadth: number;
        mainNavItems: string[];
      })
    : null;
  const contentVolume = audit.contentVolume
    ? (JSON.parse(audit.contentVolume) as {
        images: number;
        videos: number;
        documents: number;
      })
    : null;
  const complexityFactors = audit.complexityFactors
    ? (JSON.parse(audit.complexityFactors) as {
        factor: string;
        impact: 'positive' | 'negative';
        score: number;
        description: string;
      }[])
    : [];
  const migrationRisks = audit.migrationRisks
    ? (JSON.parse(audit.migrationRisks) as {
        category: string;
        title: string;
        description: string;
        impact: 'low' | 'medium' | 'high';
        mitigation: string;
      }[])
    : [];
  const a11yViolations = audit.a11yViolations
    ? (JSON.parse(audit.a11yViolations) as {
        id: string;
        impact: 'minor' | 'moderate' | 'serious' | 'critical';
        count: number;
        description: string;
        helpUrl: string;
      }[])
    : [];
  const screenshots = audit.screenshots
    ? (JSON.parse(audit.screenshots) as { url: string; title: string }[])
    : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-4 mb-2">
            <Button variant="outline" size="sm" asChild>
              <Link href={`/leads/${id}`}>← Zurück zu Lead Overview</Link>
            </Button>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Website Audit</h1>
          <p className="text-muted-foreground">{lead.customerName}</p>
        </div>
        <AuditStatusBadge status={audit.status} />
      </div>

      {audit.status === 'running' && (
        <Card className="border-blue-200 bg-blue-50/50">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 animate-pulse text-blue-600" />
              <CardTitle>Audit läuft...</CardTitle>
            </div>
            <CardDescription>
              Der Website Audit wird derzeit durchgeführt. Dies kann einige Minuten dauern.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          </CardContent>
        </Card>
      )}

      {audit.status === 'failed' && (
        <Card className="border-destructive">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              <CardTitle>Audit fehlgeschlagen</CardTitle>
            </div>
            <CardDescription>Der Website Audit konnte nicht abgeschlossen werden.</CardDescription>
          </CardHeader>
        </Card>
      )}

      {audit.status === 'completed' && (
        <>
          {/* Tech Stack Section */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Server className="h-5 w-5 text-muted-foreground" />
                <CardTitle>Tech Stack</CardTitle>
              </div>
              <CardDescription>Erkannte Technologien und Frameworks</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">
                    Content Management
                  </p>
                  <div className="space-y-1">
                    <p className="font-semibold">{audit.cms || 'Unbekannt'}</p>
                    {audit.cmsVersion && (
                      <p className="text-sm text-muted-foreground">Version: {audit.cmsVersion}</p>
                    )}
                  </div>
                </div>

                {audit.framework && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-2">Framework</p>
                    <p className="font-semibold">{audit.framework}</p>
                  </div>
                )}

                {audit.hosting && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-2">Hosting</p>
                    <p className="font-semibold">{audit.hosting}</p>
                  </div>
                )}

                {audit.server && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-2">Server</p>
                    <p className="font-semibold">{audit.server}</p>
                  </div>
                )}
              </div>

              {techStack && techStack.length > 0 && (
                <>
                  <Separator className="my-4" />
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-3">
                      Weitere Technologien
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {techStack.map((tech: string) => (
                        <Badge key={tech} variant="secondary">
                          {tech}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Performance Section */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-muted-foreground" />
                <CardTitle>Performance Metrics</CardTitle>
              </div>
              <CardDescription>Core Web Vitals und Performance-Analyse</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Performance Score */}
              {audit.performanceScore !== null && (
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-muted-foreground">Overall Performance Score</span>
                    <span className="font-medium">{audit.performanceScore}/100</span>
                  </div>
                  <Progress value={audit.performanceScore} />
                  <p className="text-xs text-muted-foreground mt-1">
                    <PerformanceGradeLabel score={audit.performanceScore} />
                  </p>
                </div>
              )}

              <Separator />

              {/* Core Web Vitals */}
              <div>
                <h4 className="font-semibold mb-4">Core Web Vitals</h4>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  {audit.lcp !== null && (
                    <MetricCard
                      title="LCP"
                      subtitle="Largest Contentful Paint"
                      value={`${(audit.lcp / 1000).toFixed(2)}s`}
                      threshold={2.5}
                      actualValue={audit.lcp / 1000}
                    />
                  )}
                  {audit.fid !== null && (
                    <MetricCard
                      title="FID"
                      subtitle="First Input Delay"
                      value={`${audit.fid}ms`}
                      threshold={100}
                      actualValue={audit.fid}
                    />
                  )}
                  {audit.cls && (
                    <MetricCard
                      title="CLS"
                      subtitle="Cumulative Layout Shift"
                      value={audit.cls}
                      threshold={0.1}
                      actualValue={parseFloat(audit.cls)}
                    />
                  )}
                  {audit.ttfb !== null && (
                    <MetricCard
                      title="TTFB"
                      subtitle="Time to First Byte"
                      value={`${audit.ttfb}ms`}
                      threshold={600}
                      actualValue={audit.ttfb}
                    />
                  )}
                </div>
              </div>

              {/* Performance Bottlenecks */}
              {performanceBottlenecks.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <h4 className="font-semibold mb-3">Performance Bottlenecks</h4>
                    <ul className="space-y-2">
                      {performanceBottlenecks.map((bottleneck: string, idx: number) => (
                        <li key={idx} className="flex items-start gap-2 text-sm">
                          <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                          <span>{bottleneck}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Content Architecture Section */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Layout className="h-5 w-5 text-muted-foreground" />
                <CardTitle>Content Architecture</CardTitle>
              </div>
              <CardDescription>Seitenstruktur und Content-Analyse</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Overview Metrics */}
              <div className="grid gap-4 md:grid-cols-4">
                <div className="rounded-lg border p-4">
                  <p className="text-sm text-muted-foreground mb-1">Seiten gesamt</p>
                  <p className="text-2xl font-bold">{audit.pageCount || 0}</p>
                </div>
                {contentVolume && (
                  <>
                    <div className="rounded-lg border p-4">
                      <p className="text-sm text-muted-foreground mb-1">Bilder</p>
                      <p className="text-2xl font-bold">{contentVolume.images || 0}</p>
                    </div>
                    <div className="rounded-lg border p-4">
                      <p className="text-sm text-muted-foreground mb-1">Videos</p>
                      <p className="text-2xl font-bold">{contentVolume.videos || 0}</p>
                    </div>
                    <div className="rounded-lg border p-4">
                      <p className="text-sm text-muted-foreground mb-1">Dokumente</p>
                      <p className="text-2xl font-bold">{contentVolume.documents || 0}</p>
                    </div>
                  </>
                )}
              </div>

              {/* Content Types */}
              {contentTypes.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <h4 className="font-semibold mb-3">Content Types</h4>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Typ</TableHead>
                          <TableHead>URL Pattern</TableHead>
                          <TableHead className="text-right">Geschätzte Anzahl</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {contentTypes.map(
                          (
                            ct: {
                              name: string;
                              pattern: string;
                              estimatedCount: number;
                            },
                            idx: number
                          ) => (
                            <TableRow key={idx}>
                              <TableCell className="font-medium">{ct.name}</TableCell>
                              <TableCell className="font-mono text-xs">{ct.pattern}</TableCell>
                              <TableCell className="text-right">{ct.estimatedCount}</TableCell>
                            </TableRow>
                          )
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}

              {/* Navigation Structure */}
              {navigationStructure && (
                <>
                  <Separator />
                  <div>
                    <h4 className="font-semibold mb-3">Navigation Structure</h4>
                    <div className="grid gap-4 md:grid-cols-3">
                      <div>
                        <p className="text-sm text-muted-foreground">Tiefe</p>
                        <p className="text-lg font-semibold">{navigationStructure.depth} Ebenen</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Breite (Durchschnitt)</p>
                        <p className="text-lg font-semibold">{navigationStructure.breadth} Items</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Hauptnavigation</p>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {navigationStructure.mainNavItems
                            .slice(0, 5)
                            .map((item: string, idx: number) => (
                              <Badge key={idx} variant="outline">
                                {item}
                              </Badge>
                            ))}
                          {navigationStructure.mainNavItems.length > 5 && (
                            <Badge variant="outline">
                              +{navigationStructure.mainNavItems.length - 5}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Migration Complexity Section */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Gauge className="h-5 w-5 text-muted-foreground" />
                <CardTitle>Migration Complexity</CardTitle>
              </div>
              <CardDescription>Bewertung der Migrations-Komplexität</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Complexity Overview */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-lg border p-4">
                  <p className="text-sm text-muted-foreground mb-2">Complexity Score</p>
                  <div className="flex items-baseline gap-2">
                    <p className="text-3xl font-bold">{audit.complexityScore || 0}</p>
                    <p className="text-muted-foreground">/100</p>
                  </div>
                  {audit.complexityScore !== null && (
                    <Progress value={audit.complexityScore} className="mt-2" />
                  )}
                </div>
                <div className="rounded-lg border p-4">
                  <p className="text-sm text-muted-foreground mb-2">Kategorie</p>
                  <ComplexityBadge complexity={audit.migrationComplexity} />
                </div>
              </div>

              {/* Complexity Factors */}
              {complexityFactors.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <h4 className="font-semibold mb-3">Complexity Factors</h4>
                    <div className="space-y-2">
                      {complexityFactors.map((factor, idx) => (
                          <div
                            key={idx}
                            className="flex items-start gap-3 p-3 rounded-lg border bg-card"
                          >
                            <div className="flex-shrink-0 mt-0.5">
                              {factor.impact === 'negative' ? (
                                <AlertTriangle className="h-4 w-4 text-red-600" />
                              ) : (
                                <CheckCircle2 className="h-4 w-4 text-green-600" />
                              )}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center justify-between mb-1">
                                <p className="font-medium text-sm">{factor.factor}</p>
                                <Badge
                                  variant={factor.impact === 'negative' ? 'destructive' : 'default'}
                                >
                                  {factor.score > 0 ? '+' : ''}
                                  {factor.score}
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground">{factor.description}</p>
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  </div>
                </>
              )}

              {/* Migration Risks */}
              {migrationRisks.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <h4 className="font-semibold mb-3">Migration Risks</h4>
                    <div className="space-y-3">
                      {migrationRisks.map((risk, idx) => (
                          <div key={idx} className="rounded-lg border p-4">
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <p className="font-semibold">{risk.title}</p>
                                  <ImpactBadge impact={risk.impact} />
                                </div>
                                <Badge variant="outline" className="mb-2">
                                  {risk.category}
                                </Badge>
                              </div>
                            </div>
                            <p className="text-sm text-muted-foreground mb-3">{risk.description}</p>
                            <div className="rounded-lg bg-muted p-3">
                              <p className="text-xs font-medium text-muted-foreground mb-1">
                                Mitigation
                              </p>
                              <p className="text-sm">{risk.mitigation}</p>
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Accessibility Section */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Globe className="h-5 w-5 text-muted-foreground" />
                <CardTitle>Accessibility Audit</CardTitle>
              </div>
              <CardDescription>WCAG 2.1 AA Compliance Check</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Accessibility Overview */}
              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-lg border p-4">
                  <p className="text-sm text-muted-foreground mb-2">Accessibility Score</p>
                  <div className="flex items-baseline gap-2">
                    <p className="text-3xl font-bold">{audit.accessibilityScore || 0}</p>
                    <p className="text-muted-foreground">/100</p>
                  </div>
                  {audit.accessibilityScore !== null && (
                    <Progress value={audit.accessibilityScore} className="mt-2" />
                  )}
                </div>
                <div className="rounded-lg border p-4">
                  <p className="text-sm text-muted-foreground mb-2">WCAG Level</p>
                  <Badge variant="outline" className="text-lg">
                    {audit.wcagLevel || 'AA'}
                  </Badge>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="text-sm text-muted-foreground mb-2">Geschätzte Fix Hours</p>
                  <p className="text-3xl font-bold">{audit.estimatedFixHours || 0}h</p>
                </div>
              </div>

              {/* Issues Summary */}
              {audit.a11yIssueCount !== null && audit.a11yIssueCount > 0 && (
                <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <AlertTriangle className="h-5 w-5 text-yellow-600" />
                    <p className="font-semibold text-yellow-900">
                      {audit.a11yIssueCount} Accessibility Issues gefunden
                    </p>
                  </div>
                  <p className="text-sm text-yellow-800">
                    Es wurden {a11yViolations.length} verschiedene Arten von Verstößen auf{' '}
                    {audit.a11yIssueCount} Stellen identifiziert.
                  </p>
                </div>
              )}

              {/* Violations */}
              {a11yViolations.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <h4 className="font-semibold mb-3">WCAG Violations</h4>
                    <div className="space-y-2">
                      {a11yViolations.slice(0, 10).map((violation, idx) => (
                          <div
                            key={idx}
                            className="flex items-start gap-3 p-3 rounded-lg border bg-card"
                          >
                            <div className="flex-shrink-0 mt-0.5">
                              <ImpactIcon impact={violation.impact} />
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center justify-between mb-1">
                                <p className="font-medium text-sm font-mono">{violation.id}</p>
                                <Badge variant="outline">
                                  {violation.count}{' '}
                                  {violation.count === 1 ? 'Instanz' : 'Instanzen'}
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground mb-2">
                                {violation.description}
                              </p>
                              <a
                                href={violation.helpUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                              >
                                <FileText className="h-3 w-3" />
                                Mehr erfahren
                              </a>
                            </div>
                          </div>
                        )
                      )}
                    </div>
                    {a11yViolations.length > 10 && (
                      <p className="text-sm text-muted-foreground mt-3">
                        +{a11yViolations.length - 10} weitere Violations
                      </p>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Screenshots Gallery */}
          {screenshots.length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Image className="h-5 w-5 text-muted-foreground" />
                  <CardTitle>Screenshots</CardTitle>
                </div>
                <CardDescription>
                  Visuelle Aufnahmen der Website ({screenshots.length} Bilder)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {screenshots.map((screenshot, idx) => (
                    <div key={idx} className="rounded-lg border overflow-hidden">
                      <div className="aspect-video bg-muted flex items-center justify-center">
                        <Image className="h-8 w-8 text-muted-foreground" />
                      </div>
                      <div className="p-3">
                        <p className="text-sm font-medium truncate">{screenshot.title}</p>
                        <p className="text-xs text-muted-foreground truncate">{screenshot.url}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPER COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════

function AuditStatusBadge({ status }: { status: string }) {
  const statusConfig = {
    pending: { label: 'Ausstehend', variant: 'outline' as const },
    running: { label: 'Läuft', variant: 'default' as const },
    completed: { label: 'Abgeschlossen', variant: 'default' as const },
    failed: { label: 'Fehlgeschlagen', variant: 'destructive' as const },
  };

  const config = statusConfig[status as keyof typeof statusConfig] || {
    label: status,
    variant: 'secondary' as const,
  };

  return <Badge variant={config.variant}>{config.label}</Badge>;
}

function PerformanceGradeLabel({ score }: { score: number }) {
  if (score >= 90) return <span className="text-green-600 font-medium">Excellent (A)</span>;
  if (score >= 75) return <span className="text-blue-600 font-medium">Good (B+)</span>;
  if (score >= 60) return <span className="text-yellow-600 font-medium">Fair (B)</span>;
  if (score >= 40) return <span className="text-orange-600 font-medium">Poor (C)</span>;
  return <span className="text-red-600 font-medium">Very Poor (D)</span>;
}

function MetricCard({
  title,
  subtitle,
  value,
  threshold,
  actualValue,
}: {
  title: string;
  subtitle: string;
  value: string;
  threshold: number;
  actualValue: number;
}) {
  const isGood = actualValue <= threshold;

  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-center gap-2 mb-1">
        <p className="text-sm font-medium">{title}</p>
        {isGood ? (
          <CheckCircle2 className="h-4 w-4 text-green-600" />
        ) : (
          <AlertTriangle className="h-4 w-4 text-yellow-600" />
        )}
      </div>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
    </div>
  );
}

function ComplexityBadge({
  complexity,
}: {
  complexity: 'low' | 'medium' | 'high' | 'very_high' | null;
}) {
  const config = {
    low: { label: 'Low', variant: 'default' as const, className: 'bg-green-100 text-green-800' },
    medium: {
      label: 'Medium',
      variant: 'outline' as const,
      className: 'bg-yellow-100 text-yellow-800',
    },
    high: {
      label: 'High',
      variant: 'outline' as const,
      className: 'bg-orange-100 text-orange-800',
    },
    very_high: {
      label: 'Very High',
      variant: 'destructive' as const,
      className: 'bg-red-100 text-red-800',
    },
  };

  const selectedConfig = complexity ? config[complexity] : config.medium;

  return <Badge className={selectedConfig.className}>{selectedConfig.label}</Badge>;
}

function ImpactBadge({ impact }: { impact: 'low' | 'medium' | 'high' }) {
  const config = {
    low: { label: 'Low Impact', className: 'bg-green-100 text-green-800' },
    medium: { label: 'Medium Impact', className: 'bg-yellow-100 text-yellow-800' },
    high: { label: 'High Impact', className: 'bg-red-100 text-red-800' },
  };

  return <Badge className={config[impact].className}>{config[impact].label}</Badge>;
}

function ImpactIcon({ impact }: { impact: 'minor' | 'moderate' | 'serious' | 'critical' }) {
  const config = {
    minor: { icon: AlertCircle, className: 'text-blue-600' },
    moderate: { icon: AlertTriangle, className: 'text-yellow-600' },
    serious: { icon: AlertTriangle, className: 'text-orange-600' },
    critical: { icon: AlertCircle, className: 'text-red-600' },
  };

  const Icon = config[impact].icon;
  return <Icon className={`h-4 w-4 ${config[impact].className}`} />;
}
