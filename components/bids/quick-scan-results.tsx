'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Loader2, CheckCircle2, Globe, RefreshCw, Sparkles, AlertCircle, RotateCcw,
  Shield, Search, Scale, Gauge, Navigation, Building2, Newspaper, Image, Eye
} from 'lucide-react';
import { toast } from 'sonner';
import { ActivityStream } from '@/components/ai-elements/activity-stream';
import { retriggerQuickScan } from '@/lib/quick-scan/actions';
import { QuickScanRenderer } from '@/components/json-render/quick-scan-registry';
import type { QuickScan } from '@/lib/db/schema';

interface QuickScanResultsProps {
  quickScan: QuickScan;
  bidId: string;
  onRefresh?: () => void;
}

interface VisualizationTree {
  root: string | null;
  elements: Record<string, {
    key: string;
    type: string;
    props: Record<string, unknown>;
    children?: string[];
  }>;
}

// Types for parsed fields
interface TechStackData {
  cms?: string;
  cmsVersion?: string;
  cmsConfidence?: number;
  framework?: string;
  hosting?: string;
  backend?: string[];
  libraries?: string[];
}

interface ContentVolumeData {
  estimatedPageCount?: number;
  complexity?: 'low' | 'medium' | 'high';
  languages?: string[];
}

interface FeaturesData {
  ecommerce?: boolean;
  userAccounts?: boolean;
  search?: boolean;
  multiLanguage?: boolean;
  blog?: boolean;
  forms?: boolean;
  api?: boolean;
}

interface BlRecommendationData {
  primaryBusinessLine?: string | null;
  confidence?: number | null;
  reasoning?: string | null;
  alternativeBusinessLines?: Array<{ name: string; confidence: number }>;
  requiredSkills?: string[];
}

// New enhanced audit types
interface AccessibilityAuditData {
  score: number;
  level: 'A' | 'AA' | 'AAA' | 'fail';
  criticalIssues: number;
  seriousIssues: number;
  moderateIssues: number;
  minorIssues: number;
  checks: {
    hasAltTexts: boolean;
    hasAriaLabels: boolean;
    hasProperHeadings: boolean;
    hasSkipLinks: boolean;
    colorContrast: string;
    keyboardNavigation: string;
    formLabels: string;
    languageAttribute: boolean;
  };
  recommendations?: string[];
}

interface SEOAuditData {
  score: number;
  checks: {
    hasTitle: boolean;
    hasMetaDescription: boolean;
    hasCanonical: boolean;
    hasSitemap: boolean;
    hasStructuredData: boolean;
    hasOpenGraph: boolean;
    mobileViewport: boolean;
  };
}

interface LegalComplianceData {
  score: number;
  checks: {
    hasImprint: boolean;
    hasPrivacyPolicy: boolean;
    hasCookieBanner: boolean;
    hasTermsOfService: boolean;
    hasAccessibilityStatement: boolean;
  };
  gdprIndicators?: {
    cookieConsentTool?: string;
  };
}

interface PerformanceData {
  htmlSize: number;
  resourceCount: {
    scripts: number;
    stylesheets: number;
    images: number;
    fonts: number;
  };
  estimatedLoadTime: 'fast' | 'medium' | 'slow';
  hasLazyLoading: boolean;
  hasMinification: boolean;
}

interface NavigationData {
  mainNav: Array<{ label: string }>;
  footerNav?: Array<{ label: string }>;
  hasSearch: boolean;
  hasBreadcrumbs: boolean;
  hasMegaMenu: boolean;
  maxDepth: number;
  totalItems: number;
}

interface ScreenshotsData {
  homepage?: {
    desktop?: string;
    mobile?: string;
  };
  keyPages?: Array<{ url: string; title: string; screenshot: string }>;
  timestamp: string;
}

interface CompanyIntelligenceData {
  basicInfo: {
    name: string;
    legalForm?: string;
    headquarters?: string;
    employeeCount?: string;
    industry?: string;
    website: string;
  };
  financials?: {
    revenueClass?: string;
    publiclyTraded?: boolean;
  };
  newsAndReputation?: {
    recentNews?: Array<{
      title: string;
      source: string;
      date?: string;
      sentiment?: string;
    }>;
    sentimentScore?: number;
  };
  leadership?: {
    ceo?: string;
    cto?: string;
  };
  dataQuality: {
    confidence: number;
    sources: string[];
  };
}

interface ResultsData {
  techStack: TechStackData | Record<string, never>;
  contentVolume: ContentVolumeData | Record<string, never>;
  features: FeaturesData | Record<string, never>;
  blRecommendation: BlRecommendationData;
  // Enhanced audits
  accessibilityAudit?: AccessibilityAuditData | null;
  seoAudit?: SEOAuditData | null;
  legalCompliance?: LegalComplianceData | null;
  performanceIndicators?: PerformanceData | null;
  navigationStructure?: NavigationData | null;
  screenshots?: ScreenshotsData | null;
  companyIntelligence?: CompanyIntelligenceData | null;
}

