'use client';

import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

export interface SectionGroupProps {
  title: string;
  children: React.ReactNode;
  className?: string;
}

/**
 * Section Group Component
 *
 * Groups related section cards with a heading and visual separator.
 * Mirrors the sidebar navigation structure.
 */
export function SectionGroup({ title, children, className }: SectionGroupProps) {
  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex items-center gap-4">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </h3>
        <Separator className="flex-1" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </div>
  );
}
