import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';

import { Reasoning, ReasoningTrigger, ReasoningContent } from '@/components/ai-elements/reasoning';

// Mock streamdown to avoid markdown parsing complexity
vi.mock('streamdown', () => ({
  Streamdown: ({ children, className }: { children: string; className?: string }) => (
    <div className={className} data-testid="streamdown">
      {children}
    </div>
  ),
}));

describe('Reasoning', () => {
  it('renders children', () => {
    render(
      <Reasoning>
        <ReasoningTrigger />
        <ReasoningContent>Some reasoning text</ReasoningContent>
      </Reasoning>
    );
    expect(screen.getByText('Some reasoning text')).toBeInTheDocument();
  });

  it('is open by default (defaultOpen=true)', () => {
    render(
      <Reasoning>
        <ReasoningTrigger />
        <ReasoningContent>Content here</ReasoningContent>
      </Reasoning>
    );
    expect(screen.getByText('Content here')).toBeVisible();
  });

  it('can be closed by default', () => {
    render(
      <Reasoning defaultOpen={false}>
        <ReasoningTrigger />
        <ReasoningContent>Hidden content</ReasoningContent>
      </Reasoning>
    );
    // When closed, Radix Collapsible removes content from DOM
    expect(screen.queryByText('Hidden content')).not.toBeInTheDocument();
  });

  it('calls onOpenChange when toggled', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(
      <Reasoning defaultOpen={false} onOpenChange={onOpenChange}>
        <ReasoningTrigger />
        <ReasoningContent>Content</ReasoningContent>
      </Reasoning>
    );

    await user.click(screen.getByRole('button'));
    expect(onOpenChange).toHaveBeenCalled();
  });

  it('has correct displayName', () => {
    expect(Reasoning.displayName).toBe('Reasoning');
  });
});

describe('ReasoningTrigger', () => {
  it('shows streaming message when isStreaming', () => {
    render(
      <Reasoning isStreaming={true}>
        <ReasoningTrigger />
        <ReasoningContent>text</ReasoningContent>
      </Reasoning>
    );
    expect(screen.getByText('Denke nach...')).toBeInTheDocument();
  });

  it('shows default message when not streaming and no duration', () => {
    render(
      <Reasoning defaultOpen={false}>
        <ReasoningTrigger />
        <ReasoningContent>text</ReasoningContent>
      </Reasoning>
    );
    expect(screen.getByText('Hat einige Sekunden nachgedacht')).toBeInTheDocument();
  });

  it('shows duration message when duration is provided', () => {
    render(
      <Reasoning duration={5}>
        <ReasoningTrigger />
        <ReasoningContent>text</ReasoningContent>
      </Reasoning>
    );
    expect(screen.getByText('Hat 5 Sekunden nachgedacht')).toBeInTheDocument();
  });

  it('accepts custom getThinkingMessage', () => {
    render(
      <Reasoning>
        <ReasoningTrigger getThinkingMessage={() => <span>Custom message</span>} />
        <ReasoningContent>text</ReasoningContent>
      </Reasoning>
    );
    expect(screen.getByText('Custom message')).toBeInTheDocument();
  });

  it('renders custom children instead of default content', () => {
    render(
      <Reasoning>
        <ReasoningTrigger>
          <span>Custom trigger</span>
        </ReasoningTrigger>
        <ReasoningContent>text</ReasoningContent>
      </Reasoning>
    );
    expect(screen.getByText('Custom trigger')).toBeInTheDocument();
  });

  it('has correct displayName', () => {
    expect(ReasoningTrigger.displayName).toBe('ReasoningTrigger');
  });
});

describe('ReasoningContent', () => {
  it('renders markdown content via Streamdown', () => {
    render(
      <Reasoning>
        <ReasoningTrigger />
        <ReasoningContent>Some **markdown** content</ReasoningContent>
      </Reasoning>
    );
    expect(screen.getByTestId('streamdown')).toHaveTextContent('Some **markdown** content');
  });

  it('has correct displayName', () => {
    expect(ReasoningContent.displayName).toBe('ReasoningContent');
  });
});
