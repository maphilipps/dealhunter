import {
  Server,
  Gauge,
  ShieldCheck,
  Code,
  CheckCircle2,
  XCircle,
  Plug,
  FileText,
  Layers,
  Cloud,
  AlertTriangle,
} from 'lucide-react';
import { notFound, redirect } from 'next/navigation';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { getAgentResult } from '@/lib/agents/expert-agents';
import type { TechStackAnalysis } from '@/lib/agents/expert-agents/techstack-schema';
import { auth } from '@/lib/auth';
import { getCachedRfpWithRelations } from '@/lib/rfps/cached-queries';

// Labels for categories and requirement types
const categoryLabels: Record<string, string> = {
  cms: 'CMS',
  framework: 'Framework',
  language: 'Programmiersprache',
  database: 'Datenbank',
  cloud: 'Cloud',
  integration: 'Integration',
  security: 'Security',
  analytics: 'Analytics',
  other: 'Sonstige',
};

const requirementTypeLabels: Record<string, string> = {
  required: 'Erforderlich',
  preferred: 'Bevorzugt',
  excluded: 'Ausgeschlossen',
  mentioned: 'Erwähnt',
};

const flexibilityLabels: Record<string, string> = {
  rigid: 'Strikt vorgegeben',
  preferred: 'Bevorzugt',
  flexible: 'Flexibel',
  open: 'Offen',
};

const flexibilityColors: Record<string, string> = {
  rigid: 'bg-red-100 text-red-800',
  preferred: 'bg-yellow-100 text-yellow-800',
  flexible: 'bg-blue-100 text-blue-800',
  open: 'bg-green-100 text-green-800',
};

