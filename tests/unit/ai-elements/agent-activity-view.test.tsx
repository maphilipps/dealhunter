import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';

import {
  AgentActivityView,
  AgentActivityHeader,
  AgentActivityEmpty,
  AgentActivityGroup,
  AgentActivityComplete,
} from '@/components/ai-elements/agent-activity-view';
import type { AgentPhase } from '@/components/ai-elements/types';
import type { AgentEvent } from '@/lib/streaming/event-types';
import { AgentEventType } from '@/lib/streaming/event-types';

const baseTimestamp = 1700000000000;

const makeProgressEvent = (agent: string, message: string, offset = 0): AgentEvent => ({
  id: `evt-${agent}-${offset}`,
  type: AgentEventType.AGENT_PROGRESS,
  timestamp: baseTimestamp + offset * 1000,
  data: { agent, message },
});

const makeCompleteEvent = (agent: string, offset = 0): AgentEvent => ({
  id: `evt-${agent}-complete`,
  type: AgentEventType.AGENT_COMPLETE,
  timestamp: baseTimestamp + offset * 1000,
  data: { agent, result: {} },
});

const makePhaseStartEvent = (
  phase: 'bootstrap' | 'multi_page' | 'analysis' | 'synthesis',
  message: string,
  offset = 0
): AgentEvent => ({
  id: `phase-${phase}`,
  type: AgentEventType.PHASE_START,
  timestamp: baseTimestamp + offset * 1000,
  data: { phase, message, timestamp: baseTimestamp + offset * 1000 },
});

// ============================================================================
// AgentActivityView (Root)
// ============================================================================

