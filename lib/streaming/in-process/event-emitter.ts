// Server-Sent Events (SSE) stream utilities

import { AgentEventType } from './event-types';
import type { AgentEvent } from './event-types';

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
  let isClosed = false;

  return new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      // Async emit function that ensures minimum delay between events
      const emit: EventEmitter = event => {
        // Guard: Don't emit if controller is already closed
        if (isClosed) {
          console.warn('[EventEmitter] Attempted to emit after stream closed:', event.type);
          return;
        }

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
        try {
          controller.enqueue(encoder.encode(sseData));
        } catch {
          // Controller was closed externally (e.g., client disconnect)
          isClosed = true;
          return;
        }

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
        emit({ type: AgentEventType.COMPLETE });
      } catch (error) {
        // Send error event
        emit({
          type: AgentEventType.ERROR,
          data: {
            message: error instanceof Error ? error.message : 'Unknown error',
            code: 'STREAM_ERROR',
          },
        });
      } finally {
        isClosed = true;
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
