'use client';

import { memo } from 'react';
import { TrendingUp, TrendingDown, Minus, AlertCircle } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

import {
  CONFIDENCE_HIGH_THRESHOLD,
  CONFIDENCE_MEDIUM_THRESHOLD,
  CONFIDENCE_LOW_THRESHOLD,
} from './constants';

interface ConfidenceIndicatorProps {
  confidence: number; // 0-100
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  label?: string;
  showThreshold?: boolean;
  threshold?: number;
  variant?: 'inline' | 'card';
  className?: string;
}

/**
 * TRANS-005: Confidence Indicator
 * Visual display of agent confidence levels
 * - Green: 80%+ (high confidence)
 * - Yellow: 60-79% (medium confidence)
 * - Red: <60% (low confidence)
 *
 * Supports two variants:
 * - inline: Simple progress bar with badge (default)
 * - card: Full card with icon, description, and threshold warning
 */
export const ConfidenceIndicator = memo(function ConfidenceIndicator({
  confidence,
  size = 'md',
  showLabel = true,
  label = 'Confidence Score',
  showThreshold = false,
  threshold = 70,
  variant = 'inline',
  className,
}: ConfidenceIndicatorProps) {
  if (variant === 'card') {
    return (
      <CardConfidenceIndicator
        confidence={confidence}
        size={size}
        label={label}
        showThreshold={showThreshold}
        threshold={threshold}
        className={className}
      />
    );
  }

  return (
    <InlineConfidenceIndicator
      confidence={confidence}
      size={size}
      showLabel={showLabel}
      className={className}
    />
  );
});

ConfidenceIndicator.displayName = 'ConfidenceIndicator';

// ============================================================================
// Inline Variant (simple progress bar + badge)
// ============================================================================

interface InlineConfidenceIndicatorProps {
  confidence: number;
  size: 'sm' | 'md' | 'lg';
  showLabel: boolean;
  className?: string;
}

