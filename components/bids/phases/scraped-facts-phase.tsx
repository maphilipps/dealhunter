'use client';

import {
  Globe,
  Server,
  FileText,
  ShieldCheck,
  Search,
  Building2,
  TrendingUp,
  Scale,
  Gauge,
  Camera,
  Navigation,
  Plug,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
  Code,
  Image as ImageIcon,
  Send,
  ArrowRight,
  Users,
  Mail,
  Phone,
  GitBranch,
  BarChart3,
  Workflow,
  ChevronRight,
  ChevronDown,
  Copy,
  ExternalLink,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';

import { CMSEvaluationMatrix } from '@/components/bids/cms-evaluation-matrix';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { getBusinessUnits } from '@/lib/admin/business-units-actions';
import { forwardToBusinessLeader } from '@/lib/bids/actions';
import { startCMSEvaluation } from '@/lib/cms-matching/actions';
import type { CMSMatchingResult } from '@/lib/cms-matching/schema';
import type { QuickScan } from '@/lib/db/schema';
import type { ExtractedRequirements } from '@/lib/extraction/schema';

interface BusinessUnit {
  id: string;
  name: string;
  leaderName: string;
  leaderEmail: string;
}

interface ScrapedFactsPhaseProps {
  quickScan: QuickScan | null;
  extractedData?: ExtractedRequirements | null;
  bidId?: string;
}

// Actual data types from database
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
  // Legacy fields (might exist in older scans)
  cms?: string;
  framework?: string;
  hosting?: string;
}

interface ContentVolumeData {
  estimatedPageCount?: number;
  sitemapFound?: boolean;
  contentTypes?: string[];
  mediaAssets?: {
    images?: number;
    videos?: number;
    documents?: number;
  };
  languages?: string[];
  complexity?: 'low' | 'medium' | 'high';
}

interface FeaturesData {
  ecommerce?: boolean;
  userAccounts?: boolean;
  search?: boolean;
  multiLanguage?: boolean;
  blog?: boolean;
  forms?: boolean;
  api?: boolean;
  mobileApp?: boolean;
  customFeatures?: string[];
}

interface NavigationData {
  mainNav?: Array<{ label: string }>;
  footerNav?: Array<{ label: string }>;
  hasSearch?: boolean;
  hasBreadcrumbs?: boolean;
  hasMegaMenu?: boolean;
  maxDepth?: number;
  totalItems?: number;
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
  topIssues?: Array<{ description: string }>;
  recommendations?: string[];
}

interface SeoAuditData {
  score?: number;
  checks?: {
    hasTitle?: boolean;
    titleLength?: number;
    hasMetaDescription?: boolean;
    metaDescriptionLength?: number;
    hasCanonical?: boolean;
    hasRobotsTxt?: boolean;
    hasSitemap?: boolean;
    hasStructuredData?: boolean;
    hasOpenGraph?: boolean;
    mobileViewport?: boolean;
  };
  issues?: Array<{ description: string }>;
}

