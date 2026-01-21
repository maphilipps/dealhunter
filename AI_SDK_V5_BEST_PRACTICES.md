# AI SDK v5 Best Practices - Comprehensive Guide

> Recherchiert: 2026-01-20
> Quellen: Vercel AI SDK Official Docs, Web Research 2025/2026

## Table of Contents

1. [streamText Event Handlers](#streamtext-event-handlers)
2. [Promise.allSettled for Parallel Tool Execution](#promiseallsettled-for-parallel-tool-execution)
3. [Server-Sent Events Streaming in Next.js 16](#server-sent-events-streaming-in-nextjs-16)
4. [Error Handling in Streaming Contexts](#error-handling-in-streaming-contexts)
5. [Event Batching Patterns](#event-batching-patterns)
6. [Performance Optimizations](#performance-optimizations)
7. [Edge Cases & Anti-Patterns](#edge-cases--anti-patterns)

---

## 1. streamText Event Handlers

### onChunk Handler

**Best Practice:** Use for real-time processing of streaming chunks

```typescript
const result = streamText({
  model: openai('gpt-4o'),
  prompt: 'Your prompt',
  onChunk: async ({ chunk }) => {
    // Stream pauses until this promise resolves
    switch (chunk.type) {
      case 'text':
        console.log('Text:', chunk.text);
        break;
      case 'reasoning':
        console.log('Reasoning:', chunk.text);
        break;
      case 'tool-call':
        console.log('Tool:', chunk.toolName, chunk.input);
        break;
      case 'source':
        console.log('Source:', chunk.source);
        break;
    }
  },
});
```

**Key Points:**

- Stream processing **pauses** until callback promise resolves
- Supports both sync and async callbacks
- Enables real-time processing before chunks reach client
- Use for logging, metrics, or side effects

**Anti-Pattern:**

```typescript
// ❌ DON'T: Heavy blocking operations in onChunk
onChunk: async ({ chunk }) => {
  await heavyDatabaseOperation(); // Blocks entire stream!
  await sendSlackNotification(); // Slows down streaming
};
```

**Recommended:**

```typescript
// ✅ DO: Offload heavy operations
onChunk: async ({ chunk }) => {
  // Non-blocking fire-and-forget
  queueMetricsUpdate(chunk).catch(console.error);
};
```

### onFinish Handler

**Best Practice:** Use for post-processing and persistence

```typescript
const result = streamText({
  model: openai('gpt-4o'),
  messages: coreMessages,
  onFinish: async ({ text, finishReason, usage, response, steps, totalUsage }) => {
    try {
      // Save chat history
      await saveChat({
        id: chatId,
        messages: [...coreMessages, ...response.messages],
      });

      // Log usage metrics
      await logUsageMetrics({
        totalTokens: totalUsage.totalTokens,
        finishReason,
        stepCount: steps.length,
      });
    } catch (error) {
      console.error('Failed to save chat:', error);
      // Don't throw - stream already completed
    }
  },
});
```

**Key Points:**

- Called **after** streaming completes
- Has access to full response, usage metrics, and all steps
- Ideal for database persistence, analytics, logging
- Errors here don't affect client stream (already sent)

**Anti-Pattern:**

```typescript
// ❌ DON'T: Throw errors in onFinish
onFinish: async ({ response }) => {
  await saveChat(response); // Uncaught error breaks app
};
```

**Recommended:**

```typescript
// ✅ DO: Handle errors gracefully
onFinish: async ({ response }) => {
  try {
    await saveChat(response);
  } catch (error) {
    await logError('Failed to save chat', error);
    // Optionally: trigger retry mechanism
  }
};
```

### onAbort Handler

**Best Practice:** Clean up resources when stream is cancelled

```typescript
const result = streamText({
  model: openai('gpt-4o'),
  prompt: 'Long task...',
  abortSignal: req.signal, // Forward request abort signal
  onAbort: async ({ steps }) => {
    console.log('Stream aborted after', steps.length, 'steps');

    // Persist partial results
    await savePartialResults(steps);

    // Cleanup resources
    await cleanup();
  },
  onFinish: async ({ steps, totalUsage }) => {
    // This runs only on normal completion
    await saveFinalResults(steps, totalUsage);
  },
});
```

**Key Points:**

- Triggered when `AbortSignal` fires
- Use for cleanup: close connections, save partial state
- Different from `onFinish` (which runs on normal completion)
- Always forward `req.signal` in Next.js routes for proper cancellation

**Anti-Pattern:**

```typescript
// ❌ DON'T: Ignore abort signals
export async function POST(req: Request) {
  const result = streamText({
    model: openai('gpt-4o'),
    // Missing: abortSignal: req.signal
    // User closes browser → stream continues → resource leak
  });
}
```

---

## 2. Promise.allSettled for Parallel Tool Execution

### Why Promise.allSettled?

AI SDK v5 supports parallel tool calling natively, but for custom orchestration:

```typescript
// AI SDK handles parallel execution automatically
const result = await generateText({
  model: openai('gpt-4o'),
  tools: {
    weather: tool({
      description: 'Get weather',
      inputSchema: z.object({
        city: z.string(),
        unit: z.enum(['C', 'F']),
      }),
      execute: async ({ city, unit }) => {
        const weather = await fetchWeather(city);
        return `${weather.value}°${unit} and ${weather.description} in ${city}`;
      },
    }),
  },
  prompt: 'What is the weather in Paris and New York?',
});

// Model calls weather tool twice IN PARALLEL automatically
console.log(result.toolCalls);
// [
//   { toolName: 'weather', input: { city: 'Paris', unit: 'C' } },
//   { toolName: 'weather', input: { city: 'New York', unit: 'C' } }
// ]
```

### Custom Parallel Orchestration

When you need manual control:

```typescript
// ✅ DO: Use Promise.allSettled for resilient parallel execution
const results = await Promise.allSettled([
  fetchCompetitorData(rfpId),
  analyzeCapabilities(rfpId),
  checkCompliance(rfpId),
  assessRisk(rfpId),
]);

const processedResults = results.map((result, index) => {
  if (result.status === 'fulfilled') {
    return result.value;
  } else {
    console.error(`Task ${index} failed:`, result.reason);
    return null; // Graceful degradation
  }
});
```

**vs Promise.all:**

```typescript
// ❌ AVOID: Promise.all fails fast
try {
  const results = await Promise.all([
    fetchCompetitorData(rfpId), // Takes 5s
    analyzeCapabilities(rfpId), // Takes 3s
    checkCompliance(rfpId), // Fails at 1s → ALL rejected
    assessRisk(rfpId),
  ]);
} catch (error) {
  // Lost all successful results!
}
```

**Best Practice Pattern:**

```typescript
type AgentResult<T> =
  | {
      success: true;
      data: T;
    }
  | {
      success: false;
      error: string;
      agent: string;
    };

async function runParallelAgents(rfpId: string): Promise<AgentResult[]> {
  const agents = [
    { name: 'tech', fn: () => analyzeTech(rfpId) },
    { name: 'commercial', fn: () => analyzeCommercial(rfpId) },
    { name: 'legal', fn: () => analyzeLegal(rfpId) },
    { name: 'risk', fn: () => assessRisk(rfpId) },
  ];

  const results = await Promise.allSettled(agents.map(agent => agent.fn()));

  return results.map((result, index) => {
    const agentName = agents[index].name;

    if (result.status === 'fulfilled') {
      return { success: true, data: result.value };
    } else {
      return {
        success: false,
        error: result.reason.message,
        agent: agentName,
      };
    }
  });
}
```

---

## 3. Server-Sent Events Streaming in Next.js 16

### Essential Next.js 16 Configuration

**Critical Exports for SSE:**

```typescript
// app/api/chat/route.ts
import { streamText } from 'ai';
import { openai } from '@ai-sdk/openai';

// ✅ REQUIRED for SSE in Next.js 16
export const runtime = 'nodejs'; // Enables streaming runtime
export const dynamic = 'force-dynamic'; // Prevents static optimization/caching
export const maxDuration = 30; // Allow up to 30s for streaming

export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = streamText({
    model: openai('gpt-4o'),
    messages: await convertToModelMessages(messages),
    abortSignal: req.signal, // Forward abort signal
  });

  return result.toUIMessageStreamResponse();
}
```

**Why These Exports Matter:**

- `runtime = 'nodejs'`: Required for streaming (Edge runtime has limitations)
- `dynamic = 'force-dynamic'`: Prevents Next.js from caching the route
- `maxDuration`: Default is 15s, increase for long-running streams

**Anti-Pattern:**

```typescript
// ❌ DON'T: Missing critical exports
export async function POST(req: Request) {
  // Next.js may cache this route!
  // Streaming may fail or behave unexpectedly!
}
```

### Custom Stream Format

**Pattern:** Custom SSE transformation for specialized clients

```typescript
export type StreamEvent =
  | { type: 'text'; text: string }
  | { type: 'tool-call'; toolName: string; input: unknown }
  | { type: 'tool-result'; toolName: string; result: unknown };

const encoder = new TextEncoder();

function formatEvent(event: StreamEvent): Uint8Array {
  return encoder.encode('data: ' + JSON.stringify(event) + '\n\n');
}

export async function POST(request: Request) {
  const { prompt } = await request.json();

  const result = streamText({
    prompt,
    model: openai('gpt-4o'),
    tools,
    stopWhen: stepCountIs(5),
  });

  // Transform fullStream to custom SSE format
  const transformStream = new TransformStream({
    transform(chunk, controller) {
      switch (chunk.type) {
        case 'text-delta':
          controller.enqueue(
            formatEvent({
              type: 'text',
              text: chunk.text,
            })
          );
          break;
        case 'tool-call':
          controller.enqueue(
            formatEvent({
              type: 'tool-call',
              toolName: chunk.toolName,
              input: chunk.input,
            })
          );
          break;
        case 'tool-result':
          controller.enqueue(
            formatEvent({
              type: 'tool-result',
              toolName: chunk.toolName,
              result: chunk.output,
            })
          );
          break;
      }
    },
  });

  return new Response(result.fullStream.pipeThrough(transformStream), {
    headers: { 'Content-Type': 'text/event-stream' },
  });
}
```

**Use Cases:**

- Custom mobile clients
- Legacy systems expecting specific SSE format
- Advanced filtering/transformation before client

---

## 4. Error Handling in Streaming Contexts

### Stream-Level Error Handling

**Pattern 1: onError Callback (Recommended)**

```typescript
export async function POST(req: Request) {
  const { messages } = await request.json();

  const result = streamText({
    model: openai('gpt-4o'),
    messages: await convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse({
    onError: error => {
      // Errors are sent as part of the stream
      if (NoSuchToolError.isInstance(error)) {
        return 'The model tried to call an unknown tool.';
      } else if (InvalidToolInputError.isInstance(error)) {
        return 'The model called a tool with invalid inputs.';
      } else {
        return 'An unknown error occurred.';
      }
    },
  });
}
```

**Pattern 2: fullStream Error Handling**

```typescript
try {
  const { fullStream } = streamText({
    model: openai('gpt-4o'),
    prompt: 'Write a story...',
  });

  for await (const part of fullStream) {
    switch (part.type) {
      case 'text-delta':
        process.stdout.write(part.text);
        break;

      case 'error':
        console.error('Stream error:', part.error);
        // Handle error part in stream
        break;

      case 'abort':
        console.log('Stream aborted');
        break;

      case 'tool-error':
        console.error('Tool error:', part.error);
        // Tool execution failed
        break;
    }
  }
} catch (error) {
  // Handle errors outside the stream
  console.error('Fatal error:', error);
}
```

### Tool Execution Errors (AI SDK 5.0+)

**New in v5:** Tool errors are no longer thrown, they appear in `steps`

```typescript
// ✅ AI SDK 5.0 Pattern
const { steps } = await generateText({
  model: openai('gpt-4o'),
  messages,
  tools,
});

// Check for tool errors in steps
const toolErrors = steps.flatMap(step => step.content.filter(part => part.type === 'tool-error'));

toolErrors.forEach(toolError => {
  console.log('Tool error:', toolError.error);
  console.log('Tool name:', toolError.toolName);
  console.log('Tool input:', toolError.input);
});
```

**Old AI SDK 4.0 Pattern (Deprecated):**

```typescript
// ❌ DEPRECATED in v5
try {
  const result = await generateText({
    /* ... */
  });
} catch (error) {
  if (error instanceof ToolExecutionError) {
    // This no longer works in v5
  }
}
```

**Why the change?**

- Enables automatic LLM roundtrips (model can retry failed tools)
- Better multi-step agent workflows
- Tool errors don't abort entire generation

---

## 5. Event Batching Patterns

### Client-Side Throttling

**Use Case:** Reduce re-renders when streaming rapidly

```typescript
'use client';

import { useCompletion } from 'ai/react';

export default function ChatComponent() {
  const { completion, input, handleSubmit } = useCompletion({
    api: '/api/completion',
    // ✅ Throttle UI updates to 50ms
    experimental_throttle: 50,
  });

  return (
    <div>
      <div>{completion}</div>
      <form onSubmit={handleSubmit}>
        <input value={input} onChange={handleInputChange} />
      </form>
    </div>
  );
}
```

**Performance Impact:**

- Without throttling: 100+ renders/sec for fast streams
- With 50ms throttle: ~20 renders/sec
- User experience: No perceptible difference
- React performance: Significantly improved

### Server-Side Backpressure

**Concept:** Prevent overwhelming slow clients

```typescript
// ✅ AI SDK handles backpressure automatically
// Streams use native Web Streams API with automatic flow control

const result = streamText({
  model: openai('gpt-4o'),
  prompt: 'Generate large response...',
});

// The stream automatically pauses if client is slow to consume
return result.toUIMessageStreamResponse();
```

**Manual Backpressure (Advanced):**

```typescript
const transformStream = new TransformStream({
  async transform(chunk, controller) {
    // Process chunk
    const processed = await processChunk(chunk);

    // Controller automatically handles backpressure
    controller.enqueue(processed);

    // If downstream is slow, this pauses automatically
  },
});
```

**Key Principle:**

- Use **lazy iteration** (pull-based) not eager pushing
- AI SDK's `fullStream` implements this correctly
- Manual stream creation: use `pull` handler, not eager loops

---

## 6. Performance Optimizations

### Timeout Configuration

**Granular Control:**

```typescript
const result = await streamText({
  model: openai('gpt-4o'),
  prompt: 'Complex task...',
  timeout: {
    totalMs: 30000, // Total timeout: 30s
    stepMs: 10000, // Per-step timeout: 10s (for multi-step)
    chunkMs: 2000, // Chunk timeout: 2s (streaming only)
  },
});
```

**Simple Timeout:**

```typescript
// ✅ Simple 5 second timeout
timeout: 5000; // milliseconds
```

**AbortSignal Pattern:**

```typescript
// ✅ Custom abort logic
const controller = new AbortController();

setTimeout(() => controller.abort(), 5000);

const result = await streamText({
  model: openai('gpt-4o'),
  prompt: 'Task...',
  abortSignal: controller.signal,
});
```

### Step Control (maxSteps → stopWhen)

**AI SDK 5.0 Migration:**

```typescript
// ❌ OLD (v4.0)
const result = await generateText({
  model: openai('gpt-4o'),
  messages,
  maxSteps: 5,
});

// ✅ NEW (v5.0)
import { stepCountIs, hasToolCall } from 'ai';

const result = await generateText({
  model: openai('gpt-4o'),
  messages,
  stopWhen: stepCountIs(5), // Stop at step 5 IF tools were called
});
```

**Advanced Patterns:**

```typescript
// Stop when specific tool is called
stopWhen: hasToolCall('finalizeTask');

// Multiple conditions (ANY triggers stop)
stopWhen: [
  stepCountIs(10), // Max 10 steps
  hasToolCall('submitOrder'), // OR when order submitted
];

// Custom logic
stopWhen: ({ steps }) => {
  const lastStep = steps[steps.length - 1];
  return lastStep?.text?.includes('COMPLETE');
};
```

**Important:** `stopWhen` only evaluates when last step has tool results

### Multi-Step Tool Execution

**Server-Side Control:**

```typescript
import { streamText, stepCountIs } from 'ai';

const result = streamText({
  model: openai('gpt-4o'),
  messages,
  tools,
  stopWhen: stepCountIs(5),
  onStepFinish: async ({ toolResults }) => {
    if (toolResults.length) {
      console.log('Step completed:', toolResults);
    }
  },
});
```

**Client-Side Automatic Submission:**

```typescript
import { useChat } from '@ai-sdk/react';
import { lastAssistantMessageIsCompleteWithToolCalls } from 'ai';

const { messages, addToolOutput } = useChat({
  // Auto-submit when all tool results available
  sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,

  async onToolCall({ toolCall }) {
    const result = await executeToolCall(toolCall);

    // ⚠️ IMPORTANT: Don't await addToolOutput to avoid deadlocks
    addToolOutput({
      tool: toolCall.toolName,
      toolCallId: toolCall.toolCallId,
      output: result,
    });
  },
});
```

**Anti-Pattern (Deadlock):**

```typescript
// ❌ DON'T: Awaiting addToolOutput causes deadlock
async onToolCall({ toolCall }) {
  const result = await executeToolCall(toolCall);
  await addToolOutput({ /* ... */ }); // DEADLOCK!
}
```

---

## 7. Edge Cases & Anti-Patterns

### 1. Abort Signal Forwarding

**Edge Case:** User closes browser mid-stream

```typescript
// ✅ ALWAYS forward req.signal
export async function POST(req: Request) {
  const result = streamText({
    model: openai('gpt-4o'),
    prompt: req.body.prompt,
    abortSignal: req.signal, // ← Critical!
  });

  return result.toUIMessageStreamResponse();
}
```

**Why?** Without forwarding:

- Stream continues running after user disconnects
- Wasted API calls and compute
- Memory leaks in long-running servers

### 2. Message Persistence Timing

**Anti-Pattern:** Saving too early

```typescript
// ❌ DON'T: Save before streaming completes
export async function POST(req: Request) {
  const { messages } = await req.json();

  await saveMessages(messages); // Only has user message!

  const result = streamText({
    model: openai('gpt-4o'),
    messages: await convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse();
}
```

**Best Practice:**

```typescript
// ✅ DO: Save in onFinish
export async function POST(req: Request) {
  const { id, messages } = await req.json();

  const result = streamText({
    model: openai('gpt-4o'),
    messages: await convertToModelMessages(messages),
    onFinish: async ({ response }) => {
      await saveChat({
        id,
        messages: [...messages, ...response.messages],
      });
    },
  });

  return result.toUIMessageStreamResponse();
}
```

### 3. Stream Consumption on Abort

**Critical:** Always consume stream even when aborted

```typescript
// ✅ Proper abort handling
import { consumeStream } from 'ai';

export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = streamText({
    model: openai('gpt-4o'),
    messages: await convertToModelMessages(messages),
    abortSignal: req.signal,
  });

  return result.toUIMessageStreamResponse({
    consumeSseStream: consumeStream, // ← Prevents memory leaks
    onFinish: ({ isAborted }) => {
      if (isAborted) {
        console.log('Stream aborted');
        // Release resources
      } else {
        console.log('Stream completed');
        // Save results
      }
    },
  });
}
```

**Why?** Without consuming:

- Hanging connections
- Memory leaks
- Resource exhaustion under load

### 4. Tool Schema Validation

**Best Practice:** Always validate tool inputs

```typescript
import { tool } from 'ai';
import { z } from 'zod';

// ✅ DO: Strict schema with descriptions
const weatherTool = tool({
  description: 'Get current weather for a city',
  inputSchema: z.object({
    city: z.string().min(1).describe('The city name'),
    unit: z.enum(['C', 'F']).describe('Temperature unit'),
    includeAirQuality: z.boolean().optional().describe('Include air quality index'),
  }),
  execute: async ({ city, unit, includeAirQuality }) => {
    // Input is fully typed and validated!
  },
});
```

**Anti-Pattern:**

```typescript
// ❌ DON'T: Weak or missing validation
const weatherTool = tool({
  inputSchema: z.object({
    city: z.string(), // No min length, no description
    unit: z.string(), // Should be enum!
  }),
  execute: async ({ city, unit }) => {
    // unit could be 'xyz' → runtime error
  },
});
```

### 5. Error Message Exposure

**Security Issue:** Leaking internal details

```typescript
// ❌ DON'T: Expose internal errors to client
return result.toUIMessageStreamResponse({
  onError: error => {
    return error.message; // Could leak DB schema, API keys, etc.
  },
});
```

**Best Practice:**

```typescript
// ✅ DO: Sanitize error messages
return result.toUIMessageStreamResponse({
  onError: error => {
    // Log full error server-side
    console.error('Stream error:', error);

    // Return generic message to client
    if (NoSuchToolError.isInstance(error)) {
      return 'Unknown tool requested';
    } else if (InvalidToolInputError.isInstance(error)) {
      return 'Invalid tool parameters';
    } else {
      return 'An error occurred'; // Generic fallback
    }
  },
});
```

### 6. Next.js 16 Caching Gotchas

**Issue:** SSE routes getting cached

```typescript
// ❌ WRONG: Route may be cached
export async function POST(req: Request) {
  return streamText({
    /* ... */
  }).toUIMessageStreamResponse();
}

// ✅ CORRECT: Force dynamic
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: Request) {
  return streamText({
    /* ... */
  }).toUIMessageStreamResponse();
}
```

**Symptoms of missing config:**

- Same response for different inputs
- Stale data
- Streams not updating

---

## Summary: Essential Checklist

### Every Streaming Route Should Have:

```typescript
// ✅ Complete Template
import { streamText, convertToModelMessages } from 'ai';
import { openai } from '@ai-sdk/openai';

// 1. Essential Next.js exports
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST(req: Request) {
  const { id, messages } = await req.json();

  const result = streamText({
    model: openai('gpt-4o'),
    messages: await convertToModelMessages(messages),

    // 2. Forward abort signal
    abortSignal: req.signal,

    // 3. Timeout configuration
    timeout: {
      totalMs: 30000,
      stepMs: 10000,
      chunkMs: 2000,
    },

    // 4. Step control
    stopWhen: stepCountIs(5),

    // 5. Event handlers
    onChunk: async ({ chunk }) => {
      // Optional: Real-time processing
    },

    onFinish: async ({ response, usage }) => {
      try {
        await saveChat({ id, messages: [...messages, ...response.messages] });
        await logMetrics(usage);
      } catch (error) {
        console.error('Save failed:', error);
      }
    },

    onAbort: async ({ steps }) => {
      await savePartialResults(id, steps);
    },
  });

  // 6. Proper response with error handling
  return result.toUIMessageStreamResponse({
    onError: error => {
      console.error('Stream error:', error);
      return 'An error occurred'; // Sanitized message
    },
  });
}
```

---

## References & Sources

### Official Documentation

- [AI SDK 5 Announcement](https://vercel.com/blog/ai-sdk-5)
- [streamText API Reference](https://ai-sdk.dev/docs/reference/ai-sdk-core/stream-text)
- [Tool Calling Guide](https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling)
- [Error Handling Guide](https://ai-sdk.dev/docs/ai-sdk-core/error-handling)
- [Migration Guide v5.0](https://ai-sdk.dev/docs/migration-guides/migration-guide-5-0)
- [Stream Protocols](https://ai-sdk.dev/docs/ai-sdk-ui/stream-protocol)

### Next.js 16 Resources

- [Next.js 16 Release](https://nextjs.org/blog/next-16)
- [Fixing Slow SSE in Next.js](https://medium.com/@oyetoketoby80/fixing-slow-sse-server-sent-events-streaming-in-next-js-and-vercel-99f42fbdb996)
- [Using SSE in Next.js - Upstash](https://upstash.com/blog/sse-streaming-llm-responses)

### Best Practices & Patterns

- [Real-time AI with Vercel AI SDK - LogRocket](https://blog.logrocket.com/nextjs-vercel-ai-sdk-streaming/)
- [Vercel AI SDK Complete Guide](https://www.tenxdeveloper.com/blog/vercel-ai-sdk-complete-guide)
- [AI SDK Workflow Patterns](https://ai-sdk.dev/docs/agents/workflows)
- [Promise.all in 2025 - LogRocket](https://blog.logrocket.com/promise-all-modern-async-patterns/)

### Community Resources

- [Vercel Community: Streaming Tool Output](https://community.vercel.com/t/streaming-text-tool-output/22025)
- [GitHub Discussion: Message Persistence](https://github.com/vercel/ai/discussions/4845)
- [Next.js SSE Discussion](https://github.com/vercel/next.js/discussions/48427)

---

**Last Updated:** 2026-01-20
**AI SDK Version:** 5.0+
**Next.js Version:** 16+
