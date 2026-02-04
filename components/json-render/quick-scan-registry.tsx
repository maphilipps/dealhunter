'use client';

import {
  AlertTriangle,
  BarChart3,
  Building,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Code,
  ExternalLink,
  FileText,
  FolderTree,
  FormInput,
  Globe,
  HelpCircle,
  Image,
  Info,
  Layers,
  Lightbulb,
  Linkedin,
  Mail,
  Maximize2,
  Menu,
  Monitor,
  MousePointer,
  Navigation,
  Package,
  Phone,
  Play,
  Scale,
  Server,
  Shield,
  Smartphone,
  Users,
  XCircle,
  Zap,
} from 'lucide-react';
import React from 'react';
import type { ComponentType, ReactNode } from 'react';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableRow } from '@/components/ui/table';
import {
  TypographyH2,
  TypographyH3,
  TypographyLarge,
  TypographyList,
  TypographyMuted,
  TypographyMutedSpan,
  TypographyP,
  TypographySmall,
} from '@/components/ui/typography';
import { cn } from '@/lib/utils';

// Types for json-render elements
interface ElementBase {
  key: string;
  type: string;
  props: Record<string, unknown>;
  children?: string[];
}

interface RegistryComponentProps {
  element: ElementBase;
  children?: ReactNode;
}

// Icon mapping for ResultCard
const iconMap = {
  tech: Server,
  content: Package,
  features: Code,
  recommendation: Lightbulb,
  accessibility: Shield,
  seo: Globe,
  legal: Scale,
  performance: Zap,
  navigation: Navigation,
  company: Building,
  migration: FileText,
  screenshots: Image,
  questions: HelpCircle,
  decisionMakers: Users,
  siteTree: FolderTree,
  contentTypes: BarChart3,
  extractedComponents: Layers,
};

/**
 * Quick Scan Component Registry
 * Maps json-render catalog components to React implementations
 */
