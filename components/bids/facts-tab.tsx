'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import {
  Loader2,
  RotateCcw,
  Globe,
  Server,
  Code,
  Zap,
  Gauge,
  FileText,
  Users,
  Camera,
  AlertCircle,
  ExternalLink,
  CheckCircle,
  XCircle,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';
import type { QuickScan } from '@/lib/db/schema';
import { retriggerQuickScan } from '@/lib/quick-scan/actions';
import type {
  TechStack,
  PerformanceIndicators,
  ContentVolume,
  DecisionMakersResearch,
  Screenshots,
  AccessibilityAudit,
} from '@/lib/quick-scan/schema';

interface FactsTabProps {
  quickScan: QuickScan;
  bidId: string;
}

/**
 * Facts Tab Component - Structured Card-based UI
 *
 * Displays Quick Scan results in consistent, scannable cards.
 * All cards use ShadCN components only.
 */
export function FactsTab({ quickScan, bidId }: FactsTabProps) {
  const [isRetriggering, setIsRetriggering] = useState(false);

  // Parse JSON fields from Quick Scan
  const techStack: TechStack | null = quickScan.techStack
    ? (JSON.parse(quickScan.techStack) as TechStack)
    : null;
  const performanceIndicators: PerformanceIndicators | null = quickScan.performanceIndicators
    ? (JSON.parse(quickScan.performanceIndicators) as PerformanceIndicators)
    : null;
  const contentVolume: ContentVolume | null = quickScan.contentVolume
    ? (JSON.parse(quickScan.contentVolume) as ContentVolume)
    : null;
  const decisionMakers: DecisionMakersResearch | null = quickScan.decisionMakers
    ? (JSON.parse(quickScan.decisionMakers) as DecisionMakersResearch)
    : null;
  const screenshots: Screenshots | null = quickScan.screenshots
    ? (JSON.parse(quickScan.screenshots) as Screenshots)
    : null;
  const accessibilityAudit: AccessibilityAudit | null = quickScan.accessibilityAudit
    ? (JSON.parse(quickScan.accessibilityAudit) as AccessibilityAudit)
    : null;

  const handleRetrigger = async () => {
    setIsRetriggering(true);
    toast.info('Starte Quick Scan erneut...');
    try {
      const result = await retriggerQuickScan(bidId);
      if (result.success) {
        toast.success('Quick Scan gestartet - bitte warten...');
        window.location.reload();
      } else {
        toast.error(result.error || 'Quick Scan Re-Trigger fehlgeschlagen');
        setIsRetriggering(false);
      }
    } catch {
      toast.error('Ein Fehler ist aufgetreten');
      setIsRetriggering(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-blue-600" />
              <CardTitle>Website-Analyse</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => void handleRetrigger()}
                disabled={isRetriggering}
              >
                {isRetriggering ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <RotateCcw className="h-4 w-4 mr-1" />
                )}
                Erneut scannen
              </Button>
              <Badge variant={quickScan.status === 'completed' ? 'default' : 'destructive'}>
                {quickScan.status === 'completed' ? 'Abgeschlossen' : 'Fehlgeschlagen'}
              </Badge>
            </div>
          </div>
          <CardDescription>Analyse von {quickScan.websiteUrl}</CardDescription>
        </CardHeader>
      </Card>

      {/* Tech Stack Card */}
      {techStack && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Code className="h-5 w-5 text-purple-600" />
              <CardTitle>Technologie-Stack</CardTitle>
            </div>
            <CardDescription>Erkannte Technologien und Frameworks</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* CMS */}
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Content Management System</p>
                <Badge variant="default" className="text-base">
                  {techStack.cms || 'Custom'}
                </Badge>
                {techStack.cmsVersion && (
                  <p className="text-xs text-muted-foreground">Version: {techStack.cmsVersion}</p>
                )}
              </div>

              {/* Framework */}
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Frontend Framework</p>
                <Badge variant="secondary" className="text-base">
                  {techStack.framework || 'Vanilla JS'}
                </Badge>
                {techStack.frameworkVersion && (
                  <p className="text-xs text-muted-foreground">Version: {techStack.frameworkVersion}</p>
                )}
              </div>

              {/* Backend */}
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Backend</p>
                <div className="flex flex-wrap gap-1">
                  {techStack.backend && techStack.backend.length > 0 ? (
                    techStack.backend.map(tech => (
                      <Badge key={tech} variant="outline">
                        {tech}
                      </Badge>
                    ))
                  ) : (
                    <Badge variant="outline">Unknown</Badge>
                  )}
                </div>
              </div>
            </div>

            {/* Confidence Score */}
            {techStack.cmsConfidence !== undefined && (
              <div className="pt-3 border-t">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Erkennungs-Confidence</span>
                  <span className="text-sm font-bold">{techStack.cmsConfidence}%</span>
                </div>
                <Progress value={techStack.cmsConfidence} className="h-2" />
              </div>
            )}

            {/* Hosting & Server */}
            {(techStack.hosting || techStack.server) && (
              <div className="pt-3 border-t grid grid-cols-2 gap-4">
                {techStack.hosting && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Hosting</p>
                    <Badge variant="outline">
                      <Server className="h-3 w-3 mr-1" />
                      {techStack.hosting}
                    </Badge>
                  </div>
                )}
                {techStack.server && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Web Server</p>
                    <Badge variant="outline">{techStack.server}</Badge>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Performance Card */}
      {performanceIndicators && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-orange-600" />
              <CardTitle>Performance-Indikatoren</CardTitle>
            </div>
            <CardDescription>Geschätztes Ladezeit-Verhalten</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Load Time Badge */}
            <div>
              <p className="text-sm font-medium mb-2">Geschätzte Ladezeit</p>
              <Badge
                variant={
                  performanceIndicators.estimatedLoadTime === 'fast'
                    ? 'default'
                    : performanceIndicators.estimatedLoadTime === 'medium'
                      ? 'secondary'
                      : 'destructive'
                }
                className="text-base"
              >
                {performanceIndicators.estimatedLoadTime === 'fast' && (
                  <CheckCircle className="h-4 w-4 mr-1" />
                )}
                {performanceIndicators.estimatedLoadTime === 'medium' && (
                  <AlertTriangle className="h-4 w-4 mr-1" />
                )}
                {performanceIndicators.estimatedLoadTime === 'slow' && (
                  <XCircle className="h-4 w-4 mr-1" />
                )}
                {performanceIndicators.estimatedLoadTime === 'fast' && 'Schnell'}
                {performanceIndicators.estimatedLoadTime === 'medium' && 'Mittel'}
                {performanceIndicators.estimatedLoadTime === 'slow' && 'Langsam'}
              </Badge>
            </div>

            {/* Resource Count */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-3 border-t">
              <div>
                <p className="text-xs text-muted-foreground">Scripts</p>
                <p className="text-lg font-bold">{performanceIndicators.resourceCount.scripts}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Stylesheets</p>
                <p className="text-lg font-bold">{performanceIndicators.resourceCount.stylesheets}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Images</p>
                <p className="text-lg font-bold">{performanceIndicators.resourceCount.images}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Fonts</p>
                <p className="text-lg font-bold">{performanceIndicators.resourceCount.fonts}</p>
              </div>
            </div>

            {/* Performance Features */}
            <div className="pt-3 border-t grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2">
                {performanceIndicators.hasLazyLoading ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-600" />
                )}
                <span className="text-sm">Lazy Loading</span>
              </div>
              <div className="flex items-center gap-2">
                {performanceIndicators.hasMinification ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-600" />
                )}
                <span className="text-sm">Minifizierung</span>
              </div>
              <div className="flex items-center gap-2">
                {performanceIndicators.hasCaching ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-600" />
                )}
                <span className="text-sm">Caching</span>
              </div>
              <div className="flex items-center gap-2">
                <Gauge className="h-4 w-4 text-orange-600" />
                <span className="text-sm">
                  {performanceIndicators.renderBlockingResources} Render-Blocking
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Two-Column Layout: Content Volume + Decision Makers */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Content Volume Card */}
        {contentVolume && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-green-600" />
                <CardTitle>Content-Volumen</CardTitle>
              </div>
              <CardDescription>Umfang der Website</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Page Count */}
              <div>
                <p className="text-sm text-muted-foreground mb-1">Seitenzahl</p>
                <p className="text-3xl font-bold">
                  {contentVolume.sitemapFound && contentVolume.actualPageCount
                    ? contentVolume.actualPageCount
                    : `~${contentVolume.estimatedPageCount}`}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {contentVolume.sitemapFound
                    ? 'Aus Sitemap ermittelt'
                    : 'Geschätzt (kein Sitemap gefunden)'}
                </p>
              </div>

              {/* Complexity */}
              {contentVolume.complexity && (
                <div className="pt-3 border-t">
                  <p className="text-sm text-muted-foreground mb-2">Komplexität</p>
                  <Badge
                    variant={
                      contentVolume.complexity === 'low'
                        ? 'default'
                        : contentVolume.complexity === 'medium'
                          ? 'secondary'
                          : 'destructive'
                    }
                    className="text-base"
                  >
                    {contentVolume.complexity === 'low' && 'Niedrig'}
                    {contentVolume.complexity === 'medium' && 'Mittel'}
                    {contentVolume.complexity === 'high' && 'Hoch'}
                  </Badge>
                </div>
              )}

              {/* Languages */}
              {contentVolume.languages && contentVolume.languages.length > 0 && (
                <div className="pt-3 border-t">
                  <p className="text-sm text-muted-foreground mb-2">Sprachen</p>
                  <div className="flex flex-wrap gap-1">
                    {contentVolume.languages.map(lang => (
                      <Badge key={lang} variant="outline">
                        {lang}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Decision Makers Card */}
        {decisionMakers && decisionMakers.decisionMakers.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-blue-600" />
                <CardTitle>IT-Entscheider</CardTitle>
              </div>
              <CardDescription>Identifizierte Kontakte</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {decisionMakers.decisionMakers.map((dm, idx) => (
                <div key={idx} className="flex items-start gap-3 pb-3 border-b last:border-0">
                  <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-semibold">
                    {dm.name
                      .split(' ')
                      .map(n => n[0])
                      .join('')
                      .toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{dm.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{dm.role}</p>
                    {dm.linkedInUrl && (
                      <a
                        href={dm.linkedInUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:underline flex items-center gap-1 mt-1"
                      >
                        LinkedIn
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {dm.source}
                  </Badge>
                </div>
              ))}

              {/* Research Quality */}
              {decisionMakers.researchQuality && (
                <div className="pt-3 border-t">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Research Confidence</span>
                    <span className="text-xs font-bold">
                      {decisionMakers.researchQuality.confidence}%
                    </span>
                  </div>
                  <Progress value={decisionMakers.researchQuality.confidence} className="h-1 mt-1" />
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Screenshots Gallery */}
      {screenshots && screenshots.homepage && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Camera className="h-5 w-5 text-indigo-600" />
              <CardTitle>Screenshots</CardTitle>
            </div>
            <CardDescription>Homepage Desktop & Mobile</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Desktop Screenshot */}
              {screenshots.homepage.desktop && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Desktop</p>
                  <Dialog>
                    <DialogTrigger asChild>
                      <button className="relative w-full overflow-hidden rounded-lg border border-slate-200 hover:border-slate-300 transition-colors cursor-pointer">
                        <img
                          src={screenshots.homepage.desktop}
                          alt="Desktop Screenshot"
                          className="w-full h-auto"
                        />
                      </button>
                    </DialogTrigger>
                    <DialogContent className="max-w-4xl">
                      <img
                        src={screenshots.homepage.desktop}
                        alt="Desktop Screenshot"
                        className="w-full h-auto"
                      />
                    </DialogContent>
                  </Dialog>
                </div>
              )}

              {/* Mobile Screenshot */}
              {screenshots.homepage.mobile && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Mobile</p>
                  <Dialog>
                    <DialogTrigger asChild>
                      <button className="relative w-full overflow-hidden rounded-lg border border-slate-200 hover:border-slate-300 transition-colors cursor-pointer">
                        <img
                          src={screenshots.homepage.mobile}
                          alt="Mobile Screenshot"
                          className="w-full h-auto"
                        />
                      </button>
                    </DialogTrigger>
                    <DialogContent className="max-w-xl">
                      <img
                        src={screenshots.homepage.mobile}
                        alt="Mobile Screenshot"
                        className="w-full h-auto"
                      />
                    </DialogContent>
                  </Dialog>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Accessibility Card (conditional - only if issues exist) */}
      {accessibilityAudit && accessibilityAudit.criticalIssues + accessibilityAudit.seriousIssues > 0 && (
        <Card className="border-amber-200 bg-amber-50/50">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-600" />
              <CardTitle>Accessibility-Issues</CardTitle>
            </div>
            <CardDescription>WCAG-Compliance: {accessibilityAudit.level}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Issue Counts */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="text-center">
                <p className="text-2xl font-bold text-red-600">{accessibilityAudit.criticalIssues}</p>
                <p className="text-xs text-muted-foreground">Kritisch</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-orange-600">{accessibilityAudit.seriousIssues}</p>
                <p className="text-xs text-muted-foreground">Schwerwiegend</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-yellow-600">{accessibilityAudit.moderateIssues}</p>
                <p className="text-xs text-muted-foreground">Moderat</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-slate-600">{accessibilityAudit.minorIssues}</p>
                <p className="text-xs text-muted-foreground">Gering</p>
              </div>
            </div>

            {/* Top Issues */}
            {accessibilityAudit.topIssues && accessibilityAudit.topIssues.length > 0 && (
              <div className="pt-3 border-t">
                <p className="text-sm font-medium mb-2">Häufigste Probleme</p>
                <div className="space-y-2">
                  {accessibilityAudit.topIssues.slice(0, 5).map((issue, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-sm">
                      <Badge
                        variant={
                          issue.severity === 'critical'
                            ? 'destructive'
                            : issue.severity === 'serious'
                              ? 'secondary'
                              : 'outline'
                        }
                        className="text-xs"
                      >
                        {issue.severity}
                      </Badge>
                      <div className="flex-1">
                        <p className="text-sm">{issue.description}</p>
                        <p className="text-xs text-muted-foreground">{issue.count}× gefunden</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Score */}
            <div className="pt-3 border-t">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Accessibility Score</span>
                <span className="text-sm font-bold">{accessibilityAudit.score}%</span>
              </div>
              <Progress value={accessibilityAudit.score} className="h-2" />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
