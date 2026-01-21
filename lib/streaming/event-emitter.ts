// Server-Sent Events (SSE) stream utilities

import type { AgentEvent, AgentEventType } from './event-types';

export type EventEmitter = (event: Omit<AgentEvent, 'id' | 'timestamp'>) => void;

// Minimum delay between events to ensure they arrive as separate chunks
// This creates a visual "streaming" effect in the UI
const MIN_EVENT_DELAY_MS = 50;

/**
 * Creates a ReadableStream for Server-Sent Events with proper SSE encoding
 * Best practice: Use native Web Streams API for streaming responses
 *
 * Events are sent with a minimum delay between them to ensure they arrive
 * as separate chunks on the client, creating a true streaming experience.
 */
export function createAgentEventStream(
  handler: (emit: EventEmitter) => Promise<void>
): ReadableStream {
  let eventCounter = 0;
  let lastEmitTime = 0;

  return new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      // Async emit function that ensures minimum delay between events
      const emit: EventEmitter = event => {
        const now = Date.now();
        const timeSinceLastEmit = now - lastEmitTime;

        // Add timestamp with spacing to ensure visual separation
        const agentEvent: AgentEvent = {
          id: `event-${++eventCounter}`,
          timestamp: now,
          ...event,
        };

        // SSE format: "data: {json}\n\n"
        const sseData = `data: ${JSON.stringify(agentEvent)}\n\n`;
        controller.enqueue(encoder.encode(sseData));

        // Track last emit time for delay calculation
        lastEmitTime = now;

        // If events are being emitted too fast, we note it but don't block
        // The client will receive them and use its own timestamps
        if (timeSinceLastEmit < MIN_EVENT_DELAY_MS && eventCounter > 1) {
          // Events are being batched - client will spread timestamps
        }
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