export const quickScanRegistry: Record<string, ComponentType<RegistryComponentProps>> = {
  ResultCard: ({ element, children }) => {
    const { title, description, icon } = element.props as {
      title: string;
      description?: string;
      icon?: keyof typeof iconMap;
    };
    const Icon = icon ? iconMap[icon] : null;

    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          {Icon && <Icon className="h-5 w-5 text-muted-foreground" />}
          <TypographyH3>{title}</TypographyH3>
        </div>
        {description && <TypographyMuted>{description}</TypographyMuted>}
        {children}
      </div>
    );
  },

  Metric: ({ element }) => {
    const { label, value, subValue, trend } = element.props as {
      label: string;
      value: string;
      subValue?: string;
      trend?: 'up' | 'down' | 'neutral';
    };

    const trendColors = {
      up: 'text-green-600',
      down: 'text-red-600',
      neutral: 'text-muted-foreground',
    };

    return (
      <div className="flex flex-col p-3 bg-muted/50 rounded-lg">
        <TypographyMutedSpan>{label}</TypographyMutedSpan>
        <span className="text-2xl font-bold">{value}</span>
        {subValue && (
          <span className={cn('text-sm', trend ? trendColors[trend] : 'text-muted-foreground')}>
            {subValue}
          </span>
        )}
      </div>
    );
  },

  TechBadge: ({ element }) => {
    const { name, version, confidence, category } = element.props as {
      name: string;
      version?: string;
      confidence?: number;
      category?: string;
    };

    const categoryColors: Record<string, string> = {
      cms: 'bg-purple-100 text-purple-800 border-purple-200',
      framework: 'bg-blue-100 text-blue-800 border-blue-200',
      backend: 'bg-green-100 text-green-800 border-green-200',
      hosting: 'bg-orange-100 text-orange-800 border-orange-200',
      library: 'bg-gray-100 text-gray-800 border-gray-200',
      tool: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    };

    return (
      <div
        className={cn(
          'inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border',
          category ? categoryColors[category] : 'bg-muted border-border'
        )}
      >
        <span className="font-medium">{name}</span>
        {version && <span className="text-xs opacity-70">v{version}</span>}
        {confidence !== undefined && (
          <Badge variant="secondary" className="text-xs">
            {confidence}%
          </Badge>
        )}
      </div>
    );
  },

  FeatureList: ({ element }) => {
    const { title, features } = element.props as {
      title?: string;
      features: Array<{ name: string; detected: boolean; details?: string }>;
    };

    return (
      <div className="space-y-2">
        {title && <TypographySmall>{title}</TypographySmall>}
        <div className="grid gap-2">
          {features.map((feature, idx) => (
            <div key={idx} className="flex items-center gap-2">
              {feature.detected ? (
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              ) : (
                <XCircle className="h-4 w-4 text-muted-foreground" />
              )}
              <span className={cn('text-sm', !feature.detected && 'text-muted-foreground')}>
                {feature.name}
              </span>
              {feature.details && (
                <TypographyMutedSpan className="text-xs">({feature.details})</TypographyMutedSpan>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  },

  Recommendation: ({ element }) => {
    const { businessUnit, confidence, reasoning } = element.props as {
      businessUnit: string;
      confidence: number;
      reasoning: string;
    };

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-2xl font-bold text-blue-900">{businessUnit}</span>
          <Badge variant="secondary" className="bg-blue-100 text-blue-900">
            {confidence}% Confidence
          </Badge>
        </div>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Confidence:</span>
            <Progress value={confidence} className="flex-1 h-2" />
          </div>
        </div>
        <p className="text-sm text-blue-800">{reasoning}</p>
      </div>
    );
  },

  AlternativesList: ({ element }) => {
    const { title, alternatives } = element.props as {
      title?: string;
      alternatives: Array<{ name: string; confidence: number; reason: string }>;
    };

    return (
      <div className="space-y-3">
        {title && <TypographySmall>{title}</TypographySmall>}
        {alternatives.map((alt, idx) => (
          <div key={idx} className="flex items-start justify-between p-3 bg-muted/50 rounded-lg">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium">{alt.name}</span>
                <Badge variant="outline" className="text-xs">
                  {alt.confidence}%
                </Badge>
              </div>
              <TypographyP className="text-sm mt-1 leading-normal [&:not(:first-child)]:mt-1">
                {alt.reason}
              </TypographyP>
            </div>
          </div>
        ))}
      </div>
    );
  },

  SkillsList: ({ element }) => {
    const { title, skills } = element.props as {
      title?: string;
      skills: string[];
    };

    return (
      <div className="space-y-2">
        {title && <TypographySmall>{title}</TypographySmall>}
        <div className="flex flex-wrap gap-2">
          {skills.map((skill, idx) => (
            <Badge key={idx} variant="outline">
              {skill}
            </Badge>
          ))}
        </div>
      </div>
    );
  },

  ContentStats: ({ element }) => {
    const { pageCount, complexity, languages, contentTypes } = element.props as {
      pageCount?: number;
      complexity?: 'low' | 'medium' | 'high';
      languages?: string[];
      contentTypes?: Array<{ type: string; count: number }>;
    };

    const complexityColors = {
      low: 'bg-green-100 text-green-800',
      medium: 'bg-yellow-100 text-yellow-800',
      high: 'bg-red-100 text-red-800',
    };

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          {pageCount !== undefined && (
            <div className="flex flex-col">
              <TypographyMutedSpan>Geschätzte Seiten</TypographyMutedSpan>
              <span className="text-xl font-bold">{pageCount}</span>
            </div>
          )}
          {complexity && (
            <div className="flex flex-col">
              <TypographyMutedSpan>Komplexität</TypographyMutedSpan>
              <Badge className={cn('w-fit', complexityColors[complexity])}>{complexity}</Badge>
            </div>
          )}
        </div>

        {languages && languages.length > 0 && (
          <div>
            <TypographyMutedSpan className="block mb-2">Sprachen</TypographyMutedSpan>
            <div className="flex flex-wrap gap-1">
              {languages.map((lang, idx) => (
                <Badge key={idx} variant="outline" className="text-xs">
                  {lang}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {contentTypes && contentTypes.length > 0 && (
          <div>
            <TypographyMutedSpan className="block mb-2">Content Types</TypographyMutedSpan>
            <div className="space-y-1">
              {contentTypes.map((ct, idx) => (
                <div key={idx} className="flex items-center justify-between text-sm">
                  <span>{ct.type}</span>
                  <Badge variant="secondary">{ct.count}</Badge>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  },

  Grid: ({ element, children }) => {
    const { columns = 2, gap = 'md' } = element.props as {
      columns?: number;
      gap?: 'sm' | 'md' | 'lg';
    };

    const gapClasses = {
      sm: 'gap-3',
      md: 'gap-5',
      lg: 'gap-8',
    };

    return (
      <div
        className={cn('grid', gapClasses[gap])}
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      >
        {children}
      </div>
    );
  },

  // ========================================
  // TEXT COMPONENTS (for AI synthesis & fallback)
  // ========================================

  /**
   * BulletList - Simple bullet point list for text content
   */
  BulletList: ({ element }) => {
    const { items } = element.props as { items: string[] };
    return (
      <TypographyList>
        {items.map((item, idx) => (
          <li key={idx}>{item}</li>
        ))}
      </TypographyList>
    );
  },

  /**
   * Paragraph - Simple text paragraph
   */
  Paragraph: ({ element }) => {
    const { text } = element.props as { text: string };
    return <TypographyP>{text}</TypographyP>;
  },

  /**
   * KeyValue - Single key-value pair as table row
   */
  KeyValue: ({ element }) => {
    const { label, value } = element.props as { label: string; value: string };
    return (
      <Table>
        <TableBody>
          <TableRow>
            <TableHead scope="row">{label}</TableHead>
            <TableCell>{value}</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    );
  },

  /**
   * KeyValueTable - Multiple key-value pairs as proper table
   */
  KeyValueTable: ({ element }) => {
    const { items } = element.props as { items?: Array<{ label: string; value: string }> };
    if (!items || items.length === 0) return null;
    return (
      <Table>
        <TableBody>
          {items.map((item, idx) => (
            <TableRow key={idx}>
              <TableHead scope="row">{item.label}</TableHead>
              <TableCell>{item.value}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  },

  /**
   * Section - Major section with Card and H2 heading
   */
  Section: ({ element, children }) => {
    const {
      title,
      description,
      badge,
      badgeVariant = 'default',
    } = element.props as {
      title: string;
      description?: string;
      badge?: string;
      badgeVariant?: 'default' | 'secondary' | 'destructive' | 'outline';
    };

    return (
      <Card className="bg-gray-50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle as="h2">{title}</CardTitle>
            {badge && <Badge variant={badgeVariant}>{badge}</Badge>}
          </div>
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
        {children && (
          <CardContent>
            <div className="space-y-4">{children}</div>
          </CardContent>
        )}
      </Card>
    );
  },

  /**
   * SubSection - Sub-section with H3 heading
   */
  SubSection: ({ element, children }) => {
    const {
      title,
      description,
      badge,
      badgeVariant = 'secondary',
    } = element.props as {
      title: string;
      description?: string;
      badge?: string;
      badgeVariant?: 'default' | 'secondary' | 'destructive' | 'outline';
    };

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <TypographyH3>{title}</TypographyH3>
          {badge && <Badge variant={badgeVariant}>{badge}</Badge>}
        </div>
        {description && <TypographyMuted>{description}</TypographyMuted>}
        <div className="space-y-3">{children}</div>
      </div>
    );
  },

  /**
   * Insight - Highlighted insight box with icon
   */
  Insight: ({ element }) => {
    const {
      title,
      text,
      type = 'info',
    } = element.props as {
      title: string;
      text: string;
      type?: 'info' | 'warning' | 'success' | 'tip';
    };

    const typeConfig = {
      info: {
        icon: HelpCircle,
        bgColor: 'bg-blue-50 border-blue-200',
        iconColor: 'text-blue-600',
        titleColor: 'text-blue-900',
      },
      warning: {
        icon: Shield,
        bgColor: 'bg-yellow-50 border-yellow-200',
        iconColor: 'text-yellow-600',
        titleColor: 'text-yellow-900',
      },
      success: {
        icon: CheckCircle2,
        bgColor: 'bg-green-50 border-green-200',
        iconColor: 'text-green-600',
        titleColor: 'text-green-900',
      },
      tip: {
        icon: Lightbulb,
        bgColor: 'bg-purple-50 border-purple-200',
        iconColor: 'text-purple-600',
        titleColor: 'text-purple-900',
      },
    };

    const config = typeConfig[type];
    const Icon = config.icon;

    return (
      <div className={cn('p-3 rounded-lg border', config.bgColor)}>
        <div className="flex items-start gap-3">
          <Icon className={cn('h-5 w-5 mt-0.5 flex-shrink-0', config.iconColor)} />
          <div className="flex-1 min-w-0">
            <p className={cn('font-medium text-sm', config.titleColor)}>{title}</p>
            <p className="text-sm mt-1">{text}</p>
          </div>
        </div>
      </div>
    );
  },

  // Company Intelligence Components
  CompanyCard: ({ element }) => {
    const { name, industry, size, location, employeeCount, revenue } = element.props as {
      name: string;
      industry?: string;
      size?: 'startup' | 'small' | 'medium' | 'large' | 'enterprise';
      location?: string;
      employeeCount?: string;
      revenue?: string;
    };

    const sizeLabels = {
      startup: 'Startup',
      small: 'Klein (1-50 MA)',
      medium: 'Mittel (51-250 MA)',
      large: 'Groß (251-1000 MA)',
      enterprise: 'Enterprise (1000+ MA)',
    };

    return (
      <div className="p-4 rounded-lg border bg-card space-y-3">
        <div>
          <TypographyLarge>{name}</TypographyLarge>
          {industry && <TypographyMuted className="mt-0.5">{industry}</TypographyMuted>}
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          {size && (
            <div>
              <TypographyMutedSpan>Größe:</TypographyMutedSpan>
              <p className="font-medium">{sizeLabels[size]}</p>
            </div>
          )}
          {location && (
            <div>
              <TypographyMutedSpan>Standort:</TypographyMutedSpan>
              <p className="font-medium">{location}</p>
            </div>
          )}
          {employeeCount && (
            <div>
              <TypographyMutedSpan>Mitarbeiter:</TypographyMutedSpan>
              <p className="font-medium">{employeeCount}</p>
            </div>
          )}
          {revenue && (
            <div>
              <TypographyMutedSpan>Umsatz:</TypographyMutedSpan>
              <p className="font-medium">{revenue}</p>
            </div>
          )}
        </div>
      </div>
    );
  },

  ContactInfo: ({ element }) => {
    const { name, title, email, phone } = element.props as {
      name: string;
      title?: string;
      email?: string;
      phone?: string;
    };

    return (
      <div className="p-3 rounded-lg bg-muted/50 space-y-1">
        <p className="font-medium">{name}</p>
        {title && <p className="text-sm">{title}</p>}
        {email && (
          <p className="text-sm">
            <span className="text-muted-foreground">Email:</span>{' '}
            <a href={`mailto:${email}`} className="text-blue-600 hover:underline">
              {email}
            </a>
          </p>
        )}
        {phone && (
          <p className="text-sm">
            <span className="text-muted-foreground">Tel:</span>{' '}
            <a href={`tel:${phone}`} className="text-blue-600 hover:underline">
              {phone}
            </a>
          </p>
        )}
      </div>
    );
  },

  NewsItem: ({ element }) => {
    const { title, source, date, sentiment, summary } = element.props as {
      title: string;
      source?: string;
      date?: string;
      sentiment?: 'positive' | 'neutral' | 'negative';
      summary?: string;
    };

    const sentimentColors = {
      positive: 'bg-green-100 text-green-800 border-green-200',
      neutral: 'bg-gray-100 text-gray-800 border-gray-200',
      negative: 'bg-red-100 text-red-800 border-red-200',
    };

    return (
      <div className="p-3 rounded-lg border space-y-2">
        <div className="flex items-start justify-between gap-2">
          <h4 className="font-medium text-sm flex-1">{title}</h4>
          {sentiment && (
            <Badge className={cn('text-xs', sentimentColors[sentiment])}>{sentiment}</Badge>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {source && <span>{source}</span>}
          {source && date && <span>•</span>}
          {date && <span>{date}</span>}
        </div>
        {summary && <p className="text-sm">{summary}</p>}
      </div>
    );
  },

  NewsList: ({ element }) => {
    const { title, items } = element.props as {
      title?: string;
      items: Array<{
        title: string;
        source?: string;
        date?: string;
        sentiment?: 'positive' | 'neutral' | 'negative';
        summary?: string;
      }>;
    };

    const sentimentColors = {
      positive: 'bg-green-100 text-green-800 border-green-200',
      neutral: 'bg-gray-100 text-gray-800 border-gray-200',
      negative: 'bg-red-100 text-red-800 border-red-200',
    };

    return (
      <div className="space-y-3">
        {title && <TypographySmall>{title}</TypographySmall>}
        <div className="space-y-2">
          {items.map((item, idx) => (
            <div key={idx} className="p-3 rounded-lg border space-y-2">
              <div className="flex items-start justify-between gap-2">
                <TypographySmall className="flex-1">{item.title}</TypographySmall>
                {item.sentiment && (
                  <Badge className={cn('text-xs', sentimentColors[item.sentiment])}>
                    {item.sentiment}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {item.source && <span>{item.source}</span>}
                {item.source && item.date && <span>•</span>}
                {item.date && <span>{item.date}</span>}
              </div>
              {item.summary && (
                <TypographyP className="text-sm mt-0 leading-normal [&:not(:first-child)]:mt-1">
                  {item.summary}
                </TypographyP>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  },

  QuestionChecklist: ({ element }) => {
    const { title, projectType, questions, summary } = element.props as {
      title?: string;
      projectType?: 'migration' | 'greenfield' | 'relaunch';
      questions: Array<{
        id: number;
        question: string;
        answered: boolean;
        answer?: string;
      }>;
      summary?: {
        answered: number;
        total: number;
      };
    };

    const projectTypeLabels = {
      migration: 'Migration',
      greenfield: 'Greenfield',
      relaunch: 'Relaunch',
    };

    const projectTypeColors = {
      migration: 'bg-blue-100 text-blue-800 border-blue-200',
      greenfield: 'bg-green-100 text-green-800 border-green-200',
      relaunch: 'bg-purple-100 text-purple-800 border-purple-200',
    };

    const answeredCount = summary?.answered ?? questions.filter(q => q.answered).length;
    const totalCount = summary?.total ?? questions.length;
    const progressPercent = totalCount > 0 ? Math.round((answeredCount / totalCount) * 100) : 0;

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5 text-violet-600" />
            {title && <h3 className="font-medium">{title}</h3>}
          </div>
          <div className="flex items-center gap-2">
            {projectType && (
              <Badge className={cn('text-xs', projectTypeColors[projectType])}>
                {projectTypeLabels[projectType]}
              </Badge>
            )}
            <Badge variant="secondary">
              {answeredCount}/{totalCount} beantwortet
            </Badge>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <Progress value={progressPercent} className="flex-1 h-2" />
          <span className="text-sm font-medium text-muted-foreground">{progressPercent}%</span>
        </div>

        <div className="space-y-2">
          {questions.map(q => (
            <div key={q.id} className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50">
              {q.answered ? (
                <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
              ) : (
                <XCircle className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className={cn('text-sm', !q.answered && 'text-muted-foreground')}>
                  {q.id}. {q.question}
                </p>
                {q.answered && q.answer && (
                  <p className="text-xs text-green-700 mt-1 line-clamp-2">→ {q.answer}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  },

  ScoreCard: ({ element }) => {
    const {
      label,
      score,
      maxScore = 100,
      variant = 'default',
      showProgress = true,
    } = element.props as {
      label: string;
      score: number;
      maxScore?: number;
      variant?: 'default' | 'success' | 'warning' | 'danger';
      showProgress?: boolean;
    };

    const variantColors = {
      default: 'text-blue-600',
      success: 'text-green-600',
      warning: 'text-yellow-600',
      danger: 'text-red-600',
    };

    const progressColors = {
      default: '[&>div]:bg-blue-500',
      success: '[&>div]:bg-green-500',
      warning: '[&>div]:bg-yellow-500',
      danger: '[&>div]:bg-red-500',
    };

    const percent = Math.min(100, Math.round((score / maxScore) * 100));

    return (
      <div className="p-4 rounded-lg bg-muted/50 space-y-2">
        <div className="flex items-center justify-between">
          <TypographyMutedSpan>{label}</TypographyMutedSpan>
          <span className={cn('text-xl font-bold', variantColors[variant])}>
            {score}
            {maxScore !== 100 && `/${maxScore}`}
          </span>
        </div>
        {showProgress && (
          <Progress value={percent} className={cn('h-2', progressColors[variant])} />
        )}
      </div>
    );
  },

  Screenshots: ({ element }) => {
    const { desktop, mobile, timestamp } = element.props as {
      desktop?: string;
      mobile?: string;
      timestamp?: string;
    };

    const [isOpen, setIsOpen] = React.useState(false);

    // Lightbox-Komponente für ein einzelnes Bild
    const ImageWithLightbox = ({
      src,
      alt,
      label,
      icon: Icon,
      maxWidth,
    }: {
      src: string;
      alt: string;
      label: string;
      icon: React.ComponentType<{ className?: string }>;
      maxWidth?: string;
    }) => (
      <Dialog>
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Icon className="h-4 w-4" />
            <span>{label}</span>
          </div>
          <DialogTrigger asChild>
            <div
              className={cn(
                'relative rounded-lg border overflow-hidden cursor-pointer group',
                maxWidth
              )}
            >
              <img
                src={src}
                alt={alt}
                className="w-full h-auto object-cover transition-transform group-hover:scale-[1.02]"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 rounded-full p-2">
                  <Maximize2 className="h-5 w-5 text-white" />
                </div>
              </div>
            </div>
          </DialogTrigger>
        </div>
        <DialogContent className="max-w-[90vw] max-h-[90vh] p-0 overflow-hidden">
          <DialogTitle className="sr-only">{alt}</DialogTitle>
          <img src={src} alt={alt} className="w-full h-full object-contain" />
        </DialogContent>
      </Dialog>
    );

    if (!desktop && !mobile) {
      return (
        <div className="p-4 rounded-lg bg-muted/50 text-center text-muted-foreground">
          Keine Screenshots verfügbar
        </div>
      );
    }

    return (
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            className="w-full flex items-center justify-between p-3 h-auto rounded-lg border hover:bg-muted/50"
          >
            <div className="flex items-center gap-2">
              <Image className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium text-sm">Screenshots</span>
              <Badge variant="secondary" className="text-xs">
                {[desktop, mobile].filter(Boolean).length} Bild
                {[desktop, mobile].filter(Boolean).length > 1 ? 'er' : ''}
              </Badge>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              {timestamp && (
                <span className="text-xs hidden sm:inline">
                  {new Date(timestamp).toLocaleDateString('de-DE')}
                </span>
              )}
              <ChevronDown className={cn('h-4 w-4 transition-transform', isOpen && 'rotate-180')} />
            </div>
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="pt-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {desktop && (
                <ImageWithLightbox
                  src={desktop}
                  alt="Desktop Screenshot"
                  label="Desktop"
                  icon={Monitor}
                />
              )}
              {mobile && (
                <ImageWithLightbox
                  src={mobile}
                  alt="Mobile Screenshot"
                  label="Mobile"
                  icon={Smartphone}
                  maxWidth="max-w-[200px] mx-auto"
                />
              )}
            </div>
            {timestamp && (
              <p className="text-xs text-muted-foreground text-center">
                Erstellt: {new Date(timestamp).toLocaleString('de-DE')}
              </p>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    );
  },

  // ========================================
  // NEW: Decision Makers List Component
  // ========================================
  DecisionMakersList: ({ element }) => {
    const { decisionMakers, researchQuality } = element.props as {
      decisionMakers: Array<{
        name: string;
        role: string;
        email?: string;
        emailConfidence?: 'confirmed' | 'likely' | 'derived';
        phone?: string;
        linkedInUrl?: string;
        xingUrl?: string;
        source?: string;
      }>;
      researchQuality?: {
        linkedInFound?: number;
        emailsConfirmed?: number;
        emailsDerived?: number;
      };
    };

    if (!decisionMakers || decisionMakers.length === 0) {
      return (
        <div className="p-4 rounded-lg bg-muted/50 text-center text-muted-foreground">
          Keine Entscheidungsträger gefunden
        </div>
      );
    }

    const confidenceColors = {
      confirmed: 'bg-green-100 text-green-800 border-green-200',
      likely: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      derived: 'bg-orange-100 text-orange-800 border-orange-200',
    };

    return (
      <div className="space-y-4">
        {researchQuality && (
          <div className="flex gap-3 text-xs text-muted-foreground mb-3">
            {researchQuality.linkedInFound !== undefined && (
              <span>{researchQuality.linkedInFound} LinkedIn Profile</span>
            )}
            {researchQuality.emailsConfirmed !== undefined && (
              <span>{researchQuality.emailsConfirmed} bestätigte Emails</span>
            )}
            {researchQuality.emailsDerived !== undefined && (
              <span>{researchQuality.emailsDerived} abgeleitete Emails</span>
            )}
          </div>
        )}
        <div className="grid gap-3">
          {decisionMakers.map((dm, idx) => (
            <div key={idx} className="p-3 rounded-lg border bg-card space-y-2">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium">{dm.name}</p>
                  <p className="text-sm">{dm.role}</p>
                </div>
                <div className="flex gap-1">
                  {dm.linkedInUrl && (
                    <a
                      href={dm.linkedInUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 rounded-md hover:bg-muted"
                    >
                      <Linkedin className="h-4 w-4 text-blue-600" />
                    </a>
                  )}
                  {dm.xingUrl && (
                    <a
                      href={dm.xingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 rounded-md hover:bg-muted"
                    >
                      <ExternalLink className="h-4 w-4 text-green-600" />
                    </a>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-2 text-sm">
                {dm.email && (
                  <div className="flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                    <a href={`mailto:${dm.email}`} className="text-blue-600 hover:underline">
                      {dm.email}
                    </a>
                    {dm.emailConfidence && (
                      <Badge
                        className={cn(
                          'text-[10px] px-1.5 py-0',
                          confidenceColors[dm.emailConfidence]
                        )}
                      >
                        {dm.emailConfidence}
                      </Badge>
                    )}
                  </div>
                )}
                {dm.phone && (
                  <div className="flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                    <a href={`tel:${dm.phone}`} className="text-blue-600 hover:underline">
                      {dm.phone}
                    </a>
                  </div>
                )}
              </div>
              {dm.source && <p className="text-xs text-muted-foreground">Quelle: {dm.source}</p>}
            </div>
          ))}
        </div>
      </div>
    );
  },

  // ========================================
  // NEW: Site Tree Component - Vollständiger rekursiver Baum
  // ========================================
  SiteTree: ({ element }) => {
    // Erweiterte Typdefinition für alle verfügbaren Daten
    interface SiteTreeNode {
      path: string;
      url?: string;
      count: number;
      children?: SiteTreeNode[];
    }

    interface NavItem {
      label: string;
      url?: string;
      children?: NavItem[];
    }

    interface SiteTreeProps {
      totalPages: number;
      maxDepth: number;
      crawledAt?: string;
      sources?: {
        sitemap?: number;
        linkDiscovery?: number;
        navigation?: number;
      };
      sections?: Array<{
        path: string;
        label?: string;
        count: number;
        depth?: number;
        children?: SiteTreeNode[];
      }>;
      navigation?: {
        mainNav?: NavItem[];
        footerNav?: NavItem[];
        breadcrumbs?: boolean;
        megaMenu?: boolean;
        stickyHeader?: boolean;
        mobileMenu?: boolean;
      };
    }

    const props = element.props as unknown as SiteTreeProps;
    const { totalPages, maxDepth, crawledAt, sources, sections, navigation } = props;

    // State für alle expandierten Nodes (mit Pfad als Key)
    const [expanded, setExpanded] = React.useState<Record<string, boolean>>({});
    const [expandAll, setExpandAll] = React.useState(false);

    const toggleNode = (path: string) => {
      setExpanded(prev => ({ ...prev, [path]: !prev[path] }));
    };

    const toggleExpandAll = () => {
      if (expandAll) {
        setExpanded({});
      } else {
        // Alle Pfade sammeln und expandieren
        const allPaths: Record<string, boolean> = {};
        const collectPaths = (nodes: SiteTreeNode[] | undefined, prefix: string) => {
          nodes?.forEach((node, idx) => {
            const key = `${prefix}/${node.path}-${idx}`;
            if (node.children?.length) {
              allPaths[key] = true;
              collectPaths(node.children, key);
            }
          });
        };
        sections?.forEach((section, idx) => {
          const key = `section-${idx}`;
          if (section.children?.length) {
            allPaths[key] = true;
            collectPaths(section.children, key);
          }
        });
        setExpanded(allPaths);
      }
      setExpandAll(!expandAll);
    };

    // Rekursive Tree-Node Komponente
    const TreeNode = ({
      node,
      depth = 0,
      pathKey,
    }: {
      node: SiteTreeNode;
      depth?: number;
      pathKey: string;
    }) => {
      const hasChildren = node.children && node.children.length > 0;
      const isExpanded = expanded[pathKey] || false;
      const paddingLeft = 12 + depth * 16;

      return (
        <div className="border-l border-muted ml-2">
          <Button
            variant="ghost"
            onClick={() => hasChildren && toggleNode(pathKey)}
            className={cn(
              'w-full flex items-center justify-between py-1.5 px-2 h-auto rounded-none text-left text-sm',
              hasChildren ? 'cursor-pointer' : 'cursor-default'
            )}
            style={{ paddingLeft: `${paddingLeft}px` }}
          >
            <div className="flex items-center gap-1.5 min-w-0 flex-1">
              {hasChildren ? (
                isExpanded ? (
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                )
              ) : (
                <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              )}
              <span
                className={cn('truncate', hasChildren ? 'font-medium' : 'text-muted-foreground')}
              >
                {node.path || '/'}
              </span>
              {node.url && (
                <a
                  href={node.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={e => e.stopPropagation()}
                  className="text-blue-600 hover:text-blue-800"
                >
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
            <Badge variant="outline" className="text-xs ml-2 shrink-0">
              {node.count}
            </Badge>
          </Button>
          {isExpanded && hasChildren && (
            <div className="bg-muted/20">
              {node.children!.map((child, idx) => (
                <TreeNode
                  key={`${pathKey}/${child.path}-${idx}`}
                  node={child}
                  depth={depth + 1}
                  pathKey={`${pathKey}/${child.path}-${idx}`}
                />
              ))}
            </div>
          )}
        </div>
      );
    };

    // Navigation Menu Komponente
    const NavMenu = ({ items, title }: { items: NavItem[]; title: string }) => (
      <div className="space-y-1">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          {title}
        </p>
        <div className="space-y-0.5">
          {items.map((item, idx) => (
            <div key={idx} className="text-sm">
              <div className="flex items-center gap-2 py-1">
                <Menu className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="font-medium">{item.label}</span>
                {item.url && (
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800"
                  >
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
              {item.children && item.children.length > 0 && (
                <div className="ml-5 border-l border-muted pl-2 space-y-0.5">
                  {item.children.map((child, cidx) => (
                    <div
                      key={cidx}
                      className="flex items-center gap-2 py-0.5 text-muted-foreground"
                    >
                      <span>{child.label}</span>
                      {child.url && (
                        <a
                          href={child.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800"
                        >
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );

    return (
      <div className="space-y-4">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="p-3 rounded-lg bg-muted/50">
            <TypographyMuted>Gesamte Seiten</TypographyMuted>
            <p className="text-2xl font-bold">{totalPages}</p>
          </div>
          <div className="p-3 rounded-lg bg-muted/50">
            <TypographyMuted>Max. Tiefe</TypographyMuted>
            <p className="text-2xl font-bold">{maxDepth}</p>
          </div>
          {sources?.sitemap !== undefined && sources.sitemap > 0 && (
            <div className="p-3 rounded-lg bg-muted/50">
              <TypographyMuted>Aus Sitemap</TypographyMuted>
              <p className="text-2xl font-bold">{sources.sitemap}</p>
            </div>
          )}
          {sources?.linkDiscovery !== undefined && sources.linkDiscovery > 0 && (
            <div className="p-3 rounded-lg bg-muted/50">
              <TypographyMuted>Link Discovery</TypographyMuted>
              <p className="text-2xl font-bold">{sources.linkDiscovery}</p>
            </div>
          )}
          {sources?.navigation !== undefined && sources.navigation > 0 && (
            <div className="p-3 rounded-lg bg-muted/50">
              <TypographyMuted>Aus Navigation</TypographyMuted>
              <p className="text-2xl font-bold">{sources.navigation}</p>
            </div>
          )}
        </div>

        {/* Navigation Features */}
        {navigation && (
          <div className="flex flex-wrap gap-2">
            {navigation.breadcrumbs && (
              <Badge variant="secondary" className="text-xs">
                Breadcrumbs
              </Badge>
            )}
            {navigation.megaMenu && (
              <Badge variant="secondary" className="text-xs">
                Mega-Menü
              </Badge>
            )}
            {navigation.stickyHeader && (
              <Badge variant="secondary" className="text-xs">
                Sticky Header
              </Badge>
            )}
            {navigation.mobileMenu && (
              <Badge variant="secondary" className="text-xs">
                Mobile Menü
              </Badge>
            )}
          </div>
        )}

        {/* Main Navigation */}
        {navigation?.mainNav && navigation.mainNav.length > 0 && (
          <div className="border rounded-lg p-3">
            <NavMenu items={navigation.mainNav} title="Hauptnavigation" />
          </div>
        )}

        {/* Footer Navigation */}
        {navigation?.footerNav && navigation.footerNav.length > 0 && (
          <div className="border rounded-lg p-3">
            <NavMenu items={navigation.footerNav} title="Footer Navigation" />
          </div>
        )}

        {/* Full Site Tree */}
        {sections && sections.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">
                Vollständige Seitenstruktur
              </p>
              <Button
                variant="link"
                size="sm"
                onClick={toggleExpandAll}
                className="text-xs h-auto p-0"
              >
                {expandAll ? 'Alle einklappen' : 'Alle aufklappen'}
              </Button>
            </div>
            <div className="border rounded-lg overflow-hidden max-h-[500px] overflow-y-auto">
              {sections.map((section, idx) => {
                const sectionKey = `section-${idx}`;
                const hasChildren = section.children && section.children.length > 0;
                const isExpanded = expanded[sectionKey] || false;

                return (
                  <div key={idx} className="border-b last:border-b-0">
                    <Button
                      variant="ghost"
                      onClick={() => hasChildren && toggleNode(sectionKey)}
                      className={cn(
                        'w-full flex items-center justify-between p-2 h-auto rounded-none text-left',
                        hasChildren ? 'cursor-pointer' : 'cursor-default'
                      )}
                    >
                      <div className="flex items-center gap-2">
                        {hasChildren ? (
                          isExpanded ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )
                        ) : (
                          <FolderTree className="h-4 w-4 text-muted-foreground" />
                        )}
                        <span className="font-medium text-sm">
                          {section.label || section.path || '/'}
                        </span>
                        {section.label && section.path && section.label !== section.path && (
                          <span className="text-xs text-muted-foreground">({section.path})</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {section.depth !== undefined && (
                          <span className="text-xs text-muted-foreground">
                            Tiefe: {section.depth}
                          </span>
                        )}
                        <Badge variant="secondary">{section.count}</Badge>
                      </div>
                    </Button>
                    {isExpanded && hasChildren && (
                      <div className="border-t bg-muted/10">
                        {section.children!.map((child, cidx) => (
                          <TreeNode
                            key={`${sectionKey}/${child.path}-${cidx}`}
                            node={child}
                            depth={0}
                            pathKey={`${sectionKey}/${child.path}-${cidx}`}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Crawl Timestamp */}
        {crawledAt && (
          <p className="text-xs text-muted-foreground text-right">
            Gecrawlt: {new Date(crawledAt).toLocaleString('de-DE')}
          </p>
        )}
      </div>
    );
  },

  // ========================================
  // NEW: Navigation Stats Component
  // ========================================
  NavigationStats: ({ element }) => {
    const { totalItems, maxDepth, mainNav, features } = element.props as {
      totalItems?: number;
      maxDepth?: number;
      mainNav?: Array<{ label: string; url?: string }>;
      features?: {
        hasSearch?: boolean;
        hasBreadcrumbs?: boolean;
        hasMegaMenu?: boolean;
        hasStickyHeader?: boolean;
        hasFooterNav?: boolean;
      };
    };

    const navFeatures = features
      ? [
          { name: 'Suche', detected: !!features.hasSearch },
          { name: 'Breadcrumbs', detected: !!features.hasBreadcrumbs },
          { name: 'Mega Menu', detected: !!features.hasMegaMenu },
          { name: 'Sticky Header', detected: !!features.hasStickyHeader },
          { name: 'Footer Navigation', detected: !!features.hasFooterNav },
        ]
      : [];

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          {totalItems !== undefined && (
            <div className="p-3 rounded-lg bg-muted/50">
              <TypographyMuted>Nav-Items</TypographyMuted>
              <p className="text-2xl font-bold">{totalItems}</p>
            </div>
          )}
          {maxDepth !== undefined && (
            <div className="p-3 rounded-lg bg-muted/50">
              <TypographyMuted>Max. Tiefe</TypographyMuted>
              <p className="text-2xl font-bold">{maxDepth}</p>
            </div>
          )}
        </div>

        {mainNav && mainNav.length > 0 && (
          <div className="space-y-2">
            <TypographySmall className="text-muted-foreground">Hauptnavigation</TypographySmall>
            <div className="flex flex-wrap gap-2">
              {mainNav.map((item, idx) => (
                <Badge key={idx} variant="outline" className="text-sm">
                  <Menu className="h-3 w-3 mr-1" />
                  {item.label}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {navFeatures.length > 0 && (
          <div className="space-y-2">
            <TypographySmall className="text-muted-foreground">Features</TypographySmall>
            <div className="grid gap-1">
              {navFeatures.map((feature, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  {feature.detected ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : (
                    <XCircle className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className={cn('text-sm', !feature.detected && 'text-muted-foreground')}>
                    {feature.name}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  },

  // ========================================
  // NEW: Content Type Distribution Component
  // ========================================
  ContentTypeDistribution: ({ element }) => {
    const { estimatedContentTypes, distribution, recommendations } = element.props as {
      estimatedContentTypes?: number;
      distribution: Array<{
        type: string;
        count: number;
        percentage: number;
        color?: string;
      }>;
      recommendations?: string[];
    };

    // Default colors for content types
    const typeColors: Record<string, string> = {
      Seiten: 'bg-blue-500',
      'Blog-Artikel': 'bg-green-500',
      Produkte: 'bg-purple-500',
      News: 'bg-orange-500',
      Events: 'bg-pink-500',
      Downloads: 'bg-cyan-500',
      FAQ: 'bg-yellow-500',
      Jobs: 'bg-red-500',
    };

    const maxCount = Math.max(...distribution.map(d => d.count), 1);

    return (
      <div className="space-y-4">
        {estimatedContentTypes !== undefined && (
          <div className="p-3 rounded-lg bg-muted/50 w-fit">
            <TypographyMuted>Content Types</TypographyMuted>
            <p className="text-2xl font-bold">{estimatedContentTypes}</p>
          </div>
        )}

        <div className="space-y-2">
          {distribution.map((item, idx) => (
            <div key={idx} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{item.type}</span>
                <TypographyMutedSpan>
                  {item.count} ({item.percentage}%)
                </TypographyMutedSpan>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all',
                    item.color || typeColors[item.type] || 'bg-primary'
                  )}
                  style={{ width: `${(item.count / maxCount) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>

        {recommendations && recommendations.length > 0 && (
          <div className="space-y-2 pt-2 border-t">
            <TypographySmall className="text-muted-foreground">
              Migration-Empfehlungen
            </TypographySmall>
            <TypographyList className="my-0 ml-0 space-y-1 [&>li]:mt-0">
              {recommendations.map((rec, idx) => (
                <li key={idx} className="text-sm flex items-start gap-2">
                  <span className="text-blue-500 mt-1">•</span>
                  {rec}
                </li>
              ))}
            </TypographyList>
          </div>
        )}
      </div>
    );
  },

  // ========================================
  // NEW: TechStack Component (for grouped tech display)
  // ========================================
  TechStack: ({ element }) => {
    const { title, technologies } = element.props as {
      title?: string;
      technologies: Array<{
        name: string;
        version?: string;
        confidence?: number;
        category?: string;
      }>;
    };

    const categoryColors: Record<string, string> = {
      cms: 'bg-purple-100 text-purple-800 border-purple-200',
      framework: 'bg-blue-100 text-blue-800 border-blue-200',
      backend: 'bg-green-100 text-green-800 border-green-200',
      hosting: 'bg-orange-100 text-orange-800 border-orange-200',
      library: 'bg-gray-100 text-gray-800 border-gray-200',
      tool: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    };

    return (
      <div className="space-y-2">
        {title && <TypographySmall>{title}</TypographySmall>}
        <div className="flex flex-wrap gap-2">
          {technologies.map((tech, idx) => (
            <div
              key={idx}
              className={cn(
                'inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border',
                tech.category ? categoryColors[tech.category] : 'bg-muted border-border'
              )}
            >
              <span className="font-medium">{tech.name}</span>
              {tech.version && <span className="text-xs opacity-70">v{tech.version}</span>}
              {tech.confidence !== undefined && (
                <Badge variant="secondary" className="text-xs">
                  {tech.confidence}%
                </Badge>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  },

  // ========================================
  // NEW: Extracted Components Display
  // ========================================
  ExtractedComponents: ({ element }) => {
    interface NavigationComponent {
      type:
        | 'mega_menu'
        | 'sticky_header'
        | 'mobile_menu'
        | 'sidebar'
        | 'breadcrumbs'
        | 'pagination'
        | 'standard';
      features: string[];
      itemCount?: number;
      maxDepth?: number;
    }

    interface ContentBlockComponent {
      type: string;
      count: number;
      examples: string[];
      hasImages?: boolean;
      hasLinks?: boolean;
    }

    interface FormComponent {
      type:
        | 'contact'
        | 'newsletter'
        | 'search'
        | 'login'
        | 'registration'
        | 'checkout'
        | 'filter'
        | 'generic';
      fields: number;
      hasValidation?: boolean;
      hasFileUpload?: boolean;
      hasCaptcha?: boolean;
    }

    interface MediaComponent {
      type:
        | 'image_gallery'
        | 'video_embed'
        | 'video_player'
        | 'audio_player'
        | 'carousel'
        | 'lightbox'
        | 'background_video';
      count: number;
      providers?: string[];
    }

    interface ExtractedComponentsProps {
      navigation: NavigationComponent[];
      contentBlocks: ContentBlockComponent[];
      forms: FormComponent[];
      mediaElements: MediaComponent[];
      interactiveElements: string[];
      summary: {
        totalComponents: number;
        complexity: 'simple' | 'moderate' | 'complex' | 'very_complex';
        uniquePatterns: number;
        estimatedComponentTypes: number;
      };
    }

    const props = element.props as unknown as ExtractedComponentsProps;
    const { navigation, contentBlocks, forms, mediaElements, interactiveElements, summary } = props;

    const [expandedSections, setExpandedSections] = React.useState<Record<string, boolean>>({
      navigation: true,
      contentBlocks: true,
      forms: false,
      media: false,
      interactive: false,
    });

    const toggleSection = (section: string) => {
      setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
    };

    const complexityColors = {
      simple: 'bg-green-100 text-green-800 border-green-200',
      moderate: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      complex: 'bg-orange-100 text-orange-800 border-orange-200',
      very_complex: 'bg-red-100 text-red-800 border-red-200',
    };

    const typeIcons: Record<string, React.ReactNode> = {
      // Navigation types
      mega_menu: <Menu className="h-4 w-4" />,
      sticky_header: <Navigation className="h-4 w-4" />,
      mobile_menu: <Menu className="h-4 w-4" />,
      sidebar: <Menu className="h-4 w-4" />,
      breadcrumbs: <Navigation className="h-4 w-4" />,
      pagination: <Navigation className="h-4 w-4" />,
      standard: <Navigation className="h-4 w-4" />,
      // Content block types
      hero: <Layers className="h-4 w-4" />,
      cards: <Layers className="h-4 w-4" />,
      accordion: <ChevronDown className="h-4 w-4" />,
      tabs: <Layers className="h-4 w-4" />,
      slider: <Play className="h-4 w-4" />,
      carousel: <Play className="h-4 w-4" />,
      // Form types
      contact: <FormInput className="h-4 w-4" />,
      newsletter: <Mail className="h-4 w-4" />,
      search: <Globe className="h-4 w-4" />,
      login: <Shield className="h-4 w-4" />,
      // Media types
      image_gallery: <Image className="h-4 w-4" />,
      video_embed: <Play className="h-4 w-4" />,
      video_player: <Play className="h-4 w-4" />,
    };

    const SectionHeader = ({
      title,
      count,
      sectionKey,
    }: {
      title: string;
      count: number;
      sectionKey: string;
    }) => (
      <Button
        variant="ghost"
        onClick={() => toggleSection(sectionKey)}
        className="w-full flex items-center justify-between py-2 px-3 h-auto bg-muted/50 rounded-lg hover:bg-muted/80"
      >
        <div className="flex items-center gap-2">
          {expandedSections[sectionKey] ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
          <span className="font-medium text-sm">{title}</span>
        </div>
        <Badge variant="secondary">{count}</Badge>
      </Button>
    );

    return (
      <div className="space-y-4">
        {/* Summary Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="flex flex-col p-3 bg-muted/30 rounded-lg">
            <span className="text-xs text-muted-foreground">Komponenten</span>
            <span className="text-xl font-bold">{summary.totalComponents}</span>
          </div>
          <div className="flex flex-col p-3 bg-muted/30 rounded-lg">
            <span className="text-xs text-muted-foreground">Muster</span>
            <span className="text-xl font-bold">{summary.uniquePatterns}</span>
          </div>
          <div className="flex flex-col p-3 bg-muted/30 rounded-lg">
            <span className="text-xs text-muted-foreground">Typen</span>
            <span className="text-xl font-bold">{summary.estimatedComponentTypes}</span>
          </div>
          <div className="flex flex-col p-3 bg-muted/30 rounded-lg">
            <span className="text-xs text-muted-foreground">Komplexität</span>
            <Badge className={cn('w-fit mt-1', complexityColors[summary.complexity])}>
              {summary.complexity.replace('_', ' ')}
            </Badge>
          </div>
        </div>

        {/* Navigation Components */}
        {navigation.length > 0 && (
          <div className="space-y-2">
            <SectionHeader title="Navigation" count={navigation.length} sectionKey="navigation" />
            {expandedSections.navigation && (
              <div className="space-y-2 pl-4">
                {navigation.map((nav, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-3 p-2 bg-blue-50/50 rounded-lg border border-blue-100"
                  >
                    <div className="mt-0.5 text-blue-600">
                      {typeIcons[nav.type] || <Navigation className="h-4 w-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm capitalize">
                          {nav.type.replace('_', ' ')}
                        </span>
                        {nav.itemCount && (
                          <Badge variant="outline" className="text-xs">
                            {nav.itemCount} Items
                          </Badge>
                        )}
                        {nav.maxDepth && (
                          <Badge variant="outline" className="text-xs">
                            Tiefe: {nav.maxDepth}
                          </Badge>
                        )}
                      </div>
                      {nav.features.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {nav.features.map((feature, fidx) => (
                            <Badge key={fidx} variant="secondary" className="text-xs">
                              {feature}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Content Blocks */}
        {contentBlocks.length > 0 && (
          <div className="space-y-2">
            <SectionHeader
              title="Content Blocks"
              count={contentBlocks.length}
              sectionKey="contentBlocks"
            />
            {expandedSections.contentBlocks && (
              <div className="space-y-2 pl-4">
                {contentBlocks.map((block, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-3 p-2 bg-purple-50/50 rounded-lg border border-purple-100"
                  >
                    <div className="mt-0.5 text-purple-600">
                      {typeIcons[block.type] || <Layers className="h-4 w-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm capitalize">
                          {block.type.replace('_', ' ')}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {block.count}x gefunden
                        </Badge>
                        {block.hasImages && (
                          <Badge variant="secondary" className="text-xs">
                            Bilder
                          </Badge>
                        )}
                        {block.hasLinks && (
                          <Badge variant="secondary" className="text-xs">
                            Links
                          </Badge>
                        )}
                      </div>
                      {block.examples.length > 0 && (
                        <div className="text-xs text-muted-foreground mt-1 truncate">
                          z.B. {block.examples.slice(0, 2).join(', ')}
                          {block.examples.length > 2 && ` (+${block.examples.length - 2})`}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Forms */}
        {forms.length > 0 && (
          <div className="space-y-2">
            <SectionHeader title="Formulare" count={forms.length} sectionKey="forms" />
            {expandedSections.forms && (
              <div className="space-y-2 pl-4">
                {forms.map((form, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-3 p-2 bg-green-50/50 rounded-lg border border-green-100"
                  >
                    <div className="mt-0.5 text-green-600">
                      {typeIcons[form.type] || <FormInput className="h-4 w-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm capitalize">
                          {form.type.replace('_', ' ')}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {form.fields} Felder
                        </Badge>
                        {form.hasValidation && (
                          <Badge variant="secondary" className="text-xs">
                            Validierung
                          </Badge>
                        )}
                        {form.hasFileUpload && (
                          <Badge variant="secondary" className="text-xs">
                            Upload
                          </Badge>
                        )}
                        {form.hasCaptcha && (
                          <Badge variant="secondary" className="text-xs">
                            Captcha
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Media Elements */}
        {mediaElements.length > 0 && (
          <div className="space-y-2">
            <SectionHeader title="Medien" count={mediaElements.length} sectionKey="media" />
            {expandedSections.media && (
              <div className="space-y-2 pl-4">
                {mediaElements.map((media, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-3 p-2 bg-orange-50/50 rounded-lg border border-orange-100"
                  >
                    <div className="mt-0.5 text-orange-600">
                      {typeIcons[media.type] || <Image className="h-4 w-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm capitalize">
                          {media.type.replace('_', ' ')}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {media.count}x
                        </Badge>
                        {media.providers && media.providers.length > 0 && (
                          <span className="text-xs text-muted-foreground">
                            via {media.providers.join(', ')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Interactive Elements */}
        {interactiveElements.length > 0 && (
          <div className="space-y-2">
            <SectionHeader
              title="Interaktive Elemente"
              count={interactiveElements.length}
              sectionKey="interactive"
            />
            {expandedSections.interactive && (
              <div className="flex flex-wrap gap-2 pl-4 pt-2">
                {interactiveElements.map((el, idx) => (
                  <Badge key={idx} variant="outline" className="capitalize">
                    <MousePointer className="h-3 w-3 mr-1" />
                    {el.replace('_', ' ')}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  },

  // ========================================
  // Deep-Scan Expert Components
  // ========================================

  /**
   * ExpertResultCard - Summary card for an expert agent's results
   */
  ExpertResultCard: ({ element, children }) => {
    const { expertName, confidence, status, summary } = element.props as {
      expertName: string;
      confidence?: number;
      status?: 'complete' | 'running' | 'error' | 'pending';
      summary?: string;
    };

    const statusConfig = {
      complete: { label: 'Abgeschlossen', color: 'bg-green-100 text-green-800 border-green-200' },
      running: { label: 'In Bearbeitung', color: 'bg-blue-100 text-blue-800 border-blue-200' },
      error: { label: 'Fehler', color: 'bg-red-100 text-red-800 border-red-200' },
      pending: { label: 'Ausstehend', color: 'bg-gray-100 text-gray-800 border-gray-200' },
    };

    const config = status ? statusConfig[status] : statusConfig.complete;

    return (
      <Card className="mb-4">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">{expertName}</CardTitle>
            <div className="flex items-center gap-2">
              {confidence !== undefined && <Badge variant="secondary">{confidence}%</Badge>}
              <Badge className={cn('text-xs', config.color)}>{config.label}</Badge>
            </div>
          </div>
          {summary && <CardDescription>{summary}</CardDescription>}
        </CardHeader>
        {children && <CardContent className="pt-0">{children}</CardContent>}
      </Card>
    );
  },

  /**
   * TechStackSummary - Combined view of CMS, frameworks, and hosting
   */
  TechStackSummary: ({ element }) => {
    const { cms, frameworks, hosting, confidence } = element.props as {
      cms?: { name: string; version?: string; confidence: number };
      frameworks?: Array<{ name: string; type: string; confidence: number }>;
      hosting?: { provider?: string; type?: string; cdn?: string };
      confidence?: number;
    };

    return (
      <div className="space-y-4">
        {/* Overall confidence */}
        {confidence !== undefined && (
          <div className="flex items-center gap-2 mb-4">
            <span className="text-sm text-muted-foreground">Gesamtvertrauen:</span>
            <Progress value={confidence} className="flex-1 max-w-[200px] h-2" />
            <span className="text-sm font-medium">{confidence}%</span>
          </div>
        )}

        {/* CMS */}
        {cms && (
          <div className="p-3 rounded-lg bg-purple-50 border border-purple-100">
            <p className="text-sm font-medium text-purple-800 mb-2">CMS</p>
            <div className="flex items-center gap-2">
              <span className="font-semibold">{cms.name}</span>
              {cms.version && <Badge variant="outline">v{cms.version}</Badge>}
              <Badge variant="secondary">{cms.confidence}%</Badge>
            </div>
          </div>
        )}

        {/* Frameworks */}
        {frameworks && frameworks.length > 0 && (
          <div className="p-3 rounded-lg bg-blue-50 border border-blue-100">
            <p className="text-sm font-medium text-blue-800 mb-2">Frameworks & Libraries</p>
            <div className="flex flex-wrap gap-2">
              {frameworks.map((fw, idx) => (
                <div
                  key={idx}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-white rounded border"
                >
                  <span className="font-medium text-sm">{fw.name}</span>
                  <span className="text-xs text-muted-foreground">({fw.type})</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Hosting */}
        {hosting && (hosting.provider || hosting.type || hosting.cdn) && (
          <div className="p-3 rounded-lg bg-orange-50 border border-orange-100">
            <p className="text-sm font-medium text-orange-800 mb-2">Hosting</p>
            <div className="grid grid-cols-3 gap-4 text-sm">
              {hosting.provider && (
                <div>
                  <span className="text-muted-foreground">Provider:</span>
                  <p className="font-medium">{hosting.provider}</p>
                </div>
              )}
              {hosting.type && (
                <div>
                  <span className="text-muted-foreground">Typ:</span>
                  <p className="font-medium">{hosting.type}</p>
                </div>
              )}
              {hosting.cdn && (
                <div>
                  <span className="text-muted-foreground">CDN:</span>
                  <p className="font-medium">{hosting.cdn}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  },

  /**
   * DecisionCard - BID/NO-BID recommendation with score breakdown
   */
  DecisionCard: ({ element }) => {
    const { decision, confidence, score, reasoning, factors } = element.props as {
      decision: 'BID' | 'NO-BID' | 'REVIEW';
      confidence: number;
      score?: number;
      reasoning: string;
      factors?: Array<{
        name: string;
        score: number;
        weight: number;
        impact: 'positive' | 'negative' | 'neutral';
      }>;
    };

    const decisionConfig = {
      BID: {
        label: 'BID',
        color: 'bg-green-500 text-white',
        borderColor: 'border-green-200 bg-green-50',
      },
      'NO-BID': {
        label: 'NO-BID',
        color: 'bg-red-500 text-white',
        borderColor: 'border-red-200 bg-red-50',
      },
      REVIEW: {
        label: 'REVIEW',
        color: 'bg-yellow-500 text-white',
        borderColor: 'border-yellow-200 bg-yellow-50',
      },
    };

    const config = decisionConfig[decision];
    const impactColors = {
      positive: 'text-green-600',
      negative: 'text-red-600',
      neutral: 'text-gray-600',
    };

    return (
      <div className={cn('p-4 rounded-lg border-2', config.borderColor)}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Badge className={cn('text-lg px-4 py-1', config.color)}>{config.label}</Badge>
            {score !== undefined && <span className="text-2xl font-bold">{score}/100</span>}
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Confidence</p>
            <p className="text-xl font-semibold">{confidence}%</p>
          </div>
        </div>

        <p className="text-sm mb-4">{reasoning}</p>

        {factors && factors.length > 0 && (
          <div className="space-y-2 pt-4 border-t">
            <p className="text-sm font-medium text-muted-foreground">Bewertungsfaktoren</p>
            {factors.map((factor, idx) => (
              <div key={idx} className="flex items-center justify-between text-sm">
                <span className={impactColors[factor.impact]}>{factor.name}</span>
                <div className="flex items-center gap-2">
                  <Progress value={factor.score} className="w-20 h-1.5" />
                  <span className="w-8 text-right">{factor.score}%</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  },

  /**
   * MigrationComplexity - Visual complexity indicator for migrations
   */
  MigrationComplexity: ({ element }) => {
    const { level, score, factors, estimatedEffort } = element.props as {
      level: 'low' | 'medium' | 'high' | 'very_high';
      score: number;
      factors?: Array<{ name: string; impact: 'low' | 'medium' | 'high' }>;
      estimatedEffort?: { minDays: number; maxDays: number };
    };

    const levelConfig = {
      low: { label: 'Niedrig', color: 'bg-green-500', bgColor: 'bg-green-50 border-green-200' },
      medium: {
        label: 'Mittel',
        color: 'bg-yellow-500',
        bgColor: 'bg-yellow-50 border-yellow-200',
      },
      high: { label: 'Hoch', color: 'bg-orange-500', bgColor: 'bg-orange-50 border-orange-200' },
      very_high: { label: 'Sehr hoch', color: 'bg-red-500', bgColor: 'bg-red-50 border-red-200' },
    };

    const config = levelConfig[level];
    const impactConfig = {
      low: 'bg-green-100 text-green-800',
      medium: 'bg-yellow-100 text-yellow-800',
      high: 'bg-red-100 text-red-800',
    };

    return (
      <div className={cn('p-4 rounded-lg border', config.bgColor)}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm text-muted-foreground">Migrationskomplexität</p>
            <div className="flex items-center gap-2 mt-1">
              <div className={cn('w-3 h-3 rounded-full', config.color)} />
              <span className="text-xl font-bold">{config.label}</span>
            </div>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold">{score}</p>
            <p className="text-sm text-muted-foreground">/ 100</p>
          </div>
        </div>

        {/* Progress bar visualization */}
        <div className="h-3 bg-gray-200 rounded-full overflow-hidden mb-4">
          <div
            className={cn('h-full transition-all', config.color)}
            style={{ width: `${score}%` }}
          />
        </div>

        {estimatedEffort && (
          <div className="p-2 bg-white/50 rounded mb-4">
            <p className="text-sm">
              <span className="text-muted-foreground">Geschätzter Aufwand: </span>
              <span className="font-medium">
                {estimatedEffort.minDays}–{estimatedEffort.maxDays} PT
              </span>
            </p>
          </div>
        )}

        {factors && factors.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground uppercase">
              Komplexitätsfaktoren
            </p>
            <div className="flex flex-wrap gap-1.5">
              {factors.map((factor, idx) => (
                <Badge key={idx} className={cn('text-xs', impactConfig[factor.impact])}>
                  {factor.name}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  },

  /**
   * ProsConsList - Two-column pro/contra display
   */
  ProsConsList: ({ element }) => {
    const { title, pros, cons } = element.props as {
      title?: string;
      pros: Array<{ text: string; importance?: 'high' | 'medium' | 'low' }>;
      cons: Array<{ text: string; importance?: 'high' | 'medium' | 'low' }>;
    };

    const importanceWeight = { high: 'font-medium', medium: '', low: 'text-muted-foreground' };

    return (
      <div className="space-y-3">
        {title && <h4 className="font-medium">{title}</h4>}
        <div className="grid grid-cols-2 gap-4">
          {/* Pros */}
          <div className="p-3 rounded-lg bg-green-50 border border-green-100">
            <p className="text-sm font-medium text-green-800 mb-2 flex items-center gap-1">
              <CheckCircle2 className="h-4 w-4" />
              Vorteile ({pros.length})
            </p>
            <ul className="space-y-1.5">
              {pros.map((pro, idx) => (
                <li
                  key={idx}
                  className={cn(
                    'text-sm flex items-start gap-2',
                    importanceWeight[pro.importance || 'medium']
                  )}
                >
                  <span className="text-green-600 mt-0.5">+</span>
                  <span>{pro.text}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Cons */}
          <div className="p-3 rounded-lg bg-red-50 border border-red-100">
            <p className="text-sm font-medium text-red-800 mb-2 flex items-center gap-1">
              <XCircle className="h-4 w-4" />
              Nachteile ({cons.length})
            </p>
            <ul className="space-y-1.5">
              {cons.map((con, idx) => (
                <li
                  key={idx}
                  className={cn(
                    'text-sm flex items-start gap-2',
                    importanceWeight[con.importance || 'medium']
                  )}
                >
                  <span className="text-red-600 mt-0.5">−</span>
                  <span>{con.text}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    );
  },

  /**
   * NextStepsList - Action items with priority and owner
   */
  NextStepsList: ({ element }) => {
    const { title, steps } = element.props as {
      title?: string;
      steps: Array<{
        action: string;
        priority: 'critical' | 'high' | 'medium' | 'low';
        owner?: string;
        dueDate?: string;
        completed?: boolean;
      }>;
    };

    const priorityConfig = {
      critical: { label: 'Kritisch', color: 'bg-red-100 text-red-800 border-red-200' },
      high: { label: 'Hoch', color: 'bg-orange-100 text-orange-800 border-orange-200' },
      medium: { label: 'Mittel', color: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
      low: { label: 'Niedrig', color: 'bg-gray-100 text-gray-800 border-gray-200' },
    };

    return (
      <div className="space-y-3">
        {title && <h4 className="font-medium">{title}</h4>}
        <div className="space-y-2">
          {steps.map((step, idx) => {
            const config = priorityConfig[step.priority];
            return (
              <div
                key={idx}
                className={cn(
                  'p-3 rounded-lg border flex items-start gap-3',
                  step.completed ? 'bg-muted/50 opacity-70' : 'bg-card'
                )}
              >
                <div className="flex-shrink-0 mt-0.5">
                  {step.completed ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  ) : (
                    <div className="h-5 w-5 rounded-full border-2 border-muted-foreground/30" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={cn('text-sm', step.completed && 'line-through')}>{step.action}</p>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <Badge className={cn('text-xs', config.color)}>{config.label}</Badge>
                    {step.owner && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {step.owner}
                      </span>
                    )}
                    {step.dueDate && (
                      <span className="text-xs text-muted-foreground">bis {step.dueDate}</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  },

  /**
   * ProjectTimeline - Full project timeline visualization with Gantt-like bars
   *
   * Props:
   * - totalDays: number - Total project duration in working days
   * - totalWeeks: number - Total duration in weeks
   * - totalMonths: number - Total duration in months
   * - phases: Array<{ name, durationDays, startDay, endDay, keyActivities }> - Project phases
   * - assumedTeamSize: { min, optimal, max } - Team size recommendation
   * - confidence: number - Confidence level (0-100)
   * - assumptions?: string[] - Key assumptions
   * - risks?: Array<{ factor, impact, likelihood }> - Timeline risks
   * - calculationBasis?: { contentVolume, complexity, integrations, hasCriticalDeadline }
   * - estimatedStart?: string - ISO date
   * - estimatedGoLive?: string - ISO date
   */
  ProjectTimeline: ({ element }) => {
    const {
      totalDays,
      totalWeeks,
      totalMonths,
      phases,
      assumedTeamSize,
      confidence,
      assumptions,
      risks,
      calculationBasis,
      estimatedStart,
      estimatedGoLive,
    } = element.props as {
      totalDays: number;
      totalWeeks: number;
      totalMonths: number;
      phases: Array<{
        name: string;
        durationDays: number;
        startDay: number;
        endDay: number;
        keyActivities?: string[];
      }>;
      assumedTeamSize: { min: number; optimal: number; max: number };
      confidence: number;
      assumptions?: string[];
      risks?: Array<{ factor: string; impact: 'low' | 'medium' | 'high'; likelihood: string }>;
      calculationBasis?: {
        contentVolume: string;
        complexity: string;
        integrations: number;
        hasCriticalDeadline: boolean;
      };
      estimatedStart?: string;
      estimatedGoLive?: string;
    };

    const confidenceBg =
      confidence >= 80
        ? 'bg-green-100 text-green-800'
        : confidence >= 60
          ? 'bg-yellow-100 text-yellow-800'
          : 'bg-red-100 text-red-800';

    const phaseColors = [
      'bg-blue-500',
      'bg-purple-500',
      'bg-green-500',
      'bg-orange-500',
      'bg-pink-500',
      'bg-teal-500',
    ];

    const maxDay = totalDays || 1;

    return (
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Projekt-Timeline (Schätzung)
              </CardTitle>
              <CardDescription>
                Basierend auf Quick Scan Analyse - Detaillierte Planung erfolgt nach Zuordnung
              </CardDescription>
            </div>
            <Badge className={confidenceBg}>{confidence}% Konfidenz</Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Summary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Gesamtdauer
              </div>
              <div className="text-2xl font-bold">{totalWeeks} Wochen</div>
              <div className="text-xs text-muted-foreground">{totalDays} Arbeitstage</div>
            </div>

            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">Monate</div>
              <div className="text-2xl font-bold">{totalMonths?.toFixed(1) || '–'}</div>
              <div className="text-xs text-muted-foreground">ca. Monate</div>
            </div>

            <div className="space-y-1">
              <div className="text-sm text-muted-foreground flex items-center gap-1">
                <Users className="h-3 w-3" />
                Team-Größe
              </div>
              <div className="text-2xl font-bold">{assumedTeamSize?.optimal || '–'}</div>
              <div className="text-xs text-muted-foreground">
                {assumedTeamSize ? `${assumedTeamSize.min}-${assumedTeamSize.max} Personen` : '–'}
              </div>
            </div>

            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">Phasen</div>
              <div className="text-2xl font-bold">{phases?.length || 0}</div>
              <div className="text-xs text-muted-foreground">Projekt-Phasen</div>
            </div>
          </div>

          {/* Timeline Dates */}
          {(estimatedStart || estimatedGoLive) && (
            <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
              {estimatedStart && (
                <div>
                  <div className="text-sm font-medium">Geschätzter Start</div>
                  <div className="text-lg">
                    {new Date(estimatedStart).toLocaleDateString('de-DE', {
                      day: '2-digit',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </div>
                </div>
              )}
              {estimatedGoLive && (
                <div>
                  <div className="text-sm font-medium">Geschätztes Go-Live</div>
                  <div className="text-lg">
                    {new Date(estimatedGoLive).toLocaleDateString('de-DE', {
                      day: '2-digit',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Phase Bars (Gantt-like) */}
          {phases && phases.length > 0 && (
            <div className="space-y-3">
              <div className="text-sm font-medium">Phasen-Übersicht</div>
              <div className="space-y-2">
                {phases.map((phase, index) => {
                  const startPercent = (phase.startDay / maxDay) * 100;
                  const widthPercent = (phase.durationDays / maxDay) * 100;
                  const color = phaseColors[index % phaseColors.length];

                  return (
                    <div key={index} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <div className="font-medium">{phase.name}</div>
                        <div className="text-muted-foreground">
                          {phase.durationDays} Tage ({Math.ceil(phase.durationDays / 5)} Wochen)
                        </div>
                      </div>
                      <div className="relative h-8 bg-muted rounded-md overflow-hidden">
                        <div
                          className={cn(
                            'absolute h-full transition-all flex items-center px-2 text-white text-xs font-medium',
                            color
                          )}
                          style={{
                            left: `${startPercent}%`,
                            width: `${Math.max(widthPercent, 5)}%`,
                          }}
                        >
                          {widthPercent > 20 && <span className="truncate">{phase.name}</span>}
                        </div>
                      </div>
                      {phase.keyActivities && phase.keyActivities.length > 0 && (
                        <div className="text-xs text-muted-foreground pl-2">
                          {phase.keyActivities.slice(0, 2).join(' • ')}
                          {phase.keyActivities.length > 2 &&
                            ` +${phase.keyActivities.length - 2} weitere`}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Calculation Basis */}
          {calculationBasis && (
            <div className="p-4 bg-muted rounded-lg space-y-2">
              <div className="text-sm font-medium flex items-center gap-2">
                <Info className="h-4 w-4" />
                Berechnungsgrundlage
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Content-Volumen:</span>
                  <span className="ml-2">{calculationBasis.contentVolume}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Komplexität:</span>
                  <span className="ml-2 capitalize">{calculationBasis.complexity}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Integrationen:</span>
                  <span className="ml-2">{calculationBasis.integrations}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Kritische Deadline:</span>
                  <span className="ml-2">
                    {calculationBasis.hasCriticalDeadline ? 'Ja' : 'Nein'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Assumptions */}
          {assumptions && assumptions.length > 0 && (
            <div className="space-y-2">
              <div className="text-sm font-medium flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                Annahmen
              </div>
              <ul className="list-disc list-inside text-sm space-y-1">
                {assumptions.map((assumption, index) => (
                  <li key={index}>{assumption}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Risks */}
          {risks && risks.length > 0 && (
            <div className="space-y-2">
              <div className="text-sm font-medium flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-orange-500" />
                Timeline-Risiken
              </div>
              <div className="space-y-2">
                {risks.map((risk, index) => {
                  const impactColors = {
                    low: 'bg-green-100 text-green-800',
                    medium: 'bg-yellow-100 text-yellow-800',
                    high: 'bg-red-100 text-red-800',
                  };
                  return (
                    <div
                      key={index}
                      className={cn(
                        'p-3 rounded-lg border',
                        risk.impact === 'high' ? 'border-red-200 bg-red-50' : 'border-muted'
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-sm">{risk.factor}</span>
                        <div className="flex gap-1">
                          <Badge className={cn('text-xs', impactColors[risk.impact])}>
                            {risk.impact === 'high'
                              ? 'Hoch'
                              : risk.impact === 'medium'
                                ? 'Mittel'
                                : 'Niedrig'}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  },
};

/**
 * Recursive renderer for json-render tree
 */
export interface RenderTree {
  root: string | null;
  elements: Record<string, ElementBase>;
}

interface RenderTreeProps {
  tree: RenderTree;
}

export function QuickScanRenderer({ tree }: RenderTreeProps): React.ReactElement | null {
  if (!tree.root || !tree.elements[tree.root]) {
    return null;
  }

  const renderElement = (key: string): React.ReactElement | null => {
    const element = tree.elements[key];
    if (!element) return null;

    const Component = quickScanRegistry[element.type];
    if (!Component) {
      console.warn(`Unknown component type: ${element.type}`);
      return null;
    }

    const childElements = element.children
      ?.map(childKey => {
        const child = renderElement(childKey);
        return child ? (
          <div key={childKey} className="mb-4 last:mb-0">
            {child}
          </div>
        ) : null;
      })
      .filter(Boolean) as React.ReactElement[];

    return <Component element={element}>{childElements}</Component>;
  };

  return <div className="space-y-6">{renderElement(tree.root)}</div>;
}
