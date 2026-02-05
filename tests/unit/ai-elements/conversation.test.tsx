import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
} from '@/components/ai-elements/conversation';

// Mock use-stick-to-bottom since it requires browser APIs
vi.mock('use-stick-to-bottom', () => ({
  StickToBottom: ({ children, className, role, ...props }: React.ComponentProps<'div'>) => (
    <div className={className} role={role} data-testid="stick-to-bottom" {...props}>
      {children}
    </div>
  ),
  useStickToBottomContext: () => ({
    isAtBottom: true,
    scrollToBottom: vi.fn(),
  }),
}));

// Add Content as a static property after mock
const StickToBottomMock = await import('use-stick-to-bottom');
(StickToBottomMock.StickToBottom as Record<string, unknown>).Content = ({
  children,
  className,
  ...props
}: React.ComponentProps<'div'>) => (
  <div className={className} data-testid="stick-to-bottom-content" {...props}>
    {children}
  </div>
);

describe('Conversation', () => {
  it('renders with role="log" for accessibility', () => {
    render(<Conversation>Content</Conversation>);
    expect(screen.getByRole('log')).toBeInTheDocument();
  });

  it('renders children', () => {
    render(<Conversation>Hello</Conversation>);
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });

  it('has correct displayName', () => {
    expect(Conversation.displayName).toBe('Conversation');
  });
});

describe('ConversationContent', () => {
  it('renders children', () => {
    render(<ConversationContent>Messages here</ConversationContent>);
    expect(screen.getByText('Messages here')).toBeInTheDocument();
  });

  it('has correct displayName', () => {
    expect(ConversationContent.displayName).toBe('ConversationContent');
  });
});

describe('ConversationEmptyState', () => {
  it('renders default German title', () => {
    render(<ConversationEmptyState />);
    expect(screen.getByText('Noch keine Nachrichten')).toBeInTheDocument();
  });

  it('renders default German description', () => {
    render(<ConversationEmptyState />);
    expect(
      screen.getByText('Starten Sie eine Unterhaltung, um Nachrichten zu sehen')
    ).toBeInTheDocument();
  });

  it('renders custom title and description', () => {
    render(<ConversationEmptyState title="No data" description="Start fresh" />);
    expect(screen.getByText('No data')).toBeInTheDocument();
    expect(screen.getByText('Start fresh')).toBeInTheDocument();
  });

  it('renders icon when provided', () => {
    render(<ConversationEmptyState icon={<span data-testid="icon">I</span>} />);
    expect(screen.getByTestId('icon')).toBeInTheDocument();
  });

  it('renders children instead of default layout', () => {
    render(
      <ConversationEmptyState>
        <div data-testid="custom">Custom empty state</div>
      </ConversationEmptyState>
    );
    expect(screen.getByTestId('custom')).toBeInTheDocument();
    expect(screen.queryByText('Noch keine Nachrichten')).not.toBeInTheDocument();
  });

  it('has correct displayName', () => {
    expect(ConversationEmptyState.displayName).toBe('ConversationEmptyState');
  });
});
