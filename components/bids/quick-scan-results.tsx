'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Loader2, CheckCircle2, Globe, RefreshCw, AlertCircle, RotateCcw,
  Search, Scale, Gauge, Navigation, Building2, Newspaper, Image, Eye,
  FileText, GitBranch, Users, Mail, Phone, Linkedin, TriangleAlert, Lightbulb
} from 'lucide-react';
import { toast } from 'sonner';
import { ActivityStream } from '@/components/ai-elements/activity-stream';
import { retriggerQuickScan } from '@/lib/quick-scan/actions';
import { BidTabs } from './bid-tabs';
import { BUMatchingTab } from './bu-matching-tab';
import { TenQuestionsTab } from './ten-questions-tab';
import { ScrapedFactsPhase } from './phases/scraped-facts-phase';
import type { QuickScan } from '@/lib/db/schema';

interface QuickScanResultsProps {
  quickScan: QuickScan;
  bidId: string;
  onRefresh?: () => void;
  extractedData?: ExtractedRequirements | null;
}

// Import ExtractedRequirements type for RFP data
import type { ExtractedRequirements } from '@/lib/extraction/schema';

// Types for parsed fields
interface TechStackData {
  cms?: string;
  cmsVersion?: string;
  cmsConfidence?: number;
  framework?: string;
  hosting?: string;
  cdn?: string;
  server?: string;
  backend?: string[];
  libraries?: string[];
  analytics?: string[];
  marketing?: string[];
  javascriptFrameworks?: Array<{ name: string; version?: string; confidence: number }>;
  cssFrameworks?: Array<{ name: string; version?: string; confidence: number }>;
  apiEndpoints?: {
    rest?: string[];
    graphql?: boolean;
    graphqlEndpoint?: string;
  };
  headlessCms?: string[];
  serverSideRendering?: boolean;
  buildTools?: string[];
  cdnProviders?: string[];
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
  mainNav: Array<{
    label: string;
    url?: string;
    children?: Array<{ label: string; url?: string }>;
  }>;
  footerNav?: Array<{ label: string; url?: string }>;
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

// QuickScan 2.0 Types
interface ContentTypesData {
  pagesAnalyzed: number;
  distribution: Array<{
    type: string;
    count: number;
    percentage: number;
  }>;
  complexity: 'simple' | 'moderate' | 'complex';
  estimatedContentTypes: number;
  customFieldsNeeded?: number;
  recommendations?: string[];
}

interface MigrationComplexityData {
  score: number;
  recommendation: 'simple' | 'moderate' | 'complex' | 'very_complex';
  factors: {
    cmsExportability?: { score: number; notes: string };
    dataQuality?: { score: number; notes: string };
    contentComplexity?: { score: number; notes: string };
    integrationComplexity?: { score: number; notes: string };
  };
  warnings?: string[];
  opportunities?: string[];
  estimatedEffort?: {
    minPT: number;
    maxPT: number;
    confidence: number;
  };
}

interface DecisionMakersData {
  decisionMakers: Array<{
    name: string;
    role: string;
    linkedInUrl?: string;
    xingUrl?: string;
    email?: string;
    emailConfidence?: 'high' | 'medium' | 'low' | 'unknown';
    phone?: string;
    source: 'impressum' | 'linkedin' | 'xing' | 'website' | 'web_search' | 'derived';
  }>;
  genericContacts?: {
    mainEmail?: string;
    salesEmail?: string;
    techEmail?: string;
    marketingEmail?: string;
    supportEmail?: string;
    phone?: string;
    fax?: string;
  };
  researchQuality: {
    linkedInFound: number;
    xingFound?: number;
    emailsConfirmed: number;
    emailsDerived: number;
    confidence: number;
    sources: string[];
    lastUpdated: string;
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
  // QuickScan 2.0
  contentTypes?: ContentTypesData | null;
  migrationComplexity?: MigrationComplexityData | null;
  decisionMakers?: DecisionMakersData | null;
}

/**
 * Collapsible Navigation Tree Item Component
 */
function NavigationTreeItem({
  item,
  depth
}: {
  item: { label: string; url?: string; children?: Array<{ label: string; url?: string }> };
  depth: number;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const hasChildren = item.children && item.children.length > 0;
  const paddingLeft = depth * 16;

  return (
    <div className="text-sm">
      <div
        className="flex items-center gap-1 py-1 hover:bg-muted/50 rounded px-1 -mx-1 group"
        style={{ paddingLeft }}
      >
        {hasChildren && (
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="p-0.5 hover:bg-muted rounded"
          >
            <svg
              className={`h-3 w-3 text-muted-foreground transition-transform ${isOpen ? 'rotate-90' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}
        {!hasChildren && <span className="w-4" />}
        {item.url ? (
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline flex-1 truncate"
            title={item.url}
          >
            {item.label}
          </a>
        ) : (
          <span className="text-foreground flex-1 truncate">{item.label}</span>
        )}
        {hasChildren && (
          <Badge variant="outline" className="text-[10px] h-4 opacity-60 group-hover:opacity-100">
            {item.children!.length}
          </Badge>
        )}
      </div>
      {hasChildren && isOpen && (
        <div className="border-l border-muted ml-2">
          {item.children!.slice(0, 10).map((child, childIdx) => (
            <NavigationTreeItem key={childIdx} item={child} depth={depth + 1} />
          ))}
          {item.children!.length > 10 && (
            <div
              className="text-xs text-muted-foreground py-1"
              style={{ paddingLeft: (depth + 1) * 16 + 16 }}
            >
              +{item.children!.length - 10} weitere
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Helper to parse JSON fields safely
// Handles both string (from raw DB) and already-parsed objects (from getQuickScanResult)
function parseJsonField<T>(value: unknown): T | null {
  if (!value) return null;
  // If already an object, return as-is
  if (typeof value === 'object') {
    return value as T;
  }
  // Otherwise parse the JSON string
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Quick Scan Results Component
 * - Running: Shows live ActivityStream with agent feedback
 * - Completed: Shows dynamic json-render visualization
 * - Failed: Shows error state
 */
export function QuickScanResults({ quickScan, bidId, onRefresh, extractedData }: QuickScanResultsProps) {
  const [isRetriggering, setIsRetriggering] = useState(false);

  // Handle re-trigger Quick Scan
  const handleRetrigger = async () => {
    setIsRetriggering(true);
    toast.info('Starte Quick Scan erneut...');

    try {
      const result = await retriggerQuickScan(bidId);

      if (result.success) {
        toast.success('Quick Scan gestartet - bitte warten...');
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

  // QuickScan 2.0 fields
  const contentTypes = parseJsonField<ContentTypesData>(quickScan.contentTypes);
  const migrationComplexity = parseJsonField<MigrationComplexityData>(quickScan.migrationComplexity);
  const decisionMakers = parseJsonField<DecisionMakersData>(quickScan.decisionMakers);

  // Check if we have results to display
  const hasResults = quickScan.recommendedBusinessUnit || techStack || contentVolume || features;

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

        {/* Live Activity Stream - Grouped by Agent */}
        <ActivityStream
          streamUrl={`/api/rfps/${bidId}/quick-scan/stream`}
          title="Quick Scan Agent Activity"
          autoStart={true}
          grouped={true}
          onComplete={() => {
            // Trigger refresh to get updated results
            onRefresh?.();

            // Show toast with CTA to scroll to decision
            toast.success('Quick Scan abgeschlossen!', {
              description: 'Bitte prüfen Sie die Ergebnisse und treffen Sie eine BIT/NO BIT Entscheidung.',
              duration: 8000,
              action: {
                label: 'Zur Entscheidung',
                onClick: () => {
                  // Scroll to BitDecisionActions after short delay for page refresh
                  setTimeout(() => {
                    const decisionElement = document.querySelector('[data-decision-actions]');
                    if (decisionElement) {
                      decisionElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      // Add highlight animation
                      decisionElement.classList.add('ring-2', 'ring-blue-500', 'ring-offset-2');
                      setTimeout(() => {
                        decisionElement.classList.remove('ring-2', 'ring-blue-500', 'ring-offset-2');
                      }, 3000);
                    }
                  }, 500);
                },
              },
            });
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

  // Completed state - Show tab-based results
  if (quickScan.status === 'completed') {
    // Build results object from individual fields with explicit types
    const resultsData: ResultsData = {
      techStack: techStack || {},
      contentVolume: contentVolume || {},
      features: features || {},
      blRecommendation: {
        primaryBusinessLine: quickScan.recommendedBusinessUnit,
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
      // QuickScan 2.0
      contentTypes,
      migrationComplexity,
      decisionMakers,
    };

    // Overview Tab Content (static results view only)
    const overviewContent = (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            <h3 className="text-lg font-semibold">Quick Scan Ergebnisse</h3>
          </div>
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
        </div>

        {hasResults && (
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

    // BU Matching Tab Content
    const buMatchingContent = (
      <BUMatchingTab quickScan={quickScan} bidId={bidId} />
    );

    // 10 Questions Tab Content - pass both quickScan and extractedData for comprehensive answers
    const questionsContent = (
      <TenQuestionsTab quickScan={quickScan} extractedData={extractedData} />
    );

    // Workflow Tab Content - Simplified view with all facts and BL forwarding
    const workflowContent = (
      <ScrapedFactsPhase quickScan={quickScan} extractedData={extractedData} bidId={bidId} />
    );

    return (
      <BidTabs
        quickScan={quickScan}
        bidId={bidId}
        overviewContent={overviewContent}
        buMatchingContent={buMatchingContent}
        questionsContent={questionsContent}
        workflowContent={workflowContent}
      />
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
  // QuickScan 2.0
  const contentTypes = results.contentTypes;
  const migrationComplexity = results.migrationComplexity;
  const decisionMakers = results.decisionMakers;

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
            {blRecommendation?.primaryBusinessLine || quickScan.recommendedBusinessUnit}
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

              {techStack.javascriptFrameworks && techStack.javascriptFrameworks.length > 0 && (
                <div className="md:col-span-2">
                  <p className="text-sm font-medium text-muted-foreground mb-2">JavaScript Frameworks</p>
                  <div className="flex flex-wrap gap-2">
                    {techStack.javascriptFrameworks.map((fw, idx) => (
                      <Badge key={idx} variant="outline">
                        {fw.name}
                        {fw.version && <span className="ml-1 text-xs text-muted-foreground">v{fw.version}</span>}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {techStack.cssFrameworks && techStack.cssFrameworks.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">CSS Frameworks</p>
                  <div className="flex flex-wrap gap-2">
                    {techStack.cssFrameworks.map((fw, idx) => (
                      <Badge key={idx} variant="outline">
                        {fw.name}
                        {fw.version && <span className="ml-1 text-xs text-muted-foreground">v{fw.version}</span>}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {techStack.headlessCms && techStack.headlessCms.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">Headless CMS</p>
                  <div className="flex flex-wrap gap-2">
                    {techStack.headlessCms.map((cms, idx) => (
                      <Badge key={idx} variant="secondary">{cms}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {techStack.serverSideRendering !== undefined && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">Server-Side Rendering</p>
                  <Badge variant={techStack.serverSideRendering ? "default" : "secondary"}>
                    {techStack.serverSideRendering ? "Aktiv" : "Nicht aktiv"}
                  </Badge>
                </div>
              )}

              {techStack.buildTools && techStack.buildTools.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">Build Tools</p>
                  <div className="flex flex-wrap gap-2">
                    {techStack.buildTools.map((tool, idx) => (
                      <Badge key={idx} variant="outline" className="text-xs">{tool}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {techStack.apiEndpoints && (techStack.apiEndpoints.rest?.length || techStack.apiEndpoints.graphql) && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">API Endpoints</p>
                  <div className="space-y-2">
                    {techStack.apiEndpoints.rest && techStack.apiEndpoints.rest.length > 0 && (
                      <div>
                        <span className="text-xs text-muted-foreground">REST:</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {techStack.apiEndpoints.rest.slice(0, 5).map((ep, idx) => (
                            <Badge key={idx} variant="secondary" className="text-xs">{ep}</Badge>
                          ))}
                          {techStack.apiEndpoints.rest.length > 5 && (
                            <Badge variant="outline" className="text-xs">
                              +{techStack.apiEndpoints.rest.length - 5}
                            </Badge>
                          )}
                        </div>
                      </div>
                    )}
                    {techStack.apiEndpoints.graphql && (
                      <div>
                        <span className="text-xs text-muted-foreground">GraphQL:</span>
                        <div className="mt-1">
                          <Badge variant="default" className="text-xs">
                            {techStack.apiEndpoints.graphqlEndpoint || 'Erkannt'}
                          </Badge>
                        </div>
                      </div>
                    )}
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

            {((techStack.analytics && techStack.analytics.length > 0) || (techStack.marketing && techStack.marketing.length > 0) || techStack.cdn) && (
              <div className="mt-4 pt-4 border-t grid gap-4 md:grid-cols-2">
                {techStack.analytics && techStack.analytics.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-2">Analytics</p>
                    <div className="flex flex-wrap gap-2">
                      {techStack.analytics.map((tool: string, idx: number) => (
                        <Badge key={idx} variant="secondary" className="text-xs">{tool}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                {techStack.marketing && techStack.marketing.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-2">Marketing & Compliance</p>
                    <div className="flex flex-wrap gap-2">
                      {techStack.marketing.map((tool: string, idx: number) => (
                        <Badge key={idx} variant="secondary" className="text-xs">{tool}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                {(techStack.cdn || (techStack.cdnProviders && techStack.cdnProviders.length > 0)) && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-2">CDN</p>
                    <div className="flex flex-wrap gap-2">
                      {techStack.cdn && (
                        <Badge variant="outline">{techStack.cdn}</Badge>
                      )}
                      {techStack.cdnProviders && techStack.cdnProviders.map((provider, idx) => (
                        <Badge key={idx} variant="secondary" className="text-xs">{provider}</Badge>
                      ))}
                    </div>
                  </div>
                )}
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

          {/* Navigation Structure - Enhanced with Collapsible Tree */}
          {navigationStructure && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Navigation className="h-5 w-5 text-muted-foreground" />
                    <CardTitle className="text-base">Navigation</CardTitle>
                  </div>
                  {navigationStructure.totalItems > 0 && (
                    <Badge variant="outline" className="text-xs">
                      {navigationStructure.totalItems} Items
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {/* Stats Row */}
                  <div className="grid grid-cols-3 gap-3 text-sm">
                    <div className="p-2 bg-muted/50 rounded">
                      <p className="text-muted-foreground text-xs">Items</p>
                      <p className="font-medium">{navigationStructure.totalItems || 0}</p>
                    </div>
                    <div className="p-2 bg-muted/50 rounded">
                      <p className="text-muted-foreground text-xs">Max Tiefe</p>
                      <p className="font-medium">{navigationStructure.maxDepth || 1} Ebenen</p>
                    </div>
                    <div className="p-2 bg-muted/50 rounded">
                      <p className="text-muted-foreground text-xs">Features</p>
                      <p className="font-medium text-xs">
                        {[
                          navigationStructure.hasSearch && 'Suche',
                          navigationStructure.hasBreadcrumbs && 'Breadcrumbs',
                          navigationStructure.hasMegaMenu && 'Mega Menu',
                        ].filter(Boolean).join(', ') || 'Standard'}
                      </p>
                    </div>
                  </div>

                  {/* Warning wenn keine Navigation gefunden */}
                  {(!navigationStructure.mainNav || navigationStructure.mainNav.length === 0) && (
                    <div className="flex items-center gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm">
                      <TriangleAlert className="h-4 w-4 text-yellow-600 flex-shrink-0" />
                      <span className="text-yellow-800">
                        Keine Hauptnavigation erkannt. Die Website könnte JavaScript-basierte Navigation verwenden.
                      </span>
                    </div>
                  )}

                  {/* Main Navigation Tree */}
                  {navigationStructure.mainNav && navigationStructure.mainNav.length > 0 && (
                    <div className="pt-2 border-t">
                      <p className="text-xs text-muted-foreground mb-2 font-medium">Hauptnavigation:</p>
                      <div className="space-y-1 max-h-64 overflow-y-auto pr-2">
                        {navigationStructure.mainNav.map((item, idx) => (
                          <NavigationTreeItem key={idx} item={item} depth={0} />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Footer Navigation */}
                  {navigationStructure.footerNav && navigationStructure.footerNav.length > 0 && (
                    <div className="pt-2 border-t">
                      <p className="text-xs text-muted-foreground mb-1 font-medium">Footer Navigation:</p>
                      <div className="flex flex-wrap gap-1">
                        {navigationStructure.footerNav.slice(0, 15).map((item, idx) => (
                          item.url ? (
                            <a
                              key={idx}
                              href={item.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-blue-600 hover:underline"
                            >
                              <Badge variant="outline" className="text-xs cursor-pointer hover:bg-blue-50">
                                {item.label}
                              </Badge>
                            </a>
                          ) : (
                            <Badge key={idx} variant="outline" className="text-xs">
                              {item.label}
                            </Badge>
                          )
                        ))}
                        {navigationStructure.footerNav.length > 15 && (
                          <Badge variant="outline" className="text-xs bg-muted">
                            +{navigationStructure.footerNav.length - 15} mehr
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

      {/* QuickScan 2.0: Content Types Card */}
      {contentTypes && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-muted-foreground" />
                <CardTitle>Content-Typen Analyse</CardTitle>
              </div>
              <Badge variant={
                contentTypes.complexity === 'simple' ? 'default' :
                contentTypes.complexity === 'moderate' ? 'secondary' : 'destructive'
              }>
                {contentTypes.complexity === 'simple' ? 'Einfach' :
                 contentTypes.complexity === 'moderate' ? 'Moderat' : 'Komplex'}
              </Badge>
            </div>
            <CardDescription>
              {contentTypes.pagesAnalyzed} Seiten analysiert • {contentTypes.estimatedContentTypes} Content-Typen erkannt
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Distribution */}
            {contentTypes.distribution && contentTypes.distribution.length > 0 && (
              <div className="space-y-2">
                {contentTypes.distribution.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <div className="flex-1">
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="capitalize">{item.type}</span>
                        <span className="text-muted-foreground">{item.count} ({item.percentage}%)</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full"
                          style={{ width: `${item.percentage}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Custom Fields */}
            {contentTypes.customFieldsNeeded && (
              <div className="pt-4 border-t">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Geschätzte Custom Fields benötigt</span>
                  <Badge variant="outline">{contentTypes.customFieldsNeeded}</Badge>
                </div>
              </div>
            )}

            {/* Recommendations */}
            {contentTypes.recommendations && contentTypes.recommendations.length > 0 && (
              <div className="pt-4 border-t">
                <p className="text-sm font-medium text-muted-foreground mb-2">Empfehlungen</p>
                <ul className="space-y-1">
                  {contentTypes.recommendations.map((rec, idx) => (
                    <li key={idx} className="text-sm flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* QuickScan 2.0: Migration Complexity Card */}
      {migrationComplexity && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <GitBranch className="h-5 w-5 text-muted-foreground" />
                <CardTitle>Migrations-Komplexität</CardTitle>
              </div>
              <Badge variant={
                migrationComplexity.recommendation === 'simple' ? 'default' :
                migrationComplexity.recommendation === 'moderate' ? 'secondary' :
                migrationComplexity.recommendation === 'complex' ? 'outline' : 'destructive'
              }>
                {migrationComplexity.score}% Score
              </Badge>
            </div>
            <CardDescription>
              Bewertung: {
                migrationComplexity.recommendation === 'simple' ? 'Einfache Migration' :
                migrationComplexity.recommendation === 'moderate' ? 'Moderate Komplexität' :
                migrationComplexity.recommendation === 'complex' ? 'Komplexe Migration' :
                'Sehr komplexe Migration'
              }
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Factors */}
            {migrationComplexity.factors && (
              <div className="grid gap-3 sm:grid-cols-2">
                {migrationComplexity.factors.cmsExportability && (
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">CMS Export</span>
                      <Badge variant="outline" className="text-xs">{migrationComplexity.factors.cmsExportability.score}%</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{migrationComplexity.factors.cmsExportability.notes}</p>
                  </div>
                )}
                {migrationComplexity.factors.dataQuality && (
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">Datenqualität</span>
                      <Badge variant="outline" className="text-xs">{migrationComplexity.factors.dataQuality.score}%</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{migrationComplexity.factors.dataQuality.notes}</p>
                  </div>
                )}
                {migrationComplexity.factors.contentComplexity && (
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">Content-Komplexität</span>
                      <Badge variant="outline" className="text-xs">{migrationComplexity.factors.contentComplexity.score}%</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{migrationComplexity.factors.contentComplexity.notes}</p>
                  </div>
                )}
                {migrationComplexity.factors.integrationComplexity && (
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">Integration</span>
                      <Badge variant="outline" className="text-xs">{migrationComplexity.factors.integrationComplexity.score}%</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{migrationComplexity.factors.integrationComplexity.notes}</p>
                  </div>
                )}
              </div>
            )}

            {/* Warnings & Opportunities */}
            <div className="grid gap-4 sm:grid-cols-2 pt-4 border-t">
              {migrationComplexity.warnings && migrationComplexity.warnings.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-orange-700 mb-2 flex items-center gap-1">
                    <TriangleAlert className="h-4 w-4" />
                    Risiken
                  </p>
                  <ul className="space-y-1">
                    {migrationComplexity.warnings.map((warning, idx) => (
                      <li key={idx} className="text-xs text-orange-600">{warning}</li>
                    ))}
                  </ul>
                </div>
              )}
              {migrationComplexity.opportunities && migrationComplexity.opportunities.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-green-700 mb-2 flex items-center gap-1">
                    <Lightbulb className="h-4 w-4" />
                    Chancen
                  </p>
                  <ul className="space-y-1">
                    {migrationComplexity.opportunities.map((opp, idx) => (
                      <li key={idx} className="text-xs text-green-600">{opp}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Effort Estimation */}
            {migrationComplexity.estimatedEffort && (
              <div className="pt-4 border-t">
                <p className="text-sm font-medium text-muted-foreground mb-2">Geschätzter Aufwand</p>
                <div className="flex items-center gap-4">
                  <Badge variant="secondary" className="text-base px-4 py-1">
                    {migrationComplexity.estimatedEffort.minPT} - {migrationComplexity.estimatedEffort.maxPT} PT
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    ({migrationComplexity.estimatedEffort.confidence}% Confidence)
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* QuickScan 2.0: Decision Makers Card */}
      {decisionMakers && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-muted-foreground" />
                <CardTitle>Entscheidungsträger</CardTitle>
              </div>
              <Badge variant="outline">
                {decisionMakers.researchQuality.confidence}% Confidence
              </Badge>
            </div>
            <CardDescription>
              Quellen: {decisionMakers.researchQuality.sources.join(', ')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Decision Makers */}
            {decisionMakers.decisionMakers && decisionMakers.decisionMakers.length > 0 && (
              <div className="space-y-3">
                {decisionMakers.decisionMakers.map((contact, idx) => (
                  <div key={idx} className="flex items-start justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium">{contact.name}</p>
                      <p className="text-sm text-muted-foreground">{contact.role}</p>
                      {contact.email && (
                        <div className="flex items-center gap-1 mt-1">
                          <Mail className="h-3 w-3 text-muted-foreground" />
                          <a href={`mailto:${contact.email}`} className="text-xs text-blue-600 hover:underline">
                            {contact.email}
                          </a>
                          {contact.emailConfidence && (
                            <Badge variant="outline" className="text-xs ml-1">
                              {contact.emailConfidence}
                            </Badge>
                          )}
                        </div>
                      )}
                      {contact.phone && (
                        <div className="flex items-center gap-1 mt-1">
                          <Phone className="h-3 w-3 text-muted-foreground" />
                          <a href={`tel:${contact.phone}`} className="text-xs text-blue-600 hover:underline">
                            {contact.phone}
                          </a>
                        </div>
                      )}
                      <Badge variant="outline" className="text-xs mt-2 capitalize">
                        {contact.source}
                      </Badge>
                    </div>
                    <div className="flex gap-2">
                      {contact.linkedInUrl && (
                        <a
                          href={contact.linkedInUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800"
                          title="LinkedIn"
                        >
                          <Linkedin className="h-5 w-5" />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Generic Contacts */}
            {decisionMakers.genericContacts && (
              <div className="pt-4 border-t">
                <p className="text-sm font-medium text-muted-foreground mb-2">Allgemeine Kontakte</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {decisionMakers.genericContacts.mainEmail && (
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <a href={`mailto:${decisionMakers.genericContacts.mainEmail}`} className="text-blue-600 hover:underline">
                        {decisionMakers.genericContacts.mainEmail}
                      </a>
                    </div>
                  )}
                  {decisionMakers.genericContacts.salesEmail && (
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <a href={`mailto:${decisionMakers.genericContacts.salesEmail}`} className="text-blue-600 hover:underline">
                        {decisionMakers.genericContacts.salesEmail}
                      </a>
                    </div>
                  )}
                  {decisionMakers.genericContacts.phone && (
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <a href={`tel:${decisionMakers.genericContacts.phone}`} className="text-blue-600 hover:underline">
                        {decisionMakers.genericContacts.phone}
                      </a>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Research Quality */}
            <div className="pt-4 border-t">
              <div className="grid grid-cols-3 gap-4 text-center text-sm">
                <div>
                  <p className="text-lg font-semibold text-blue-600">{decisionMakers.researchQuality.linkedInFound}</p>
                  <p className="text-xs text-muted-foreground">LinkedIn gefunden</p>
                </div>
                <div>
                  <p className="text-lg font-semibold text-green-600">{decisionMakers.researchQuality.emailsConfirmed}</p>
                  <p className="text-xs text-muted-foreground">Emails bestätigt</p>
                </div>
                <div>
                  <p className="text-lg font-semibold text-orange-600">{decisionMakers.researchQuality.emailsDerived}</p>
                  <p className="text-xs text-muted-foreground">Emails abgeleitet</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