// Helper to parse JSON fields safely
function parseJsonField<T>(value: string | null | undefined): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

/**
 * Quick Scan Results Component
 * - Running: Shows live ActivityStream with agent feedback
 * - Completed: Shows dynamic json-render visualization
 * - Failed: Shows error state
 */
export function QuickScanResults({ quickScan, bidId, onRefresh }: QuickScanResultsProps) {
  const [visualizationTree, setVisualizationTree] = useState<VisualizationTree | null>(null);
  const [isGeneratingViz, setIsGeneratingViz] = useState(false);
  const [vizError, setVizError] = useState<string | null>(null);
  const [showDynamicView, setShowDynamicView] = useState(true);
  const [isRetriggering, setIsRetriggering] = useState(false);

  // Handle re-trigger Quick Scan
  const handleRetrigger = async () => {
    setIsRetriggering(true);
    toast.info('Starte Quick Scan erneut...');

    try {
      const result = await retriggerQuickScan(bidId);

      if (result.success) {
        toast.success('Quick Scan gestartet - bitte warten...');
        // Reset visualization
        setVisualizationTree(null);
        // Force page reload to show ActivityStream
        window.location.reload();
      } else {
        toast.error(result.error || 'Quick Scan Re-Trigger fehlgeschlagen');
        setIsRetriggering(false);
      }
    } catch (error) {
      toast.error('Ein Fehler ist aufgetreten');
      setIsRetriggering(false);
    }
  };

  // Parse JSON fields from quickScan with explicit types
  const techStack = parseJsonField<TechStackData>(quickScan.techStack);
  const contentVolume = parseJsonField<ContentVolumeData>(quickScan.contentVolume);
  const features = parseJsonField<FeaturesData>(quickScan.features);

  // Parse enhanced audit fields (NEW)
  const accessibilityAudit = parseJsonField<AccessibilityAuditData>(quickScan.accessibilityAudit);
  const seoAudit = parseJsonField<SEOAuditData>(quickScan.seoAudit);
  const legalCompliance = parseJsonField<LegalComplianceData>(quickScan.legalCompliance);
  const performanceIndicators = parseJsonField<PerformanceData>(quickScan.performanceIndicators);
  const navigationStructure = parseJsonField<NavigationData>(quickScan.navigationStructure);
  const screenshots = parseJsonField<ScreenshotsData>(quickScan.screenshots);
  const companyIntelligence = parseJsonField<CompanyIntelligenceData>(quickScan.companyIntelligence);

  // Check if we have results to visualize
  const hasResults = quickScan.recommendedBusinessLine || techStack || contentVolume || features;

  // Load cached visualization or generate new one when scan completes
  useEffect(() => {
    if (quickScan.status === 'completed' && hasResults && showDynamicView && !visualizationTree && !isGeneratingViz) {
      loadOrGenerateVisualization();
    }
  }, [quickScan.status, hasResults, showDynamicView]);

  const loadOrGenerateVisualization = async () => {
    if (!hasResults) return;

    setIsGeneratingViz(true);
    setVizError(null);

    try {
      // First, try to load cached visualization
      const cachedResponse = await fetch(`/api/bids/${bidId}/visualization`);
      if (cachedResponse.ok) {
        const cachedData = await cachedResponse.json();
        if (cachedData.tree) {
          setVisualizationTree(cachedData.tree);
          setIsGeneratingViz(false);
          return;
        }
      }

      // No cache found, generate new visualization
      const results = {
        blRecommendation: {
          primaryBusinessLine: quickScan.recommendedBusinessLine,
          confidence: quickScan.confidence,
          reasoning: quickScan.reasoning,
        },
        techStack: techStack || {},
        contentVolume: contentVolume || {},
        features: features || {},
      };

      const response = await fetch(`/api/bids/${bidId}/visualization`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ results }),
      });

      if (!response.ok) {
        throw new Error('Visualization generation failed');
      }

      const data = await response.json();
      setVisualizationTree(data.tree);
    } catch (error) {
      console.error('Visualization error:', error);
      setVizError('Dynamische Visualisierung konnte nicht generiert werden');
      // Fall back to static view
      setShowDynamicView(false);
    } finally {
      setIsGeneratingViz(false);
    }
  };

  // Running state - Show live Activity Stream
  if (quickScan.status === 'running') {
    return (
      <div className="space-y-4">
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                <CardTitle className="text-blue-900">Quick Scan läuft</CardTitle>
              </div>
              <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                Live
              </Badge>
            </div>
            <CardDescription className="text-blue-700">
              Analyse der Kunden-Website: {quickScan.websiteUrl}
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Live Activity Stream */}
        <ActivityStream
          streamUrl={`/api/bids/${bidId}/quick-scan/stream`}
          title="Quick Scan Agent Activity"
          autoStart={true}
          onComplete={() => {
            // Trigger refresh to get updated results
            onRefresh?.();
          }}
        />
      </div>
    );
  }

  // Failed state
  if (quickScan.status === 'failed') {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-600" />
            <CardTitle className="text-red-900">Quick Scan fehlgeschlagen</CardTitle>
          </div>
          <CardDescription className="text-red-700">
            Website konnte nicht analysiert werden
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-red-700 mb-4">
            Bitte überprüfen Sie die Website-URL und versuchen Sie es erneut.
          </p>
          {onRefresh && (
            <Button variant="outline" onClick={onRefresh}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Erneut versuchen
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  // Completed state - Show dynamic or static results
  if (quickScan.status === 'completed') {
    // Build results object from individual fields with explicit types
    const resultsData: ResultsData = {
      techStack: techStack || {},
      contentVolume: contentVolume || {},
      features: features || {},
      blRecommendation: {
        primaryBusinessLine: quickScan.recommendedBusinessLine,
        confidence: quickScan.confidence,
        reasoning: quickScan.reasoning,
      },
      // Enhanced audits
      accessibilityAudit,
      seoAudit,
      legalCompliance,
      performanceIndicators,
      navigationStructure,
      screenshots,
      companyIntelligence,
    };

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            <h3 className="text-lg font-semibold">Quick Scan Ergebnisse</h3>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRetrigger}
              disabled={isRetriggering}
            >
              {isRetriggering ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <RotateCcw className="h-4 w-4 mr-1" />
              )}
              Erneut scannen
            </Button>
            <Button
              variant={showDynamicView ? 'default' : 'outline'}
              size="sm"
              onClick={() => setShowDynamicView(true)}
              disabled={isGeneratingViz}
            >
              <Sparkles className="h-4 w-4 mr-1" />
              Dynamisch
            </Button>
            <Button
              variant={!showDynamicView ? 'default' : 'outline'}
              size="sm"
              onClick={() => setShowDynamicView(false)}
            >
              Klassisch
            </Button>
          </div>
        </div>

        {isGeneratingViz && (
          <Card>
            <CardContent className="py-8">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Generiere dynamische Visualisierung...
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {vizError !== null && (
          <Card className="border-yellow-200 bg-yellow-50">
            <CardContent className="py-4">
              <p className="text-sm text-yellow-800">{vizError}</p>
            </CardContent>
          </Card>
        )}

        {showDynamicView && visualizationTree !== null && !isGeneratingViz && (
          <QuickScanRenderer tree={visualizationTree} />
        )}

        {(!showDynamicView || (visualizationTree === null && !isGeneratingViz)) && hasResults && (
          <StaticResultsView quickScan={quickScan} results={resultsData} />
        )}

        {/* Website Link */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-muted-foreground" />
              <CardTitle>Analysierte Website</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <a
              href={quickScan.websiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              {quickScan.websiteUrl}
            </a>
          </CardContent>
        </Card>
      </div>
    );
  }

  return null;
}

/**
 * Static Results View (fallback when dynamic visualization fails or is disabled)
 */
function StaticResultsView({
  quickScan,
  results,
}: {
  quickScan: QuickScan;
  results: ResultsData;
}) {
  const techStack = results.techStack;
  const contentVolume = results.contentVolume;
  const features = results.features;
  const blRecommendation = results.blRecommendation;
  const accessibilityAudit = results.accessibilityAudit;
  const seoAudit = results.seoAudit;
  const legalCompliance = results.legalCompliance;
  const performanceIndicators = results.performanceIndicators;
  const navigationStructure = results.navigationStructure;
  const screenshots = results.screenshots;
  const companyIntelligence = results.companyIntelligence;

  return (
    <div className="space-y-6">
      {/* Business Line Recommendation */}
      <Card className="border-blue-200 bg-blue-50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-blue-900">Empfohlene Business Line</CardTitle>
            <Badge variant="secondary" className="bg-blue-100 text-blue-900">
              {blRecommendation?.confidence || quickScan.confidence}% Confidence
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-2xl font-bold text-blue-900">
            {blRecommendation?.primaryBusinessLine || quickScan.recommendedBusinessLine}
          </p>
          {(blRecommendation?.reasoning || quickScan.reasoning) && (
            <p className="text-sm text-blue-800">
              {blRecommendation?.reasoning || quickScan.reasoning}
            </p>
          )}

          {/* Alternative Business Lines */}
          {blRecommendation?.alternativeBusinessLines && blRecommendation.alternativeBusinessLines.length > 0 && (
            <div className="pt-4 border-t border-blue-200">
              <p className="text-sm font-medium text-blue-900 mb-2">Alternativen:</p>
              <div className="space-y-2">
                {blRecommendation.alternativeBusinessLines.map((alt: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between text-sm">
                    <span className="text-blue-800">{alt.name}</span>
                    <Badge variant="outline" className="border-blue-200 text-blue-700">
                      {alt.confidence}%
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Required Skills */}
          {blRecommendation?.requiredSkills && blRecommendation.requiredSkills.length > 0 && (
            <div className="pt-4 border-t border-blue-200">
              <p className="text-sm font-medium text-blue-900 mb-2">Benötigte Skills:</p>
              <div className="flex flex-wrap gap-2">
                {blRecommendation.requiredSkills.map((skill: string, idx: number) => (
                  <Badge key={idx} variant="outline" className="border-blue-200 text-blue-700">
                    {skill}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tech Stack */}
      {techStack && (
        <Card>
          <CardHeader>
            <CardTitle>Tech Stack</CardTitle>
            <CardDescription>Erkannte Technologien</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              {techStack.cms && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">CMS</p>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-base">
                      {techStack.cms}
                    </Badge>
                    {techStack.cmsVersion && (
                      <span className="text-sm text-muted-foreground">v{techStack.cmsVersion}</span>
                    )}
                    {techStack.cmsConfidence && (
                      <span className="text-xs text-muted-foreground">
                        ({techStack.cmsConfidence}%)
                      </span>
                    )}
                  </div>
                </div>
              )}

              {techStack.framework && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">Framework</p>
                  <Badge variant="outline" className="text-base">{techStack.framework}</Badge>
                </div>
              )}

              {techStack.hosting && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">Hosting</p>
                  <Badge variant="outline" className="text-base">{techStack.hosting}</Badge>
                </div>
              )}

              {techStack.backend && techStack.backend.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">Backend</p>
                  <div className="flex flex-wrap gap-2">
                    {techStack.backend.map((tech: string, idx: number) => (
                      <Badge key={idx} variant="secondary">{tech}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {techStack.libraries && techStack.libraries.length > 0 && (
              <div className="mt-4 pt-4 border-t">
                <p className="text-sm font-medium text-muted-foreground mb-2">Libraries & Tools</p>
                <div className="flex flex-wrap gap-2">
                  {techStack.libraries.slice(0, 10).map((lib: string, idx: number) => (
                    <Badge key={idx} variant="outline" className="text-xs">{lib}</Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Content & Features */}
      {(contentVolume || features) && (
        <Card>
          <CardHeader>
            <CardTitle>Content & Features</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 md:grid-cols-2">
              {/* Content Volume */}
              {contentVolume && (
                <div className="space-y-3">
                  <p className="font-medium">Content Volume</p>
                  {contentVolume.estimatedPageCount && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Geschätzte Seiten</span>
                      <span className="font-medium">{contentVolume.estimatedPageCount}</span>
                    </div>
                  )}
                  {contentVolume.complexity && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Komplexität</span>
                      <Badge variant={
                        contentVolume.complexity === 'high' ? 'destructive' :
                        contentVolume.complexity === 'medium' ? 'default' : 'secondary'
                      }>
                        {contentVolume.complexity}
                      </Badge>
                    </div>
                  )}
                  {contentVolume.languages && contentVolume.languages.length > 0 && (
                    <div>
                      <span className="text-sm text-muted-foreground block mb-2">Sprachen</span>
                      <div className="flex flex-wrap gap-1">
                        {contentVolume.languages.map((lang: string, idx: number) => (
                          <Badge key={idx} variant="outline" className="text-xs">{lang}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Features */}
              {features && (
                <div className="space-y-3">
                  <p className="font-medium">Erkannte Features</p>
                  <div className="grid gap-2">
                    {features.ecommerce && (
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                        <span className="text-sm">E-Commerce</span>
                      </div>
                    )}
                    {features.userAccounts && (
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                        <span className="text-sm">User Accounts</span>
                      </div>
                    )}
                    {features.search && (
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                        <span className="text-sm">Search</span>
                      </div>
                    )}
                    {features.multiLanguage && (
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                        <span className="text-sm">Multi-Language</span>
                      </div>
                    )}
                    {features.blog && (
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                        <span className="text-sm">Blog/News</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Screenshots Gallery */}
      {screenshots && (screenshots.homepage?.desktop || screenshots.homepage?.mobile) && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Image className="h-5 w-5 text-muted-foreground" />
              <CardTitle>Screenshots</CardTitle>
            </div>
            <CardDescription>
              Aufgenommen am {new Date(screenshots.timestamp).toLocaleDateString('de-DE')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              {screenshots.homepage?.desktop && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">Desktop (1920x1080)</p>
                  <img
                    src={screenshots.homepage.desktop}
                    alt="Desktop Screenshot"
                    className="rounded-lg border shadow-sm w-full"
                  />
                </div>
              )}
              {screenshots.homepage?.mobile && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">Mobile (375x812)</p>
                  <img
                    src={screenshots.homepage.mobile}
                    alt="Mobile Screenshot"
                    className="rounded-lg border shadow-sm max-w-[200px]"
                  />
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Accessibility Audit */}
      {accessibilityAudit && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Eye className="h-5 w-5 text-muted-foreground" />
                <CardTitle>Accessibility Audit</CardTitle>
              </div>
              <Badge variant={
                accessibilityAudit.level === 'AAA' ? 'default' :
                accessibilityAudit.level === 'AA' ? 'secondary' :
                accessibilityAudit.level === 'A' ? 'outline' : 'destructive'
              }>
                WCAG {accessibilityAudit.level} ({accessibilityAudit.score}%)
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Issue Summary */}
            <div className="grid grid-cols-4 gap-2">
              <div className="text-center p-2 bg-red-50 rounded">
                <p className="text-2xl font-bold text-red-600">{accessibilityAudit.criticalIssues}</p>
                <p className="text-xs text-red-700">Kritisch</p>
              </div>
              <div className="text-center p-2 bg-orange-50 rounded">
                <p className="text-2xl font-bold text-orange-600">{accessibilityAudit.seriousIssues}</p>
                <p className="text-xs text-orange-700">Schwerwiegend</p>
              </div>
              <div className="text-center p-2 bg-yellow-50 rounded">
                <p className="text-2xl font-bold text-yellow-600">{accessibilityAudit.moderateIssues}</p>
                <p className="text-xs text-yellow-700">Moderat</p>
              </div>
              <div className="text-center p-2 bg-gray-50 rounded">
                <p className="text-2xl font-bold text-gray-600">{accessibilityAudit.minorIssues}</p>
                <p className="text-xs text-gray-700">Gering</p>
              </div>
            </div>

            {/* Checks */}
            <div className="grid gap-2 md:grid-cols-2">
              <div className="flex items-center gap-2">
                {accessibilityAudit.checks.hasAltTexts ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-red-600" />
                )}
                <span className="text-sm">Alt-Texte für Bilder</span>
              </div>
              <div className="flex items-center gap-2">
                {accessibilityAudit.checks.hasAriaLabels ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-red-600" />
                )}
                <span className="text-sm">ARIA Labels</span>
              </div>
              <div className="flex items-center gap-2">
                {accessibilityAudit.checks.hasProperHeadings ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-red-600" />
                )}
                <span className="text-sm">Heading-Hierarchie</span>
              </div>
              <div className="flex items-center gap-2">
                {accessibilityAudit.checks.hasSkipLinks ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-yellow-600" />
                )}
                <span className="text-sm">Skip Links</span>
              </div>
              <div className="flex items-center gap-2">
                {accessibilityAudit.checks.languageAttribute ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-red-600" />
                )}
                <span className="text-sm">Lang-Attribut</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Farbkontrast:</span>
                <Badge variant="outline">{accessibilityAudit.checks.colorContrast}</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* SEO & Legal Audit Row */}
      {(seoAudit || legalCompliance) && (
        <div className="grid gap-4 md:grid-cols-2">
          {/* SEO Audit */}
          {seoAudit && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Search className="h-5 w-5 text-muted-foreground" />
                    <CardTitle className="text-base">SEO Audit</CardTitle>
                  </div>
                  <Badge variant={seoAudit.score >= 80 ? 'default' : seoAudit.score >= 50 ? 'secondary' : 'destructive'}>
                    {seoAudit.score}%
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-2">
                  <div className="flex items-center gap-2">
                    {seoAudit.checks.hasTitle ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-red-600" />
                    )}
                    <span className="text-sm">Title Tag</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {seoAudit.checks.hasMetaDescription ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-red-600" />
                    )}
                    <span className="text-sm">Meta Description</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {seoAudit.checks.hasSitemap ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-yellow-600" />
                    )}
                    <span className="text-sm">Sitemap</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {seoAudit.checks.hasStructuredData ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-yellow-600" />
                    )}
                    <span className="text-sm">Structured Data</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {seoAudit.checks.mobileViewport ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-red-600" />
                    )}
                    <span className="text-sm">Mobile Viewport</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Legal Compliance */}
          {legalCompliance && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Scale className="h-5 w-5 text-muted-foreground" />
                    <CardTitle className="text-base">DSGVO Compliance</CardTitle>
                  </div>
                  <Badge variant={legalCompliance.score >= 80 ? 'default' : legalCompliance.score >= 50 ? 'secondary' : 'destructive'}>
                    {legalCompliance.score}%
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-2">
                  <div className="flex items-center gap-2">
                    {legalCompliance.checks.hasImprint ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-red-600" />
                    )}
                    <span className="text-sm">Impressum</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {legalCompliance.checks.hasPrivacyPolicy ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-red-600" />
                    )}
                    <span className="text-sm">Datenschutzerklärung</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {legalCompliance.checks.hasCookieBanner ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-yellow-600" />
                    )}
                    <span className="text-sm">Cookie Banner</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {legalCompliance.checks.hasAccessibilityStatement ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-yellow-600" />
                    )}
                    <span className="text-sm">Barrierefreiheitserklärung</span>
                  </div>
                  {legalCompliance.gdprIndicators?.cookieConsentTool && (
                    <div className="flex items-center gap-2 pt-2 border-t">
                      <span className="text-xs text-muted-foreground">Cookie Tool:</span>
                      <Badge variant="outline" className="text-xs">
                        {legalCompliance.gdprIndicators.cookieConsentTool}
                      </Badge>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Performance & Navigation Row */}
      {(performanceIndicators || navigationStructure) && (
        <div className="grid gap-4 md:grid-cols-2">
          {/* Performance Indicators */}
          {performanceIndicators && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Gauge className="h-5 w-5 text-muted-foreground" />
                    <CardTitle className="text-base">Performance</CardTitle>
                  </div>
                  <Badge variant={
                    performanceIndicators.estimatedLoadTime === 'fast' ? 'default' :
                    performanceIndicators.estimatedLoadTime === 'medium' ? 'secondary' : 'destructive'
                  }>
                    {performanceIndicators.estimatedLoadTime === 'fast' ? 'Schnell' :
                     performanceIndicators.estimatedLoadTime === 'medium' ? 'Mittel' : 'Langsam'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">HTML Größe</p>
                      <p className="font-medium">{Math.round(performanceIndicators.htmlSize / 1024)} KB</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Scripts</p>
                      <p className="font-medium">{performanceIndicators.resourceCount.scripts}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Stylesheets</p>
                      <p className="font-medium">{performanceIndicators.resourceCount.stylesheets}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Bilder</p>
                      <p className="font-medium">{performanceIndicators.resourceCount.images}</p>
                    </div>
                  </div>
                  <div className="flex gap-2 pt-2 border-t">
                    {performanceIndicators.hasLazyLoading && (
                      <Badge variant="outline" className="text-xs">Lazy Loading</Badge>
                    )}
                    {performanceIndicators.hasMinification && (
                      <Badge variant="outline" className="text-xs">Minified</Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Navigation Structure */}
          {navigationStructure && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Navigation className="h-5 w-5 text-muted-foreground" />
                  <CardTitle className="text-base">Navigation</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Nav Items</p>
                      <p className="font-medium">{navigationStructure.totalItems}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Max Tiefe</p>
                      <p className="font-medium">{navigationStructure.maxDepth} Ebenen</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 pt-2 border-t">
                    {navigationStructure.hasSearch && (
                      <Badge variant="secondary" className="text-xs">Suche</Badge>
                    )}
                    {navigationStructure.hasBreadcrumbs && (
                      <Badge variant="secondary" className="text-xs">Breadcrumbs</Badge>
                    )}
                    {navigationStructure.hasMegaMenu && (
                      <Badge variant="secondary" className="text-xs">Mega Menu</Badge>
                    )}
                  </div>
                  {navigationStructure.mainNav && navigationStructure.mainNav.length > 0 && (
                    <div className="pt-2">
                      <p className="text-xs text-muted-foreground mb-1">Hauptnavigation:</p>
                      <div className="flex flex-wrap gap-1">
                        {navigationStructure.mainNav.slice(0, 6).map((item, idx) => (
                          <Badge key={idx} variant="outline" className="text-xs">
                            {item.label}
                          </Badge>
                        ))}
                        {navigationStructure.mainNav.length > 6 && (
                          <Badge variant="outline" className="text-xs">
                            +{navigationStructure.mainNav.length - 6} mehr
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Company Intelligence */}
      {companyIntelligence && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-muted-foreground" />
                <CardTitle>Unternehmensprofil</CardTitle>
              </div>
              <Badge variant="outline">
                {companyIntelligence.dataQuality.confidence}% Confidence
              </Badge>
            </div>
            <CardDescription>
              Quellen: {companyIntelligence.dataQuality.sources.join(', ')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Basic Info */}
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Unternehmen</p>
                <p className="font-medium">{companyIntelligence.basicInfo.name}</p>
                {companyIntelligence.basicInfo.legalForm && (
                  <p className="text-sm text-muted-foreground">{companyIntelligence.basicInfo.legalForm}</p>
                )}
              </div>
              {companyIntelligence.basicInfo.industry && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Branche</p>
                  <p>{companyIntelligence.basicInfo.industry}</p>
                </div>
              )}
              {companyIntelligence.basicInfo.headquarters && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Hauptsitz</p>
                  <p>{companyIntelligence.basicInfo.headquarters}</p>
                </div>
              )}
              {companyIntelligence.basicInfo.employeeCount && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Mitarbeiter</p>
                  <p>{companyIntelligence.basicInfo.employeeCount}</p>
                </div>
              )}
            </div>

            {/* Leadership */}
            {companyIntelligence.leadership && (companyIntelligence.leadership.ceo || companyIntelligence.leadership.cto) && (
              <div className="pt-4 border-t">
                <p className="text-sm font-medium text-muted-foreground mb-2">Führung</p>
                <div className="grid gap-2 md:grid-cols-2">
                  {companyIntelligence.leadership.ceo && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">CEO:</span>
                      <span className="text-sm">{companyIntelligence.leadership.ceo}</span>
                    </div>
                  )}
                  {companyIntelligence.leadership.cto && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">CTO:</span>
                      <span className="text-sm">{companyIntelligence.leadership.cto}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Financials */}
            {companyIntelligence.financials?.revenueClass && (
              <div className="pt-4 border-t">
                <p className="text-sm font-medium text-muted-foreground mb-2">Finanzen</p>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Umsatzklasse:</span>
                  <Badge variant="outline">
                    {companyIntelligence.financials.revenueClass === 'small' ? 'Klein (<5M€)' :
                     companyIntelligence.financials.revenueClass === 'medium' ? 'Mittel (5-50M€)' :
                     companyIntelligence.financials.revenueClass === 'large' ? 'Groß (50-500M€)' :
                     companyIntelligence.financials.revenueClass === 'enterprise' ? 'Enterprise (>500M€)' : 'Unbekannt'}
                  </Badge>
                  {companyIntelligence.financials.publiclyTraded && (
                    <Badge variant="secondary">Börsennotiert</Badge>
                  )}
                </div>
              </div>
            )}

            {/* News */}
            {companyIntelligence.newsAndReputation?.recentNews && companyIntelligence.newsAndReputation.recentNews.length > 0 && (
              <div className="pt-4 border-t">
                <div className="flex items-center gap-2 mb-2">
                  <Newspaper className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm font-medium text-muted-foreground">Aktuelle News</p>
                </div>
                <div className="space-y-2">
                  {companyIntelligence.newsAndReputation.recentNews.slice(0, 3).map((news, idx) => (
                    <div key={idx} className="text-sm border-l-2 border-gray-200 pl-3 py-1">
                      <p className="font-medium">{news.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {news.source} {news.date && `• ${new Date(news.date).toLocaleDateString('de-DE')}`}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* BIT Decision Questions Overview */}
      <BITDecisionOverview
        quickScan={quickScan}
        results={results}
      />
    </div>
  );
}

/**
 * BIT Decision Questions Overview
 * Maps collected Quick Scan data to the 10 key BIT decision questions
 */
function BITDecisionOverview({
  quickScan: _quickScan,
  results,
}: {
  quickScan: QuickScan;
  results: ResultsData;
}) {
  const { companyIntelligence, techStack, contentVolume, features, accessibilityAudit, legalCompliance, performanceIndicators } = results;

  // Helper to determine answer status
  const getAnswerStatus = (hasAnswer: boolean, value?: string | number | boolean | null) => {
    if (!hasAnswer || value === null || value === undefined) {
      return { status: 'unknown', color: 'bg-gray-100 text-gray-700', icon: '❓' };
    }
    return { status: 'answered', color: 'bg-green-50 text-green-800', icon: '✓' };
  };

  // Map data to the 10 BIT questions
  const questions = [
    {
      id: 1,
      question: 'Wie ist die bisherige Geschäftsbeziehung zum Kunden?',
      answer: companyIntelligence?.basicInfo?.name
        ? `Unternehmen: ${companyIntelligence.basicInfo.name}${companyIntelligence.basicInfo.industry ? `, Branche: ${companyIntelligence.basicInfo.industry}` : ''}`
        : null,
      source: 'Company Intelligence',
      ...getAnswerStatus(!!companyIntelligence, companyIntelligence?.basicInfo?.name),
    },
    {
      id: 2,
      question: 'Wie hoch ist das Auftragsvolumen bzw. Budget?',
      answer: companyIntelligence?.financials?.revenueClass
        ? `Umsatzklasse: ${companyIntelligence.financials.revenueClass}${companyIntelligence.financials.publiclyTraded ? ' (börsennotiert)' : ''}`
        : contentVolume && 'estimatedPageCount' in contentVolume && contentVolume.estimatedPageCount
          ? `Geschätzte Projektgröße basierend auf ${contentVolume.estimatedPageCount} Seiten`
          : null,
      source: 'Company Intelligence / Content Volume',
      ...getAnswerStatus(!!companyIntelligence?.financials || !!(contentVolume && 'estimatedPageCount' in contentVolume)),
    },
    {
      id: 3,
      question: 'Ist der Zeitplan realistisch?',
      answer: contentVolume && 'complexity' in contentVolume && contentVolume.complexity
        ? `Projektkomplexität: ${contentVolume.complexity === 'high' ? 'Hoch' : contentVolume.complexity === 'medium' ? 'Mittel' : 'Gering'}${contentVolume.estimatedPageCount ? `, ${contentVolume.estimatedPageCount} Seiten zu migrieren` : ''}`
        : null,
      source: 'Content Volume',
      ...getAnswerStatus(!!(contentVolume && 'complexity' in contentVolume)),
    },
    {
      id: 4,
      question: 'Um welche Art von Vertrag handelt es sich?',
      answer: null, // Not determinable from Quick Scan
      source: 'Manuell zu ermitteln',
      ...getAnswerStatus(false),
    },
    {
      id: 5,
      question: 'Welche Leistungen werden benötigt?',
      answer: [
        techStack && 'cms' in techStack && techStack.cms ? `CMS Migration von ${techStack.cms}` : null,
        features && 'ecommerce' in features && features.ecommerce ? 'E-Commerce Integration' : null,
        features && 'multiLanguage' in features && features.multiLanguage ? 'Mehrsprachigkeit' : null,
        features && 'userAccounts' in features && features.userAccounts ? 'User Management' : null,
        accessibilityAudit && accessibilityAudit.score < 50 ? 'Accessibility Überarbeitung' : null,
      ].filter(Boolean).join(', ') || null,
      source: 'Tech Stack / Features / Accessibility',
      ...getAnswerStatus(!!(techStack || features)),
    },
    {
      id: 6,
      question: 'Haben wir passende Referenzen?',
      answer: techStack && 'cms' in techStack && techStack.cms
        ? `Prüfe Referenzen für ${techStack.cms} Migrationen`
        : null,
      source: 'Tech Stack → Referenz-Datenbank',
      ...getAnswerStatus(!!(techStack && 'cms' in techStack)),
    },
    {
      id: 7,
      question: 'Welche Zuschlagskriterien gelten?',
      answer: null, // Not determinable from Quick Scan
      source: 'Ausschreibungsunterlagen',
      ...getAnswerStatus(false),
    },
    {
      id: 8,
      question: 'Welche Team-Anforderungen bestehen?',
      answer: results.blRecommendation?.requiredSkills?.length
        ? `Empfohlene Skills: ${results.blRecommendation.requiredSkills.join(', ')}`
        : techStack && 'cms' in techStack && techStack.cms
          ? `${techStack.cms} Expertise benötigt`
          : null,
      source: 'BL Recommendation / Tech Stack',
      ...getAnswerStatus(!!(results.blRecommendation?.requiredSkills || (techStack && 'cms' in techStack))),
    },
    {
      id: 9,
      question: 'Welche besonderen Herausforderungen gibt es?',
      answer: [
        performanceIndicators?.estimatedLoadTime === 'slow' ? 'Performance-Optimierung nötig' : null,
        accessibilityAudit && accessibilityAudit.criticalIssues > 0 ? `${accessibilityAudit.criticalIssues} kritische A11y-Issues` : null,
        legalCompliance && legalCompliance.score < 50 ? 'DSGVO-Compliance verbessern' : null,
        contentVolume && 'complexity' in contentVolume && contentVolume.complexity === 'high' ? 'Hohe Inhaltskomplexität' : null,
        features && 'api' in features && features.api ? 'API-Integrationen' : null,
      ].filter(Boolean).join(', ') || 'Keine besonderen Herausforderungen erkannt',
      source: 'Performance / A11y / Legal / Content',
      ...getAnswerStatus(true),
    },
    {
      id: 10,
      question: 'Wie lautet die Bit / No Bit Einschätzung?',
      answer: results.blRecommendation?.primaryBusinessLine
        ? `Empfehlung: ${results.blRecommendation.primaryBusinessLine} (${results.blRecommendation.confidence}% Confidence)`
        : null,
      source: 'BL Recommendation',
      ...getAnswerStatus(!!results.blRecommendation?.primaryBusinessLine),
    },
  ];

  const answeredCount = questions.filter(q => q.status === 'answered').length;

  return (
    <Card className="border-purple-200 bg-purple-50/50">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-purple-600" />
            <CardTitle className="text-purple-900">BIT-Entscheidungsfragen</CardTitle>
          </div>
          <Badge variant="secondary" className="bg-purple-100 text-purple-800">
            {answeredCount}/10 beantwortet
          </Badge>
        </div>
        <CardDescription className="text-purple-700">
          Übersicht der 10 Schlüsselfragen für die BIT/No-BIT Entscheidung
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {questions.map((q) => (
            <div
              key={q.id}
              className={`p-3 rounded-lg ${q.color} transition-colors`}
            >
              <div className="flex items-start gap-2">
                <span className="font-mono text-xs bg-white/50 px-1.5 py-0.5 rounded">
                  {q.id}.
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{q.question}</p>
                  {q.answer ? (
                    <p className="text-sm mt-1 opacity-90">{q.answer}</p>
                  ) : (
                    <p className="text-sm mt-1 opacity-60 italic">Keine Daten verfügbar</p>
                  )}
                  <p className="text-xs mt-1 opacity-50">Quelle: {q.source}</p>
                </div>
                <span className="text-lg">{q.icon}</span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
