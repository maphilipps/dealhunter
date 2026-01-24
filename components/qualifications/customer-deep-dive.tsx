'use client';

/**
 * Customer Deep Dive Component (DEA-140 Phase 1.2)
 *
 * Zeigt detaillierte Kundeninformationen aus Quick Scan:
 * - Company Intelligence (Unternehmensgröße, Finanzen)
 * - IT-Landschaft (Tech Stack, CMS, Hosting)
 * - Decision Makers
 * - Migration Complexity Preview
 *
 * Folgt React Best Practices:
 * - SWR für client-side caching (client-swr-dedup)
 * - Collapsible sections für bessere UX
 * - Graceful degradation bei fehlenden Daten
 */

import {
  Building,
  ChevronDown,
  ChevronUp,
  Code2,
  Database,
  ExternalLink,
  Globe,
  Network,
  RefreshCw,
  Server,
  Users,
} from 'lucide-react';
import { useState } from 'react';
import useSWR from 'swr';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface CompanyIntelligence {
  companySize?: string;
  employeeCount?: string | number;
  revenue?: string;
  industry?: string;
  founded?: string;
  headquarters?: string;
  socialProfiles?: Array<{ platform: string; url: string }>;
  recentNews?: Array<{ title: string; url?: string; date?: string }>;
}

interface TechStackItem {
  name: string;
  category?: string;
  confidence?: number;
}

interface DecisionMaker {
  name: string;
  role: string;
  email?: string;
  linkedIn?: string;
  confidence?: number;
}

interface MigrationComplexityPreview {
  overall: 'low' | 'medium' | 'high' | 'very_high';
  score?: number;
  factors?: string[];
}

interface QuickScanData {
  id: string;
  status: string;
  websiteUrl: string;
  cms: string | null;
  framework: string | null;
  hosting: string | null;
  pageCount: number | null;
  techStack: TechStackItem[] | null;
  companyIntelligence: CompanyIntelligence | null;
  decisionMakers: DecisionMaker[] | null;
  migrationComplexity: MigrationComplexityPreview | null;
  features: string[] | null;
  integrations: string[] | null;
  completedAt: string | null;
}

