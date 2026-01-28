'use client';

import { type LucideIcon, ChevronRight, AlertCircle, Loader2 } from 'lucide-react';
import Link from 'next/link';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export interface SectionCardProps {
  title: string;
  icon: LucideIcon;
  href: string;
  /** Top-3 Key Facts for this section */
  highlights?: string[];
  /** Status: 'available' | 'pending' | 'no_data' */
  status: 'available' | 'pending' | 'no_data';
  className?: string;
}

/**
 * Section Card Component
 *
 * Displays a summary card for a dashboard section with:
 * - Icon and title
 * - Top 3 key facts (highlights)
 * - Link to detail page
 * - Status indicator (loading, no data, available)
 */
export function SectionCard({
  title,
  icon: Icon,
  href,
  highlights = [],
  status,
  className,
}: SectionCardProps) {
  const isLoading = status === 'pending';
  const hasNoData = status === 'no_data';
  const hasData = status === 'available' && highlights.length > 0;

  return (
    <Link href={href} className="block">
      <Card
        className={cn(
          'group relative h-full transition-colors',
          'cursor-pointer hover:border-primary hover:bg-muted/50',
          className
        )}
      >
        <CardHeader className="flex flex-row items-center gap-3 pb-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
            <Icon className="h-4 w-4 text-primary" />
          </div>
          <CardTitle className="flex-1 text-sm font-medium">{title}</CardTitle>
          <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
        </CardHeader>
        <CardContent className="pt-0">
          {isLoading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>Wird analysiert...</span>
            </div>
          )}

          {hasNoData && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <AlertCircle className="h-3 w-3" />
              <span>Keine Angaben im Dokument gefunden</span>
            </div>
          )}

          {hasData && (
            <ul className="space-y-1.5">
              {highlights.slice(0, 3).map((highlight, index) => (
                <li key={index} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary/60" />
                  <span className="line-clamp-2">{highlight}</span>
                </li>
              ))}
            </ul>
          )}

          {/* Empty state when available but no highlights */}
          {status === 'available' && highlights.length === 0 && (
            <p className="text-sm text-muted-foreground">Keine relevanten Informationen gefunden</p>
          )}

          {/* Details link */}
          <div className="mt-3 flex items-center gap-1 text-xs font-medium text-primary">
            <span>Details ansehen</span>
            <ChevronRight className="h-3 w-3" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
