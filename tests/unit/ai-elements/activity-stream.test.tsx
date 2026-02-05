import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { ActivityStream } from '@/components/ai-elements/activity-stream';
import { AgentEventType } from '@/lib/streaming/event-types';

// Mock streamdown
vi.mock('streamdown', () => ({
  Streamdown: ({ children }: { children: string }) => <div>{children}</div>,
}));

const mockStart = vi.fn();
const mockAbort = vi.fn();

// Create a factory that returns fresh state per test
let mockState: {
  events: Array<{ id: string; type: string; timestamp: number; data?: unknown }>;
  isStreaming: boolean;
  error: string | null;
  decision: unknown;
  urlSuggestion: { suggestedUrl: string; reason: string } | null;
  start: typeof mockStart;
  abort: typeof mockAbort;
};

vi.mock('@/hooks/use-agent-stream', () => ({
  useAgentStream: () => mockState,
}));

describe('ActivityStream', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // jsdom doesn't implement scrollIntoView
    Element.prototype.scrollIntoView = vi.fn();
    mockState = {
      events: [],
      isStreaming: false,
      error: null,
      decision: null,
      urlSuggestion: null,
      start: mockStart,
      abort: mockAbort,
    };
  });

  it('renders with default title', () => {
    render(<ActivityStream streamUrl="/api/stream" />);
    expect(screen.getByText('Agent Activity')).toBeInTheDocument();
  });

  it('renders with custom title', () => {
    render(<ActivityStream streamUrl="/api/stream" title="Scan Progress" />);
    expect(screen.getByText('Scan Progress')).toBeInTheDocument();
  });

  it('shows empty state when no events and not streaming', () => {
    render(<ActivityStream streamUrl="/api/stream" />);
    expect(screen.getByText('Noch keine Aktivität')).toBeInTheDocument();
  });

  it('shows loading state when streaming with no events', () => {
    mockState.isStreaming = true;
    render(<ActivityStream streamUrl="/api/stream" />);
    expect(screen.getByText('Starte Analyse...')).toBeInTheDocument();
  });

  it('shows error alert when error occurs', () => {
    mockState.error = 'Connection failed';
    render(<ActivityStream streamUrl="/api/stream" />);
    expect(screen.getByText('Fehler')).toBeInTheDocument();
    expect(screen.getByText('Connection failed')).toBeInTheDocument();
  });

  it('shows completion alert when streaming finishes with events', () => {
    mockState.events = [
      {
        id: 'evt-1',
        type: AgentEventType.AGENT_PROGRESS,
        timestamp: Date.now(),
        data: { agent: 'Test', message: 'Done' },
      },
    ];
    render(<ActivityStream streamUrl="/api/stream" />);
    expect(screen.getByText('Analyse abgeschlossen')).toBeInTheDocument();
  });

  it('auto-starts when autoStart is true', () => {
    render(<ActivityStream streamUrl="/api/stream" autoStart />);
    expect(mockStart).toHaveBeenCalledWith('/api/stream');
  });

  it('does not auto-start when autoStart is false', () => {
    render(<ActivityStream streamUrl="/api/stream" autoStart={false} />);
    expect(mockStart).not.toHaveBeenCalled();
  });

  it('shows URL suggestion when available with error', () => {
    mockState.error = 'Redirect detected';
    mockState.urlSuggestion = {
      suggestedUrl: 'https://example.com/new',
      reason: 'Site redirected',
    };
    render(<ActivityStream streamUrl="/api/stream" />);
    expect(screen.getByText('Vorgeschlagene URL:')).toBeInTheDocument();
    expect(screen.getByText('https://example.com/new')).toBeInTheDocument();
  });

  it('renders grouped view when grouped prop is true', () => {
    mockState.isStreaming = true;
    render(<ActivityStream streamUrl="/api/stream" grouped />);
    // Grouped view uses AgentActivityView which shows "Agent Aktivität"
    expect(screen.getByText('Agent Aktivität')).toBeInTheDocument();
  });

  it('has correct displayName', () => {
    expect(ActivityStream.displayName).toBe('ActivityStream');
  });
});