interface LegalComplianceData {
  score: number;
  checks?: {
    hasImprint?: boolean;
    hasPrivacyPolicy?: boolean;
    hasCookieBanner?: boolean;
    hasTermsOfService?: boolean;
    hasAccessibilityStatement?: boolean;
  };
  gdprIndicators?: {
    cookieConsentTool?: string;
    analyticsCompliant?: boolean;
    hasDataProcessingInfo?: boolean;
  };
  issues?: Array<{ type: string; severity: string; description: string }>;
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

interface ScreenshotsData {
  homepage?: {
    desktop?: string;
    mobile?: string;
  };
  keyPages?: Array<{ name: string; path: string }>;
  timestamp?: string;
}

interface CompanyIntelligenceData {
  basicInfo?: {
    name?: string;
    website?: string;
    industry?: string;
    description?: string;
  };
  dataQuality?: {
    confidence?: number;
    sources?: string[];
    lastUpdated?: string;
  };
}

interface IntegrationsData {
  analytics?: string[];
  marketing?: string[];
  payment?: string[];
  social?: string[];
  other?: string[];
}

// ========================================
// QuickScan 2.0 Data Types
// ========================================

interface SiteTreeNodeData {
  path: string;
  url?: string;
  count: number;
  children?: SiteTreeNodeData[];
}

interface SiteTreeData {
  totalPages: number;
  maxDepth: number;
  crawledAt?: string;
  sources?: {
    sitemap: number;
    linkDiscovery: number;
    navigation: number;
  };
  sections?: Array<{
    path: string;
    label?: string;
    count: number;
    depth: number;
    children?: SiteTreeNodeData[];
  }>;
  navigation?: {
    mainNav?: Array<{ label: string; url?: string }>;
    footerNav?: Array<{ label: string; url?: string }>;
    breadcrumbs?: boolean;
    megaMenu?: boolean;
  };
}

interface ContentTypeDistributionData {
  pagesAnalyzed?: number;
  distribution?: Array<{
    type: string;
    count: number;
    percentage: number;
    examples?: string[];
  }>;
  complexity?: 'simple' | 'moderate' | 'complex' | 'very_complex';
  estimatedContentTypes?: number;
  customFieldsNeeded?: number;
  recommendations?: string[];
}

interface MigrationComplexityData {
  score: number;
  recommendation: 'easy' | 'moderate' | 'complex' | 'very_complex';
  factors?: {
    cmsExportability?: {
      score: number;
      hasRestApi?: boolean;
      hasXmlExport?: boolean;
      hasCli?: boolean;
      notes?: string;
    };
    dataQuality?: {
      score: number;
      brokenLinks?: number;
      duplicateContent?: boolean;
      inconsistentStructure?: boolean;
      notes?: string;
    };
    contentComplexity?: {
      score: number;
      embeddedMedia?: boolean;
      customFields?: number;
      complexLayouts?: boolean;
      notes?: string;
    };
    integrationComplexity?: {
      score: number;
      externalApis?: number;
      ssoRequired?: boolean;
      thirdPartyPlugins?: number;
      notes?: string;
    };
  };
  warnings?: string[];
  opportunities?: string[];
  estimatedEffort?: {
    minPT: number;
    maxPT: number;
    confidence: number;
  };
}

interface DecisionMakerData {
  name: string;
  role: string;
  linkedInUrl?: string;
  xingUrl?: string;
  email?: string;
  emailConfidence?: 'confirmed' | 'likely' | 'derived' | 'unknown';
  phone?: string;
  source: 'impressum' | 'linkedin' | 'xing' | 'website' | 'web_search' | 'derived';
}

interface DecisionMakersResearchData {
  decisionMakers?: DecisionMakerData[];
  genericContacts?: {
    mainEmail?: string;
    salesEmail?: string;
    techEmail?: string;
    marketingEmail?: string;
    supportEmail?: string;
    phone?: string;
    fax?: string;
  };
  researchQuality?: {
    linkedInFound?: number;
    xingFound?: number;
    emailsConfirmed?: number;
    emailsDerived?: number;
    confidence?: number;
    sources?: string[];
    lastUpdated?: string;
  };
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

function StatusBadge({ ok, label }: { ok: boolean | undefined; label: string }) {
  if (ok === undefined) return null;
  return (
    <Badge variant={ok ? 'default' : 'secondary'} className={ok ? 'bg-green-600' : ''}>
      {ok ? <CheckCircle2 className="h-3 w-3 mr-1" /> : <XCircle className="h-3 w-3 mr-1" />}
      {label}
    </Badge>
  );
}

// Site Tree Node Component for recursive rendering
function SiteTreeNodeComponent({ node, depth = 0 }: { node: SiteTreeNodeData; depth?: number }) {
  const [isExpanded, setIsExpanded] = useState(depth < 2);
  const hasChildren = node.children && node.children.length > 0;

  return (
    <div className="font-mono text-sm">
      <div
        className={`flex items-center gap-1 py-0.5 hover:bg-slate-100 rounded cursor-pointer ${depth > 0 ? 'ml-4' : ''}`}
        onClick={() => hasChildren && setIsExpanded(!isExpanded)}
      >
        {hasChildren ? (
          isExpanded ? (
            <ChevronDown className="h-3 w-3 text-slate-400" />
          ) : (
            <ChevronRight className="h-3 w-3 text-slate-400" />
          )
        ) : (
          <span className="w-3" />
        )}
        <span className="text-slate-700">{node.path || '/'}</span>
        <Badge variant="outline" className="text-xs ml-1">
          {node.count}
        </Badge>
      </div>
      {isExpanded && hasChildren && (
        <div className="border-l border-slate-200 ml-1.5">
          {node.children!.map((child, idx) => (
            <SiteTreeNodeComponent key={idx} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

// Email confidence badge with color coding
function EmailConfidenceBadge({ confidence }: { confidence?: string }) {
  if (!confidence) return null;

  const variants: Record<string, { color: string; label: string }> = {
    confirmed: { color: 'bg-green-100 text-green-800', label: '✓ Bestätigt' },
    likely: { color: 'bg-blue-100 text-blue-800', label: '~ Wahrscheinlich' },
    derived: { color: 'bg-yellow-100 text-yellow-800', label: '? Abgeleitet' },
    unknown: { color: 'bg-slate-100 text-slate-800', label: '— Unbekannt' },
  };

  const variant = variants[confidence] || variants.unknown;

  return (
    <Badge variant="outline" className={`text-xs ${variant.color}`}>
      {variant.label}
    </Badge>
  );
}

// Migration score color helper
function getMigrationScoreColor(score: number): string {
  if (score < 30) return 'text-green-600';
  if (score < 50) return 'text-yellow-600';
  if (score < 70) return 'text-orange-600';
  return 'text-red-600';
}

function getMigrationRecommendationLabel(recommendation: string): string {
  const labels: Record<string, string> = {
    easy: 'Einfach',
    moderate: 'Mittel',
    complex: 'Komplex',
    very_complex: 'Sehr Komplex',
  };
  return labels[recommendation] || recommendation;
}

// Copy to clipboard helper
function copyToClipboard(text: string) {
  void navigator.clipboard.writeText(text);
}

export function ScrapedFactsPhase({ quickScan, extractedData, bidId }: ScrapedFactsPhaseProps) {
  const router = useRouter();
  const [businessUnits, setBusinessUnits] = useState<BusinessUnit[]>([]);
  const [selectedBU, setSelectedBU] = useState<string>('');
  const [isForwarding, setIsForwarding] = useState(false);
  const [forwarded, setForwarded] = useState(false);
  const [forwardResult, setForwardResult] = useState<{
    businessUnit: string;
    leaderName: string;
  } | null>(null);

  // CMS Evaluation State
  const [cmsEvaluation, setCmsEvaluation] = useState<CMSMatchingResult | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [selectedCMS, setSelectedCMS] = useState<string>('');


  // Load business units
  useEffect(() => {
    async function loadBUs() {
      const result = await getBusinessUnits();
      if (result.success && result.businessUnits) {
        setBusinessUnits(result.businessUnits as BusinessUnit[]);
        // Pre-select the recommended BU if available
        if (quickScan?.recommendedBusinessUnit) {
          const recommended = result.businessUnits.find(
            bu => bu.name === quickScan.recommendedBusinessUnit
          );
          if (recommended) {
            setSelectedBU(recommended.id);
          }
        }
      }
    }
    if (quickScan?.status === 'completed') {
      void loadBUs();
    }
  }, [quickScan?.status, quickScan?.recommendedBusinessUnit]);

  // Handle CMS Evaluation
  const handleStartEvaluation = async () => {
    if (!quickScan?.id) return;

    setIsEvaluating(true);
    try {
      const result = await startCMSEvaluation(quickScan.id, { useWebSearch: true });
      if (result.success && result.result) {
        setCmsEvaluation(result.result);
        // Pre-select the recommended CMS
        if (result.result.comparedTechnologies.length > 0) {
          setSelectedCMS(result.result.comparedTechnologies[0].id);
        }
      } else {
        alert(result.error || 'CMS-Evaluation fehlgeschlagen');
      }
    } catch (error) {
      console.error('CMS Evaluation error:', error);
      alert('CMS-Evaluation fehlgeschlagen');
    } finally {
      setIsEvaluating(false);
    }
  };

  // Handle forward to BL
  const handleForward = async () => {
    if (!selectedBU || !bidId) return;

    setIsForwarding(true);
    try {
      const result = await forwardToBusinessLeader(bidId, selectedBU);
      if (result.success) {
        setForwarded(true);
        setForwardResult({
          businessUnit: result.businessUnit!,
          leaderName: result.leaderName!,
        });
        // Redirect to BL review page after 2 seconds
        setTimeout(() => {
          router.push(`/bl-review/${bidId}`);
        }, 2000);
      } else {
        alert(result.error || 'Weiterleitung fehlgeschlagen');
      }
    } catch (error) {
      console.error('Forward error:', error);
      alert('Weiterleitung fehlgeschlagen');
    } finally {
      setIsForwarding(false);
    }
  };

  if (!quickScan) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Qualification wird gestartet...</p>
        </CardContent>
      </Card>
    );
  }

  if (quickScan.status === 'running') {
    return (
      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="py-12 text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-600 mb-4" />
          <p className="text-blue-700 font-medium">Qualification läuft...</p>
          <p className="text-sm text-blue-600">Analyse von {quickScan.websiteUrl}</p>
        </CardContent>
      </Card>
    );
  }

  // Parse all JSON fields
  const techStack = parseJsonField<TechStackData>(quickScan.techStack);
  const contentVolume = parseJsonField<ContentVolumeData>(quickScan.contentVolume);
  const features = parseJsonField<FeaturesData>(quickScan.features);
  const navigationStructure = parseJsonField<NavigationData>(quickScan.navigationStructure);
  const accessibilityAudit = parseJsonField<AccessibilityAuditData>(quickScan.accessibilityAudit);
  const seoAudit = parseJsonField<SeoAuditData>(quickScan.seoAudit);
  const legalCompliance = parseJsonField<LegalComplianceData>(quickScan.legalCompliance);
  const performanceIndicators = parseJsonField<PerformanceData>(quickScan.performanceIndicators);
  const screenshots = parseJsonField<ScreenshotsData>(quickScan.screenshots);
  const companyIntelligence = parseJsonField<CompanyIntelligenceData>(
    quickScan.companyIntelligence
  );
  const integrations = parseJsonField<IntegrationsData>(quickScan.integrations);

  // QuickScan 2.0 fields
  const siteTree = parseJsonField<SiteTreeData>(quickScan.siteTree);
  const contentTypes = parseJsonField<ContentTypeDistributionData>(quickScan.contentTypes);
  const migrationComplexity = parseJsonField<MigrationComplexityData>(
    quickScan.migrationComplexity
  );
  const decisionMakers = parseJsonField<DecisionMakersResearchData>(quickScan.decisionMakers);

  // Get active features
  const activeFeatures: string[] = [];
  if (features?.ecommerce) activeFeatures.push('E-Commerce');
  if (features?.userAccounts) activeFeatures.push('User Accounts');
  if (features?.search) activeFeatures.push('Suche');
  if (features?.multiLanguage) activeFeatures.push('Mehrsprachig');
  if (features?.blog) activeFeatures.push('Blog/News');
  if (features?.forms) activeFeatures.push('Formulare');
  if (features?.api) activeFeatures.push('API');
  if (features?.mobileApp) activeFeatures.push('Mobile App');

  return (
    <div className="space-y-4">
      {/* Header Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-blue-600" />
              <CardTitle>Gescrapte Fakten</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={quickScan.status === 'completed' ? 'default' : 'destructive'}>
                {quickScan.status === 'completed' ? 'Abgeschlossen' : 'Fehlgeschlagen'}
              </Badge>
            </div>
          </div>
          <CardDescription>
            Alle automatisch erfassten Informationen von {quickScan.websiteUrl}
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Main Facts Accordion */}
      <Accordion
        type="multiple"
        defaultValue={['tech', 'content', 'company']}
        className="space-y-2"
      >
        {/* 1. Tech Stack */}
        <AccordionItem value="tech" className="border rounded-lg">
          <AccordionTrigger className="px-4 hover:no-underline">
            <div className="flex items-center gap-2">
              <Server className="h-4 w-4 text-purple-600" />
              <span className="font-medium">Tech Stack</span>
              {techStack?.cssFrameworks?.length ? (
                <Badge variant="secondary" className="ml-2">
                  {techStack.cssFrameworks.map(f => f.name).join(', ')}
                </Badge>
              ) : techStack?.cms ? (
                <Badge variant="secondary" className="ml-2">
                  {techStack.cms}
                </Badge>
              ) : null}
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4">
            <div className="space-y-4">
              {/* CSS Frameworks */}
              {techStack?.cssFrameworks?.length ? (
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

              {/* JS Frameworks */}
              {techStack?.javascriptFrameworks?.length ? (
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

              {/* Analytics */}
              {techStack?.analytics?.length ? (
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

              {/* CDN */}
              {techStack?.cdn || techStack?.cdnProviders?.length ? (
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

              {/* API Endpoints */}
              {techStack?.apiEndpoints?.rest?.length ? (
                <div>
                  <p className="text-xs text-muted-foreground mb-2">
                    API Endpoints ({techStack.apiEndpoints.rest.length})
                  </p>
                  <div className="text-xs font-mono bg-slate-100 p-2 rounded max-h-32 overflow-auto">
                    {techStack.apiEndpoints.rest.slice(0, 5).map(url => (
                      <div key={url} className="truncate">
                        {url}
                      </div>
                    ))}
                    {techStack.apiEndpoints.rest.length > 5 && (
                      <div className="text-muted-foreground">
                        +{techStack.apiEndpoints.rest.length - 5} mehr
                      </div>
                    )}
                  </div>
                </div>
              ) : null}

              {/* Server-Side Rendering */}
              <div className="flex gap-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">SSR</p>
                  <Badge variant={techStack?.serverSideRendering ? 'default' : 'secondary'}>
                    {techStack?.serverSideRendering ? 'Aktiv' : 'Nicht aktiv'}
                  </Badge>
                </div>
                {techStack?.apiEndpoints?.graphql !== undefined && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">GraphQL</p>
                    <Badge variant={techStack.apiEndpoints.graphql ? 'default' : 'secondary'}>
                      {techStack.apiEndpoints.graphql ? 'Ja' : 'Nein'}
                    </Badge>
                  </div>
                )}
              </div>

              {/* Legacy fields fallback */}
              {techStack?.cms && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">CMS</p>
                  <p className="font-medium">{techStack.cms}</p>
                </div>
              )}
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* 2. Content & Features */}
        <AccordionItem value="content" className="border rounded-lg">
          <AccordionTrigger className="px-4 hover:no-underline">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-green-600" />
              <span className="font-medium">Content & Features</span>
              {contentVolume?.estimatedPageCount && (
                <Badge variant="secondary" className="ml-2">
                  {contentVolume.estimatedPageCount} Seiten
                </Badge>
              )}
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4">
            <div className="space-y-4">
              {/* Content Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Seitenanzahl</p>
                  <p className="text-2xl font-bold">{contentVolume?.estimatedPageCount || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Komplexität</p>
                  <Badge
                    variant={
                      contentVolume?.complexity === 'high'
                        ? 'destructive'
                        : contentVolume?.complexity === 'medium'
                          ? 'secondary'
                          : 'outline'
                    }
                  >
                    {contentVolume?.complexity === 'high'
                      ? 'Hoch'
                      : contentVolume?.complexity === 'medium'
                        ? 'Mittel'
                        : 'Gering'}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Sprachen</p>
                  {contentVolume?.languages?.length ? (
                    <div className="flex gap-1">
                      {contentVolume.languages.map(l => (
                        <Badge key={l} variant="outline">
                          {l}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="font-medium">1</p>
                  )}
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Sitemap</p>
                  <Badge variant={contentVolume?.sitemapFound ? 'default' : 'secondary'}>
                    {contentVolume?.sitemapFound ? 'Vorhanden' : 'Nicht gefunden'}
                  </Badge>
                </div>
              </div>

              {/* Media Assets */}
              {contentVolume?.mediaAssets && (
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Medien</p>
                  <div className="flex gap-4">
                    <div className="text-center p-2 bg-slate-50 rounded">
                      <ImageIcon className="h-4 w-4 mx-auto text-slate-500" />
                      <p className="text-lg font-bold">{contentVolume.mediaAssets.images || 0}</p>
                      <p className="text-xs text-muted-foreground">Bilder</p>
                    </div>
                    <div className="text-center p-2 bg-slate-50 rounded">
                      <Code className="h-4 w-4 mx-auto text-slate-500" />
                      <p className="text-lg font-bold">{contentVolume.mediaAssets.videos || 0}</p>
                      <p className="text-xs text-muted-foreground">Videos</p>
                    </div>
                    <div className="text-center p-2 bg-slate-50 rounded">
                      <FileText className="h-4 w-4 mx-auto text-slate-500" />
                      <p className="text-lg font-bold">
                        {contentVolume.mediaAssets.documents || 0}
                      </p>
                      <p className="text-xs text-muted-foreground">Dokumente</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Features */}
              <div>
                <p className="text-xs text-muted-foreground mb-2">Erkannte Features</p>
                {activeFeatures.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {activeFeatures.map(f => (
                      <Badge key={f} className="bg-green-100 text-green-800">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        {f}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">Keine Features erkannt</p>
                )}
              </div>

              {/* Custom Features */}
              {features?.customFeatures?.length ? (
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Zusätzliche Features</p>
                  <div className="flex flex-wrap gap-2">
                    {features.customFeatures.map(f => (
                      <Badge key={f} variant="outline">
                        {f}
                      </Badge>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* 3. Navigation */}
        <AccordionItem value="navigation" className="border rounded-lg">
          <AccordionTrigger className="px-4 hover:no-underline">
            <div className="flex items-center gap-2">
              <Navigation className="h-4 w-4 text-blue-600" />
              <span className="font-medium">Navigation</span>
              {navigationStructure?.totalItems && (
                <Badge variant="secondary" className="ml-2">
                  {navigationStructure.totalItems} Items
                </Badge>
              )}
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4">
            {navigationStructure ? (
              <div className="space-y-4">
                {/* Stats */}
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Nav Items</p>
                    <p className="text-xl font-bold">{navigationStructure.totalItems || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Max Tiefe</p>
                    <p className="text-xl font-bold">{navigationStructure.maxDepth || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Features</p>
                    <div className="flex flex-wrap gap-1">
                      {navigationStructure.hasSearch && (
                        <Badge variant="outline" className="text-xs">
                          Suche
                        </Badge>
                      )}
                      {navigationStructure.hasBreadcrumbs && (
                        <Badge variant="outline" className="text-xs">
                          Breadcrumbs
                        </Badge>
                      )}
                      {navigationStructure.hasMegaMenu && (
                        <Badge variant="outline" className="text-xs">
                          Mega Menu
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                {/* Main Nav Items */}
                {navigationStructure.mainNav?.length ? (
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">Hauptnavigation</p>
                    <div className="flex flex-wrap gap-1">
                      {navigationStructure.mainNav.slice(0, 10).map((item, i) => (
                        <Badge key={i} variant="outline" className="text-xs">
                          {item.label}
                        </Badge>
                      ))}
                      {navigationStructure.mainNav.length > 10 && (
                        <Badge variant="secondary" className="text-xs">
                          +{navigationStructure.mainNav.length - 10} mehr
                        </Badge>
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">Keine Navigationsdaten verfügbar</p>
            )}
          </AccordionContent>
        </AccordionItem>

        {/* 4. Integrations */}
        <AccordionItem value="integrations" className="border rounded-lg">
          <AccordionTrigger className="px-4 hover:no-underline">
            <div className="flex items-center gap-2">
              <Plug className="h-4 w-4 text-orange-600" />
              <span className="font-medium">Integrationen</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4">
            {integrations || techStack?.analytics?.length || techStack?.marketing?.length ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {integrations?.analytics?.length || techStack?.analytics?.length ? (
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">Analytics</p>
                    {(integrations?.analytics || techStack?.analytics)?.map(a => (
                      <Badge key={a} variant="outline" className="mr-1 mb-1 text-xs">
                        {a}
                      </Badge>
                    ))}
                  </div>
                ) : null}
                {integrations?.marketing?.length || techStack?.marketing?.length ? (
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">Marketing</p>
                    {(integrations?.marketing || techStack?.marketing)?.map(m => (
                      <Badge key={m} variant="outline" className="mr-1 mb-1 text-xs">
                        {m}
                      </Badge>
                    ))}
                  </div>
                ) : null}
                {integrations?.payment?.length ? (
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">Payment</p>
                    {integrations.payment.map(p => (
                      <Badge key={p} variant="outline" className="mr-1 mb-1 text-xs">
                        {p}
                      </Badge>
                    ))}
                  </div>
                ) : null}
                {integrations?.social?.length ? (
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">Social</p>
                    {integrations.social.map(s => (
                      <Badge key={s} variant="outline" className="mr-1 mb-1 text-xs">
                        {s}
                      </Badge>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">Keine Integrationen erkannt</p>
            )}
          </AccordionContent>
        </AccordionItem>

        {/* 5. Accessibility Audit */}
        <AccordionItem value="accessibility" className="border rounded-lg">
          <AccordionTrigger className="px-4 hover:no-underline">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-indigo-600" />
              <span className="font-medium">Accessibility</span>
              {accessibilityAudit && (
                <Badge
                  variant={accessibilityAudit.score >= 70 ? 'default' : 'destructive'}
                  className="ml-2"
                >
                  {accessibilityAudit.level && `WCAG ${accessibilityAudit.level} - `}
                  {accessibilityAudit.score}%
                </Badge>
              )}
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4">
            {accessibilityAudit ? (
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <Progress value={accessibilityAudit.score} className="h-3" />
                  </div>
                  <span className="text-2xl font-bold">{accessibilityAudit.score}%</span>
                </div>
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
              <p className="text-muted-foreground text-sm">Kein Accessibility Audit durchgeführt</p>
            )}
          </AccordionContent>
        </AccordionItem>

        {/* 6. SEO Audit */}
        <AccordionItem value="seo" className="border rounded-lg">
          <AccordionTrigger className="px-4 hover:no-underline">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-600" />
              <span className="font-medium">SEO</span>
              {seoAudit?.score !== undefined && (
                <Badge variant={seoAudit.score >= 70 ? 'default' : 'secondary'} className="ml-2">
                  {seoAudit.score}%
                </Badge>
              )}
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4">
            {seoAudit ? (
              <div className="space-y-4">
                {seoAudit.score !== undefined && (
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <Progress value={seoAudit.score} className="h-3" />
                    </div>
                    <span className="text-2xl font-bold">{seoAudit.score}%</span>
                  </div>
                )}
                {seoAudit.checks && (
                  <div className="flex flex-wrap gap-2">
                    <StatusBadge ok={seoAudit.checks.hasTitle} label="Title Tag" />
                    <StatusBadge ok={seoAudit.checks.hasMetaDescription} label="Meta Description" />
                    <StatusBadge ok={seoAudit.checks.hasCanonical} label="Canonical" />
                    <StatusBadge ok={seoAudit.checks.hasRobotsTxt} label="robots.txt" />
                    <StatusBadge ok={seoAudit.checks.hasSitemap} label="Sitemap" />
                    <StatusBadge ok={seoAudit.checks.hasStructuredData} label="Schema.org" />
                    <StatusBadge ok={seoAudit.checks.hasOpenGraph} label="Open Graph" />
                    <StatusBadge ok={seoAudit.checks.mobileViewport} label="Mobile Viewport" />
                  </div>
                )}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">Kein SEO Audit durchgeführt</p>
            )}
          </AccordionContent>
        </AccordionItem>

        {/* 7. Legal Compliance */}
        <AccordionItem value="legal" className="border rounded-lg">
          <AccordionTrigger className="px-4 hover:no-underline">
            <div className="flex items-center gap-2">
              <Scale className="h-4 w-4 text-slate-600" />
              <span className="font-medium">Legal / DSGVO</span>
              {legalCompliance && (
                <Badge
                  variant={legalCompliance.score >= 70 ? 'default' : 'destructive'}
                  className="ml-2"
                >
                  {legalCompliance.score}%
                </Badge>
              )}
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4">
            {legalCompliance ? (
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <Progress value={legalCompliance.score} className="h-3" />
                  </div>
                  <span className="text-2xl font-bold">{legalCompliance.score}%</span>
                </div>
                {legalCompliance.checks && (
                  <div className="flex flex-wrap gap-2">
                    <StatusBadge ok={legalCompliance.checks.hasImprint} label="Impressum" />
                    <StatusBadge ok={legalCompliance.checks.hasPrivacyPolicy} label="Datenschutz" />
                    <StatusBadge
                      ok={legalCompliance.checks.hasCookieBanner}
                      label="Cookie Banner"
                    />
                    <StatusBadge ok={legalCompliance.checks.hasTermsOfService} label="AGB" />
                    <StatusBadge
                      ok={legalCompliance.checks.hasAccessibilityStatement}
                      label="Barrierefreiheit"
                    />
                  </div>
                )}
                {legalCompliance.gdprIndicators?.cookieConsentTool && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Cookie Tool</p>
                    <Badge variant="outline">
                      {legalCompliance.gdprIndicators.cookieConsentTool}
                    </Badge>
                  </div>
                )}
                {legalCompliance.issues?.length ? (
                  <div className="mt-2">
                    <p className="text-xs text-muted-foreground mb-1">Issues</p>
                    {legalCompliance.issues.map((issue, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm text-orange-700">
                        <AlertTriangle className="h-3 w-3" />
                        {issue.description}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">Keine Legal-Prüfung durchgeführt</p>
            )}
          </AccordionContent>
        </AccordionItem>

        {/* 8. Performance */}
        <AccordionItem value="performance" className="border rounded-lg">
          <AccordionTrigger className="px-4 hover:no-underline">
            <div className="flex items-center gap-2">
              <Gauge className="h-4 w-4 text-yellow-600" />
              <span className="font-medium">Performance</span>
              {performanceIndicators?.estimatedLoadTime && (
                <Badge
                  variant={
                    performanceIndicators.estimatedLoadTime === 'fast'
                      ? 'default'
                      : performanceIndicators.estimatedLoadTime === 'medium'
                        ? 'secondary'
                        : 'destructive'
                  }
                  className="ml-2"
                >
                  {performanceIndicators.estimatedLoadTime === 'fast'
                    ? 'Schnell'
                    : performanceIndicators.estimatedLoadTime === 'medium'
                      ? 'Mittel'
                      : 'Langsam'}
                </Badge>
              )}
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4">
            {performanceIndicators ? (
              <div className="space-y-4">
                {/* Resource Count */}
                {performanceIndicators.resourceCount && (
                  <div className="grid grid-cols-4 gap-4">
                    <div className="text-center p-2 bg-slate-50 rounded">
                      <p className="text-xl font-bold">
                        {performanceIndicators.resourceCount.scripts || 0}
                      </p>
                      <p className="text-xs text-muted-foreground">Scripts</p>
                    </div>
                    <div className="text-center p-2 bg-slate-50 rounded">
                      <p className="text-xl font-bold">
                        {performanceIndicators.resourceCount.stylesheets || 0}
                      </p>
                      <p className="text-xs text-muted-foreground">Stylesheets</p>
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
                )}

                {/* Other indicators */}
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
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">Keine Performance-Daten verfügbar</p>
            )}
          </AccordionContent>
        </AccordionItem>

        {/* 9. Screenshots */}
        <AccordionItem value="screenshots" className="border rounded-lg">
          <AccordionTrigger className="px-4 hover:no-underline">
            <div className="flex items-center gap-2">
              <Camera className="h-4 w-4 text-pink-600" />
              <span className="font-medium">Screenshots</span>
              {screenshots?.timestamp && (
                <Badge variant="outline" className="ml-2 text-xs">
                  {new Date(screenshots.timestamp).toLocaleDateString('de-DE')}
                </Badge>
              )}
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4">
            {screenshots?.homepage ? (
              <div className="grid grid-cols-2 gap-4">
                {screenshots.homepage.desktop && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">Desktop</p>
                    <img
                      src={screenshots.homepage.desktop}
                      alt="Desktop Screenshot"
                      className="rounded border w-full"
                    />
                  </div>
                )}
                {screenshots.homepage.mobile && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">Mobile</p>
                    <img
                      src={screenshots.homepage.mobile}
                      alt="Mobile Screenshot"
                      className="rounded border max-w-[200px]"
                    />
                  </div>
                )}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">Keine Screenshots verfügbar</p>
            )}
          </AccordionContent>
        </AccordionItem>

        {/* 10. Company Intelligence */}
        <AccordionItem value="company" className="border rounded-lg">
          <AccordionTrigger className="px-4 hover:no-underline">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-teal-600" />
              <span className="font-medium">Company Intelligence</span>
              {(companyIntelligence?.basicInfo?.name || extractedData?.customerName) && (
                <Badge variant="secondary" className="ml-2">
                  {companyIntelligence?.basicInfo?.name || extractedData?.customerName}
                </Badge>
              )}
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4">
            <div className="space-y-4">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Firma</p>
                  <p className="font-medium">
                    {companyIntelligence?.basicInfo?.name || extractedData?.customerName || '-'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Branche</p>
                  <p className="font-medium">
                    {companyIntelligence?.basicInfo?.industry || extractedData?.industry || '-'}
                  </p>
                </div>
              </div>

              {/* Data Quality */}
              {companyIntelligence?.dataQuality && (
                <div className="p-3 bg-slate-50 rounded">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">Datenqualität</p>
                      <p className="font-medium">
                        {companyIntelligence.dataQuality.confidence}% Confidence
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Quellen</p>
                      <div className="flex gap-1">
                        {companyIntelligence.dataQuality.sources?.map(s => (
                          <Badge key={s} variant="outline" className="text-xs">
                            {s}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* ========================================
            QuickScan 2.0: Enhanced Sections
            ======================================== */}

        {/* 11. Site Tree (Full Sitemap Structure) */}
        {siteTree && (
          <AccordionItem value="site-tree" className="border rounded-lg border-blue-200">
            <AccordionTrigger className="px-4 hover:no-underline">
              <div className="flex items-center gap-2">
                <GitBranch className="h-4 w-4 text-blue-600" />
                <span className="font-medium">Sitemap-Struktur</span>
                <Badge variant="secondary" className="ml-2 bg-blue-100 text-blue-800">
                  {siteTree.totalPages} Seiten
                </Badge>
                <Badge variant="outline" className="text-xs">
                  Tiefe: {siteTree.maxDepth}
                </Badge>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              <div className="space-y-4">
                {/* Sources Summary */}
                {siteTree.sources && (
                  <div className="grid grid-cols-3 gap-4 p-3 bg-blue-50 rounded">
                    <div className="text-center">
                      <p className="text-lg font-bold text-blue-800">{siteTree.sources.sitemap}</p>
                      <p className="text-xs text-blue-600">Sitemap</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-bold text-blue-800">
                        {siteTree.sources.linkDiscovery}
                      </p>
                      <p className="text-xs text-blue-600">Link Discovery</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-bold text-blue-800">
                        {siteTree.sources.navigation}
                      </p>
                      <p className="text-xs text-blue-600">Navigation</p>
                    </div>
                  </div>
                )}

                {/* Site Sections Tree */}
                {siteTree.sections && siteTree.sections.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">Seitenstruktur</p>
                    <div className="border rounded p-3 max-h-64 overflow-auto bg-slate-50">
                      {siteTree.sections.map((section, idx) => (
                        <SiteTreeNodeComponent
                          key={idx}
                          node={{
                            path: section.label || section.path,
                            count: section.count,
                            children: section.children,
                          }}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Timestamp */}
                {siteTree.crawledAt && (
                  <p className="text-xs text-muted-foreground">
                    Gecrawlt: {new Date(siteTree.crawledAt).toLocaleString('de-DE')}
                  </p>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>
        )}

        {/* 12. Content Types Distribution */}
        {contentTypes && (
          <AccordionItem value="content-types" className="border rounded-lg border-green-200">
            <AccordionTrigger className="px-4 hover:no-underline">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-green-600" />
                <span className="font-medium">Content-Typen</span>
                {contentTypes.estimatedContentTypes && (
                  <Badge variant="secondary" className="ml-2 bg-green-100 text-green-800">
                    {contentTypes.estimatedContentTypes} Typen
                  </Badge>
                )}
                {contentTypes.complexity && (
                  <Badge variant="outline" className="text-xs">
                    {contentTypes.complexity === 'simple'
                      ? 'Einfach'
                      : contentTypes.complexity === 'moderate'
                        ? 'Mittel'
                        : contentTypes.complexity === 'complex'
                          ? 'Komplex'
                          : 'Sehr komplex'}
                  </Badge>
                )}
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              <div className="space-y-4">
                {/* Pages Analyzed */}
                {contentTypes.pagesAnalyzed && (
                  <p className="text-sm text-muted-foreground">
                    {contentTypes.pagesAnalyzed} Seiten analysiert
                  </p>
                )}

                {/* Distribution Bar Chart */}
                {contentTypes.distribution && contentTypes.distribution.length > 0 && (
                  <div className="space-y-2">
                    {contentTypes.distribution.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <div className="w-24 text-sm text-right truncate">{item.type}</div>
                        <div className="flex-1 h-5 bg-slate-100 rounded overflow-hidden">
                          <div
                            className="h-full bg-green-500 flex items-center justify-end pr-2"
                            style={{ width: `${item.percentage}%` }}
                          >
                            {item.percentage > 15 && (
                              <span className="text-xs text-white font-medium">
                                {item.percentage}%
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="w-12 text-sm text-muted-foreground">({item.count})</div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Custom Fields Info */}
                {contentTypes.customFieldsNeeded && (
                  <div className="p-3 bg-slate-50 rounded">
                    <p className="text-xs text-muted-foreground">
                      Geschätzte Custom Fields für CMS
                    </p>
                    <p className="text-lg font-bold">{contentTypes.customFieldsNeeded}</p>
                  </div>
                )}

                {/* Recommendations */}
                {contentTypes.recommendations && contentTypes.recommendations.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">Empfehlungen</p>
                    <ul className="text-sm space-y-1">
                      {contentTypes.recommendations.map((rec, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5" />
                          {rec}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>
        )}

        {/* 13. Decision Makers & Contacts */}
        {decisionMakers && (
          <AccordionItem value="decision-makers" className="border rounded-lg border-purple-200">
            <AccordionTrigger className="px-4 hover:no-underline">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-purple-600" />
                <span className="font-medium">Entscheider & Kontakte</span>
                {decisionMakers.decisionMakers && (
                  <Badge variant="secondary" className="ml-2 bg-purple-100 text-purple-800">
                    {decisionMakers.decisionMakers.length} gefunden
                  </Badge>
                )}
                {decisionMakers.researchQuality?.confidence && (
                  <Badge variant="outline" className="text-xs">
                    {decisionMakers.researchQuality.confidence}% Qualität
                  </Badge>
                )}
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              <div className="space-y-4">
                {/* Decision Makers Table */}
                {decisionMakers.decisionMakers && decisionMakers.decisionMakers.length > 0 && (
                  <div className="border rounded overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium">Name</th>
                          <th className="px-3 py-2 text-left font-medium">Rolle</th>
                          <th className="px-3 py-2 text-left font-medium">LinkedIn</th>
                          <th className="px-3 py-2 text-left font-medium">E-Mail</th>
                        </tr>
                      </thead>
                      <tbody>
                        {decisionMakers.decisionMakers.map((dm, idx) => (
                          <tr key={idx} className="border-t">
                            <td className="px-3 py-2 font-medium">{dm.name}</td>
                            <td className="px-3 py-2 text-muted-foreground">{dm.role}</td>
                            <td className="px-3 py-2">
                              {dm.linkedInUrl ? (
                                <a
                                  href={dm.linkedInUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-blue-600 hover:underline"
                                >
                                  <ExternalLink className="h-3 w-3" />
                                  LinkedIn
                                </a>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </td>
                            <td className="px-3 py-2">
                              {dm.email ? (
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => copyToClipboard(dm.email!)}
                                    className="text-left hover:bg-slate-100 rounded px-1 flex items-center gap-1"
                                    title="Klicken zum Kopieren"
                                  >
                                    <Mail className="h-3 w-3" />
                                    <span className="truncate max-w-32">{dm.email}</span>
                                    <Copy className="h-3 w-3 text-muted-foreground" />
                                  </button>
                                  <EmailConfidenceBadge confidence={dm.emailConfidence} />
                                </div>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Generic Contacts */}
                {decisionMakers.genericContacts && (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {decisionMakers.genericContacts.mainEmail && (
                      <div className="p-2 bg-slate-50 rounded">
                        <p className="text-xs text-muted-foreground">Allgemein</p>
                        <button
                          onClick={() =>
                            copyToClipboard(decisionMakers.genericContacts!.mainEmail!)
                          }
                          className="text-sm font-medium flex items-center gap-1 hover:text-blue-600"
                        >
                          <Mail className="h-3 w-3" />
                          {decisionMakers.genericContacts.mainEmail}
                        </button>
                      </div>
                    )}
                    {decisionMakers.genericContacts.salesEmail && (
                      <div className="p-2 bg-slate-50 rounded">
                        <p className="text-xs text-muted-foreground">Vertrieb</p>
                        <button
                          onClick={() =>
                            copyToClipboard(decisionMakers.genericContacts!.salesEmail!)
                          }
                          className="text-sm font-medium flex items-center gap-1 hover:text-blue-600"
                        >
                          <Mail className="h-3 w-3" />
                          {decisionMakers.genericContacts.salesEmail}
                        </button>
                      </div>
                    )}
                    {decisionMakers.genericContacts.phone && (
                      <div className="p-2 bg-slate-50 rounded">
                        <p className="text-xs text-muted-foreground">Telefon</p>
                        <p className="text-sm font-medium flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {decisionMakers.genericContacts.phone}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Research Quality */}
                {decisionMakers.researchQuality && (
                  <div className="p-3 bg-purple-50 rounded">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-xs text-purple-600">Research-Qualität</p>
                        <div className="flex items-center gap-2">
                          <Progress
                            value={decisionMakers.researchQuality.confidence}
                            className="h-2 w-24"
                          />
                          <span className="font-medium">
                            {decisionMakers.researchQuality.confidence}%
                          </span>
                        </div>
                      </div>
                      <div className="text-right text-xs text-purple-600">
                        <div>LinkedIn: {decisionMakers.researchQuality.linkedInFound || 0}</div>
                        <div>
                          E-Mails bestätigt: {decisionMakers.researchQuality.emailsConfirmed || 0}
                        </div>
                        <div>
                          E-Mails abgeleitet: {decisionMakers.researchQuality.emailsDerived || 0}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>
        )}

        {/* 14. Migration Complexity */}
        {migrationComplexity && (
          <AccordionItem
            value="migration-complexity"
            className="border rounded-lg border-orange-200"
          >
            <AccordionTrigger className="px-4 hover:no-underline">
              <div className="flex items-center gap-2">
                <Workflow className="h-4 w-4 text-orange-600" />
                <span className="font-medium">Migrations-Komplexität</span>
                <Badge
                  variant="secondary"
                  className={`ml-2 ${
                    migrationComplexity.score < 30
                      ? 'bg-green-100 text-green-800'
                      : migrationComplexity.score < 50
                        ? 'bg-yellow-100 text-yellow-800'
                        : migrationComplexity.score < 70
                          ? 'bg-orange-100 text-orange-800'
                          : 'bg-red-100 text-red-800'
                  }`}
                >
                  Score: {migrationComplexity.score}/100
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {getMigrationRecommendationLabel(migrationComplexity.recommendation)}
                </Badge>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              <div className="space-y-4">
                {/* Score Visualization */}
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <Progress
                      value={migrationComplexity.score}
                      className={`h-4 ${
                        migrationComplexity.score < 30
                          ? '[&>div]:bg-green-500'
                          : migrationComplexity.score < 50
                            ? '[&>div]:bg-yellow-500'
                            : migrationComplexity.score < 70
                              ? '[&>div]:bg-orange-500'
                              : '[&>div]:bg-red-500'
                      }`}
                    />
                  </div>
                  <span
                    className={`text-3xl font-bold ${getMigrationScoreColor(migrationComplexity.score)}`}
                  >
                    {migrationComplexity.score}
                  </span>
                </div>

                {/* Factors Breakdown */}
                {migrationComplexity.factors && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {migrationComplexity.factors.cmsExportability && (
                      <div className="p-3 bg-slate-50 rounded">
                        <p className="text-xs text-muted-foreground mb-1">CMS-Export</p>
                        <p className="text-xl font-bold">
                          {migrationComplexity.factors.cmsExportability.score}
                        </p>
                        <div className="flex gap-1 mt-1">
                          {migrationComplexity.factors.cmsExportability.hasRestApi && (
                            <Badge variant="outline" className="text-xs">
                              REST
                            </Badge>
                          )}
                          {migrationComplexity.factors.cmsExportability.hasCli && (
                            <Badge variant="outline" className="text-xs">
                              CLI
                            </Badge>
                          )}
                        </div>
                      </div>
                    )}
                    {migrationComplexity.factors.dataQuality && (
                      <div className="p-3 bg-slate-50 rounded">
                        <p className="text-xs text-muted-foreground mb-1">Datenqualität</p>
                        <p className="text-xl font-bold">
                          {migrationComplexity.factors.dataQuality.score}
                        </p>
                      </div>
                    )}
                    {migrationComplexity.factors.contentComplexity && (
                      <div className="p-3 bg-slate-50 rounded">
                        <p className="text-xs text-muted-foreground mb-1">Content</p>
                        <p className="text-xl font-bold">
                          {migrationComplexity.factors.contentComplexity.score}
                        </p>
                        {migrationComplexity.factors.contentComplexity.customFields && (
                          <p className="text-xs text-muted-foreground">
                            {migrationComplexity.factors.contentComplexity.customFields} Custom
                            Fields
                          </p>
                        )}
                      </div>
                    )}
                    {migrationComplexity.factors.integrationComplexity && (
                      <div className="p-3 bg-slate-50 rounded">
                        <p className="text-xs text-muted-foreground mb-1">Integrationen</p>
                        <p className="text-xl font-bold">
                          {migrationComplexity.factors.integrationComplexity.score}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {migrationComplexity.factors.integrationComplexity.externalApis} APIs
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Estimated Effort */}
                {migrationComplexity.estimatedEffort && (
                  <div className="p-3 bg-orange-50 rounded">
                    <p className="text-xs text-orange-600 mb-1">Geschätzter Aufwand</p>
                    <p className="text-2xl font-bold text-orange-800">
                      {migrationComplexity.estimatedEffort.minPT} -{' '}
                      {migrationComplexity.estimatedEffort.maxPT} PT
                    </p>
                    <p className="text-xs text-orange-600">
                      {migrationComplexity.estimatedEffort.confidence}% Konfidenz
                    </p>
                  </div>
                )}

                {/* Warnings */}
                {migrationComplexity.warnings && migrationComplexity.warnings.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">Warnungen</p>
                    <ul className="space-y-1">
                      {migrationComplexity.warnings.map((warning, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm text-orange-700">
                          <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                          {warning}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Opportunities */}
                {migrationComplexity.opportunities &&
                  migrationComplexity.opportunities.length > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-2">Chancen</p>
                      <ul className="space-y-1">
                        {migrationComplexity.opportunities.map((opp, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-sm text-green-700">
                            <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0" />
                            {opp}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
              </div>
            </AccordionContent>
          </AccordionItem>
        )}

        {/* 15. BL Recommendation */}
        <AccordionItem value="bl-recommendation" className="border rounded-lg">
          <AccordionTrigger className="px-4 hover:no-underline">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-violet-600" />
              <span className="font-medium">BL-Empfehlung</span>
              {quickScan.recommendedBusinessUnit && (
                <Badge className="ml-2">{quickScan.recommendedBusinessUnit}</Badge>
              )}
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4">
            {quickScan.recommendedBusinessUnit ? (
              <div className="space-y-3">
                <div className="flex items-center gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Empfohlene Business Unit</p>
                    <p className="text-xl font-bold">{quickScan.recommendedBusinessUnit}</p>
                  </div>
                  {quickScan.confidence && (
                    <div>
                      <p className="text-xs text-muted-foreground">Confidence</p>
                      <div className="flex items-center gap-2">
                        <Progress value={quickScan.confidence} className="h-2 w-24" />
                        <span className="font-medium">{quickScan.confidence}%</span>
                      </div>
                    </div>
                  )}
                </div>
                {quickScan.reasoning && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Begründung</p>
                    <p className="text-sm bg-slate-50 p-3 rounded">{quickScan.reasoning}</p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">Noch keine BL-Empfehlung generiert</p>
            )}
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* CMS Evaluation Section */}
      {quickScan.status === 'completed' && bidId && (
        <div className="space-y-4">
          {!cmsEvaluation && !isEvaluating && (
            <Card className="border-blue-200 bg-blue-50">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Search className="h-5 w-5 text-blue-600" />
                  <CardTitle className="text-lg text-blue-900">CMS-Evaluation starten</CardTitle>
                </div>
                <CardDescription className="text-blue-700">
                  Matche die erkannten Anforderungen gegen verfügbare CMS-Systeme, um die beste
                  Technologie-Empfehlung zu erhalten.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button onClick={handleStartEvaluation} className="bg-blue-600 hover:bg-blue-700">
                  <Search className="h-4 w-4 mr-2" />
                  CMS-Evaluation mit Web Search starten
                </Button>
              </CardContent>
            </Card>
          )}

          {isEvaluating && (
            <Card className="border-blue-200 bg-blue-50">
              <CardContent className="py-8 text-center">
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-600 mb-4" />
                <p className="text-blue-700 font-medium">CMS-Evaluation läuft...</p>
                <p className="text-sm text-blue-600">
                  Anforderungen werden gegen CMS-Systeme gematched (mit Web Search)
                </p>
              </CardContent>
            </Card>
          )}

          {cmsEvaluation && (
            <CMSEvaluationMatrix
              result={cmsEvaluation}
              onSelectCMS={setSelectedCMS}
              selectedCMS={selectedCMS}
              isLoading={isEvaluating}
            />
          )}
        </div>
      )}

      {/* Forward to Business Leader Section */}
      {quickScan.status === 'completed' && bidId && (
        <>
          {forwarded ? (
            <Card className="border-green-500 bg-green-50">
              <CardContent className="py-8 text-center">
                <CheckCircle2 className="h-12 w-12 mx-auto text-green-600 mb-4" />
                <h3 className="text-xl font-bold text-green-800 mb-2">
                  Weiterleitung erfolgreich!
                </h3>
                <p className="text-green-700">
                  Die Anfrage wurde an <strong>{forwardResult?.leaderName}</strong> (
                  {forwardResult?.businessUnit}) weitergeleitet.
                </p>
                <p className="text-sm text-green-600 mt-2">
                  Sie werden in Kürze zur BL-Übersicht weitergeleitet...
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-orange-200 bg-orange-50">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Send className="h-5 w-5 text-orange-600" />
                  <CardTitle className="text-lg text-orange-900">
                    An Bereichsleiter weiterleiten
                  </CardTitle>
                </div>
                <CardDescription className="text-orange-700">
                  Wählen Sie die Business Unit aus und leiten Sie die Anfrage an den zuständigen
                  Bereichsleiter weiter.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <Select value={selectedBU} onValueChange={setSelectedBU}>
                      <SelectTrigger className="bg-white">
                        <SelectValue placeholder="Business Unit auswählen..." />
                      </SelectTrigger>
                      <SelectContent>
                        {businessUnits.map(bu => (
                          <SelectItem key={bu.id} value={bu.id}>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{bu.name}</span>
                              {bu.name === quickScan.recommendedBusinessUnit && (
                                <Badge variant="secondary" className="text-xs">
                                  Empfohlen
                                </Badge>
                              )}
                              <span className="text-muted-foreground text-xs">
                                ({bu.leaderName})
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    onClick={handleForward}
                    disabled={!selectedBU || isForwarding}
                    className="bg-orange-600 hover:bg-orange-700"
                  >
                    {isForwarding ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Weiterleiten...
                      </>
                    ) : (
                      <>
                        Weiterleiten
                        <ArrowRight className="h-4 w-4 ml-2" />
                      </>
                    )}
                  </Button>
                </div>
                {quickScan.recommendedBusinessUnit && (
                  <p className="text-xs text-orange-600 mt-3">
                    <AlertTriangle className="h-3 w-3 inline mr-1" />
                    AI-Empfehlung: <strong>{quickScan.recommendedBusinessUnit}</strong> mit{' '}
                    {quickScan.confidence}% Confidence
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