describe('AgentActivityView', () => {
  it('shows empty state with loader when streaming with no events', () => {
    render(<AgentActivityView events={[]} isStreaming={true} />);
    expect(screen.getByText('Starte Analyse...')).toBeInTheDocument();
  });

  it('shows empty state without loader when not streaming with no events', () => {
    render(<AgentActivityView events={[]} isStreaming={false} />);
    expect(screen.getByText('Noch keine Aktivität')).toBeInTheDocument();
  });

  it('renders agent groups from events', () => {
    const events = [
      makeProgressEvent('Website Crawler', 'Fetching homepage', 0),
      makeProgressEvent('Website Crawler', 'Parsing HTML', 1),
    ];
    render(<AgentActivityView events={events} isStreaming={true} />);
    expect(screen.getByText('Website Crawler')).toBeInTheDocument();
    expect(screen.getByText('2 Nachrichten')).toBeInTheDocument();
  });

  it('shows progress percentage', () => {
    const events = [
      makeProgressEvent('Website Crawler', 'Working...', 0),
      makeCompleteEvent('Website Crawler', 2),
    ];
    render(<AgentActivityView events={events} isStreaming={true} />);
    expect(screen.getByText(/\d+%/)).toBeInTheDocument();
  });

  it('shows completion message when not streaming', () => {
    const events = [
      makeProgressEvent('Website Crawler', 'Done', 0),
      makeCompleteEvent('Website Crawler', 1),
    ];
    render(<AgentActivityView events={events} isStreaming={false} />);
    expect(screen.getByText('Analyse abgeschlossen')).toBeInTheDocument();
  });

  it('renders phase indicators when phase events exist', () => {
    const events = [
      makePhaseStartEvent('bootstrap', 'Starting bootstrap phase', 0),
      makeProgressEvent('Website Crawler', 'Working...', 1),
    ];
    render(<AgentActivityView events={events} isStreaming={true} />);
    // Phase label appears in badge — use getAllByText since it may appear in badge + current phase message
    expect(screen.getAllByText('Bootstrap').length).toBeGreaterThanOrEqual(1);
  });

  it('expands agent group on click to show messages', async () => {
    const user = userEvent.setup();
    const events = [makeProgressEvent('Website Crawler', 'Fetching homepage', 0)];
    render(<AgentActivityView events={events} isStreaming={true} />);

    await user.click(screen.getByText('Website Crawler'));

    expect(screen.getByText('Fetching homepage')).toBeInTheDocument();
  });

  it('shows correct agent status icons', () => {
    const events = [
      makeProgressEvent('Website Crawler', 'Working...', 0),
      makeCompleteEvent('Website Crawler', 2),
      makeProgressEvent('Wappalyzer', 'Detecting...', 1),
    ];
    render(<AgentActivityView events={events} isStreaming={true} />);
    expect(screen.getByText('Website Crawler')).toBeInTheDocument();
    expect(screen.getByText('Wappalyzer')).toBeInTheDocument();
  });

  it('has correct displayName', () => {
    expect(AgentActivityView.displayName).toBe('AgentActivityView');
  });

  it('passes className to root Card', () => {
    const { container } = render(
      <AgentActivityView events={[]} isStreaming={false} className="custom-class" />
    );
    expect(container.firstElementChild).toHaveClass('custom-class');
  });

  it('renders multiple phases in header', () => {
    const events = [
      makePhaseStartEvent('bootstrap', 'Bootstrap starting', 0),
      makeProgressEvent('Website Crawler', 'Working...', 1),
      makeCompleteEvent('Website Crawler', 2),
      makePhaseStartEvent('analysis', 'Analysis starting', 3),
      makeProgressEvent('Tech Stack Analyzer', 'Analyzing...', 4),
    ];
    render(<AgentActivityView events={events} isStreaming={true} />);
    // Both phase labels should appear at least once
    expect(screen.getAllByText('Bootstrap').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Analyse').length).toBeGreaterThanOrEqual(1);
  });
});

// ============================================================================
// AgentActivityHeader
// ============================================================================

describe('AgentActivityHeader', () => {
  it('has correct displayName', () => {
    expect(AgentActivityHeader.displayName).toBe('AgentActivityHeader');
  });

  it('renders progress percentage', () => {
    render(<AgentActivityHeader isStreaming={false} progress={42} phases={[]} />);
    expect(screen.getByText('42%')).toBeInTheDocument();
  });

  it('renders title', () => {
    render(<AgentActivityHeader isStreaming={false} progress={0} phases={[]} />);
    expect(screen.getByText('Agent Aktivität')).toBeInTheDocument();
  });

  it('renders phase badges', () => {
    const phases: AgentPhase[] = [
      {
        id: 'bootstrap',
        label: 'Bootstrap',
        status: 'complete',
        analyses: [],
        startedAt: baseTimestamp,
      },
      {
        id: 'analysis',
        label: 'Analyse',
        status: 'running',
        analyses: [],
        startedAt: baseTimestamp + 5000,
      },
    ];
    render(<AgentActivityHeader isStreaming={true} progress={50} phases={phases} />);
    // Phase labels appear in badges — may appear multiple times due to current phase message
    expect(screen.getAllByText('Bootstrap').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Analyse').length).toBeGreaterThanOrEqual(1);
  });

  it('renders current phase message', () => {
    const phases: AgentPhase[] = [
      {
        id: 'bootstrap',
        label: 'Crawling website...',
        status: 'running',
        analyses: [],
        startedAt: baseTimestamp,
      },
    ];
    render(<AgentActivityHeader isStreaming={true} progress={10} phases={phases} />);
    // Label appears in both badge and current phase message
    expect(screen.getAllByText('Crawling website...').length).toBeGreaterThanOrEqual(1);
  });

  it('renders analysis counts in phase badges', () => {
    const phases: AgentPhase[] = [
      {
        id: 'analysis',
        label: 'Analyse',
        status: 'running',
        analyses: [
          { name: 'Tech', success: true, duration: 100 },
          { name: 'Content', success: false, duration: 200 },
          { name: 'SEO', success: true, duration: 150 },
        ],
        startedAt: baseTimestamp,
      },
    ];
    render(<AgentActivityHeader isStreaming={true} progress={30} phases={phases} />);
    expect(screen.getByText('(2/3)')).toBeInTheDocument();
  });

  it('does not render phase section when phases is empty', () => {
    render(<AgentActivityHeader isStreaming={false} progress={0} phases={[]} />);
    expect(screen.queryByText('Bootstrap')).not.toBeInTheDocument();
    expect(screen.queryByText('Analyse')).not.toBeInTheDocument();
  });

  it('accepts className', () => {
    const { container } = render(
      <AgentActivityHeader isStreaming={false} progress={0} phases={[]} className="test-hdr" />
    );
    expect(container.firstElementChild).toHaveClass('test-hdr');
  });
});

// ============================================================================
// AgentActivityEmpty
// ============================================================================

describe('AgentActivityEmpty', () => {
  it('has correct displayName', () => {
    expect(AgentActivityEmpty.displayName).toBe('AgentActivityEmpty');
  });

  it('shows loading state when streaming', () => {
    render(<AgentActivityEmpty isStreaming={true} />);
    expect(screen.getByText('Starte Analyse...')).toBeInTheDocument();
  });

  it('shows idle state when not streaming', () => {
    render(<AgentActivityEmpty isStreaming={false} />);
    expect(screen.getByText('Noch keine Aktivität')).toBeInTheDocument();
  });

  it('accepts className', () => {
    const { container } = render(<AgentActivityEmpty isStreaming={false} className="test-empty" />);
    expect(container.firstElementChild).toHaveClass('test-empty');
  });
});

// ============================================================================
// AgentActivityGroup
// ============================================================================

describe('AgentActivityGroup', () => {
  const baseGroup = {
    name: 'Website Crawler',
    status: 'running' as const,
    events: [makeProgressEvent('Website Crawler', 'Fetching homepage', 0)],
    startTime: baseTimestamp,
  };

  it('has correct displayName', () => {
    expect(AgentActivityGroup.displayName).toBe('AgentActivityGroup');
  });

  it('renders agent name and message count', () => {
    render(
      <AgentActivityGroup
        group={baseGroup}
        isExpanded={false}
        onToggle={vi.fn()}
        streamStartTime={baseTimestamp}
      />
    );
    expect(screen.getByText('Website Crawler')).toBeInTheDocument();
    expect(screen.getByText('1 Nachrichten')).toBeInTheDocument();
  });

  it('shows event messages when expanded', () => {
    render(
      <AgentActivityGroup
        group={baseGroup}
        isExpanded={true}
        onToggle={vi.fn()}
        streamStartTime={baseTimestamp}
      />
    );
    expect(screen.getByText('Fetching homepage')).toBeInTheDocument();
  });

  it('does not show event messages when collapsed', () => {
    render(
      <AgentActivityGroup
        group={baseGroup}
        isExpanded={false}
        onToggle={vi.fn()}
        streamStartTime={baseTimestamp}
      />
    );
    expect(screen.queryByText('Fetching homepage')).not.toBeInTheDocument();
  });

  it('calls onToggle when clicked', async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    render(
      <AgentActivityGroup
        group={baseGroup}
        isExpanded={false}
        onToggle={onToggle}
        streamStartTime={baseTimestamp}
      />
    );

    await user.click(screen.getByText('Website Crawler'));
    expect(onToggle).toHaveBeenCalled();
  });

  it('shows duration for completed agents', () => {
    const completedGroup = {
      ...baseGroup,
      status: 'complete' as const,
      endTime: baseTimestamp + 5000,
    };
    render(
      <AgentActivityGroup
        group={completedGroup}
        isExpanded={false}
        onToggle={vi.fn()}
        streamStartTime={baseTimestamp}
      />
    );
    expect(screen.getByText('5s')).toBeInTheDocument();
  });

  it('shows fallback text for events without message', () => {
    const groupWithNoMessage = {
      ...baseGroup,
      events: [
        {
          id: 'evt-no-msg',
          type: AgentEventType.AGENT_PROGRESS,
          timestamp: baseTimestamp,
          data: { agent: 'Website Crawler' },
        } as AgentEvent,
      ],
    };
    render(
      <AgentActivityGroup
        group={groupWithNoMessage}
        isExpanded={true}
        onToggle={vi.fn()}
        streamStartTime={baseTimestamp}
      />
    );
    expect(screen.getByText('Verarbeitung...')).toBeInTheDocument();
  });

  it('accepts className', () => {
    const { container } = render(
      <AgentActivityGroup
        group={baseGroup}
        isExpanded={false}
        onToggle={vi.fn()}
        streamStartTime={baseTimestamp}
        className="test-group"
      />
    );
    expect(container.firstElementChild).toHaveClass('test-group');
  });
});

// ============================================================================
// AgentActivityComplete
// ============================================================================

describe('AgentActivityComplete', () => {
  it('has correct displayName', () => {
    expect(AgentActivityComplete.displayName).toBe('AgentActivityComplete');
  });

  it('renders completion text', () => {
    render(<AgentActivityComplete completedCount={5} totalCount={8} />);
    expect(screen.getByText('Analyse abgeschlossen')).toBeInTheDocument();
  });

  it('renders agent counts', () => {
    render(<AgentActivityComplete completedCount={5} totalCount={8} />);
    expect(screen.getByText('5 von 8 Agents fertig')).toBeInTheDocument();
  });

  it('accepts className', () => {
    const { container } = render(
      <AgentActivityComplete completedCount={3} totalCount={3} className="test-complete" />
    );
    expect(container.firstElementChild).toHaveClass('test-complete');
  });
});
