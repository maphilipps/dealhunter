import {
  Server,
  Gauge,
  ShieldCheck,
  Code,
  CheckCircle2,
  XCircle,
  Plug,
} from 'lucide-react';
import { notFound, redirect } from 'next/navigation';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { auth } from '@/lib/auth';
import { getCachedRfpWithRelations } from '@/lib/rfps/cached-queries';

// Tech Stack Data Types (from Quick Scan)
interface TechStackData {
  backend?: string[];
  cdn?: string;
  libraries?: string[];
  analytics?: string[];
  marketing?: string[];
  javascriptFrameworks?: Array<{ name: string; confidence: number }>;
  cssFrameworks?: Array<{ name: string; confidence: number }>;
  headlessCms?: string[];
  buildTools?: string[];
  cdnProviders?: string[];
  overallConfidence?: number;
  apiEndpoints?: {
    rest?: string[];
    graphql?: boolean;
  };
  serverSideRendering?: boolean;
  // Legacy fields
  cms?: string;
  framework?: string;
  hosting?: string;
}

interface PerformanceData {
  htmlSize?: number;
  resourceCount?: {
    scripts?: number;
    stylesheets?: number;
    images?: number;
    fonts?: number;
  };
  estimatedLoadTime?: 'fast' | 'medium' | 'slow';
  hasLazyLoading?: boolean;
  hasMinification?: boolean;
  hasCaching?: boolean;
  renderBlockingResources?: number;
}

interface AccessibilityAuditData {
  score: number;
  level?: 'A' | 'AA' | 'AAA' | 'fail';
  criticalIssues: number;
  seriousIssues: number;
  moderateIssues: number;
  minorIssues: number;
  checks?: {
    hasAltTexts?: boolean;
    hasAriaLabels?: boolean;
    hasProperHeadings?: boolean;
    hasSkipLinks?: boolean;
    colorContrast?: string;
    keyboardNavigation?: string;
    formLabels?: string;
    languageAttribute?: boolean;
  };
}

interface IntegrationsData {
  analytics?: string[];
  marketing?: string[];
  payment?: string[];
  social?: string[];
  other?: string[];
}

// Helper to parse JSON fields safely
function parseJsonField<T>(value: unknown): T | null {
  if (!value) return null;
  if (typeof value === 'object') {
    return value as T;
  }
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  }
  return null;
}

function StatusBadge({ ok, label }: { ok: boolean | undefined; label: string }) {
  if (ok === undefined) return null;
  return (
    <Badge variant={ok ? 'default' : 'secondary'} className={ok ? 'bg-green-600' : ''}>
      {ok ? <CheckCircle2 className="h-3 w-3 mr-1" /> : <XCircle className="h-3 w-3 mr-1" />}
      {label}
    </Badge>
  );
}

