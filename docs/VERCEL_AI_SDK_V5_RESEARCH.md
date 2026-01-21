# Vercel AI SDK v5 - Multi-Agent System Dokumentation

> Recherche-Ergebnisse für das Dealhunter Multi-Agent System mit Vercel AI SDK v5

**Datum:** 2026-01-18
**Kontext:** Multi-Agent System für BD-Entscheidungen mit Extraction, Tech, Legal, Commercial, Competition, Reference und Coordinator Agents

---

## Inhaltsverzeichnis

1. [generateText & streamText API](#1-generatetext--streamtext-api)
2. [Tool Definition & Execution](#2-tool-definition--execution)
3. [generateObject für Structured Output](#3-generateobject-für-structured-output)
4. [Multi-Agent Orchestrierung](#4-multi-agent-orchestrierung)
5. [Frontend Hooks (useChat, useObject)](#5-frontend-hooks)
6. [Streaming UI Patterns](#6-streaming-ui-patterns)
7. [Error Handling & Retry Patterns](#7-error-handling--retry-patterns)
8. [Best Practices aus dem Dealhunter Code](#8-best-practices-aus-dem-dealhunter-code)

---

## 1. generateText & streamText API

### Überblick

Die AI SDK Core bietet zwei Haupt-Funktionen:

- **`generateText`**: Generiert Text für einen gegebenen Prompt (non-streaming, ideal für Agents mit Tools)
- **`streamText`**: Streamt Text in Echtzeit (ideal für Chat und interaktive UIs)

**Offizielle Dokumentation:**

- [AI SDK Core: Generating Text](https://ai-sdk.dev/docs/ai-sdk-core/generating-text)
- [AI SDK Core: generateText Reference](https://ai-sdk.dev/docs/reference/ai-sdk-core/generate-text)
- [AI SDK Core: streamText Reference](https://ai-sdk.dev/docs/reference/ai-sdk-core/stream-text)

### generateText - Non-Interactive Agents

Ideal für Agent-Loops und Server-Side Processing ohne UI-Streaming.

**Key Parameters:**

```typescript
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';

const result = await generateText({
  model: openai('gpt-4o'),
  system: 'Du bist ein Legal Risk Assessor bei adesso SE.',
  prompt: 'Bewerte die rechtlichen Risiken...',
  temperature: 0.3,
  maxTokens: 4000,
  maxRetries: 2, // Retry on rate limits or transient errors
});

// Result object contains:
// - result.text: Generated text content
// - result.usage: Token usage info
// - result.finishReason: Why generation stopped
```

**Wichtig für Multi-Step Agents:**

Das `stopWhen`-Parameter transformiert einen Single-Request in einen Tool-Calling Loop:

```typescript
const result = await generateText({
  model: openai('gpt-4o'),
  prompt: 'Research and analyze...',
  tools: {
    searchWeb: tool({
      /* ... */
    }),
    analyzeData: tool({
      /* ... */
    }),
  },
  maxSteps: 5, // Maximum loop iterations
});
```

### streamText - Interactive UI Streaming

**Key Characteristics:**

- Startet sofort mit Streaming (kein Warten auf komplette Antwort)
- Errors werden Teil des Streams (Server crasht nicht)
- Ideal für Chat-Bots und Echtzeit-Anwendungen

**Callbacks:**

```typescript
import { streamText } from 'ai';

const stream = streamText({
  model: openai('gpt-4o'),
  prompt: 'Analyze this opportunity...',

  onChunk: ({ chunk }) => {
    // Triggered for each chunk
    console.log('Chunk:', chunk);
  },

  onFinish: ({ text, usage, finishReason, messages, steps }) => {
    // Triggered when stream completes
    console.log('Finished:', text);
    console.log('Total usage:', usage);
    console.log('Steps taken:', steps);
  },

  onError: error => {
    // Log errors without crashing
    console.error('Stream error:', error);
  },
});
```

**Beispiel aus Dealhunter Code (Quick Scan Agent):**

Dealhunter verwendet derzeit **OpenAI SDK direkt** statt AI SDK für synchrone Agents. Für zukünftige Streaming-Implementierungen würde `streamText` verwendet:

```typescript
// Current approach (synchronous):
const completion = await openai.chat.completions.create({
  model: 'claude-haiku-4.5',
  messages: [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ],
  temperature: 0.3,
  max_tokens: 4000,
});

// Future with AI SDK streamText:
const stream = streamText({
  model: openai('gpt-4o'),
  system: systemPrompt,
  prompt: userPrompt,
  temperature: 0.3,
  maxTokens: 4000,
  onChunk: ({ chunk }) => {
    emit({
      type: AgentEventType.AGENT_PROGRESS,
      data: { agent: 'Quick Scan', message: chunk.text },
    });
  },
});
```

---

## 2. Tool Definition & Execution

**Offizielle Dokumentation:**

- [How to build AI Agents with Vercel AI SDK](https://vercel.com/kb/guide/how-to-build-ai-agents-with-vercel-and-the-ai-sdk)
- [AI SDK 5 Blog Post](https://vercel.com/blog/ai-sdk-5)

### Tool Definition mit Zod Schema

```typescript
import { tool } from 'ai';
import { z } from 'zod';

const searchWebTool = tool({
  description: 'Search the web for information',
  parameters: z.object({
    query: z.string().describe('The search query'),
    maxResults: z.number().default(5),
  }),
  execute: async ({ query, maxResults }) => {
    // Perform search
    const results = await fetch(`https://api.search.com?q=${query}`);
    return results.json();
  },
});
```

### Tool Execution Flow

1. AI SDK extrahiert Tool-Calls aus Model Output
2. Validiert Arguments gegen Zod Schema (automatisch)
3. Führt `execute` Funktion aus
4. Speichert Call + Result in `toolCalls` und `toolResults`
5. Fügt beide zur Message History hinzu (für Multi-Step Loops)

### Multi-Step Tool-Calling Loop

```typescript
const result = await generateText({
  model: openai('gpt-4o'),
  prompt: 'Research legal risks for this contract',
  tools: {
    searchCaseLaw: tool({
      /* ... */
    }),
    analyzeContract: tool({
      /* ... */
    }),
    checkCompliance: tool({
      /* ... */
    }),
  },
  maxSteps: 10, // Stop after 10 tool calls
  onStepFinish: ({ step, toolCalls, toolResults }) => {
    console.log(`Step ${step}:`, toolCalls.length, 'tool calls');
  },
});
```

### AI SDK 5 Features für Tools

**Tool-Level Provider Options:**

```typescript
const cacheTool = tool({
  description: 'Expensive computation',
  parameters: z.object({ data: z.string() }),
  execute: async ({ data }) => {
    /* ... */
  },
  // Cache tool definition with Anthropic (reduces token usage)
  experimental_providerOptions: {
    anthropic: {
      cacheControl: { type: 'ephemeral' },
    },
  },
});
```

**Provider-Executed Tools (Nativ):**

AI SDK 5 unterstützt nativ Provider-executed Tools (z.B. Anthropic Claude Computer Use), die automatisch Results zur Message History hinzufügen.

---

## 3. generateObject für Structured Output

**Offizielle Dokumentation:**

- [AI SDK Core: Generating Structured Data](https://ai-sdk.dev/docs/ai-sdk-core/generating-structured-data)
- [AI SDK Core: generateObject Reference](https://ai-sdk.dev/docs/reference/ai-sdk-core/generate-object)
- [Structured Data Extraction | Vercel Academy](https://vercel.com/academy/ai-sdk/structured-data-extraction)

### Moderne Approach (Empfohlen)

**WICHTIG:** `generateObject` ist deprecated. Verwende stattdessen `generateText` mit `output`-Property.

```typescript
import { generateText, Output } from 'ai';
import { z } from 'zod';

const capabilitySchema = z.object({
  overallCapabilityScore: z.number().min(0).max(100),
  confidence: z.number().min(0).max(100),
  reasoning: z.string(),
  criticalBlockers: z.array(z.string()),
});

const result = await generateText({
  model: openai('gpt-4o'),
  prompt: 'Analyze technical capabilities...',
  output: Output.object({
    schema: capabilitySchema,
    name: 'capability_assessment',
    description: 'Technical capability analysis result',
  }),
});

// result.object is type-safe and validated
const assessment = result.object; // Type: z.infer<typeof capabilitySchema>
```

### Array Output Mode

```typescript
const technologiesSchema = z.object({
  name: z.string(),
  version: z.string().optional(),
  confidence: z.number(),
});

const result = await generateText({
  model: openai('gpt-4o'),
  prompt: 'Detect all technologies on this website',
  output: Output.array({
    element: technologiesSchema,
    name: 'technologies',
  }),
});

// result.object is an array
const technologies = result.object; // Type: Array<z.infer<typeof technologiesSchema>>
```

### Kombination mit Tools

**Problem:** `generateObject` / `streamObject` unterstützen KEINE Tools.

**Lösung:** Verwende `generateText` oder `streamText` mit `output`-Option:

```typescript
const result = await generateText({
  model: openai('gpt-4o'),
  prompt: 'Research and analyze...',
  tools: {
    searchWeb: tool({
      /* ... */
    }),
  },
  output: Output.object({
    schema: analysisSchema,
  }),
  maxSteps: 5, // Tool-calling loop
});

// result.object contains structured output AFTER tool calls
```

### Beispiel aus Dealhunter Code

Dealhunter verwendet **manuelle JSON-Parsing** statt AI SDK Structured Output:

````typescript
// Current approach (manual parsing):
async function callAI<T>(systemPrompt: string, userPrompt: string, schema: any): Promise<T> {
  const completion = await openai.chat.completions.create({
    model: 'claude-haiku-4.5',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.3,
    max_tokens: 8000,
  });

  const responseText = completion.choices[0]?.message?.content || '{}';

  // Manual cleanup of markdown code blocks
  const cleanedResponse = responseText
    .replace(/```json\n?/g, '')
    .replace(/```\n?/g, '')
    .trim();

  const rawResult = JSON.parse(cleanedResponse);
  const cleanedResult = Object.fromEntries(
    Object.entries(rawResult).filter(([_, v]) => v !== null)
  );

  return schema.parse(cleanedResult) as T;
}

// Future with AI SDK:
const result = await generateText({
  model: openai('claude-3-5-haiku-20241022'),
  system: systemPrompt,
  prompt: userPrompt,
  temperature: 0.3,
  maxTokens: 8000,
  output: Output.object({ schema }),
});

// result.object is already validated
return result.object;
````

**Vorteil AI SDK Approach:**

- Kein manuelles Markdown-Cleanup nötig
- Type-Safe Output (TypeScript inference)
- Automatische Zod Validation
- Retry bei Schema-Validierungsfehlern

---

## 4. Multi-Agent Orchestrierung

**Offizielle Dokumentation:**

- [Building AI Agent Workflows With Vercel's AI SDK](https://www.callstack.com/blog/building-ai-agent-workflows-with-vercels-ai-sdk-a-practical-guide)
- [How to allow multiple agents to stream back an object - GitHub Discussion](https://github.com/vercel/ai/discussions/3298)

### Parallel Execution Pattern (Promise.all)

**Best Practice:** Parallel Agent Execution für unabhängige Analysen.

```typescript
// Multiple specialist agents in parallel
const [techAnalysis, legalAnalysis, commercialAnalysis] = await Promise.all([
  runTechAgent({ requirements }),
  runLegalAgent({ requirements }),
  runCommercialAgent({ requirements }),
]);

// Aggregator agent combines results
const finalDecision = await runCoordinatorAgent({
  techAnalysis,
  legalAnalysis,
  commercialAnalysis,
});
```

**Beispiel aus Dealhunter Code:**

```typescript
// BID Evaluation: 6 Agents in parallel
const [
  capabilityMatch,
  dealQuality,
  strategicFit,
  competitionCheck,
  legalAssessment,
  referenceMatch,
] = await Promise.all([
  runCapabilityAgent({ extractedRequirements, quickScanResults }),
  runDealQualityAgent({ extractedRequirements, quickScanResults }),
  runStrategicFitAgent({ extractedRequirements, quickScanResults }),
  runCompetitionAgent({ extractedRequirements, quickScanResults }),
  runLegalAgent({ extractedRequirements, quickScanResults }),
  runReferenceAgent({ extractedRequirements, quickScanResults }),
]);

// Calculate weighted scores
const weightedScores = {
  overall:
    capabilityMatch.overallCapabilityScore * 0.25 +
    dealQuality.overallDealQualityScore * 0.2 +
    strategicFit.overallStrategicFitScore * 0.15 +
    competitionCheck.estimatedWinProbability * 0.15 +
    legalAssessment.overallLegalScore * 0.15 +
    referenceMatch.overallReferenceScore * 0.1,
};
```

### Sequential Execution Pattern

Für Agents, die voneinander abhängen:

```typescript
// Sequential: Each step depends on previous
const extraction = await runExtractionAgent({ document });
const quickScan = await runQuickScanAgent({
  websiteUrl: extraction.websiteUrl,
  extractedRequirements: extraction,
});
const bitEvaluation = await runBitEvaluationAgent({
  extractedRequirements: extraction,
  quickScanResults: quickScan,
});
```

### Parallel mit Progress Callbacks (async-parallel)

**Best Practice:** Emit Events während parallel execution für Live-UI-Updates.

```typescript
const agentPromises = [
  runCapabilityAgent({ requirements }).then(result => {
    emit({
      type: AgentEventType.AGENT_COMPLETE,
      data: { agent: 'Capability', result, confidence: result.confidence },
    });
    return result;
  }),
  runLegalAgent({ requirements }).then(result => {
    emit({
      type: AgentEventType.AGENT_COMPLETE,
      data: { agent: 'Legal', result, confidence: result.confidence },
    });
    return result;
  }),
];

const results = await Promise.all(agentPromises);
```

**Beispiel aus Dealhunter Code (BID Evaluation mit Streaming):**

```typescript
export async function runBitEvaluationWithStreaming(
  input: BitEvaluationInput,
  emit: EventEmitter
): Promise<BitEvaluationResult> {
  emit({
    type: AgentEventType.AGENT_PROGRESS,
    data: {
      agent: 'Coordinator',
      message:
        'Running parallel agent evaluation (Capability, Deal Quality, Strategic Fit, Competition, Legal, Reference)',
    },
  });

  const agentPromises = [
    runCapabilityAgent({ extractedRequirements, quickScanResults }).then(result => {
      emit({
        type: AgentEventType.AGENT_COMPLETE,
        data: { agent: 'Capability', result, confidence: result.confidence },
      });
      return result;
    }),
    runDealQualityAgent({ extractedRequirements, quickScanResults }).then(result => {
      emit({
        type: AgentEventType.AGENT_COMPLETE,
        data: { agent: 'Deal Quality', result, confidence: result.confidence },
      });
      return result;
    }),
    // ... weitere Agents
  ];

  const [capabilityMatch, dealQuality /* ... */] = await Promise.all(agentPromises);

  // Coordinator fasst Ergebnisse zusammen
  const decision = await generateBitDecision({
    /* all results */
  });

  return { capabilityMatch, dealQuality, decision /* ... */ };
}
```

### Restate Integration für Erweiterte Orchestrierung

Für komplexe Multi-Agent Workflows mit Durable Execution:

```typescript
// Using Restate for agent orchestration
import { RestatePromise } from '@restatedev/sdk';

// Racing agents: Use first result, cancel others
const result = await RestatePromise.race([
  runFastAgent({ requirements }),
  runAccurateAgent({ requirements }),
]);

// Parallel agents with coordination
const [results] = await RestatePromise.all([
  runAgent1({ data }),
  runAgent2({ data }),
  runAgent3({ data }),
]);

const aggregated = await runAggregatorAgent({ results });
```

**Quelle:**

- [Tour of Restate for Agents with Vercel AI SDK](https://docs.restate.dev/tour/vercel-ai-agents)

---

## 5. Frontend Hooks

**Offizielle Dokumentation:**

- [AI SDK UI: useChat Reference](https://ai-sdk.dev/docs/reference/ai-sdk-ui/use-chat)
- [AI SDK UI: Overview](https://ai-sdk.dev/docs/ai-sdk-ui/overview)
- [Basic Chatbot | Vercel Academy](https://vercel.com/academy/ai-sdk/basic-chatbot)

### useChat Hook

Für Chat-basierte Interfaces mit Streaming.

```typescript
'use client';

import { useChat } from 'ai/react';

export default function ChatComponent() {
  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
    api: '/api/chat', // Default endpoint
    onFinish: (message) => {
      console.log('Message finished:', message);
    },
    onError: (error) => {
      console.error('Chat error:', error);
    },
  });

  return (
    <div>
      {messages.map(m => (
        <div key={m.id}>
          <strong>{m.role}:</strong> {m.content}
        </div>
      ))}

      <form onSubmit={handleSubmit}>
        <input
          value={input}
          onChange={handleInputChange}
          disabled={isLoading}
        />
      </form>
    </div>
  );
}
```

**Backend Route:**

```typescript
import { streamText } from 'ai';
import { openai } from '@ai-sdk/openai';

export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = streamText({
    model: openai('gpt-4o'),
    messages,
  });

  return result.toDataStreamResponse();
}
```

### useObject Hook

Für Streaming von strukturierten JSON-Objekten.

```typescript
'use client';

import { experimental_useObject as useObject } from 'ai/react';

export default function StructuredUI() {
  const { object, submit, isLoading } = useObject({
    api: '/api/generate-analysis',
    schema: z.object({
      techStack: z.object({
        cms: z.string(),
        framework: z.string(),
      }),
      score: z.number(),
    }),
  });

  return (
    <div>
      <button onClick={() => submit('Analyze website')}>
        Analyze
      </button>

      {object && (
        <div>
          <p>CMS: {object.techStack?.cms}</p>
          <p>Framework: {object.techStack?.framework}</p>
          <p>Score: {object.score}</p>
        </div>
      )}
    </div>
  );
}
```

**Backend Route:**

```typescript
import { streamObject } from 'ai';
import { openai } from '@ai-sdk/openai';

export async function POST(req: Request) {
  const { prompt } = await req.json();

  const result = streamObject({
    model: openai('gpt-4o'),
    schema: analysisSchema,
    prompt,
  });

  return result.toTextStreamResponse();
}
```

### WICHTIG: useChat und useObject sind NICHT kompatibel

**Von der Dokumentation:**

> useChat and useObject are NOT compatible together. They've been designed to be on their own for specific use cases: useChat for chat, useCompletion for completion, useObject for streaming structured objects.

**Lösung:** Für komplexe UIs wie Dealhunter, verwende **Custom Hooks mit EventSource (SSE)**.

**Beispiel aus Dealhunter Code:**

```typescript
// Custom hook für Agent Streaming
export function useAgentStream() {
  const [state, dispatch] = useReducer(streamReducer, initialState);
  const eventSourceRef = useRef<EventSource | null>(null);

  const start = useCallback((url: string) => {
    dispatch({ type: 'RESET' });
    dispatch({ type: 'SET_STREAMING', isStreaming: true });

    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.onmessage = event => {
      const agentEvent: AgentEvent = JSON.parse(event.data);
      dispatch({ type: 'ADD_EVENT', event: agentEvent });
    };

    eventSource.onerror = error => {
      console.error('EventSource error:', error);
      dispatch({ type: 'SET_ERROR', error: 'Stream connection failed' });
    };
  }, []);

  return { ...state, start, abort };
}
```

**Verwendung im Frontend:**

```typescript
'use client';

import { useAgentStream } from '@/hooks/use-agent-stream';

export default function EvaluationPage() {
  const { events, agentStates, start, abort } = useAgentStream();

  const handleEvaluate = () => {
    start('/api/bids/evaluate?bidId=123');
  };

  return (
    <div>
      <button onClick={handleEvaluate}>Start Evaluation</button>

      {Object.entries(agentStates).map(([agent, state]) => (
        <div key={agent}>
          <h3>{agent}</h3>
          <p>Status: {state.status}</p>
          {state.progress && <p>{state.progress}</p>}
          {state.confidence && <p>Confidence: {state.confidence}%</p>}
        </div>
      ))}
    </div>
  );
}
```

---

## 6. Streaming UI Patterns

**Offizielle Dokumentation:**

- [AI SDK RSC: Streaming React Components](https://ai-sdk.dev/docs/ai-sdk-rsc/streaming-react-components)
- [Generative UI Chatbot with React Server Components](https://vercel.com/templates/next.js/rsc-genui)
- [AI SDK 3.0 with Generative UI support](https://vercel.com/blog/ai-sdk-3-generative-ui)

### React Server Components (RSC) mit streamUI

**WICHTIG:** AI SDK RSC ist **experimentell** und aktuell pausiert. Für Production, verwende AI SDK UI.

```typescript
import { streamUI } from 'ai/rsc';
import { openai } from '@ai-sdk/openai';

export async function generateDashboard(query: string) {
  const result = streamUI({
    model: openai('gpt-4o'),
    prompt: `Generate a dashboard for: ${query}`,
    text: ({ content }) => <div>{content}</div>,
    tools: {
      renderChart: {
        description: 'Render a chart component',
        parameters: z.object({
          type: z.enum(['bar', 'line', 'pie']),
          data: z.array(z.object({ label: z.string(), value: z.number() })),
        }),
        generate: async ({ type, data }) => {
          return <Chart type={type} data={data} />;
        },
      },
    },
  });

  return result.value;
}
```

**Migration Empfehlung:** AI SDK RSC → AI SDK UI mit Server Actions.

### Server-Sent Events (SSE) für Agent Streaming

**Best Practice für Dealhunter:** Verwende SSE für Agent-Progress-Updates.

**Backend (Next.js Route Handler):**

```typescript
import { NextRequest } from 'next/server';
import { runBitEvaluationWithStreaming } from '@/lib/bit-evaluation/agent';

export async function GET(req: NextRequest) {
  const bidId = req.nextUrl.searchParams.get('bidId');

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      // Emit function for agent events
      const emit = (event: AgentEvent) => {
        const data = `data: ${JSON.stringify(event)}\n\n`;
        controller.enqueue(encoder.encode(data));
      };

      try {
        const result = await runBitEvaluationWithStreaming({ bidId }, emit);

        // Send final complete event
        emit({
          type: AgentEventType.COMPLETE,
          data: result,
        });

        controller.close();
      } catch (error) {
        emit({
          type: AgentEventType.ERROR,
          data: { message: error.message },
        });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
```

### Progressive Rendering Pattern

Zeige Agent-Fortschritt sofort, während Agents arbeiten:

```typescript
'use client';

export default function AgentProgressUI() {
  const { events, agentStates } = useAgentStream();

  return (
    <div className="space-y-4">
      {Object.entries(agentStates).map(([agent, state]) => (
        <Card key={agent}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {agent}
              {state.status === 'running' && <Loader className="animate-spin" />}
              {state.status === 'complete' && <CheckCircle className="text-green-500" />}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {state.progress && <p className="text-sm text-muted-foreground">{state.progress}</p>}
            {state.confidence && (
              <div className="mt-2">
                <Progress value={state.confidence} />
                <p className="text-xs text-muted-foreground mt-1">
                  Confidence: {state.confidence}%
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
```

---

## 7. Error Handling & Retry Patterns

**Offizielle Dokumentation:**

- [AI SDK Core: Error Handling](https://ai-sdk.dev/docs/ai-sdk-core/error-handling)
- [AI SDK UI: Error Handling](https://ai-sdk.dev/docs/ai-sdk-ui/error-handling)
- [AI SDK Core: Settings](https://ai-sdk.dev/docs/ai-sdk-core/settings)

### maxRetries Configuration

```typescript
import { generateText } from 'ai';

const result = await generateText({
  model: openai('gpt-4o'),
  prompt: 'Analyze...',
  maxRetries: 2, // Default: 2
  // maxRetries: 0 to disable retries
});
```

**Retry Behavior:**

- Automatisch bei Rate Limits und Transient Errors
- Verwendet Exponential Backoff
- Wirft Error nach Erschöpfung aller Retries

### onError Callback

```typescript
const { messages, error } = useChat({
  api: '/api/chat',
  onError: error => {
    console.error('Chat error:', error);
    toast.error(`Chat failed: ${error.message}`);
  },
});
```

### Custom Retry Logic mit Middleware

Für erweiterte Retry-Strategien (z.B. Provider-Switching):

```typescript
import { wrapLanguageModel } from 'ai';

const modelWithRetry = wrapLanguageModel({
  model: openai('gpt-4o'),
  middleware: {
    transformParams: async ({ params }) => params,
    wrapGenerate: async ({ doGenerate, params }) => {
      let lastError;

      for (let i = 0; i < 3; i++) {
        try {
          return await doGenerate(params);
        } catch (error) {
          lastError = error;

          // Custom backoff
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));

          // Optional: Switch provider/region on retry
          if (i === 1) {
            params.model = openai('gpt-3.5-turbo'); // Fallback model
          }
        }
      }

      throw lastError;
    },
  },
});
```

### Error Recovery Best Practices

**1. Graceful Degradation:**

```typescript
try {
  const techStack = await detectTechStackWithAI(html, url, headers);
  return techStack;
} catch (error) {
  console.error('AI tech stack detection failed, using Wappalyzer results:', error);
  // Fallback to Wappalyzer results
  return wappalyzerResults;
}
```

**2. Partial Results bei Multi-Agent Failures:**

```typescript
const results = await Promise.allSettled([
  runTechAgent({ requirements }),
  runLegalAgent({ requirements }),
  runCommercialAgent({ requirements }),
]);

// Filter successful results
const successfulResults = results
  .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled')
  .map(r => r.value);

// Log failures
results
  .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
  .forEach(r => console.error('Agent failed:', r.reason));

// Continue with partial results
if (successfulResults.length >= 2) {
  return aggregateResults(successfulResults);
}
```

**Beispiel aus Dealhunter Code (Quick Scan Enhanced Audits):**

```typescript
const [playwrightRes, seoRes, legalRes, perfRes, companyRes] = await Promise.allSettled([
  runPlaywrightAudit(fullUrl, bidId, { takeScreenshots: true }),
  performSEOAudit(html, fullUrl),
  performLegalComplianceCheck(html),
  analyzePerformanceIndicators(html),
  gatherCompanyIntelligence(companyName, fullUrl, html),
]);

// Process Playwright results
if (playwrightRes.status === 'fulfilled' && playwrightRes.value) {
  playwrightResult = playwrightRes.value;
  screenshots = playwrightResult.screenshots;
} else {
  emitThought(
    'Playwright',
    'Browser-Analyse übersprungen',
    playwrightRes.status === 'rejected' ? playwrightRes.reason.message : 'Keine Ergebnisse'
  );
}

// Continue with partial results - SEO, Legal, etc.
```

---

## 8. Best Practices aus dem Dealhunter Code

### 8.1 Parallel Agent Execution mit Progress Callbacks

**Pattern:** `async-parallel` mit `.then()` Callbacks für Live-Updates.

```typescript
const agentPromises = [
  runCapabilityAgent({ requirements }).then(result => {
    emit({
      type: AgentEventType.AGENT_COMPLETE,
      data: { agent: 'Capability', result, confidence: result.confidence },
    });
    return result;
  }),
  runLegalAgent({ requirements }).then(result => {
    emit({
      type: AgentEventType.AGENT_COMPLETE,
      data: { agent: 'Legal', result, confidence: result.confidence },
    });
    return result;
  }),
];

const results = await Promise.all(agentPromises);
```

**Vorteil:**

- Agents laufen parallel (schneller als Sequential)
- UI erhält sofort Updates wenn einzelne Agents fertig sind
- User sieht Fortschritt in Echtzeit

### 8.2 Circular Buffer für Event-Speicherung

**Pattern:** `perf-004` - Verhindert Memory Leaks bei Long-Running Streams.

```typescript
const MAX_EVENTS = 150;

function streamReducer(state: StreamState, action: Action): StreamState {
  switch (action.type) {
    case 'ADD_EVENT': {
      const allEvents = [...state.events, action.event];

      // Circular buffer: keep only last MAX_EVENTS
      const newEvents =
        allEvents.length > MAX_EVENTS ? allEvents.slice(allEvents.length - MAX_EVENTS) : allEvents;

      return { ...state, events: newEvents };
    }
  }
}
```

**Vorteil:**

- Verhindert unbounded memory growth bei langen Agent-Streams
- Behält die wichtigsten (neuesten) Events
- Performance bleibt konstant

### 8.3 Reducer für Complex State Management

**Pattern:** `rerender-derived-state` - Verwende Reducer statt mehrere useState.

```typescript
type StreamState = {
  events: AgentEvent[];
  isStreaming: boolean;
  error: string | null;
  decision: any;
  agentStates: Record<string, AgentState>;
};

function streamReducer(state: StreamState, action: Action): StreamState {
  // Single source of truth
  // All state updates in one place
  // Prevents race conditions
}

export function useAgentStream() {
  const [state, dispatch] = useReducer(streamReducer, initialState);

  // Single state object instead of 5+ useState calls
  return state;
}
```

**Vorteil:**

- Weniger Re-Renders
- Keine Race Conditions
- Einfacher zu testen

### 8.4 Chain-of-Thought Logging

**Pattern:** Strukturierte Progress-Messages für bessere UX.

```typescript
const emitThought = (agent: string, thought: string, details?: string) => {
  emit({
    type: AgentEventType.AGENT_PROGRESS,
    data: { agent, message: thought, details },
  });
  logActivity(thought, details);
};

// Usage in agents:
emitThought(
  'Tech Stack Analyzer',
  'Analysiere Technology Stack...',
  websiteData.wappalyzerResults.length >= 3
    ? 'Verwende Wappalyzer-Ergebnisse'
    : 'Starte AI-gestützte Analyse'
);

emitThought(
  'Tech Stack Analyzer',
  techStack.cms ? `Tech Stack erkannt: ${techStack.cms}` : 'Kein CMS eindeutig erkannt',
  techSummary || 'Minimale Tech-Stack-Informationen verfügbar'
);
```

**Vorteil:**

- User versteht was der Agent gerade macht
- Debugging wird einfacher (Activity Log)
- Vertrauen in AI-Entscheidungen steigt

### 8.5 Weighted Scoring für Multi-Agent Decisions

**Pattern:** Kombiniere Agent-Scores mit Business-Gewichtungen.

```typescript
// Calculate weighted scores
const weightedScores = {
  capability: capabilityMatch.overallCapabilityScore,
  dealQuality: dealQuality.overallDealQualityScore,
  strategicFit: strategicFit.overallStrategicFitScore,
  winProbability: competitionCheck.estimatedWinProbability,
  legal: legalAssessment.overallLegalScore,
  reference: referenceMatch.overallReferenceScore,
  overall:
    capabilityMatch.overallCapabilityScore * 0.25 + // 25% weight
    dealQuality.overallDealQualityScore * 0.2 + // 20% weight
    strategicFit.overallStrategicFitScore * 0.15 + // 15% weight
    competitionCheck.estimatedWinProbability * 0.15 + // 15% weight
    legalAssessment.overallLegalScore * 0.15 + // 15% weight
    referenceMatch.overallReferenceScore * 0.1, // 10% weight
};

// Decision logic based on weighted score + blockers
const shouldBit = weightedScores.overall >= 55 && allCriticalBlockers.length === 0;
```

**Vorteil:**

- Business-Logik transparent
- Scores sind nachvollziehbar
- Leicht anpassbar (Gewichtungen konfigurierbar)

### 8.6 AI-Assisted Fallbacks

**Pattern:** Verwende AI als Fallback wenn automatische Erkennung fehlschlägt.

```typescript
async function detectTechStack(data: WebsiteData): Promise<TechStack> {
  // Try Wappalyzer first (fast, automatic)
  const wappalyzerResults = data.wappalyzerResults;

  // Check if results are meaningful
  const hasMeaningfulResults = (cms || framework) && wappalyzerResults.length >= 3;

  if (!hasMeaningfulResults) {
    // Fallback to AI analysis
    try {
      return await detectTechStackWithAI(data.html, data.url, data.headers);
    } catch (error) {
      console.error('AI tech stack detection failed, using Wappalyzer results:', error);
      // Fall through to Wappalyzer results if AI fails
    }
  }

  return wappalyzerTechStack;
}
```

**Vorteil:**

- Best-of-both-worlds (Speed von Wappalyzer + Accuracy von AI)
- Graceful Degradation
- Immer ein Ergebnis (auch wenn niedrige Confidence)

---

## Zusammenfassung & Recommendations

### Für Dealhunter Multi-Agent System

**1. Behalte aktuelle Architektur bei (OpenAI SDK direkt):**

- Funktioniert gut für synchrone Agents
- Manuelle JSON-Parsing ist akzeptabel (mit Zod Validation)
- Keine unmittelbaren Vorteile durch AI SDK Migration

**2. Erwäge AI SDK für zukünftige Features:**

- **Streaming Agents:** Verwende `streamText` statt `generateText` für Live-Updates
- **Structured Output:** Verwende `Output.object()` statt manuellem JSON-Parsing
- **Tool-Calling Loops:** Verwende `maxSteps` für Multi-Step Agents mit Tools

**3. Multi-Agent Best Practices implementiert:**

- ✅ Parallel Execution mit `Promise.all`
- ✅ Progress Callbacks für Live-Updates
- ✅ Weighted Scoring für finale Entscheidungen
- ✅ Graceful Degradation bei Fehlern
- ✅ Chain-of-Thought Logging

**4. Frontend Streaming:**

- ✅ Custom `useAgentStream` Hook ist besser als `useChat` für Multi-Agent UI
- ✅ Circular Buffer verhindert Memory Leaks
- ✅ Reducer für Complex State Management

### Migration Path (Optional)

Falls du AI SDK einführen möchtest:

**Phase 1:** Einzelne Agents mit `generateText` + `Output.object()` refactoren

```typescript
// Before (current):
const completion = await openai.chat.completions.create({
  /* ... */
});
const cleaned = cleanupMarkdown(completion.choices[0].message.content);
return schema.parse(JSON.parse(cleaned));

// After (AI SDK):
const result = await generateText({
  model: openai('claude-3-5-haiku-20241022'),
  system: systemPrompt,
  prompt: userPrompt,
  output: Output.object({ schema }),
});
return result.object; // Type-safe, already validated
```

**Phase 2:** Streaming für einzelne Agents

```typescript
const stream = streamText({
  model: openai('gpt-4o'),
  system: systemPrompt,
  prompt: userPrompt,
  output: Output.object({ schema }),
  onChunk: ({ chunk }) => {
    emit({ type: AgentEventType.AGENT_PROGRESS, data: { agent: 'Tech', message: chunk.text } });
  },
});
```

**Phase 3:** Tool-Calling für erweiterte Agents

```typescript
const result = await generateText({
  model: openai('gpt-4o'),
  prompt: 'Research company intelligence',
  tools: {
    searchWeb: tool({
      /* ... */
    }),
    scrapeLinkedIn: tool({
      /* ... */
    }),
  },
  maxSteps: 5,
  output: Output.object({ schema: companyIntelligenceSchema }),
});
```

---

## Quellen

### Offizielle Dokumentation

- [AI SDK Core: Generating Text](https://ai-sdk.dev/docs/ai-sdk-core/generating-text)
- [AI SDK Core: generateText Reference](https://ai-sdk.dev/docs/reference/ai-sdk-core/generate-text)
- [AI SDK Core: streamText Reference](https://ai-sdk.dev/docs/reference/ai-sdk-core/stream-text)
- [AI SDK Core: Generating Structured Data](https://ai-sdk.dev/docs/ai-sdk-core/generating-structured-data)
- [AI SDK Core: generateObject Reference](https://ai-sdk.dev/docs/reference/ai-sdk-core/generate-object)
- [AI SDK UI: useChat Reference](https://ai-sdk.dev/docs/reference/ai-sdk-ui/use-chat)
- [AI SDK UI: Overview](https://ai-sdk.dev/docs/ai-sdk-ui/overview)
- [AI SDK Core: Error Handling](https://ai-sdk.dev/docs/ai-sdk-core/error-handling)
- [AI SDK RSC: Streaming React Components](https://ai-sdk.dev/docs/ai-sdk-rsc/streaming-react-components)

### Guides & Tutorials

- [How to build AI Agents with Vercel AI SDK](https://vercel.com/kb/guide/how-to-build-ai-agents-with-vercel-and-the-ai-sdk)
- [AI SDK 5 - Vercel Blog](https://vercel.com/blog/ai-sdk-5)
- [Building AI Agent Workflows - Callstack](https://www.callstack.com/blog/building-ai-agent-workflows-with-vercels-ai-sdk-a-practical-guide)
- [Vercel Academy: Structured Data Extraction](https://vercel.com/academy/ai-sdk/structured-data-extraction)
- [Vercel Academy: Basic Chatbot](https://vercel.com/academy/ai-sdk/basic-chatbot)

### Advanced Topics

- [Tour of Restate for Agents with Vercel AI SDK](https://docs.restate.dev/tour/vercel-ai-agents)
- [Generative UI Chatbot Template](https://vercel.com/templates/next.js/rsc-genui)
- [AI SDK 3.0 with Generative UI](https://vercel.com/blog/ai-sdk-3-generative-ui)

### GitHub Discussions

- [How to allow multiple agents to stream](https://github.com/vercel/ai/discussions/3298)
- [Can streamObject be used with useChat?](https://github.com/vercel/ai/discussions/1952)
- [Combining useChat with useObject](https://github.com/vercel/ai/discussions/2931)

---

**Datum:** 2026-01-18
**Erstellt von:** Claude Code (Research Agent)
**Kontext:** Dealhunter Multi-Agent System
