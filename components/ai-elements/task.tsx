'use client';

import { CheckCircle2, Circle, AlertCircle, ChevronDownIcon, ListChecksIcon } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import { memo } from 'react';

import { Loader } from './loader';

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'error';

// ============================================================================
// Task (Root)
// ============================================================================

export type TaskProps = ComponentProps<typeof Collapsible>;

export const Task = memo(({ className, defaultOpen = true, children, ...props }: TaskProps) => (
  <Collapsible className={cn('not-prose mb-4', className)} defaultOpen={defaultOpen} {...props}>
    {children}
  </Collapsible>
));

Task.displayName = 'Task';

// ============================================================================
// TaskTrigger
// ============================================================================

export type TaskTriggerProps = ComponentProps<typeof CollapsibleTrigger> & {
  title: string;
  completedCount?: number;
  totalCount?: number;
};

export const TaskTrigger = memo(
  ({ className, title, completedCount, totalCount, children, ...props }: TaskTriggerProps) => (
    <CollapsibleTrigger
      className={cn(
        'flex w-full items-center gap-2 text-muted-foreground text-sm transition-colors hover:text-foreground',
        className
      )}
      {...props}
    >
      {children ?? (
        <>
          <ListChecksIcon className="size-4" />
          <span className="font-medium">{title}</span>
          {completedCount !== undefined && totalCount !== undefined && (
            <span className="text-xs">
              ({completedCount}/{totalCount})
            </span>
          )}
          <ChevronDownIcon className="ml-auto size-4 transition-transform [[data-state=open]>&]:rotate-180" />
        </>
      )}
    </CollapsibleTrigger>
  )
);

TaskTrigger.displayName = 'TaskTrigger';

// ============================================================================
// TaskContent
// ============================================================================

export type TaskContentProps = ComponentProps<typeof CollapsibleContent>;

export const TaskContent = memo(({ className, children, ...props }: TaskContentProps) => (
  <CollapsibleContent
    className={cn(
      'mt-2 space-y-1',
      'data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-top-2 data-[state=open]:slide-in-from-top-2 outline-none data-[state=closed]:animate-out data-[state=open]:animate-in',
      className
    )}
    {...props}
  >
    {children}
  </CollapsibleContent>
));

TaskContent.displayName = 'TaskContent';

// ============================================================================
// TaskItem
// ============================================================================

export type TaskItemProps = ComponentProps<'div'> & {
  status: TaskStatus;
  children: ReactNode;
};

const statusIcons: Record<TaskStatus, ReactNode> = {
  pending: <Circle className="size-4 text-muted-foreground" />,
  in_progress: <Loader size="sm" />,
  completed: <CheckCircle2 className="size-4 text-green-500" />,
  error: <AlertCircle className="size-4 text-destructive" />,
};

export const TaskItem = memo(({ className, status, children, ...props }: TaskItemProps) => (
  <div
    className={cn(
      'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm',
      status === 'in_progress' && 'bg-muted/50',
      status === 'completed' && 'text-muted-foreground',
      status === 'error' && 'text-destructive',
      className
    )}
    {...props}
  >
    <span className="flex-shrink-0">{statusIcons[status]}</span>
    <span className="flex-1 min-w-0">{children}</span>
  </div>
));

TaskItem.displayName = 'TaskItem';
