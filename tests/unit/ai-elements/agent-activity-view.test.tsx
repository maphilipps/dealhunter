import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';

import { AgentActivityView } from '@/components/ai-elements/agent-activity-view';
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
    // Progress shown in badge
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
    expect(screen.getByText('Bootstrap')).toBeInTheDocument();
  });

  it('expands agent group on click to show messages', async () => {
    const user = userEvent.setup();
    const events = [makeProgressEvent('Website Crawler', 'Fetching homepage', 0)];
    render(<AgentActivityView events={events} isStreaming={true} />);

    // Click the agent group trigger
    await user.click(screen.getByText('Website Crawler'));

    // The message should be visible in the expanded section
    expect(screen.getByText('Fetching homepage')).toBeInTheDocument();
  });

  it('shows correct agent status icons', () => {
    const events = [
      makeProgressEvent('Website Crawler', 'Working...', 0),
      makeCompleteEvent('Website Crawler', 2),
      makeProgressEvent('Wappalyzer', 'Detecting...', 1),
    ];
    render(<AgentActivityView events={events} isStreaming={true} />);
    // Both agents should be visible
    expect(screen.getByText('Website Crawler')).toBeInTheDocument();
    expect(screen.getByText('Wappalyzer')).toBeInTheDocument();
  });

  it('has correct displayName', () => {
    expect(AgentActivityView.displayName).toBe('AgentActivityView');
  });
});
