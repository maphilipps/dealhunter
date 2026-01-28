/**
 * Summary Link Card
 *
 * Wiederverwendbare Card-Komponente für Quick-Scan Ergebnisse.
 * Zeigt Icon, Titel, kurze Summary und Link zur Detail-Seite.
 */

import { type LucideIcon, ChevronRight } from 'lucide-react';
import Link from 'next/link';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export interface SummaryLinkCardProps {
  title: string;
  icon: LucideIcon;
  href: string;
  summary?: string | null;
  details?: string[];
  disabled?: boolean;
  className?: string;
}

export function SummaryLinkCard({
  title,
  icon: Icon,
  href,
  summary,
  details,
  disabled = false,
  className,
}: SummaryLinkCardProps) {
  const content = (
    <Card
      className={cn(
        'group relative transition-colors',
        disabled
          ? 'cursor-not-allowed opacity-50'
          : 'cursor-pointer hover:border-primary hover:bg-muted/50',
        className
      )}
    >
      <CardHeader className="flex flex-row items-center gap-3 pb-2">
        <div
          className={cn(
            'flex h-10 w-10 items-center justify-center rounded-lg',
            disabled ? 'bg-muted' : 'bg-primary/10'
          )}
        >
          <Icon className={cn('h-5 w-5', disabled ? 'text-muted-foreground' : 'text-primary')} />
        </div>
        <CardTitle className="text-base font-medium">{title}</CardTitle>
        {!disabled && (
          <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
        )}
      </CardHeader>
      <CardContent className="pt-0">
        {summary ? (
          <p className="line-clamp-2 text-sm text-muted-foreground">{summary}</p>
        ) : (
          <p className="text-sm italic text-muted-foreground">Keine Daten verfügbar</p>
        )}
        {details && details.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {details.slice(0, 3).map((detail, index) => (
              <span
                key={index}
                className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground"
              >
                {detail}
              </span>
            ))}
            {details.length > 3 && (
              <span className="text-xs text-muted-foreground">+{details.length - 3} mehr</span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );

  if (disabled) {
    return content;
  }

  return (
    <Link href={href} className="block">
      {content}
    </Link>
  );
}
