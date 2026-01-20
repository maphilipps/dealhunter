'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Minus, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ConfidenceIndicatorProps {
  confidence: number;
  label?: string;
  showThreshold?: boolean;
  threshold?: number;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function ConfidenceIndicator({
  confidence,
  label = 'Confidence Score',
  showThreshold = true,
  threshold = 70,
  className,
  size = 'md',
}: ConfidenceIndicatorProps) {
  const getConfidenceLevel = () => {
    if (confidence >= 80) return 'high';
    if (confidence >= threshold) return 'medium';
    if (confidence >= 50) return 'low';
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
              <div className={cn('font-bold', config.color, sizes.scoreSize)}>
                {confidence}%
              </div>
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
                  Diese Empfehlung sollte manuell von einem Experten überprüft werden.
                  Zusätzliche Informationen oder eine zweite Meinung können hilfreich sein.
                </p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

interface ConfidenceBreakdownProps {
  breakdown: { label: string; confidence: number; weight?: number }[];
  className?: string;
}

export function ConfidenceBreakdown({ breakdown, className }: ConfidenceBreakdownProps) {
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
}
