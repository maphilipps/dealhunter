/**
 * Suggested Actions Component
 *
 * Displays context-aware suggested actions with icons and descriptions.
 * Used for capability discovery and next-step guidance.
 */

import { Button } from './button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './card';

import { cn } from '@/lib/utils';

export interface SuggestedAction {
  id: string;
  icon: React.ReactNode;
  label: string;
  description: string;
  onClick: () => void;
  variant?: 'default' | 'outline' | 'secondary';
  disabled?: boolean;
}

export interface SuggestedActionsProps {
  title?: string;
  description?: string;
  actions: SuggestedAction[];
  columns?: 1 | 2 | 3;
  className?: string;
}

export function SuggestedActions({
  title = 'Suggested Actions',
  description,
  actions,
  columns = 2,
  className,
}: SuggestedActionsProps) {
  const gridCols = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        <div className={cn('grid gap-3', gridCols[columns])}>
          {actions.map(action => (
            <Button
              key={action.id}
              variant={action.variant || 'outline'}
              className="h-auto flex-col items-start gap-2 p-4 text-left"
              onClick={action.onClick}
              disabled={action.disabled}
            >
              <div className="flex items-center gap-3 w-full">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                  {action.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm mb-1">{action.label}</div>
                  <div className="text-xs text-muted-foreground line-clamp-2">
                    {action.description}
                  </div>
                </div>
              </div>
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
