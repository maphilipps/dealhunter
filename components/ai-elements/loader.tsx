'use client';

import { Loader2Icon } from 'lucide-react';
import { memo } from 'react';
import type { ComponentProps } from 'react';

import { cn } from '@/lib/utils';

export type LoaderProps = Omit<ComponentProps<'svg'>, 'ref'> & {
  size?: 'xs' | 'sm' | 'md' | 'lg';
};

const sizeClasses = {
  xs: 'size-3',
  sm: 'size-4',
  md: 'size-6',
  lg: 'size-8',
};

export const Loader = memo(({ className, size = 'md', ...props }: LoaderProps) => {
  return (
    <Loader2Icon
      className={cn('animate-spin text-muted-foreground', sizeClasses[size], className)}
      {...props}
    />
  );
});

Loader.displayName = 'Loader';