const InlineConfidenceIndicator = memo(function InlineConfidenceIndicator({
  confidence,
  size,
  showLabel,
  className,
}: InlineConfidenceIndicatorProps) {
  const getConfidenceColor = () => {
    if (confidence >= CONFIDENCE_HIGH_THRESHOLD) return 'green';
    if (confidence >= CONFIDENCE_MEDIUM_THRESHOLD) return 'yellow';
    return 'red';
  };

  const color = getConfidenceColor();

  const getColorClasses = () => {
    switch (color) {
      case 'green':
        return 'bg-green-500 dark:bg-green-400';
      case 'yellow':
        return 'bg-yellow-500 dark:bg-yellow-400';
      case 'red':
        return 'bg-red-500 dark:bg-red-400';
      default:
        return 'bg-gray-500 dark:bg-gray-400';
    }
  };

  const getTextColor = () => {
    switch (color) {
      case 'green':
        return 'text-green-700 dark:text-green-300';
      case 'yellow':
        return 'text-yellow-700 dark:text-yellow-300';
      case 'red':
        return 'text-red-700 dark:text-red-300';
      default:
        return 'text-gray-700 dark:text-gray-300';
    }
  };

  const getBadgeVariant = (): 'default' | 'secondary' | 'destructive' | 'outline' => {
    switch (color) {
      case 'green':
        return 'default';
      case 'yellow':
        return 'secondary';
      case 'red':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  const sizeClasses = {
    sm: 'h-1.5',
    md: 'h-2',
    lg: 'h-3',
  };

  const confidenceText =
    confidence >= CONFIDENCE_HIGH_THRESHOLD
      ? 'High'
      : confidence >= CONFIDENCE_MEDIUM_THRESHOLD
        ? 'Medium'
        : 'Low';

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="flex-1 min-w-[60px] bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className={cn(sizeClasses[size], getColorClasses(), 'transition-all duration-300')}
          style={{ width: `${confidence}%` }}
        />
      </div>
      {showLabel && (
        <div className="flex items-center gap-2">
          <span className={cn('text-sm font-medium tabular-nums', getTextColor())}>
            {confidence}%
          </span>
          <Badge variant={getBadgeVariant()} className="text-xs">
            {confidenceText}
          </Badge>
        </div>
      )}
    </div>
  );
});

InlineConfidenceIndicator.displayName = 'InlineConfidenceIndicator';

// ============================================================================
// Card Variant (full card with icon, description, and threshold warning)
// ============================================================================

interface CardConfidenceIndicatorProps {
  confidence: number;
  size: 'sm' | 'md' | 'lg';
  label: string;
  showThreshold: boolean;
  threshold: number;
  className?: string;
}

const CardConfidenceIndicator = memo(function CardConfidenceIndicator({
  confidence,
  size,
  label,
  showThreshold,
  threshold,
  className,
}: CardConfidenceIndicatorProps) {
  const getConfidenceLevel = () => {
    if (confidence >= CONFIDENCE_HIGH_THRESHOLD) return 'high';
    if (confidence >= threshold) return 'medium';
    if (confidence >= CONFIDENCE_LOW_THRESHOLD) return 'low';
    return 'very-low';
  };

  const level = getConfidenceLevel();

  const levelConfig = {
    high: {
      color: 'text-green-600 dark:text-green-400',
      bgColor: 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800',
      icon: TrendingUp,
      label: 'Hoch',
      description: 'Sehr zuversichtliche Empfehlung',
    },
    medium: {
      color: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800',
      icon: Minus,
      label: 'Mittel',
      description: 'Zuversichtliche Empfehlung',
    },
    low: {
      color: 'text-yellow-600 dark:text-yellow-400',
      bgColor: 'bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800',
      icon: AlertCircle,
      label: 'Niedrig',
      description: 'Vorsichtige Empfehlung - weitere Prüfung empfohlen',
    },
    'very-low': {
      color: 'text-red-600 dark:text-red-400',
      bgColor: 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800',
      icon: TrendingDown,
      label: 'Sehr niedrig',
      description: 'Unsichere Empfehlung - manuelle Überprüfung erforderlich',
    },
  };

  const config = levelConfig[level];
  const Icon = config.icon;

  const sizeConfig = {
    sm: {
      iconSize: 'h-4 w-4',
      textSize: 'text-sm',
      scoreSize: 'text-2xl',
      progressHeight: 'h-2',
    },
    md: {
      iconSize: 'h-5 w-5',
      textSize: 'text-base',
      scoreSize: 'text-3xl',
      progressHeight: 'h-3',
    },
    lg: {
      iconSize: 'h-6 w-6',
      textSize: 'text-lg',
      scoreSize: 'text-4xl',
      progressHeight: 'h-4',
    },
  };

  const sizes = sizeConfig[size];

  return (
    <Card className={cn('border-2', config.bgColor, className)}>
      <CardContent className="p-6">
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Icon className={cn(sizes.iconSize, config.color)} />
                <span className={cn('font-medium', sizes.textSize)}>{label}</span>
              </div>
              <p className="text-sm text-muted-foreground">{config.description}</p>
            </div>
            <div className="text-right">
              <div className={cn('font-bold', config.color, sizes.scoreSize)}>{confidence}%</div>
              <Badge variant="outline" className={cn('mt-1', config.color)}>
                {config.label}
              </Badge>
            </div>
          </div>

          <Progress value={confidence} className={sizes.progressHeight} />

          {showThreshold && confidence < threshold && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50">
              <AlertCircle className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium">Unter Schwellenwert ({threshold}%)</p>
                <p className="text-muted-foreground mt-1">
                  Diese Empfehlung sollte manuell von einem Experten überprüft werden. Zusätzliche
                  Informationen oder eine zweite Meinung können hilfreich sein.
                </p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
});

CardConfidenceIndicator.displayName = 'CardConfidenceIndicator';

// ============================================================================
// ConfidenceBreakdown (exported separately for detailed views)
// ============================================================================

interface ConfidenceBreakdownProps {
  breakdown: { label: string; confidence: number; weight?: number }[];
  className?: string;
}

export const ConfidenceBreakdown = memo(function ConfidenceBreakdown({
  breakdown,
  className,
}: ConfidenceBreakdownProps) {
  return (
    <Card className={className}>
      <CardContent className="p-6">
        <h4 className="font-semibold mb-4">Confidence Breakdown</h4>
        <div className="space-y-3">
          {breakdown.map((item, index) => (
            <div key={index} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{item.label}</span>
                <div className="flex items-center gap-2">
                  {item.weight !== undefined && (
                    <span className="text-muted-foreground text-xs">
                      ({(item.weight * 100).toFixed(0)}%)
                    </span>
                  )}
                  <span className="font-semibold">{item.confidence}%</span>
                </div>
              </div>
              <Progress value={item.confidence} className="h-2" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
});

ConfidenceBreakdown.displayName = 'ConfidenceBreakdown';
