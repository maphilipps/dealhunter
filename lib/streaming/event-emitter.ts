// Server-Sent Events (SSE) stream utilities

import type { AgentEvent, AgentEventType } from './event-types';

export type EventEmitter = (event: Omit<AgentEvent, 'id' | 'timestamp'>) => void;

/**
 * Creates a ReadableStream for Server-Sent Events with proper SSE encoding
 * Best practice: Use native Web Streams API for streaming responses
 */
export function createAgentEventStream(
  handler: (emit: EventEmitter) => Promise<void>
): ReadableStream {
  let eventCounter = 0;

  return new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      const emit: EventEmitter = (event) => {
        const agentEvent: AgentEvent = {
          id: `event-${++eventCounter}`,
          timestamp: Date.now(),
          ...event,
        };

        // SSE format: "data: {json}\n\n"
        const sseData = `data: ${JSON.stringify(agentEvent)}\n\n`;
        controller.enqueue(encoder.encode(sseData));
      };

      try {
        await handler(emit);

        // Send final completion event
        emit({ type: 'complete' as AgentEventType });
      } catch (error) {
        // Send error event
        emit({
          type: 'error' as AgentEventType,
          data: {
            message: error instanceof Error ? error.message : 'Unknown error',
            code: 'STREAM_ERROR',
          },
        });
      } finally {
        controller.close();
      }
    },

    cancel() {
      // Handle client disconnect
      console.log('Stream cancelled by client');
    },
  });
}

/**
 * Helper to create SSE response with proper headers
 */
export function createSSEResponse(stream: ReadableStream): Response {
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    },
  });
}