const requirementTypeColors: Record<string, string> = {
  required: 'bg-red-100 text-red-800',
  preferred: 'bg-yellow-100 text-yellow-800',
  excluded: 'bg-gray-100 text-gray-800',
  mentioned: 'bg-blue-100 text-blue-800',
};

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

  // Get RFP with relations (cached and parallelized) and expert agent results
  const [{ rfp, quickScan }, techStackAgentResult] = await Promise.all([
    getCachedRfpWithRelations(id),
    getAgentResult(id, 'techstack_expert'),
  ]);

  if (!rfp) {
    notFound();
  }

  // Check ownership
  if (rfp.userId !== session.user.id) {
    notFound();
  }

  // Parse techstack expert analysis
  let techStackAnalysis: TechStackAnalysis | null = null;
  if (techStackAgentResult?.metadata?.result) {
    techStackAnalysis = techStackAgentResult.metadata.result as TechStackAnalysis;
  }

  // Parse tech stack data from Quick Scan
  const techStack = quickScan ? parseJsonField<TechStackData>(quickScan.techStack) : null;
  const performanceIndicators = quickScan
    ? parseJsonField<PerformanceData>(quickScan.performanceIndicators)
    : null;
  const accessibilityAudit = quickScan
    ? parseJsonField<AccessibilityAuditData>(quickScan.accessibilityAudit)
    : null;
  const integrations = quickScan ? parseJsonField<IntegrationsData>(quickScan.integrations) : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Tech Stack</h1>
        <p className="text-muted-foreground">Anforderungen aus RFP & Website-Analyse</p>
      </div>

      {/* RFP Requirements Section */}
      {techStackAnalysis && (
        <>
          <div className="space-y-4">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-600" />
              RFP Anforderungen (Expert Agent)
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* CMS Requirements Card */}
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Layers className="h-5 w-5 text-blue-600" />
                    <CardTitle className="text-lg">CMS Anforderungen</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <Badge
                      className={flexibilityColors[techStackAnalysis.cmsRequirements.flexibility]}
                    >
                      {flexibilityLabels[techStackAnalysis.cmsRequirements.flexibility]}
                    </Badge>
                    {techStackAnalysis.cmsRequirements.headlessRequired && (
                      <Badge variant="outline">Headless erforderlich</Badge>
                    )}
                    {techStackAnalysis.cmsRequirements.multilingualRequired && (
                      <Badge variant="outline">Mehrsprachig erforderlich</Badge>
                    )}
                  </div>

                  {techStackAnalysis.cmsRequirements.explicit?.length ? (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Explizit gefordert</p>
                      <div className="flex flex-wrap gap-1">
                        {techStackAnalysis.cmsRequirements.explicit.map(cms => (
                          <Badge key={cms} variant="default" className="bg-red-600">
                            {cms}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {techStackAnalysis.cmsRequirements.preferred?.length ? (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Bevorzugt</p>
                      <div className="flex flex-wrap gap-1">
                        {techStackAnalysis.cmsRequirements.preferred.map(cms => (
                          <Badge key={cms} variant="secondary">
                            {cms}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {techStackAnalysis.cmsRequirements.excluded?.length ? (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Ausgeschlossen</p>
                      <div className="flex flex-wrap gap-1">
                        {techStackAnalysis.cmsRequirements.excluded.map(cms => (
                          <Badge key={cms} variant="outline" className="line-through text-gray-500">
                            {cms}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </CardContent>
              </Card>

              {/* Integration Requirements Card */}
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Plug className="h-5 w-5 text-orange-600" />
                    <CardTitle className="text-lg">Integration Anforderungen</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {techStackAnalysis.integrations.sso?.length ? (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">SSO Systeme</p>
                      <div className="flex flex-wrap gap-1">
                        {techStackAnalysis.integrations.sso.map(s => (
                          <Badge key={s} variant="outline">
                            {s}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {techStackAnalysis.integrations.erp?.length ? (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">ERP Systeme</p>
                      <div className="flex flex-wrap gap-1">
                        {techStackAnalysis.integrations.erp.map(e => (
                          <Badge key={e} variant="outline">
                            {e}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {techStackAnalysis.integrations.crm?.length ? (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">CRM Systeme</p>
                      <div className="flex flex-wrap gap-1">
                        {techStackAnalysis.integrations.crm.map(c => (
                          <Badge key={c} variant="outline">
                            {c}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {techStackAnalysis.integrations.payment?.length ? (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Payment Provider</p>
                      <div className="flex flex-wrap gap-1">
                        {techStackAnalysis.integrations.payment.map(p => (
                          <Badge key={p} variant="outline">
                            {p}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {techStackAnalysis.integrations.other?.length ? (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Weitere Integrationen</p>
                      <div className="flex flex-wrap gap-1">
                        {techStackAnalysis.integrations.other.map(o => (
                          <Badge key={o} variant="outline">
                            {o}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {!techStackAnalysis.integrations.sso?.length &&
                    !techStackAnalysis.integrations.erp?.length &&
                    !techStackAnalysis.integrations.crm?.length &&
                    !techStackAnalysis.integrations.payment?.length &&
                    !techStackAnalysis.integrations.other?.length && (
                      <p className="text-sm text-muted-foreground">
                        Keine Integrationen spezifiziert
                      </p>
                    )}
                </CardContent>
              </Card>

              {/* Infrastructure Requirements Card */}
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Cloud className="h-5 w-5 text-cyan-600" />
                    <CardTitle className="text-lg">Infrastruktur Anforderungen</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {techStackAnalysis.infrastructure.cloudProviders?.length ? (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Cloud Provider</p>
                      <div className="flex flex-wrap gap-1">
                        {techStackAnalysis.infrastructure.cloudProviders.map(c => (
                          <Badge key={c} variant="outline">
                            {c}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {techStackAnalysis.infrastructure.hostingRequirements && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Hosting</p>
                      <p className="text-sm">
                        {techStackAnalysis.infrastructure.hostingRequirements}
                      </p>
                    </div>
                  )}

                  {techStackAnalysis.infrastructure.securityCertifications?.length ? (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">
                        Security Zertifizierungen
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {techStackAnalysis.infrastructure.securityCertifications.map(s => (
                          <Badge key={s} variant="outline" className="bg-green-50">
                            {s}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {techStackAnalysis.infrastructure.complianceRequirements?.length ? (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Compliance Anforderungen</p>
                      <div className="flex flex-wrap gap-1">
                        {techStackAnalysis.infrastructure.complianceRequirements.map(c => (
                          <Badge key={c} variant="outline" className="bg-yellow-50">
                            {c}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {!techStackAnalysis.infrastructure.cloudProviders?.length &&
                    !techStackAnalysis.infrastructure.hostingRequirements &&
                    !techStackAnalysis.infrastructure.securityCertifications?.length &&
                    !techStackAnalysis.infrastructure.complianceRequirements?.length && (
                      <p className="text-sm text-muted-foreground">
                        Keine Infrastruktur-Anforderungen spezifiziert
                      </p>
                    )}
                </CardContent>
              </Card>

              {/* Complexity Assessment Card */}
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-amber-600" />
                    <CardTitle className="text-lg">Komplexitätsbewertung</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs text-muted-foreground">Komplexitätsscore</p>
                      <span className="text-lg font-bold">
                        {techStackAnalysis.complexityScore}/10
                      </span>
                    </div>
                    <Progress value={techStackAnalysis.complexityScore * 10} className="h-2" />
                  </div>

                  {techStackAnalysis.complexityFactors.length > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-2">Komplexitätsfaktoren</p>
                      <ul className="text-sm space-y-1">
                        {techStackAnalysis.complexityFactors.map((factor, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <span className="text-amber-600 mt-0.5">•</span>
                            <span>{factor}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="pt-2">
                    <Badge variant="outline">Konfidenz: {techStackAnalysis.confidence}%</Badge>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* All Technology Requirements Table */}
            {techStackAnalysis.requirements.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Alle Technologie-Anforderungen</CardTitle>
                  <CardDescription>Aus dem RFP-Dokument extrahierte Technologien</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Kategorie</TableHead>
                        <TableHead>Typ</TableHead>
                        <TableHead>Kontext</TableHead>
                        <TableHead className="text-right">Konfidenz</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {techStackAnalysis.requirements.map((req, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-medium">{req.name}</TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {categoryLabels[req.category] || req.category}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge className={requirementTypeColors[req.requirementType]}>
                              {requirementTypeLabels[req.requirementType] || req.requirementType}
                            </Badge>
                          </TableCell>
                          <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                            {req.context}
                          </TableCell>
                          <TableCell className="text-right">{req.confidence}%</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </div>

          <Separator className="my-8" />
        </>
      )}

      {/* Website Tech Stack Section Header */}
      <h2 className="text-xl font-semibold flex items-center gap-2">
        <Server className="h-5 w-5 text-purple-600" />
        Website Tech Stack (Quick Scan)
      </h2>

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
                    {techStack.cssFrameworks.map(fw => (
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
                    {techStack.javascriptFrameworks.map(fw => (
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
                    {techStack.backend.map(b => (
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
                    {techStack.libraries.map(lib => (
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
                    {techStack.analytics.map(a => (
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
                    {techStack.marketing.map(m => (
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
                    {techStack.headlessCms.map(cms => (
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
                    {techStack.buildTools.map(tool => (
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
                    {techStack.cdnProviders?.map(cdn => (
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
                    {techStack.apiEndpoints.rest.map(url => (
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
                  {integrations.analytics.map(a => (
                    <Badge key={a} variant="outline" className="mr-1 mb-1 text-xs">
                      {a}
                    </Badge>
                  ))}
                </div>
              ) : null}
              {integrations.marketing?.length ? (
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Marketing</p>
                  {integrations.marketing.map(m => (
                    <Badge key={m} variant="outline" className="mr-1 mb-1 text-xs">
                      {m}
                    </Badge>
                  ))}
                </div>
              ) : null}
              {integrations.payment?.length ? (
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Payment</p>
                  {integrations.payment.map(p => (
                    <Badge key={p} variant="outline" className="mr-1 mb-1 text-xs">
                      {p}
                    </Badge>
                  ))}
                </div>
              ) : null}
              {integrations.social?.length ? (
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Social</p>
                  {integrations.social.map(s => (
                    <Badge key={s} variant="outline" className="mr-1 mb-1 text-xs">
                      {s}
                    </Badge>
                  ))}
                </div>
              ) : null}
              {integrations.other?.length ? (
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Weitere</p>
                  {integrations.other.map(o => (
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
                  <StatusBadge ok={accessibilityAudit.checks.hasProperHeadings} label="Headings" />
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
            <p className="text-sm text-muted-foreground">Kein Accessibility Audit durchgeführt.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