export default async function TechPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/login');
  }

  // Get RFP with relations (cached and parallelized)
  const { rfp, quickScan } = await getCachedRfpWithRelations(id);

  if (!rfp) {
    notFound();
  }

  // Check ownership
  if (rfp.userId !== session.user.id) {
    notFound();
  }

  // Parse tech stack data from Quick Scan
  const techStack = quickScan
    ? parseJsonField<TechStackData>(quickScan.techStack)
    : null;
  const performanceIndicators = quickScan
    ? parseJsonField<PerformanceData>(quickScan.performanceIndicators)
    : null;
  const accessibilityAudit = quickScan
    ? parseJsonField<AccessibilityAuditData>(quickScan.accessibilityAudit)
    : null;
  const integrations = quickScan
    ? parseJsonField<IntegrationsData>(quickScan.integrations)
    : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Tech Stack</h1>
        <p className="text-muted-foreground">Technologien und Performance-Indikatoren</p>
      </div>

      {/* Tech Stack Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Server className="h-5 w-5 text-purple-600" />
            <CardTitle>Technologie-Stack</CardTitle>
          </div>
          <CardDescription>ALLE identifizierten Technologien und Frameworks</CardDescription>
        </CardHeader>
        <CardContent>
          {techStack ? (
            <div className="space-y-4">
              {/* CSS Frameworks - SHOW ALL */}
              {techStack.cssFrameworks?.length ? (
                <div>
                  <p className="text-xs text-muted-foreground mb-2">CSS Frameworks</p>
                  <div className="flex flex-wrap gap-2">
                    {techStack.cssFrameworks.map((fw) => (
                      <Badge key={fw.name} variant="outline">
                        {fw.name} ({fw.confidence}%)
                      </Badge>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* JavaScript Frameworks - SHOW ALL */}
              {techStack.javascriptFrameworks?.length ? (
                <div>
                  <p className="text-xs text-muted-foreground mb-2">JavaScript Frameworks</p>
                  <div className="flex flex-wrap gap-2">
                    {techStack.javascriptFrameworks.map((fw) => (
                      <Badge key={fw.name} variant="outline">
                        {fw.name} ({fw.confidence}%)
                      </Badge>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* Backend - SHOW ALL */}
              {techStack.backend?.length ? (
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Backend</p>
                  <div className="flex flex-wrap gap-2">
                    {techStack.backend.map((b) => (
                      <Badge key={b} variant="outline">
                        {b}
                      </Badge>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* Libraries - SHOW ALL */}
              {techStack.libraries?.length ? (
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Libraries</p>
                  <div className="flex flex-wrap gap-2">
                    {techStack.libraries.map((lib) => (
                      <Badge key={lib} variant="outline">
                        {lib}
                      </Badge>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* Analytics - SHOW ALL */}
              {techStack.analytics?.length ? (
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Analytics</p>
                  <div className="flex flex-wrap gap-2">
                    {techStack.analytics.map((a) => (
                      <Badge key={a} variant="outline">
                        {a}
                      </Badge>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* Marketing - SHOW ALL */}
              {techStack.marketing?.length ? (
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Marketing</p>
                  <div className="flex flex-wrap gap-2">
                    {techStack.marketing.map((m) => (
                      <Badge key={m} variant="outline">
                        {m}
                      </Badge>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* Headless CMS - SHOW ALL */}
              {techStack.headlessCms?.length ? (
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Headless CMS</p>
                  <div className="flex flex-wrap gap-2">
                    {techStack.headlessCms.map((cms) => (
                      <Badge key={cms} variant="outline">
                        {cms}
                      </Badge>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* Build Tools - SHOW ALL */}
              {techStack.buildTools?.length ? (
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Build Tools</p>
                  <div className="flex flex-wrap gap-2">
                    {techStack.buildTools.map((tool) => (
                      <Badge key={tool} variant="outline">
                        {tool}
                      </Badge>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* CDN Providers - SHOW ALL */}
              {techStack.cdn || techStack.cdnProviders?.length ? (
                <div>
                  <p className="text-xs text-muted-foreground mb-2">CDN</p>
                  <div className="flex flex-wrap gap-2">
                    {techStack.cdn && <Badge variant="outline">{techStack.cdn}</Badge>}
                    {techStack.cdnProviders?.map((cdn) => (
                      <Badge key={cdn} variant="outline">
                        {cdn}
                      </Badge>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* API Endpoints - SHOW ALL */}
              {techStack.apiEndpoints?.rest?.length ? (
                <div>
                  <p className="text-xs text-muted-foreground mb-2">
                    API Endpoints ({techStack.apiEndpoints.rest.length} gefunden)
                  </p>
                  <div className="text-xs font-mono bg-slate-100 p-2 rounded max-h-64 overflow-auto">
                    {techStack.apiEndpoints.rest.map((url) => (
                      <div key={url} className="truncate">
                        {url}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* Server-Side Rendering */}
              <div className="flex gap-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">SSR</p>
                  <Badge variant={techStack.serverSideRendering ? 'default' : 'secondary'}>
                    {techStack.serverSideRendering ? 'Aktiv' : 'Nicht aktiv'}
                  </Badge>
                </div>
                {techStack.apiEndpoints?.graphql !== undefined && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">GraphQL</p>
                    <Badge variant={techStack.apiEndpoints.graphql ? 'default' : 'secondary'}>
                      {techStack.apiEndpoints.graphql ? 'Ja' : 'Nein'}
                    </Badge>
                  </div>
                )}
                {techStack.overallConfidence && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Confidence</p>
                    <Badge variant="outline">{techStack.overallConfidence}%</Badge>
                  </div>
                )}
              </div>

              {/* Legacy fields fallback */}
              {techStack.cms && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">CMS</p>
                  <p className="font-medium">{techStack.cms}</p>
                </div>
              )}
              {techStack.framework && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Framework</p>
                  <p className="font-medium">{techStack.framework}</p>
                </div>
              )}
              {techStack.hosting && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Hosting</p>
                  <p className="font-medium">{techStack.hosting}</p>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Keine Tech Stack-Informationen verfügbar. Bitte führen Sie einen Quick Scan durch.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Integrations Card */}
      {integrations && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Plug className="h-5 w-5 text-orange-600" />
              <CardTitle>Integrationen</CardTitle>
            </div>
            <CardDescription>Erkannte Drittanbieter-Services</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {integrations.analytics?.length ? (
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Analytics</p>
                  {integrations.analytics.map((a) => (
                    <Badge key={a} variant="outline" className="mr-1 mb-1 text-xs">
                      {a}
                    </Badge>
                  ))}
                </div>
              ) : null}
              {integrations.marketing?.length ? (
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Marketing</p>
                  {integrations.marketing.map((m) => (
                    <Badge key={m} variant="outline" className="mr-1 mb-1 text-xs">
                      {m}
                    </Badge>
                  ))}
                </div>
              ) : null}
              {integrations.payment?.length ? (
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Payment</p>
                  {integrations.payment.map((p) => (
                    <Badge key={p} variant="outline" className="mr-1 mb-1 text-xs">
                      {p}
                    </Badge>
                  ))}
                </div>
              ) : null}
              {integrations.social?.length ? (
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Social</p>
                  {integrations.social.map((s) => (
                    <Badge key={s} variant="outline" className="mr-1 mb-1 text-xs">
                      {s}
                    </Badge>
                  ))}
                </div>
              ) : null}
              {integrations.other?.length ? (
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Weitere</p>
                  {integrations.other.map((o) => (
                    <Badge key={o} variant="outline" className="mr-1 mb-1 text-xs">
                      {o}
                    </Badge>
                  ))}
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Performance Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Gauge className="h-5 w-5 text-yellow-600" />
            <CardTitle>Performance-Indikatoren</CardTitle>
          </div>
          <CardDescription>Ladezeiten und Optimierungen</CardDescription>
        </CardHeader>
        <CardContent>
          {performanceIndicators ? (
            <div className="space-y-4">
              {/* Load Time Estimate */}
              {performanceIndicators.estimatedLoadTime && (
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Geschätzte Ladezeit</p>
                  <Badge
                    variant={
                      performanceIndicators.estimatedLoadTime === 'fast'
                        ? 'default'
                        : performanceIndicators.estimatedLoadTime === 'medium'
                          ? 'secondary'
                          : 'destructive'
                    }
                  >
                    {performanceIndicators.estimatedLoadTime === 'fast'
                      ? 'Schnell'
                      : performanceIndicators.estimatedLoadTime === 'medium'
                        ? 'Mittel'
                        : 'Langsam'}
                  </Badge>
                </div>
              )}

              {/* Resource Count */}
              {performanceIndicators.resourceCount && (
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Ressourcen</p>
                  <div className="grid grid-cols-4 gap-4">
                    <div className="text-center p-2 bg-slate-50 rounded">
                      <Code className="h-4 w-4 mx-auto text-slate-500 mb-1" />
                      <p className="text-xl font-bold">
                        {performanceIndicators.resourceCount.scripts || 0}
                      </p>
                      <p className="text-xs text-muted-foreground">Scripts</p>
                    </div>
                    <div className="text-center p-2 bg-slate-50 rounded">
                      <p className="text-xl font-bold">
                        {performanceIndicators.resourceCount.stylesheets || 0}
                      </p>
                      <p className="text-xs text-muted-foreground">CSS</p>
                    </div>
                    <div className="text-center p-2 bg-slate-50 rounded">
                      <p className="text-xl font-bold">
                        {performanceIndicators.resourceCount.images || 0}
                      </p>
                      <p className="text-xs text-muted-foreground">Bilder</p>
                    </div>
                    <div className="text-center p-2 bg-slate-50 rounded">
                      <p className="text-xl font-bold">
                        {performanceIndicators.resourceCount.fonts || 0}
                      </p>
                      <p className="text-xs text-muted-foreground">Fonts</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Optimizations */}
              <div className="flex flex-wrap gap-2">
                {performanceIndicators.hasLazyLoading !== undefined && (
                  <StatusBadge ok={performanceIndicators.hasLazyLoading} label="Lazy Loading" />
                )}
                {performanceIndicators.hasMinification !== undefined && (
                  <StatusBadge ok={performanceIndicators.hasMinification} label="Minification" />
                )}
                {performanceIndicators.hasCaching !== undefined && (
                  <StatusBadge ok={performanceIndicators.hasCaching} label="Caching" />
                )}
              </div>

              {performanceIndicators.renderBlockingResources !== undefined && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Render-Blocking Resources</p>
                  <Badge
                    variant={
                      performanceIndicators.renderBlockingResources > 50
                        ? 'destructive'
                        : 'secondary'
                    }
                  >
                    {performanceIndicators.renderBlockingResources}
                  </Badge>
                </div>
              )}

              {performanceIndicators.htmlSize && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">HTML-Größe</p>
                  <p className="font-medium">
                    {(performanceIndicators.htmlSize / 1024).toFixed(2)} KB
                  </p>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Keine Performance-Daten verfügbar.</p>
          )}
        </CardContent>
      </Card>

      {/* Accessibility Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-indigo-600" />
            <CardTitle>Accessibility Audit</CardTitle>
          </div>
          <CardDescription>WCAG-Konformität und Barrierefreiheit</CardDescription>
        </CardHeader>
        <CardContent>
          {accessibilityAudit ? (
            <div className="space-y-4">
              {/* Score */}
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <Progress value={accessibilityAudit.score} className="h-3" />
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold">{accessibilityAudit.score}%</p>
                  {accessibilityAudit.level && (
                    <Badge
                      variant={accessibilityAudit.level === 'AAA' ? 'default' : 'secondary'}
                      className="mt-1"
                    >
                      WCAG {accessibilityAudit.level}
                    </Badge>
                  )}
                </div>
              </div>

              {/* Issues Breakdown */}
              <div className="grid grid-cols-4 gap-2 text-center">
                <div className="p-2 bg-red-50 rounded">
                  <p className="text-xl font-bold text-red-600">
                    {accessibilityAudit.criticalIssues}
                  </p>
                  <p className="text-xs text-red-600">Kritisch</p>
                </div>
                <div className="p-2 bg-orange-50 rounded">
                  <p className="text-xl font-bold text-orange-600">
                    {accessibilityAudit.seriousIssues}
                  </p>
                  <p className="text-xs text-orange-600">Schwer</p>
                </div>
                <div className="p-2 bg-yellow-50 rounded">
                  <p className="text-xl font-bold text-yellow-600">
                    {accessibilityAudit.moderateIssues}
                  </p>
                  <p className="text-xs text-yellow-600">Moderat</p>
                </div>
                <div className="p-2 bg-blue-50 rounded">
                  <p className="text-xl font-bold text-blue-600">
                    {accessibilityAudit.minorIssues}
                  </p>
                  <p className="text-xs text-blue-600">Gering</p>
                </div>
              </div>

              {/* Checks */}
              {accessibilityAudit.checks && (
                <div className="flex flex-wrap gap-2">
                  <StatusBadge ok={accessibilityAudit.checks.hasAltTexts} label="Alt-Texte" />
                  <StatusBadge ok={accessibilityAudit.checks.hasAriaLabels} label="ARIA Labels" />
                  <StatusBadge
                    ok={accessibilityAudit.checks.hasProperHeadings}
                    label="Headings"
                  />
                  <StatusBadge ok={accessibilityAudit.checks.hasSkipLinks} label="Skip Links" />
                  <StatusBadge
                    ok={accessibilityAudit.checks.languageAttribute}
                    label="Lang-Attribut"
                  />
                  {accessibilityAudit.checks.colorContrast && (
                    <Badge
                      variant={
                        accessibilityAudit.checks.colorContrast === 'pass'
                          ? 'default'
                          : 'destructive'
                      }
                    >
                      Kontrast: {accessibilityAudit.checks.colorContrast}
                    </Badge>
                  )}
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Kein Accessibility Audit durchgeführt.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
