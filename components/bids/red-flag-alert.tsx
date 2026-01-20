'use client';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { RedFlag } from './types';

interface RedFlagAlertProps {
  flags: RedFlag[];
  className?: string;
}

export function RedFlagAlert({ flags, className }: RedFlagAlertProps) {
  if (!flags || flags.length === 0) return null;

  const criticalFlags = flags.filter((f) => f.severity === 'critical');
  const highFlags = flags.filter((f) => f.severity === 'high');
  const mediumFlags = flags.filter((f) => f.severity === 'medium');

  const categoryLabels = {
    legal: 'Rechtlich',
    technical: 'Technisch',
    commercial: 'Kommerziell',
    strategic: 'Strategisch',
    competition: 'Wettbewerb',
  };

  const severityConfig = {
    critical: {
      icon: XCircle,
      variant: 'destructive' as const,
      label: 'Kritisch',
      color: 'text-red-600 dark:text-red-400',
    },
    high: {
      icon: AlertTriangle,
      variant: 'destructive' as const,
      label: 'Hoch',
      color: 'text-orange-600 dark:text-orange-400',
    },
    medium: {
      icon: AlertTriangle,
      variant: 'default' as const,
      label: 'Mittel',
      color: 'text-yellow-600 dark:text-yellow-400',
    },
  };

  const renderFlags = (flagList: RedFlag[], severity: 'critical' | 'high' | 'medium') => {
    if (flagList.length === 0) return null;

    const config = severityConfig[severity];
    const Icon = config.icon;

    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Icon className={cn('h-4 w-4', config.color)} />
          <span className="font-semibold text-sm">{config.label}</span>
          <Badge variant="outline" className="text-xs">
            {flagList.length}
          </Badge>
        </div>
        <ul className="space-y-2 ml-6">
          {flagList.map((flag, index) => (
            <li key={index} className="text-sm">
              <div className="flex items-start gap-2">
                <span className="font-medium">{flag.title}</span>
                <Badge variant="outline" className="text-xs">
                  {categoryLabels[flag.category]}
                </Badge>
              </div>
              <p className="text-muted-foreground mt-1">{flag.description}</p>
            </li>
          ))}
        </ul>
      </div>
    );
  };

  return (
    <Alert variant="destructive" className={className}>
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>Red Flags erkannt ({flags.length})</AlertTitle>
      <AlertDescription className="space-y-4 mt-3">
        {renderFlags(criticalFlags, 'critical')}
        {renderFlags(highFlags, 'high')}
        {renderFlags(mediumFlags, 'medium')}
      </AlertDescription>
    </Alert>
  );
}
