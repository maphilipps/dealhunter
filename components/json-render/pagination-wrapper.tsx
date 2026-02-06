'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { TypographyMutedSpan } from '@/components/ui/typography';

interface PaginationWrapperProps<T> {
  items: T[];
  pageSize?: number;
  renderItem: (item: T, index: number) => ReactNode;
  className?: string;
}

/**
 * Generic pagination wrapper for lists with >pageSize items.
 * Renders all items if count <= pageSize, otherwise paginates.
 */
export function PaginationWrapper<T>({
  items,
  pageSize = 10,
  renderItem,
  className,
}: PaginationWrapperProps<T>) {
  const [page, setPage] = useState(0);

  if (items.length <= pageSize) {
    return <div className={className}>{items.map((item, idx) => renderItem(item, idx))}</div>;
  }

  const totalPages = Math.ceil(items.length / pageSize);
  const startIdx = page * pageSize;
  const pageItems = items.slice(startIdx, startIdx + pageSize);

  return (
    <div className={className}>
      {pageItems.map((item, idx) => renderItem(item, startIdx + idx))}
      <div className="flex items-center justify-between pt-3 border-t mt-3">
        <TypographyMutedSpan>
          {startIdx + 1}–{Math.min(startIdx + pageSize, items.length)} von {items.length}
        </TypographyMutedSpan>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <TypographyMutedSpan className="px-2">
            {page + 1}/{totalPages}
          </TypographyMutedSpan>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
