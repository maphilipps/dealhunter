'use client';

import {
  Globe,
  Server,
  FileText,
  ShieldCheck,
  Search,
  Users,
  Building2,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  BarChart3,
} from 'lucide-react';
import { Loader } from '@/components/ai-elements/loader';
import { useState, useEffect } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import type { LeadScan } from '@/lib/db/schema';
import type { ExtractedRequirements } from '@/lib/extraction/schema';

interface BLAssignmentViewProps {
  qualificationScan: LeadScan;
  extractedData?: ExtractedRequirements | null;
  preQualificationId: string;
}

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

interface AccessibilityAuditData {
  score: number;
  criticalIssues: number;
  seriousIssues: number;
}

interface SeoAuditData {
  score?: number;
  hasMetaTags?: boolean;
  hasSitemap?: boolean;
}

interface BUMatchCriteria {
  techStackScore: number;
  featuresScore: number;
  referencesScore: number;
  industryScore: number;
  keywordsScore: number;
}

interface BUMatch {
  businessUnit: {
    id: string;
    name: string;
    shortName: string;
    color: string;
  };
  totalScore: number;
  criteria: BUMatchCriteria;
  matchedTechnologies: string[];
  reasoning: string;
}

function parseJsonField<T>(value: string | null | undefined): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

export function BLAssignmentView({
  qualificationScan,
  extractedData,
  preQualificationId,
}: BLAssignmentViewProps) {
  const [buMatches, setBuMatches] = useState<BUMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState<string | null>(null);

  // Parse Quick Scan data
  const techStack = parseJsonField<TechStackData>(qualificationScan.techStack);
  const contentVolume = parseJsonField<ContentVolumeData>(qualificationScan.contentVolume);
  const features = parseJsonField<FeaturesData>(qualificationScan.features);
  const accessibilityAudit = parseJsonField<AccessibilityAuditData>(
    qualificationScan.accessibilityAudit
  );
  const seoAudit = parseJsonField<SeoAuditData>(qualificationScan.seoAudit);

  // Fetch BU matches
  useEffect(() => {
    async function fetchBUMatches() {
      try {
        const res = await fetch(`/api/qualifications/${preQualificationId}/bu-matching`);
        if (res.ok) {
          const data = (await res.json()) as { matches?: BUMatch[] };
          setBuMatches(data.matches || []);
        }
      } catch (error) {
        console.error('Error fetching BU matches:', error);
      } finally {
        setLoading(false);
      }
    }
    void fetchBUMatches();
  }, [preQualificationId]);

  // Handle BL assignment
  const handleAssign = async (buId: string, buName: string) => {
    setAssigning(buId);
    try {
      // TODO: Implement actual assignment API
      await new Promise(resolve => setTimeout(resolve, 1000));
      alert(`Bid wurde an ${buName} weitergeleitet!`);
    } catch (error) {
      console.error('Error assigning:', error);
    } finally {
      setAssigning(null);
    }
  };

  // Get active features list
  const activeFeatures = Object.entries(features || {})
    .filter((entry): entry is [string, true] => entry[1] === true)
    .map(([k]) => {
      const labels: Record<string, string> = {
        ecommerce: 'E-Commerce',
        userAccounts: 'User Accounts',
        search: 'Suche',
        multiLanguage: 'Mehrsprachig',
        blog: 'Blog',
        forms: 'Formulare',
        api: 'API',
      };
      return labels[k] || k;
    });

  return (
    <div className="space-y-6">
      {/* Section 1: Fakten (gescraped) */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-blue-600" />
            <CardTitle>Gescrapte Fakten</CardTitle>
          </div>
          <CardDescription>
            Automatisch erkannte Informationen von {qualificationScan.websiteUrl || 'der Website'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Tech Stack */}
            <div className="p-4 rounded-lg bg-slate-50 border">
              <div className="flex items-center gap-2 mb-2">
                <Server className="h-4 w-4 text-slate-600" />
                <span className="font-medium text-sm">Tech Stack</span>
              </div>
              {techStack?.cms ? (
                <div className="space-y-1">
                  <Badge variant="secondary">{techStack.cms}</Badge>
                  {techStack.framework && (
                    <Badge variant="outline" className="ml-1">
                      {techStack.framework}
                    </Badge>
                  )}
                  {techStack.cmsConfidence && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Confidence: {techStack.cmsConfidence}%
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Nicht erkannt</p>
              )}
            </div>

            {/* Content Volume */}
            <div className="p-4 rounded-lg bg-slate-50 border">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="h-4 w-4 text-slate-600" />
                <span className="font-medium text-sm">Content</span>
              </div>
              {contentVolume?.estimatedPageCount ? (
                <div className="space-y-1">
                  <p className="text-lg font-semibold">{contentVolume.estimatedPageCount} Seiten</p>
                  <Badge
                    variant={
                      contentVolume.complexity === 'high'
                        ? 'destructive'
                        : contentVolume.complexity === 'medium'
                          ? 'secondary'
                          : 'outline'
                    }
                  >
                    {contentVolume.complexity === 'high'
                      ? 'Hoch'
                      : contentVolume.complexity === 'medium'
                        ? 'Mittel'
                        : 'Gering'}
                  </Badge>
                  {contentVolume.languages?.length && (
                    <p className="text-xs text-muted-foreground">
                      {contentVolume.languages.length} Sprachen
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Nicht erkannt</p>
              )}
            </div>

            {/* Features */}
            <div className="p-4 rounded-lg bg-slate-50 border">
              <div className="flex items-center gap-2 mb-2">
                <Search className="h-4 w-4 text-slate-600" />
                <span className="font-medium text-sm">Features</span>
              </div>
              {activeFeatures.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {activeFeatures.map(f => (
                    <Badge key={f} variant="outline" className="text-xs">
                      {f}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Keine erkannt</p>
              )}
            </div>

            {/* Accessibility */}
            <div className="p-4 rounded-lg bg-slate-50 border">
              <div className="flex items-center gap-2 mb-2">
                <ShieldCheck className="h-4 w-4 text-slate-600" />
                <span className="font-medium text-sm">Accessibility</span>
              </div>
              {accessibilityAudit ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Progress value={accessibilityAudit.score} className="h-2 flex-1" />
                    <span className="text-sm font-medium">{accessibilityAudit.score}%</span>
                  </div>
                  {accessibilityAudit.criticalIssues > 0 && (
                    <Badge variant="destructive" className="text-xs">
                      {accessibilityAudit.criticalIssues} kritisch
                    </Badge>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Nicht geprüft</p>
              )}
            </div>

            {/* SEO */}
            <div className="p-4 rounded-lg bg-slate-50 border">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-4 w-4 text-slate-600" />
                <span className="font-medium text-sm">SEO</span>
              </div>
              {seoAudit ? (
                <div className="space-y-1">
                  {seoAudit.score && (
                    <div className="flex items-center gap-2">
                      <Progress value={seoAudit.score} className="h-2 flex-1" />
                      <span className="text-sm font-medium">{seoAudit.score}%</span>
                    </div>
                  )}
                  <div className="flex gap-2 text-xs">
                    {seoAudit.hasMetaTags && <Badge variant="outline">Meta ✓</Badge>}
                    {seoAudit.hasSitemap && <Badge variant="outline">Sitemap ✓</Badge>}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Nicht geprüft</p>
              )}
            </div>

            {/* Kunde */}
            <div className="p-4 rounded-lg bg-slate-50 border">
              <div className="flex items-center gap-2 mb-2">
                <Building2 className="h-4 w-4 text-slate-600" />
                <span className="font-medium text-sm">Kunde</span>
              </div>
              <div className="space-y-1">
                <p className="font-medium">{extractedData?.customerName || 'Unbekannt'}</p>
                {extractedData?.industry && (
                  <Badge variant="outline" className="text-xs">
                    {extractedData.industry}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section 2: BU-Vergleich */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-purple-600" />
            <CardTitle>Business Unit Vergleich</CardTitle>
          </div>
          <CardDescription>Warum passt welche BU am besten zu dieser Anfrage?</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader size="md" className="text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">Berechne Matches...</span>
            </div>
          ) : buMatches.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">Keine Business Units gefunden</p>
          ) : (
            <div className="space-y-4">
              {buMatches.map((match, index) => (
                <div
                  key={match.businessUnit.id}
                  className={`p-4 rounded-lg border-2 ${
                    index === 0 ? 'border-green-500 bg-green-50' : 'border-slate-200 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      {index === 0 && <CheckCircle2 className="h-5 w-5 text-green-600" />}
                      <div>
                        <h3 className="font-semibold flex items-center gap-2">
                          {match.businessUnit.name}
                          <Badge
                            variant={index === 0 ? 'default' : 'secondary'}
                            className="text-xs"
                          >
                            {match.businessUnit.shortName}
                          </Badge>
                        </h3>
                        {index === 0 && (
                          <p className="text-sm text-green-700 font-medium">
                            Beste Übereinstimmung
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold">{Math.round(match.totalScore)}%</div>
                      <p className="text-xs text-muted-foreground">Match Score</p>
                    </div>
                  </div>

                  {/* Kriterien Breakdown */}
                  <div className="grid grid-cols-5 gap-2 mb-3">
                    <div className="text-center">
                      <div className="text-xs text-muted-foreground mb-1">Tech</div>
                      <Progress value={match.criteria.techStackScore} className="h-1.5" />
                      <div className="text-xs font-medium mt-1">
                        {Math.round(match.criteria.techStackScore)}%
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-xs text-muted-foreground mb-1">Features</div>
                      <Progress value={match.criteria.featuresScore} className="h-1.5" />
                      <div className="text-xs font-medium mt-1">
                        {Math.round(match.criteria.featuresScore)}%
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-xs text-muted-foreground mb-1">Referenzen</div>
                      <Progress value={match.criteria.referencesScore} className="h-1.5" />
                      <div className="text-xs font-medium mt-1">
                        {Math.round(match.criteria.referencesScore)}%
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-xs text-muted-foreground mb-1">Branche</div>
                      <Progress value={match.criteria.industryScore} className="h-1.5" />
                      <div className="text-xs font-medium mt-1">
                        {Math.round(match.criteria.industryScore)}%
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-xs text-muted-foreground mb-1">Keywords</div>
                      <Progress value={match.criteria.keywordsScore} className="h-1.5" />
                      <div className="text-xs font-medium mt-1">
                        {Math.round(match.criteria.keywordsScore)}%
                      </div>
                    </div>
                  </div>

                  {/* Reasoning */}
                  <div className="text-sm text-muted-foreground bg-white/50 rounded p-2">
                    <strong>Begründung:</strong> {match.reasoning}
                    {match.matchedTechnologies.length > 0 && (
                      <span className="block mt-1">
                        <strong>Gematchte Technologien:</strong>{' '}
                        {match.matchedTechnologies.join(', ')}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Section 3: Weiterleitung */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-orange-600" />
            <CardTitle>Weiterleitung an Bereichsleiter</CardTitle>
          </div>
          <CardDescription>
            Wähle den Bereichsleiter für die Bid/No-Bid Entscheidung
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-4">
              <Loader size="md" className="text-muted-foreground" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {buMatches.map((match, index) => (
                <Button
                  key={match.businessUnit.id}
                  variant={index === 0 ? 'default' : 'outline'}
                  className="justify-between h-auto py-3"
                  disabled={assigning !== null}
                  onClick={() => handleAssign(match.businessUnit.id, match.businessUnit.name)}
                >
                  <div className="text-left">
                    <div className="font-medium">{match.businessUnit.shortName}</div>
                    <div className="text-xs opacity-70">{Math.round(match.totalScore)}% Match</div>
                  </div>
                  {assigning === match.businessUnit.id ? (
                    <Loader size="sm" />
                  ) : (
                    <ArrowRight className="h-4 w-4" />
                  )}
                </Button>
              ))}
            </div>
          )}

          <Separator className="my-4" />

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <AlertCircle className="h-4 w-4" />
            <span>
              Der Bereichsleiter erhält eine Benachrichtigung und trifft die finale Bid/No-Bid
              Entscheidung.
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
