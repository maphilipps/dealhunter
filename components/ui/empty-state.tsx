/**
 * Empty State Component
 *
 * Reusable empty state with icon, title, description, and action buttons.
 * Used for onboarding, empty lists, and missing data scenarios.
 */

import { Button } from './button';
import { Card, CardContent } from './card';

import { cn } from '@/lib/utils';

export interface EmptyStateAction {
  label: string;
  onClick: () => void;
  variant?: 'default' | 'outline' | 'secondary' | 'ghost';
  icon?: React.ReactNode;
}

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  actions?: EmptyStateAction[];
  variant?: 'default' | 'info' | 'warning' | 'success';
  className?: string;
}

const variantStyles = {
  default: 'border-border',
  info: 'border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/20',
  warning: 'border-yellow-200 bg-yellow-50/50 dark:border-yellow-800 dark:bg-yellow-950/20',
  success: 'border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-950/20',
};

export function EmptyState({
  icon,
  title,
  description,
  actions = [],
  variant = 'default',
  className,
}: EmptyStateProps) {
  return (
    <Card className={cn('border-dashed', variantStyles[variant], className)}>
      <CardContent className="flex flex-col items-center justify-center py-12 px-6 text-center">
        {/* Icon */}
        {icon && (
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted text-muted-foreground">
            {icon}
          </div>
        )}

        {/* Title */}
        <h3 className="text-lg font-semibold mb-2">{title}</h3>

        {/* Description */}
        {description && (
          <p className="text-sm text-muted-foreground max-w-md mb-6">{description}</p>
        )}

        {/* Actions */}
        {actions.length > 0 && (
          <div className="flex flex-wrap gap-2 justify-center">
            {actions.map((action, idx) => (
              <Button
                key={idx}
                variant={action.variant || (idx === 0 ? 'default' : 'outline')}
                onClick={action.onClick}
                className="gap-2"
              >
                {action.icon}
                {action.label}
              </Button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
