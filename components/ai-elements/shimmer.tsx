'use client';

import type { ComponentProps } from 'react';
import { memo } from 'react';

import { cn } from '@/lib/utils';

export type ShimmerProps = ComponentProps<'span'> & {
  duration?: number;
};

export const Shimmer = memo(({ className, children, duration = 2, ...props }: ShimmerProps) => (
  <span
    className={cn('inline-block animate-pulse', className)}
    style={{ animationDuration: `${duration}s` }}
    {...props}
  >
    {children}
  </span>
));

Shimmer.displayName = 'Shimmer';
