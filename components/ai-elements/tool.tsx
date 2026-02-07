'use client';

import { ChevronDownIcon, WrenchIcon } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import { createContext, memo, useContext, useMemo } from 'react';

import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

export type ToolState = 'input-streaming' | 'input-available' | 'output-available' | 'output-error';

type ToolContextValue = {
  state: ToolState;
};

// ============================================================================
// Context
// ============================================================================

const ToolContext = createContext<ToolContextValue | null>(null);

const useTool = () => {
  const context = useContext(ToolContext);
  if (!context) {
    throw new Error('Tool components must be used within Tool');
  }
  return context;
};

// ============================================================================
// Tool (Root)
// ============================================================================

export type ToolProps = ComponentProps<typeof Collapsible> & {
  state?: ToolState;
};

export const Tool = memo(
  ({
    className,
    state = 'input-available',
    defaultOpen = false,
    children,
    ...props
  }: ToolProps) => {
    const contextValue = useMemo(() => ({ state }), [state]);

    return (
      <ToolContext.Provider value={contextValue}>
        <Collapsible
          className={cn('not-prose rounded-md border bg-muted/30 px-3 py-2', className)}
          defaultOpen={defaultOpen}
          {...props}
        >
          {children}
        </Collapsible>
      </ToolContext.Provider>
    );
  }
);

Tool.displayName = 'Tool';

// ============================================================================
// ToolHeader
// ============================================================================

const stateLabels: Record<ToolState, string> = {
  'input-streaming': 'Wird aufgerufen...',
  'input-available': 'Aufgerufen',
  'output-available': 'Ergebnis',
  'output-error': 'Fehler',
};

const stateBadgeVariant: Record<ToolState, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  'input-streaming': 'outline',
  'input-available': 'secondary',
  'output-available': 'default',
  'output-error': 'destructive',
};

export type ToolHeaderProps = ComponentProps<typeof CollapsibleTrigger> & {
  toolName: string;
  state?: ToolState;
};

export const ToolHeader = memo(
  ({ className, toolName, state: stateProp, children, ...props }: ToolHeaderProps) => {
    const context = useTool();
    const state = stateProp ?? context.state;

    return (
      <CollapsibleTrigger
        className={cn(
          'flex w-full items-center gap-2 text-xs text-muted-foreground transition-colors hover:text-foreground',
          className
        )}
        {...props}
      >
        {children ?? (
          <>
            <WrenchIcon className="size-3.5" />
            <span className="font-mono">{toolName}</span>
            <Badge variant={stateBadgeVariant[state]} className="ml-auto text-[10px] px-1.5 py-0">
              {stateLabels[state]}
            </Badge>
            <ChevronDownIcon className="size-3.5 transition-transform [[data-state=open]>&]:rotate-180" />
          </>
        )}
      </CollapsibleTrigger>
    );
  }
);

ToolHeader.displayName = 'ToolHeader';

// ============================================================================
// ToolContent
// ============================================================================

export type ToolContentProps = ComponentProps<typeof CollapsibleContent>;

export const ToolContent = memo(({ className, children, ...props }: ToolContentProps) => (
  <CollapsibleContent
    className={cn(
      'mt-2 space-y-2 text-xs',
      'data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-top-2 data-[state=open]:slide-in-from-top-2 outline-none data-[state=closed]:animate-out data-[state=open]:animate-in',
      className
    )}
    {...props}
  >
    {children}
  </CollapsibleContent>
));

ToolContent.displayName = 'ToolContent';

// ============================================================================
// ToolInput
// ============================================================================

export type ToolInputProps = ComponentProps<'div'> & {
  input: Record<string, unknown>;
};

export const ToolInput = memo(({ className, input, ...props }: ToolInputProps) => (
  <div
    className={cn('rounded bg-muted p-2 font-mono text-[11px] leading-relaxed', className)}
    {...props}
  >
    {Object.entries(input).map(([key, value]) => (
      <div key={key} className="flex gap-2">
        <span className="text-muted-foreground shrink-0">{key}:</span>
        <span className="break-all">
          {typeof value === 'string' ? value : JSON.stringify(value)}
        </span>
      </div>
    ))}
  </div>
));

ToolInput.displayName = 'ToolInput';

// ============================================================================
// ToolOutput
// ============================================================================

export type ToolOutputProps = ComponentProps<'div'> & {
  output: ReactNode;
};

export const ToolOutput = memo(({ className, output, ...props }: ToolOutputProps) => (
  <div className={cn('rounded bg-muted/50 p-2', className)} {...props}>
    {output}
  </div>
));

ToolOutput.displayName = 'ToolOutput';
