import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Mock streaming event types
vi.mock('@/lib/streaming/in-process/event-types', () => ({
  AgentEventType: {
    STEP_START: 'step-start',
    STEP_COMPLETE: 'step-complete',
    WORKFLOW_PROGRESS: 'workflow-progress',
    COMPLETE: 'complete',
    ERROR: 'error',
    AGENT_COMPLETE: 'agent-complete',
  },
}));

import {
  useQualificationScanProgress,
  type QualificationScanProgressState,
} from '@/hooks/use-qualification-scan-progress';

// Mock EventSource
class MockEventSource {
  url: string;
  onopen: ((this: EventSource, ev: Event) => void) | null = null;
  onmessage: ((this: EventSource, ev: MessageEvent) => void) | null = null;
  onerror: ((this: EventSource, ev: Event) => void) | null = null;
  readyState = 0;

  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
  }

  close = vi.fn();

  // Helpers for testing
  simulateOpen() {
    this.readyState = 1;
    this.onopen?.call(this as unknown as EventSource, new Event('open'));
  }

  simulateMessage(data: unknown) {
    this.onmessage?.call(
      this as unknown as EventSource,
      { data: JSON.stringify(data) } as MessageEvent
    );
  }

  simulateError() {
    this.onerror?.call(this as unknown as EventSource, new Event('error'));
  }

  static instances: MockEventSource[] = [];
  static reset() {
    MockEventSource.instances = [];
  }
  static latest() {
    return MockEventSource.instances[MockEventSource.instances.length - 1];
  }
}

