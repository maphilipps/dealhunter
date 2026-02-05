import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { AgentMessage } from '@/components/ai-elements/agent-message';
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
