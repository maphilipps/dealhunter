'use client';

import { CheckCircle2, XCircle, ChevronDown, Play, Sparkles } from 'lucide-react';

import { Loader } from '@/components/ai-elements/loader';
import { useState, useTransition } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Progress } from '@/components/ui/progress';
import { triggerBaselineComparison } from '@/lib/baseline-comparison/actions';
import type {
  BaselineComparisonResult,
  BaselineItem,
  BaselineCategory,
} from '@/lib/baseline-comparison/schema';

interface BaselineComparisonCardProps {
  bidId: string;
  initialResult?: BaselineComparisonResult | null;
  hasDeepAnalysis: boolean;
}

const categoryLabels: Record<BaselineCategory, string> = {
  content_types: 'Content Types',
  paragraphs: 'Paragraphs',
  navigation: 'Navigation',
  features: 'Features',
  integrations: 'Integrationen',
  media: 'Media',
  taxonomies: 'Taxonomien',
  forms: 'Formulare',
};

export function BaselineComparisonCard({
  bidId,
  initialResult,
  hasDeepAnalysis,
}: BaselineComparisonCardProps) {
  const [result, setResult] = useState<BaselineComparisonResult | null>(initialResult || null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [openCategories, setOpenCategories] = useState<Set<string>>(new Set());

  const handleTrigger = () => {
    setError(null);
    startTransition(async () => {
      const response = await triggerBaselineComparison(bidId);
      if (response.success && response.result) {
        setResult(response.result);
      } else {
        setError(response.error || 'Unbekannter Fehler');
      }
    });
  };

  const toggleCategory = (category: string) => {
    setOpenCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  // Not ready state
  if (!hasDeepAnalysis) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Baseline-Vergleich
          </CardTitle>
          <CardDescription>Deep Analysis muss zuerst abgeschlossen sein</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Der Baseline-Vergleich benötigt Daten aus der Deep Analysis. Bitte führen Sie zuerst die
            Deep Analysis durch.
          </p>
        </CardContent>
      </Card>
    );
  }

  // No result yet - show trigger button
  if (!result) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Baseline-Vergleich
          </CardTitle>
          <CardDescription>Vergleich mit adesso-Baseline durchführen</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Analysiert welche Features aus der adesso-Baseline übernommen werden können und welche
            neu entwickelt werden müssen.
          </p>

          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
          )}

          <Button onClick={handleTrigger} disabled={isPending}>
            {isPending ? (
              <>
                <Loader size="sm" className="mr-2" />
                Analysiere...
              </>
            ) : (
              <>
                <Play className="mr-2 h-4 w-4" />
                Baseline-Vergleich starten
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Show results
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              Baseline-Vergleich
            </CardTitle>
            <CardDescription>
              {result.baselineName} • {result.totalItems} Items analysiert
            </CardDescription>
          </div>
          <Badge variant={result.baselineCoverage >= 70 ? 'default' : 'secondary'}>
            {result.baselineCoverage.toFixed(0)}% Abdeckung
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Coverage Progress */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Baseline-Abdeckung</span>
            <span className="font-medium">{result.baselineCoverage.toFixed(1)}%</span>
          </div>
          <Progress value={result.baselineCoverage} className="h-3" />
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-lg border bg-green-50 p-4 dark:bg-green-950/20">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <span className="font-medium">Aus Baseline</span>
            </div>
            <p className="mt-1 text-2xl font-bold text-green-600">
              {result.availableFromBaseline.length}
            </p>
            <p className="text-xs text-muted-foreground">
              {result.estimatedSavings.hoursFromBaseline.toFixed(0)} PT gespart
            </p>
          </div>
          <div className="rounded-lg border bg-orange-50 p-4 dark:bg-orange-950/20">
            <div className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-orange-600" />
              <span className="font-medium">Neuentwicklung</span>
            </div>
            <p className="mt-1 text-2xl font-bold text-orange-600">
              {result.newDevelopment.length}
            </p>
            <p className="text-xs text-muted-foreground">
              {result.estimatedSavings.hoursNewDevelopment.toFixed(0)} PT Aufwand
            </p>
          </div>
        </div>

        {/* Category Breakdown */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Nach Kategorie</h4>
          {result.categoryBreakdown.map(cat => (
            <Collapsible
              key={cat.category}
              open={openCategories.has(cat.category)}
              onOpenChange={() => toggleCategory(cat.category)}
            >
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  className="flex h-auto w-full items-center justify-between rounded-lg border p-3 text-left hover:bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-medium">{categoryLabels[cat.category]}</span>
                    <Badge variant="outline" className="text-xs">
                      {cat.fromBaseline}/{cat.totalCount}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                      {cat.coveragePercent.toFixed(0)}%
                    </span>
                    <ChevronDown
                      className={`h-4 w-4 transition-transform ${openCategories.has(cat.category) ? 'rotate-180' : ''}`}
                    />
                  </div>
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="mt-2 space-y-1 pl-4">
                  {/* Items from baseline */}
                  {result.availableFromBaseline
                    .filter(item => item.category === cat.category)
                    .map((item, idx) => (
                      <ItemRow key={`baseline-${idx}`} item={item} type="baseline" />
                    ))}
                  {/* Items for new development */}
                  {result.newDevelopment
                    .filter(item => item.category === cat.category)
                    .map((item, idx) => (
                      <ItemRow key={`new-${idx}`} item={item} type="new" />
                    ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          ))}
        </div>

        {/* Savings Summary */}
        <div className="rounded-lg border bg-muted/50 p-4">
          <h4 className="font-medium">Ersparnis durch Baseline</h4>
          <p className="mt-1 text-sm text-muted-foreground">
            Durch Nutzung der {result.baselineName} sparen Sie ca.{' '}
            <span className="font-medium text-green-600">
              {result.estimatedSavings.savingsPercent.toFixed(0)}%
            </span>{' '}
            der Entwicklungszeit.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function ItemRow({ item, type }: { item: BaselineItem; type: 'baseline' | 'new' }) {
  return (
    <div className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
      <div className="flex items-center gap-2">
        {type === 'baseline' ? (
          <CheckCircle2 className="h-4 w-4 text-green-600" />
        ) : (
          <XCircle className="h-4 w-4 text-orange-600" />
        )}
        <span>{item.name}</span>
        {item.baselineMatch && (
          <span className="text-xs text-muted-foreground">→ {item.baselineMatch}</span>
        )}
      </div>
      <div className="flex items-center gap-2">
        {item.estimatedHours && (
          <span className="text-xs text-muted-foreground">{item.estimatedHours} PT</span>
        )}
        <Badge variant="outline" className="text-xs">
          {item.confidence}%
        </Badge>
      </div>
    </div>
  );
}