interface ApiResponse {
  quickScan: QuickScanData | null;
  rfpExtraction: Record<string, unknown> | null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// FETCHER
// ═══════════════════════════════════════════════════════════════════════════════

const fetcher = async (url: string): Promise<ApiResponse> => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API Error ${res.status}`);
  return res.json() as Promise<ApiResponse>;
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export interface CustomerDeepDiveProps {
  leadId: string;
  quickScanId?: string | null;
}

export function CustomerDeepDive({ leadId, quickScanId }: CustomerDeepDiveProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const { data, error, isLoading, mutate } = useSWR<ApiResponse>(
    quickScanId ? `/api/qualifications/${leadId}/quick-scan-data` : null,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000,
    }
  );

  // No quickScanId - show placeholder
  if (!quickScanId) {
    return (
      <Card className="border-dashed">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Building className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-lg">Customer Deep Dive</CardTitle>
          </div>
          <CardDescription>
            Keine Quick Scan Daten verfügbar. Führen Sie zuerst einen Quick Scan durch.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  // Loading
  if (isLoading) {
    return <CustomerDeepDiveSkeleton />;
  }

  // Error
  if (error) {
    return (
      <Card className="border-destructive">
        <CardHeader className="pb-3">
          <CardTitle className="text-destructive text-lg">Fehler beim Laden</CardTitle>
          <CardDescription>{error.message}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" size="sm" onClick={() => void mutate()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Erneut versuchen
          </Button>
        </CardContent>
      </Card>
    );
  }

  const quickScan = data?.quickScan;

  if (!quickScan) {
    return null;
  }

  const companyIntel = quickScan.companyIntelligence;
  const techStack = quickScan.techStack;
  const decisionMakers = quickScan.decisionMakers;
  const migrationComplexity = quickScan.migrationComplexity;

  return (
    <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Customer Deep Dive</CardTitle>
                {quickScan.status === 'completed' && (
                  <Badge variant="secondary" className="ml-2">
                    Quick Scan abgeschlossen
                  </Badge>
                )}
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                {isExpanded ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            </div>
            <CardDescription>
              Unternehmensdaten, IT-Landschaft & Decision Makers aus Quick Scan
            </CardDescription>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="space-y-6 pt-0">
            {/* Company Intelligence Section */}
            {companyIntel && Object.keys(companyIntel).length > 0 && (
              <CompanyIntelligenceSection data={companyIntel} />
            )}

            {/* IT Landscape Section */}
            <ITLandscapeSection
              cms={quickScan.cms}
              framework={quickScan.framework}
              hosting={quickScan.hosting}
              pageCount={quickScan.pageCount}
              techStack={techStack}
              features={quickScan.features}
              integrations={quickScan.integrations}
            />

            {/* Decision Makers Section */}
            {decisionMakers && decisionMakers.length > 0 && (
              <DecisionMakersSection decisionMakers={decisionMakers} />
            )}

            {/* Migration Complexity Preview */}
            {migrationComplexity && <MigrationComplexitySection complexity={migrationComplexity} />}

            {/* Last Updated */}
            {quickScan.completedAt && (
              <p className="text-xs text-muted-foreground text-right">
                Letzte Aktualisierung:{' '}
                {new Date(quickScan.completedAt).toLocaleDateString('de-DE', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

function CompanyIntelligenceSection({ data }: { data: CompanyIntelligence }) {
  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium flex items-center gap-2">
        <Building className="h-4 w-4 text-muted-foreground" />
        Unternehmensinformationen
      </h4>
      <div className="grid gap-4 md:grid-cols-3">
        {data.companySize && <InfoCard label="Unternehmensgröße" value={data.companySize} />}
        {data.employeeCount && <InfoCard label="Mitarbeiter" value={String(data.employeeCount)} />}
        {data.revenue && <InfoCard label="Umsatz" value={data.revenue} />}
        {data.founded && <InfoCard label="Gründung" value={data.founded} />}
        {data.headquarters && <InfoCard label="Hauptsitz" value={data.headquarters} />}
        {data.industry && <InfoCard label="Branche" value={data.industry} />}
      </div>

      {/* Social Profiles */}
      {data.socialProfiles && data.socialProfiles.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-2">
          {data.socialProfiles.map((profile, idx) => (
            <a
              key={idx}
              href={profile.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              {profile.platform}
              <ExternalLink className="h-3 w-3" />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function ITLandscapeSection({
  cms,
  framework,
  hosting,
  pageCount,
  techStack,
  features,
  integrations,
}: {
  cms: string | null;
  framework: string | null;
  hosting: string | null;
  pageCount: number | null;
  techStack: TechStackItem[] | null;
  features: string[] | null;
  integrations: string[] | null;
}) {
  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium flex items-center gap-2">
        <Server className="h-4 w-4 text-muted-foreground" />
        IT-Landschaft
      </h4>

      {/* Core Tech */}
      <div className="grid gap-4 md:grid-cols-4">
        <InfoCard label="CMS" value={cms || 'Nicht erkannt'} icon={Database} highlight={!!cms} />
        <InfoCard
          label="Framework"
          value={framework || 'Nicht erkannt'}
          icon={Code2}
          highlight={!!framework}
        />
        <InfoCard
          label="Hosting"
          value={hosting || 'Nicht erkannt'}
          icon={Globe}
          highlight={!!hosting}
        />
        <InfoCard
          label="Seitenanzahl"
          value={pageCount ? `~${pageCount} Seiten` : 'N/A'}
          icon={Network}
        />
      </div>

      {/* Tech Stack Tags */}
      {techStack && techStack.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Erkannte Technologien:</p>
          <div className="flex flex-wrap gap-1">
            {techStack.slice(0, 12).map((tech, idx) => (
              <Badge key={idx} variant="outline" className="text-xs">
                {tech.name}
                {tech.confidence && tech.confidence < 80 && (
                  <span className="ml-1 text-muted-foreground">({tech.confidence}%)</span>
                )}
              </Badge>
            ))}
            {techStack.length > 12 && (
              <Badge variant="secondary" className="text-xs">
                +{techStack.length - 12} weitere
              </Badge>
            )}
          </div>
        </div>
      )}

      {/* Features & Integrations */}
      <div className="grid gap-4 md:grid-cols-2">
        {features && features.length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground mb-1">Features:</p>
            <div className="flex flex-wrap gap-1">
              {features.slice(0, 6).map((feature, idx) => (
                <Badge key={idx} variant="secondary" className="text-xs">
                  {feature}
                </Badge>
              ))}
            </div>
          </div>
        )}
        {integrations && integrations.length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground mb-1">Integrationen:</p>
            <div className="flex flex-wrap gap-1">
              {integrations.slice(0, 6).map((integration, idx) => (
                <Badge key={idx} variant="outline" className="text-xs">
                  {integration}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function DecisionMakersSection({ decisionMakers }: { decisionMakers: DecisionMaker[] }) {
  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium flex items-center gap-2">
        <Users className="h-4 w-4 text-muted-foreground" />
        Decision Makers
      </h4>
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {decisionMakers.slice(0, 6).map((person, idx) => (
          <div key={idx} className="flex items-start gap-3 p-3 rounded-lg border bg-card">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <span className="text-sm font-medium text-primary">
                {person.name
                  .split(' ')
                  .map(n => n[0])
                  .join('')
                  .toUpperCase()
                  .substring(0, 2)}
              </span>
            </div>
            <div className="min-w-0">
              <p className="font-medium text-sm truncate">{person.name}</p>
              <p className="text-xs text-muted-foreground truncate">{person.role}</p>
              {person.linkedIn && (
                <a
                  href={person.linkedIn}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1"
                >
                  LinkedIn
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MigrationComplexitySection({ complexity }: { complexity: MigrationComplexityPreview }) {
  const complexityConfig = {
    low: { label: 'Niedrig', color: 'bg-green-500', value: 25 },
    medium: { label: 'Mittel', color: 'bg-yellow-500', value: 50 },
    high: { label: 'Hoch', color: 'bg-orange-500', value: 75 },
    very_high: { label: 'Sehr Hoch', color: 'bg-red-500', value: 100 },
  };

  const config = complexityConfig[complexity.overall] || complexityConfig.medium;

  return (
    <div className="space-y-3 p-3 rounded-lg bg-muted/50">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium">Migrations-Komplexität</h4>
        <Badge variant="outline" className={config.color + ' text-white'}>
          {config.label}
        </Badge>
      </div>
      <Progress value={complexity.score ?? config.value} className="h-2" />
      {complexity.factors && complexity.factors.length > 0 && (
        <ul className="text-xs text-muted-foreground space-y-1">
          {complexity.factors.slice(0, 3).map((factor, idx) => (
            <li key={idx}>• {factor}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function InfoCard({
  label,
  value,
  icon: Icon,
  highlight = false,
}: {
  label: string;
  value: string;
  icon?: React.ComponentType<{ className?: string }>;
  highlight?: boolean;
}) {
  return (
    <div
      className={`p-3 rounded-lg border ${highlight ? 'bg-primary/5 border-primary/20' : 'bg-muted/30'}`}
    >
      <div className="flex items-center gap-2 mb-1">
        {Icon && <Icon className="h-3 w-3 text-muted-foreground" />}
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
      <p className="font-medium text-sm truncate">{value}</p>
    </div>
  );
}

function CustomerDeepDiveSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-5 rounded" />
          <Skeleton className="h-5 w-40" />
        </div>
        <Skeleton className="h-4 w-64 mt-2" />
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
