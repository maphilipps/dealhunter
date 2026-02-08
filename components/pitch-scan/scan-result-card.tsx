'use client';

import { ChevronDown, ChevronRight, ExternalLink, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import useSWR from 'swr';

import { Loader } from '@/components/ai-elements/loader';
import { MessageResponse } from '@/components/ai-elements/message';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

type SectionApiResponse =
  | {
      success: true;
      section: {
        sectionId: string;
        label: string;
        content: unknown;
        metadata: unknown;
        confidence: number | null;
        createdAt: string | Date | null;
      };
    }
  | { error: string };

async function fetchJson(url: string): Promise<SectionApiResponse> {
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  const data = (await res.json()) as SectionApiResponse;
  if (!res.ok) {
    const msg = 'error' in data ? data.error : `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return data;
}

export interface ScanResultCardProps {
  pitchId: string;
  sectionId: string;
  label: string;
  confidence?: number;
  status: 'completed' | 'failed';
  errorMessage?: string;
}

export function ScanResultCard({
  pitchId,
  sectionId,
  label,
  confidence,
  status,
  errorMessage,
}: ScanResultCardProps) {
  const [open, setOpen] = useState(false);

  const url = useMemo(
    () =>
      open && status === 'completed'
        ? `/api/pitches/${pitchId}/pitch-scan/sections/${sectionId}`
        : null,
    [open, pitchId, sectionId, status]
  );

  const { data, isLoading, error } = useSWR<SectionApiResponse, Error>(url, fetchJson, {
    revalidateOnFocus: false,
    shouldRetryOnError: false,
  });

  const body = useMemo(() => {
    if (!open) return null;

    if (status === 'failed') {
      return (
        <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {errorMessage || 'Diese Sektion konnte nicht erstellt werden.'}
        </div>
      );
    }

    if (isLoading) {
      return (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader size="sm" />
          <span className="text-sm">Ergebnis wird geladen...</span>
        </div>
      );
    }

    if (error) {
      return (
        <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          Fehler beim Laden: {error.message}
        </div>
      );
    }

    if (!data || !('success' in data) || !data.success) {
      const msg = data && 'error' in data ? data.error : 'Unbekannter Fehler';
      return (
        <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          Fehler: {msg}
        </div>
      );
    }

    const content = data.section.content;
    const asMarkdown =
      typeof content === 'string'
        ? content
        : `\`\`\`json\n${JSON.stringify(content, null, 2)}\n\`\`\``;

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-end">
          <Button asChild variant="outline" size="sm" className="gap-2">
            <Link href={`/pitches/${pitchId}/pitch-scan/${sectionId}`}>
              <ExternalLink className="h-4 w-4" />
              Details öffnen
            </Link>
          </Button>
        </div>
        <div className="prose prose-sm dark:prose-invert max-w-none">
          <MessageResponse>{asMarkdown}</MessageResponse>
        </div>
      </div>
    );
  }, [open, status, errorMessage, isLoading, error, data, pitchId, sectionId]);

  const badge =
    confidence != null ? (
      <Badge variant="secondary" className="ml-auto text-[10px] font-normal tabular-nums">
        {Math.round(confidence)}%
      </Badge>
    ) : null;

  return (
    <Card className={cn('border-border', status === 'failed' && 'border-destructive/30')}>
      <Collapsible open={open} onOpenChange={setOpen}>
        <div className="px-4 py-3">
          <div className="flex items-center gap-2">
            {status === 'failed' ? (
              <AlertTriangle className="h-4 w-4 text-destructive" />
            ) : open ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
            <div className="min-w-0">
              <p className="text-sm font-medium leading-tight truncate">{label}</p>
              <p className="text-xs text-muted-foreground truncate">{sectionId}</p>
            </div>
            {badge}
          </div>
          <div className="mt-2 flex items-center gap-2">
            <Badge
              variant={status === 'failed' ? 'destructive' : 'outline'}
              className="text-[10px]"
            >
              {status === 'failed' ? 'Fehlgeschlagen' : 'Ergebnis'}
            </Badge>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="ml-auto h-7 px-2">
                {open ? 'Schließen' : 'Öffnen'}
              </Button>
            </CollapsibleTrigger>
          </div>
        </div>

        <CollapsibleContent>
          <div className="border-t px-4 py-3">{body}</div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
