'use client';

import React from 'react';
import type { ComponentType, ReactNode } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { CheckCircle2, XCircle, Server, Package, Lightbulb, Code } from 'lucide-react';
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
};

// Variant styles for ResultCard
const variantStyles = {
  default: 'border-border',
  highlight: 'border-blue-200 bg-blue-50',
  warning: 'border-yellow-200 bg-yellow-50',
  success: 'border-green-200 bg-green-50',
};

/**
 * Quick Scan Component Registry
 * Maps json-render catalog components to React implementations
 */
export const quickScanRegistry: Record<string, ComponentType<RegistryComponentProps>> = {
  ResultCard: ({ element, children }) => {
    const { title, description, variant = 'default', icon } = element.props as {
      title: string;
      description?: string;
      variant?: keyof typeof variantStyles;
      icon?: keyof typeof iconMap;
    };
    const Icon = icon ? iconMap[icon] : null;

    return (
      <Card className={cn(variantStyles[variant], 'mb-4')}>
        <CardHeader>
          <div className="flex items-center gap-2">
            {Icon && <Icon className="h-5 w-5 text-muted-foreground" />}
            <CardTitle>{title}</CardTitle>
          </div>
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
        {children && <CardContent>{children}</CardContent>}
      </Card>
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
        <span className="text-sm text-muted-foreground">{label}</span>
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
      <div className={cn(
        'inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border',
        category ? categoryColors[category] : 'bg-muted border-border'
      )}>
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
        {title && <p className="font-medium text-sm">{title}</p>}
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
                <span className="text-xs text-muted-foreground">({feature.details})</span>
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
        {title && <p className="font-medium text-sm">{title}</p>}
        {alternatives.map((alt, idx) => (
          <div key={idx} className="flex items-start justify-between p-3 bg-muted/50 rounded-lg">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium">{alt.name}</span>
                <Badge variant="outline" className="text-xs">{alt.confidence}%</Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-1">{alt.reason}</p>
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
        {title && <p className="font-medium text-sm">{title}</p>}
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
              <span className="text-sm text-muted-foreground">Geschätzte Seiten</span>
              <span className="text-xl font-bold">{pageCount}</span>
            </div>
          )}
          {complexity && (
            <div className="flex flex-col">
              <span className="text-sm text-muted-foreground">Komplexität</span>
              <Badge className={cn('w-fit', complexityColors[complexity])}>
                {complexity}
              </Badge>
            </div>
          )}
        </div>

        {languages && languages.length > 0 && (
          <div>
            <span className="text-sm text-muted-foreground block mb-2">Sprachen</span>
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
            <span className="text-sm text-muted-foreground block mb-2">Content Types</span>
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
      sm: 'gap-2',
      md: 'gap-4',
      lg: 'gap-6',
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
          <h3 className="text-lg font-semibold">{name}</h3>
          {industry && <p className="text-sm text-muted-foreground">{industry}</p>}
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          {size && (
            <div>
              <span className="text-muted-foreground">Größe:</span>
              <p className="font-medium">{sizeLabels[size]}</p>
            </div>
          )}
          {location && (
            <div>
              <span className="text-muted-foreground">Standort:</span>
              <p className="font-medium">{location}</p>
            </div>
          )}
          {employeeCount && (
            <div>
              <span className="text-muted-foreground">Mitarbeiter:</span>
              <p className="font-medium">{employeeCount}</p>
            </div>
          )}
          {revenue && (
            <div>
              <span className="text-muted-foreground">Umsatz:</span>
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
        {title && <p className="text-sm text-muted-foreground">{title}</p>}
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
            <Badge className={cn('text-xs', sentimentColors[sentiment])}>
              {sentiment}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {source && <span>{source}</span>}
          {source && date && <span>•</span>}
          {date && <span>{date}</span>}
        </div>
        {summary && <p className="text-sm text-muted-foreground">{summary}</p>}
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
        {title && <p className="font-medium text-sm">{title}</p>}
        <div className="space-y-2">
          {items.map((item, idx) => (
            <div key={idx} className="p-3 rounded-lg border space-y-2">
              <div className="flex items-start justify-between gap-2">
                <h4 className="font-medium text-sm flex-1">{item.title}</h4>
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
              {item.summary && <p className="text-sm text-muted-foreground">{item.summary}</p>}
            </div>
          ))}
        </div>
      </div>
    );
  },
};

/**
 * Recursive renderer for json-render tree
 */
interface RenderTreeProps {
  tree: {
    root: string | null;
    elements: Record<string, ElementBase>;
  };
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

    const childElements = element.children?.map((childKey) => {
      const child = renderElement(childKey);
      return child ? <div key={childKey}>{child}</div> : null;
    }).filter(Boolean) as React.ReactElement[];

    return <Component element={element}>{childElements}</Component>;
  };

  return <div className="space-y-4">{renderElement(tree.root)}</div>;
}
