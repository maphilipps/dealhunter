'use client';

import { cn } from '@/lib/utils';
import type { ComponentProps } from 'react';

export type ShimmerProps = ComponentProps<'span'> & {
  duration?: number;
};

export const Shimmer = ({ className, children, duration = 2, ...props }: ShimmerProps) => (
  <span
    className={cn('inline-block animate-pulse', className)}
    style={{ animationDuration: `${duration}s` }}
    {...props}
  >
    {children}
  </span>
);
