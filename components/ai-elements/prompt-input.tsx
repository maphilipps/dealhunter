'use client';

import type { ChatStatus } from 'ai';
import { CornerDownLeftIcon, Loader2Icon, SquareIcon, XIcon } from 'lucide-react';
import type { ComponentProps, FormEventHandler, KeyboardEventHandler } from 'react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

export type PromptInputProps = ComponentProps<'form'> & {
  onSubmit: FormEventHandler<HTMLFormElement>;
};

export const PromptInput = ({ className, children, ...props }: PromptInputProps) => (
  <form className={cn('w-full', className)} {...props}>
    <div className="relative flex items-end gap-2">{children}</div>
  </form>
);

export type PromptInputTextareaProps = ComponentProps<typeof Textarea>;

export const PromptInputTextarea = ({
  className,
  placeholder = 'Type a message...',
  onKeyDown,
  ...props
}: PromptInputTextareaProps) => {
  const [isComposing, setIsComposing] = useState(false);

  const handleKeyDown: KeyboardEventHandler<HTMLTextAreaElement> = e => {
    if (e.key === 'Enter') {
      if (isComposing || e.nativeEvent.isComposing) {
        return;
      }
      if (e.shiftKey) {
        return;
      }
      e.preventDefault();

      const form = e.currentTarget.form;
      const submitButton = form?.querySelector('button[type="submit"]') as HTMLButtonElement | null;
      if (submitButton?.disabled) {
        return;
      }

      form?.requestSubmit();
    }

    onKeyDown?.(e);
  };

  return (
    <Textarea
      className={cn('min-h-16 max-h-48 resize-none', className)}
      onCompositionEnd={() => setIsComposing(false)}
      onCompositionStart={() => setIsComposing(true)}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      {...props}
    />
  );
};

export type PromptInputSubmitProps = ComponentProps<typeof Button> & {
  status?: ChatStatus;
};

export const PromptInputSubmit = ({
  className,
  variant = 'default',
  size = 'icon',
  status,
  children,
  ...props
}: PromptInputSubmitProps) => {
  let Icon = <CornerDownLeftIcon className="size-4" />;

  if (status === 'submitted') {
    Icon = <Loader2Icon className="size-4 animate-spin" />;
  } else if (status === 'streaming') {
    Icon = <SquareIcon className="size-4" />;
  } else if (status === 'error') {
    Icon = <XIcon className="size-4" />;
  }

  return (
    <Button
      aria-label="Submit"
      className={cn(className)}
      size={size}
      type="submit"
      variant={variant}
      {...props}
    >
      {children ?? Icon}
    </Button>
  );
};

export type InputProps = ComponentProps<'form'>;

export const Input = ({ className, ...props }: InputProps) => (
  <form className={cn('relative flex flex-col gap-2', className)} {...props} />
);
