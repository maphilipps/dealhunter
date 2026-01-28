'use client';

import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { TableHead } from '@/components/ui/table';

interface SortableTableHeadProps {
  column: string;
  label: string;
  className?: string;
}

export function SortableTableHead({ column, label, className }: SortableTableHeadProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentSort = searchParams.get('sort');
  const currentOrder = searchParams.get('order');

  const isActive = currentSort === column;
  const nextOrder = isActive && currentOrder === 'asc' ? 'desc' : 'asc';

  const params = new URLSearchParams(searchParams);
  params.set('sort', column);
  params.set('order', nextOrder);

  const Icon = isActive ? (currentOrder === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown;

  return (
    <TableHead className={className}>
      <Link
        href={`${pathname}?${params.toString()}`}
        className="flex items-center gap-2 hover:text-foreground"
      >
        {label}
        <Icon className="h-4 w-4" />
      </Link>
    </TableHead>
  );
}