describe('useQualificationScanProgress', () => {
  beforeEach(() => {
    MockEventSource.reset();
    vi.useFakeTimers();
    (globalThis as Record<string, unknown>).EventSource = MockEventSource as never;
  });

  afterEach(() => {
    vi.useRealTimers();
    delete (globalThis as Record<string, unknown>).EventSource;
  });

  it('should start in idle state when qualificationId is null', () => {
    const { result } = renderHook(() => useQualificationScanProgress(null));
    expect(result.current.status).toBe('idle');
    expect(result.current.isConnected).toBe(false);
    expect(MockEventSource.instances).toHaveLength(0);
  });

  it('should connect to SSE when qualificationId is provided', () => {
    const { result } = renderHook(() => useQualificationScanProgress('q1'));
    expect(result.current.status).toBe('connecting');
    expect(MockEventSource.instances).toHaveLength(1);
    expect(MockEventSource.latest().url).toContain('/api/qualifications/q1/quick-scan/stream');
  });

  it('should set running state on open', () => {
    const { result } = renderHook(() => useQualificationScanProgress('q1'));

    act(() => {
      MockEventSource.latest().simulateOpen();
    });

    expect(result.current.status).toBe('running');
    expect(result.current.isConnected).toBe(true);
  });

  it('should handle STEP_START event', () => {
    const { result } = renderHook(() => useQualificationScanProgress('q1'));

    act(() => {
      MockEventSource.latest().simulateOpen();
      MockEventSource.latest().simulateMessage({
        type: 'step-start',
        data: {
          stepId: 'tech-stack',
          stepName: 'Tech Stack Detection',
          phase: 'analysis',
          timestamp: Date.now(),
        },
      });
    });

    expect(result.current.steps.get('tech-stack')).toBeDefined();
    expect(result.current.steps.get('tech-stack')?.status).toBe('running');
    expect(result.current.currentSteps).toContain('tech-stack');
    expect(result.current.currentMessage).toContain('Tech Stack Detection');
  });

  it('should handle STEP_COMPLETE event', () => {
    const onStepComplete = vi.fn();
    const { result } = renderHook(() => useQualificationScanProgress('q1', { onStepComplete }));

    act(() => {
      MockEventSource.latest().simulateOpen();
      MockEventSource.latest().simulateMessage({
        type: 'step-start',
        data: {
          stepId: 'tech-stack',
          stepName: 'Tech Stack',
          phase: 'analysis',
          timestamp: Date.now(),
        },
      });
      MockEventSource.latest().simulateMessage({
        type: 'step-complete',
        data: {
          stepId: 'tech-stack',
          stepName: 'Tech Stack',
          phase: 'analysis',
          success: true,
          duration: 1500,
          result: { cms: 'Drupal' },
        },
      });
    });

    expect(result.current.steps.get('tech-stack')?.status).toBe('completed');
    expect(result.current.completedSteps).toContain('tech-stack');
    expect(result.current.currentSteps).not.toContain('tech-stack');
    expect(onStepComplete).toHaveBeenCalledWith('tech-stack', { cms: 'Drupal' });
  });

  it('should handle failed STEP_COMPLETE event', () => {
    const { result } = renderHook(() => useQualificationScanProgress('q1'));

    act(() => {
      MockEventSource.latest().simulateOpen();
      MockEventSource.latest().simulateMessage({
        type: 'step-complete',
        data: {
          stepId: 'seo',
          stepName: 'SEO Audit',
          phase: 'analysis',
          success: false,
          duration: 500,
          error: 'Timeout',
        },
      });
    });

    expect(result.current.steps.get('seo')?.status).toBe('failed');
    expect(result.current.completedSteps).not.toContain('seo');
  });

  it('should handle WORKFLOW_PROGRESS event', () => {
    const { result } = renderHook(() => useQualificationScanProgress('q1'));

    act(() => {
      MockEventSource.latest().simulateOpen();
      MockEventSource.latest().simulateMessage({
        type: 'workflow-progress',
        data: {
          phase: 'analysis',
          completedSteps: 3,
          totalSteps: 10,
          currentSteps: ['tech-stack', 'seo'],
          percentage: 30,
        },
      });
    });

    expect(result.current.progress).toBe(30);
    expect(result.current.totalSteps).toBe(10);
    expect(result.current.currentSteps).toEqual(['tech-stack', 'seo']);
  });

  it('should handle COMPLETE event', () => {
    const onComplete = vi.fn();
    const { result } = renderHook(() => useQualificationScanProgress('q1', { onComplete }));

    act(() => {
      MockEventSource.latest().simulateOpen();
      MockEventSource.latest().simulateMessage({ type: 'complete' });
    });

    expect(result.current.status).toBe('completed');
    expect(result.current.progress).toBe(100);
    expect(result.current.isConnected).toBe(false);
    expect(onComplete).toHaveBeenCalled();
    expect(MockEventSource.latest().close).toHaveBeenCalled();
  });

  it('should handle ERROR event', () => {
    const onError = vi.fn();
    const { result } = renderHook(() => useQualificationScanProgress('q1', { onError }));

    act(() => {
      MockEventSource.latest().simulateOpen();
      MockEventSource.latest().simulateMessage({
        type: 'error',
        data: { message: 'Something went wrong' },
      });
    });

    expect(result.current.status).toBe('error');
    expect(result.current.error).toBe('Something went wrong');
    expect(onError).toHaveBeenCalledWith('Something went wrong');
  });

  it('should handle AGENT_COMPLETE for backwards compatibility', () => {
    const onComplete = vi.fn();
    const { result } = renderHook(() => useQualificationScanProgress('q1', { onComplete }));

    act(() => {
      MockEventSource.latest().simulateOpen();
      MockEventSource.latest().simulateMessage({ type: 'agent-complete' });
    });

    expect(result.current.status).toBe('completed');
    expect(onComplete).toHaveBeenCalled();
  });

  it('should disconnect on unmount', () => {
    const { unmount } = renderHook(() => useQualificationScanProgress('q1'));

    const es = MockEventSource.latest();
    unmount();
    expect(es.close).toHaveBeenCalled();
  });

  it('should ignore invalid JSON in messages', () => {
    const { result } = renderHook(() => useQualificationScanProgress('q1'));

    act(() => {
      MockEventSource.latest().simulateOpen();
      // Send invalid JSON
      MockEventSource.latest().onmessage?.call(
        MockEventSource.latest() as unknown as EventSource,
        { data: 'not-json' } as MessageEvent
      );
    });

    // State should remain unchanged (running, no error)
    expect(result.current.status).toBe('running');
    expect(result.current.error).toBeNull();
  });
});
