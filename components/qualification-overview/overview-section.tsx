import { Building2, Users, MapPin, Calendar, TrendingUp, Globe, ExternalLink } from 'lucide-react';

import { TechStackChartWrapper } from './tech-stack-chart-wrapper';
import type { OverviewData } from './types';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

interface OverviewSectionProps {
  data: OverviewData | null;
}

export function OverviewSection({ data }: OverviewSectionProps) {
  if (!data || !data.companyIntelligence) {
    return <EmptyOverview />;
  }

  const company = data.companyIntelligence;
  const tech = data.techStack;
  const accessibility = data.accessibilityAudit;
  const seo = data.seoAudit;
  const performance = data.performanceIndicators;
  const content = data.contentVolume;

  return (
    <div className="space-y-6">
      {/* Company Profile Card */}
      <Card>
        <CardHeader>
          <div className="flex items-start gap-4">
            <Avatar className="h-14 w-14 rounded-lg">
              <AvatarFallback className="rounded-lg bg-primary/10 text-primary text-lg">
                {company.basicInfo?.name?.substring(0, 2).toUpperCase() || '??'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <CardTitle className="text-xl">
                  {company.basicInfo?.name || 'Unbekanntes Unternehmen'}
                </CardTitle>
                {company.basicInfo?.website && (
                  <a
                    href={company.basicInfo.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-primary"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                )}
              </div>
              <CardDescription className="flex items-center gap-2">
                {company.basicInfo?.industry && (
                  <>
                    <Building2 className="h-3.5 w-3.5" />
                    {company.basicInfo.industry}
                  </>
                )}
                {company.basicInfo?.legalForm && (
                  <Badge variant="outline" className="text-xs">
                    {company.basicInfo.legalForm}
                  </Badge>
                )}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <Stat
              icon={<Calendar className="h-4 w-4" />}
              label="Gegründet"
              value={company.basicInfo?.foundedYear}
            />
            <Stat
              icon={<Users className="h-4 w-4" />}
              label="Mitarbeiter"
              value={company.basicInfo?.employeeCount}
            />
            <Stat
              icon={<MapPin className="h-4 w-4" />}
              label="Standort"
              value={company.basicInfo?.headquarters}
            />
            <Stat
              icon={<TrendingUp className="h-4 w-4" />}
              label="Umsatzklasse"
              value={formatRevenueClass(company.financials?.revenueClass)}
            />
          </div>

          {/* Leadership */}
          {company.leadership &&
            (company.leadership.ceo || company.leadership.cto || company.leadership.cmo) && (
              <div className="border-t pt-4">
                <p className="text-sm font-medium text-muted-foreground mb-2">Leadership</p>
                <div className="flex flex-wrap gap-2">
                  {company.leadership.ceo && (
                    <Badge variant="secondary">CEO: {company.leadership.ceo}</Badge>
                  )}
                  {company.leadership.cto && (
                    <Badge variant="secondary">CTO: {company.leadership.cto}</Badge>
                  )}
                  {company.leadership.cmo && (
                    <Badge variant="secondary">CMO: {company.leadership.cmo}</Badge>
                  )}
                </div>
              </div>
            )}

          {/* Corporate Structure */}
          {company.corporateStructure?.parentCompany && (
            <div className="border-t pt-4 mt-4">
              <p className="text-sm font-medium text-muted-foreground mb-2">Unternehmensstruktur</p>
              <div className="flex items-center gap-2 text-sm">
                <Globe className="h-4 w-4 text-muted-foreground" />
                Teil von: {company.corporateStructure.parentCompany}
                {company.corporateStructure.groupName && (
                  <Badge variant="outline" className="text-xs">
                    {company.corporateStructure.groupName}
                  </Badge>
                )}
              </div>
            </div>
          )}

          {/* Data Quality Indicator */}
          {company.dataQuality && (
            <div className="border-t pt-4 mt-4">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Datenquellen: {company.dataQuality.sources.join(', ')}</span>
                <span>
                  Konfidenz: {company.dataQuality.confidence}% | Stand:{' '}
                  {new Date(company.dataQuality.lastUpdated).toLocaleDateString('de-DE')}
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tech Stack Card */}
      {tech && (
        <Card>
          <CardHeader>
            <CardTitle>Tech Stack</CardTitle>
            <CardDescription>Erkannte Technologien und Infrastruktur</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-6">
              {/* Categorized Badges */}
              <div className="space-y-4">
                {tech.cms && (
                  <TechCategory
                    label="CMS"
                    items={[tech.cms + (tech.cmsVersion ? ` ${tech.cmsVersion}` : '')]}
                    variant="default"
                  />
                )}
                {tech.framework && (
                  <TechCategory
                    label="Framework"
                    items={[
                      tech.framework + (tech.frameworkVersion ? ` ${tech.frameworkVersion}` : ''),
                    ]}
                    variant="secondary"
                  />
                )}
                {tech.backend && tech.backend.length > 0 && (
                  <TechCategory label="Backend" items={tech.backend} variant="outline" />
                )}
                {tech.libraries && tech.libraries.length > 0 && (
                  <TechCategory label="Libraries" items={tech.libraries} variant="outline" />
                )}
                {tech.hosting && (
                  <TechCategory label="Hosting" items={[tech.hosting]} variant="outline" />
                )}
                {tech.analytics && tech.analytics.length > 0 && (
                  <TechCategory label="Analytics" items={tech.analytics} variant="outline" />
                )}
              </div>

              {/* Donut Chart */}
              <div className="flex items-center justify-center">
                <div className="aspect-square w-full max-w-[200px]">
                  <TechStackChartWrapper data={tech} />
                </div>
              </div>
            </div>

            {/* Confidence */}
            {tech.overallConfidence !== undefined && (
              <div className="border-t pt-4 mt-4 flex items-center gap-2 text-xs text-muted-foreground">
                <span>Erkennungs-Konfidenz:</span>
                <Progress value={tech.overallConfidence} className="h-1.5 w-24" />
                <span>{tech.overallConfidence}%</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Content Volume Card */}
      {content && (
        <Card>
          <CardHeader>
            <CardTitle>Content Umfang</CardTitle>
            <CardDescription>Geschätzter Content-Umfang der Website</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Stat
                label="Seiten"
                value={
                  content.actualPageCount?.toLocaleString('de-DE') ||
                  `~${content.estimatedPageCount.toLocaleString('de-DE')}`
                }
                sublabel={content.sitemapFound ? 'via Sitemap' : 'geschätzt'}
              />
              <Stat label="Bilder" value={content.mediaAssets?.images?.toLocaleString('de-DE')} />
              <Stat label="Videos" value={content.mediaAssets?.videos?.toLocaleString('de-DE')} />
              <Stat
                label="Dokumente"
                value={content.mediaAssets?.documents?.toLocaleString('de-DE')}
              />
            </div>
            {content.languages && content.languages.length > 0 && (
              <div className="border-t pt-4 mt-4">
                <p className="text-xs text-muted-foreground mb-2">Sprachen</p>
                <div className="flex flex-wrap gap-1">
                  {content.languages.map(lang => (
                    <Badge key={lang} variant="outline" className="text-xs">
                      {lang}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            {content.complexity && (
              <div className="border-t pt-4 mt-4">
                <ComplexityBadge complexity={content.complexity} />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Quality Scores Card */}
      {(accessibility || seo || performance) && (
        <Card>
          <CardHeader>
            <CardTitle>Quality Scores</CardTitle>
            <CardDescription>Technische Qualitätsbewertungen der Website</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {accessibility && (
              <ScoreBar
                label="Accessibility"
                value={accessibility.score}
                badge={accessibility.level !== 'fail' ? accessibility.level : undefined}
                issues={accessibility.criticalIssues + accessibility.seriousIssues}
                issueLabel="kritische Issues"
              />
            )}
            {seo && (
              <ScoreBar
                label="SEO"
                value={seo.score}
                issues={seo.issues?.filter(i => i.severity === 'error').length}
                issueLabel="Errors"
              />
            )}
            {performance && (
              <ScoreBar
                label="Performance"
                value={getPerformanceScore(performance.estimatedLoadTime)}
                metrics={`${performance.resourceCount.scripts} Scripts, ${performance.resourceCount.stylesheets} CSS`}
              />
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Helper Components
function EmptyOverview() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Keine Daten verfügbar</CardTitle>
        <CardDescription>
          Die Qualification wurde noch nicht durchgeführt oder enthält keine Daten.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Die Qualification läuft automatisch, sobald Daten verfügbar sind.
        </p>
      </CardContent>
    </Card>
  );
}

function Stat({
  icon,
  label,
  value,
  sublabel,
}: {
  icon?: React.ReactNode;
  label: string;
  value?: string | number | null;
  sublabel?: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
        {icon}
        {label}
      </div>
      <p className="font-medium">{value ?? '-'}</p>
      {sublabel && <p className="text-xs text-muted-foreground">{sublabel}</p>}
    </div>
  );
}

function TechCategory({
  label,
  items,
  variant,
}: {
  label: string;
  items: string[];
  variant: 'default' | 'secondary' | 'outline';
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground mb-1.5">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {items.map(item => (
          <Badge key={item} variant={variant}>
            {item}
          </Badge>
        ))}
      </div>
    </div>
  );
}

function ScoreBar({
  label,
  value,
  badge,
  issues,
  issueLabel,
  metrics,
}: {
  label: string;
  value?: number | null;
  badge?: string;
  issues?: number;
  issueLabel?: string;
  metrics?: string;
}) {
  const score = value ?? 0;
  const getColorClass = (s: number) => {
    if (s >= 80) return 'bg-green-500';
    if (s >= 50) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div>
      <div className="flex justify-between mb-1.5">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-sm text-muted-foreground">{score}/100</span>
      </div>
      <div className="relative h-2 w-full overflow-hidden rounded-full bg-secondary">
        <div
          className={`h-full transition-all ${getColorClass(score)}`}
          style={{ width: `${score}%` }}
        />
      </div>
      <div className="flex gap-2 mt-1.5">
        {badge && (
          <Badge variant="outline" className="text-xs">
            {badge}
          </Badge>
        )}
        {issues !== undefined && issues > 0 && (
          <span className="text-xs text-muted-foreground">
            {issues} {issueLabel}
          </span>
        )}
        {metrics && <span className="text-xs text-muted-foreground">{metrics}</span>}
      </div>
    </div>
  );
}

function ComplexityBadge({ complexity }: { complexity: 'low' | 'medium' | 'high' }) {
  const config = {
    low: { label: 'Niedrige Komplexität', variant: 'secondary' as const },
    medium: { label: 'Mittlere Komplexität', variant: 'default' as const },
    high: { label: 'Hohe Komplexität', variant: 'destructive' as const },
  };
  const c = config[complexity];
  return <Badge variant={c.variant}>{c.label}</Badge>;
}

// Utility functions
function formatRevenueClass(
  revenueClass?: 'startup' | 'small' | 'medium' | 'large' | 'enterprise' | 'unknown' | null
): string | null {
  if (!revenueClass || revenueClass === 'unknown') return null;
  const labels: Record<string, string> = {
    startup: 'Startup',
    small: 'KMU',
    medium: 'Mittelstand',
    large: 'Großunternehmen',
    enterprise: 'Konzern',
  };
  return labels[revenueClass] || null;
}

function getPerformanceScore(loadTime?: 'fast' | 'medium' | 'slow'): number {
  const scores = { fast: 90, medium: 60, slow: 30 };
  return loadTime ? scores[loadTime] : 50;
}
