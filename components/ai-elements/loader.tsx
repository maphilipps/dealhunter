'use client';

import { Loader2Icon } from 'lucide-react';
import type { ComponentProps } from 'react';

import { cn } from '@/lib/utils';

export type LoaderProps = ComponentProps<'div'> & {
  size?: 'sm' | 'md' | 'lg';
};

export const Loader = ({ className, size = 'md', ...props }: LoaderProps) => {
  const sizeClasses = {
    sm: 'size-4',
    md: 'size-6',
    lg: 'size-8',
  };

  return (
    <div className={cn('flex items-center justify-center p-4', className)} {...props}>
      <Loader2Icon className={cn('animate-spin text-muted-foreground', sizeClasses[size])} />
    </div>
  );
};
