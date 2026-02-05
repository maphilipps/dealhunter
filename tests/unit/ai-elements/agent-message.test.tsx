import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import {
  AgentMessage,
  AgentMessageHeader,
  AgentMessageContent,
  AgentMessageActions,
} from '@/components/ai-elements/agent-message';
import type { AgentEvent } from '@/lib/streaming/event-types';
import { AgentEventType } from '@/lib/streaming/event-types';

// Mock streamdown
vi.mock('streamdown', () => ({
  Streamdown: ({ children }: { children: string }) => <div>{children}</div>,
}));

const makeProgressEvent = (
  overrides: Partial<{
    agent: string;
    message: string;
    details: string;
    reasoning: string;
    confidence: number;
    toolCalls: Array<{ name: string; args: Record<string, unknown> }>;
    sources: Array<{
      type: 'reference' | 'competitor' | 'technology';
      title: string;
      content?: string;
    }>;
  }> = {}
): AgentEvent => ({
  id: 'evt-1',
  type: AgentEventType.AGENT_PROGRESS,
  timestamp: Date.now(),
  data: {
    agent: 'Tech Stack Analyzer',
    message: 'Analyzing tech stack...',
    ...overrides,
  },
});

const makeCompleteEvent = (
  overrides: Partial<{
    agent: string;
    result: unknown;
    confidence: number;
  }> = {}
): AgentEvent => ({
  id: 'evt-2',
  type: AgentEventType.AGENT_COMPLETE,
  timestamp: Date.now(),
  data: {
    agent: 'Tech Stack Analyzer',
    result: { cms: 'Drupal' },
    ...overrides,
  },
});

describe('AgentMessage', () => {
  it('renders progress event with agent name and message', () => {
    render(<AgentMessage event={makeProgressEvent()} />);
    expect(screen.getByText('Tech Stack Analyzer')).toBeInTheDocument();
    expect(screen.getByText('Analyzing tech stack...')).toBeInTheDocument();
  });

  it('renders complete event with agent name', () => {
    render(<AgentMessage event={makeCompleteEvent()} />);
    expect(screen.getByText('Tech Stack Analyzer')).toBeInTheDocument();
  });

  it('returns null for non-progress/complete events', () => {
    const event: AgentEvent = {
      id: 'evt-3',
      type: AgentEventType.START,
      timestamp: Date.now(),
    };
    const { container } = render(<AgentMessage event={event} />);
    expect(container.firstChild).toBeNull();
  });

  it('returns null for progress event without valid data', () => {
    const event: AgentEvent = {
      id: 'evt-4',
      type: AgentEventType.AGENT_PROGRESS,
      timestamp: Date.now(),
      data: 'invalid',
    };
    const { container } = render(<AgentMessage event={event} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders details when provided', () => {
    render(<AgentMessage event={makeProgressEvent({ details: 'Found Drupal 10' })} />);
    expect(screen.getByText('Found Drupal 10')).toBeInTheDocument();
  });

  it('renders confidence indicator when provided', () => {
    render(<AgentMessage event={makeProgressEvent({ confidence: 85 })} />);
    expect(screen.getByText('85%')).toBeInTheDocument();
  });

  it('renders tool calls when provided', () => {
    render(
      <AgentMessage
        event={makeProgressEvent({
          toolCalls: [{ name: 'webSearch', args: { query: 'drupal', limit: 10 } }],
        })}
      />
    );
    expect(screen.getByText('webSearch')).toBeInTheDocument();
    expect(screen.getByText('(query, limit)')).toBeInTheDocument();
  });

  it('renders reasoning section when provided', () => {
    render(<AgentMessage event={makeProgressEvent({ reasoning: 'Based on headers...' })} />);
    expect(screen.getByText('Begründung')).toBeInTheDocument();
  });

  it('renders copy button', () => {
    render(<AgentMessage event={makeProgressEvent()} />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('has correct displayName', () => {
    expect(AgentMessage.displayName).toBe('AgentMessage');
  });
});

describe('AgentMessageHeader', () => {
  it('renders agent name in badge', () => {
    render(<AgentMessageHeader agent="CMS Scanner" timestamp={Date.now()} />);
    expect(screen.getByText('CMS Scanner')).toBeInTheDocument();
  });

  it('renders formatted timestamp', () => {
    const ts = new Date('2026-01-15T14:30:45').getTime();
    render(<AgentMessageHeader agent="Scanner" timestamp={ts} />);
    expect(screen.getByText('14:30:45')).toBeInTheDocument();
  });

  it('accepts className prop', () => {
    const { container } = render(
      <AgentMessageHeader agent="Scanner" timestamp={Date.now()} className="custom-class" />
    );
    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('has correct displayName', () => {
    expect(AgentMessageHeader.displayName).toBe('AgentMessageHeader');
  });
});

describe('AgentMessageContent', () => {
  it('renders message text', () => {
    render(<AgentMessageContent message="Processing..." />);
    expect(screen.getByText('Processing...')).toBeInTheDocument();
  });

  it('renders details text', () => {
    render(<AgentMessageContent details="Found 3 modules" />);
    expect(screen.getByText('Found 3 modules')).toBeInTheDocument();
  });

  it('renders confidence indicator', () => {
    render(<AgentMessageContent confidence={92} />);
    expect(screen.getByText('92%')).toBeInTheDocument();
  });

  it('renders tool calls', () => {
    render(
      <AgentMessageContent
        toolCalls={[{ name: 'fetchPage', args: { url: 'https://example.com' } }]}
      />
    );
    expect(screen.getByText('fetchPage')).toBeInTheDocument();
    expect(screen.getByText('(url)')).toBeInTheDocument();
  });

  it('renders reasoning section', () => {
    render(<AgentMessageContent reasoning="Because of X..." />);
    expect(screen.getByText('Begründung')).toBeInTheDocument();
  });

  it('renders nothing when no props provided', () => {
    const { container } = render(<AgentMessageContent />);
    expect(container.firstChild).toBeEmptyDOMElement();
  });

  it('accepts className prop', () => {
    const { container } = render(<AgentMessageContent className="extra" />);
    expect(container.firstChild).toHaveClass('extra');
  });

  it('has correct displayName', () => {
    expect(AgentMessageContent.displayName).toBe('AgentMessageContent');
  });
});

describe('AgentMessageActions', () => {
  it('renders copy button', () => {
    render(<AgentMessageActions onCopy={() => {}} copied={false} />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('shows check icon when copied', () => {
    const { container } = render(<AgentMessageActions onCopy={() => {}} copied={true} />);
    // Check icon has text-green-600 class
    const svg = container.querySelector('svg');
    expect(svg).toHaveClass('text-green-600');
  });

  it('calls onCopy when button clicked', async () => {
    const { default: userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();
    const handleCopy = vi.fn();
    render(<AgentMessageActions onCopy={handleCopy} copied={false} />);
    await user.click(screen.getByRole('button'));
    expect(handleCopy).toHaveBeenCalledOnce();
  });

  it('has correct displayName', () => {
    expect(AgentMessageActions.displayName).toBe('AgentMessageActions');
  });
});
