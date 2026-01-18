---
skill: json-render-integration
description: Expert guidance for integrating json-render.dev for safe, AI-generated UI components
tags: [ui, ai-generation, json-render, streaming, vercel-ai-sdk]
version: 1.0.0
---

# JSON Render Integration Skill

Expert guidance for integrating [json-render](https://json-render.dev) from Vercel Labs to enable safe, AI-generated UI components constrained by predefined catalogs.

## What is JSON Render?

**json-render** enables developers to let end users generate dashboards, widgets, and data visualizations from natural language prompts—safely constrained to components you define.

### Core Principles

1. **Guardrailed** - AI can only use components in your catalog (no arbitrary code generation)
2. **Predictable** - JSON output matches your schema every time
3. **Fast** - Stream and render progressively as the model responds

### How It Works

```
User Prompt → AI + Catalog → JSON Tree → React Components
  (natural)    (guardrailed)  (predictable)  (streamed)
```

## Installation

```bash
npm install @json-render/core @json-render/react
# or
pnpm add @json-render/core @json-render/react
```

## Package Overview

| Package | Purpose |
|---------|---------|
| `@json-render/core` | Types, schemas, visibility, actions, validation |
| `@json-render/react` | React renderer, providers, hooks |

## Implementation Workflow

### 1. Define Component Catalog

Create a catalog that defines what AI can use:

```typescript
// lib/json-render/catalog.ts
import { createCatalog } from '@json-render/core';
import { z } from 'zod';

export const catalog = createCatalog({
  name: 'Dealhunter Dashboard',
  components: {
    Card: {
      props: z.object({
        title: z.string().optional(),
        description: z.string().optional(),
        padding: z.enum(['sm', 'md', 'lg']).optional(),
      }),
      hasChildren: true,
      description: 'Container with optional title',
    },
    Metric: {
      props: z.object({
        label: z.string(),
        valuePath: z.string(), // JSON Pointer to data
        format: z.enum(['number', 'currency', 'percent']).optional(),
        trend: z.enum(['up', 'down', 'neutral']).optional(),
        trendValue: z.string().optional(),
      }),
      description: 'Display a metric with optional trend',
    },
    Chart: {
      props: z.object({
        type: z.enum(['bar', 'line', 'pie', 'area']),
        dataPath: z.string(), // JSON Pointer to array
        title: z.string().optional(),
        height: z.number().optional(),
      }),
      description: 'Data visualization chart',
    },
    Table: {
      props: z.object({
        dataPath: z.string(),
        columns: z.array(z.object({
          key: z.string(),
          label: z.string(),
          format: z.enum(['text', 'currency', 'date', 'badge']).optional(),
        })),
      }),
      description: 'Data table with configurable columns',
    },
    Button: {
      props: z.object({
        label: z.string(),
        action: z.string(), // Action name
        variant: z.enum(['primary', 'secondary', 'danger', 'ghost']).optional(),
      }),
      description: 'Clickable button with action',
    },
  },
  actions: {
    export_report: { description: 'Export dashboard to PDF' },
    refresh_data: { description: 'Refresh all metrics' },
    view_details: {
      params: z.object({ id: z.string() }),
      description: 'View detailed information',
    },
  },
});

// Export component list for system prompt
export const componentList = Object.keys(catalog.components);
```

### 2. Create Component Registry

Map catalog components to React implementations:

```typescript
// components/json-render/registry.tsx
import type { ComponentRegistry } from '@json-render/react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
// ... other ShadCN imports

export const componentRegistry: ComponentRegistry = {
  Card: ({ element, children }) => (
    <Card className={`p-${element.props.padding || 'md'}`}>
      {element.props.title && (
        <h3 className="text-lg font-semibold mb-2">
          {element.props.title}
        </h3>
      )}
      {element.props.description && (
        <p className="text-sm text-muted-foreground mb-4">
          {element.props.description}
        </p>
      )}
      {children}
    </Card>
  ),

  Metric: ({ element }) => {
    const { useDataValue } = useJsonRenderContext();
    const value = useDataValue(element.props.valuePath);

    const formatted = formatValue(value, element.props.format);

    return (
      <div className="metric">
        <p className="text-sm text-muted-foreground">{element.props.label}</p>
        <p className="text-2xl font-bold">{formatted}</p>
        {element.props.trend && (
          <p className={`text-sm ${
            element.props.trend === 'up' ? 'text-green-600' :
            element.props.trend === 'down' ? 'text-red-600' :
            'text-muted-foreground'
          }`}>
            {element.props.trendValue}
          </p>
        )}
      </div>
    );
  },

  Chart: ({ element }) => {
    const { useDataValue } = useJsonRenderContext();
    const data = useDataValue(element.props.dataPath);

    // Use ShadCN Chart component
    return (
      <Chart
        type={element.props.type}
        data={data}
        title={element.props.title}
        height={element.props.height || 300}
      />
    );
  },

  Table: ({ element }) => {
    const { useDataValue } = useJsonRenderContext();
    const data = useDataValue(element.props.dataPath);

    return (
      <Table>
        <TableHeader>
          <TableRow>
            {element.props.columns.map((col) => (
              <TableHead key={col.key}>{col.label}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row, idx) => (
            <TableRow key={idx}>
              {element.props.columns.map((col) => (
                <TableCell key={col.key}>
                  {formatCell(row[col.key], col.format)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  },

  Button: ({ element, onAction }) => (
    <Button
      variant={element.props.variant || 'primary'}
      onClick={() => onAction(element.props.action)}
    >
      {element.props.label}
    </Button>
  ),
};

function formatValue(value: any, format?: string) {
  if (format === 'currency') return `$${value.toLocaleString()}`;
  if (format === 'percent') return `${(value * 100).toFixed(1)}%`;
  return value.toLocaleString();
}

function formatCell(value: any, format?: string) {
  if (format === 'currency') return `$${value}`;
  if (format === 'date') return new Date(value).toLocaleDateString();
  if (format === 'badge') return <Badge>{value}</Badge>;
  return value;
}
```

### 3. Create API Route (AI Generation)

Set up streaming endpoint with Vercel AI SDK:

```typescript
// app/api/json-render/generate/route.ts
import { streamText } from 'ai';
import { componentList } from '@/lib/json-render/catalog';

export const maxDuration = 30;

const SYSTEM_PROMPT = `You are a dashboard widget generator that outputs JSONL (JSON Lines) patches.

AVAILABLE COMPONENTS:
${componentList.join(', ')}

COMPONENT DETAILS:
- Card: { title?: string, description?: string, padding?: "sm"|"md"|"lg" } - Container with optional title
- Metric: { label: string, valuePath: string, format?: "number"|"currency"|"percent", trend?: "up"|"down"|"neutral", trendValue?: string }
- Chart: { type: "bar"|"line"|"pie"|"area", dataPath: string, title?: string, height?: number }
- Table: { dataPath: string, columns: [{ key: string, label: string, format?: "text"|"currency"|"date"|"badge" }] }
- Button: { label: string, action: string, variant?: "primary"|"secondary"|"danger"|"ghost" }

DATA BINDING:
- valuePath: "/analytics/revenue" (for single values like Metric)
- dataPath: "/analytics/salesByRegion" (for arrays like Chart, Table)

OUTPUT FORMAT:
Output JSONL where each line is a patch operation. Use a FLAT key-based structure:

OPERATIONS:
- {"op":"set","path":"/root","value":"main-card"} - Set the root element key
- {"op":"add","path":"/elements/main-card","value":{...}} - Add an element by unique key

ELEMENT STRUCTURE:
{
  "key": "unique-key",
  "type": "ComponentType",
  "props": { ... },
  "children": ["child-key-1", "child-key-2"]  // Array of child element keys
}

RULES:
1. First set /root to the root element's key
2. Add each element with a unique key using /elements/{key}
3. Parent elements list child keys in their "children" array
4. Stream elements progressively - parent first, then children
5. Each element must have: key, type, props
6. Children array contains STRING KEYS, not nested objects

EXAMPLE - Revenue Dashboard:
{"op":"set","path":"/root","value":"main-card"}
{"op":"add","path":"/elements/main-card","value":{"key":"main-card","type":"Card","props":{"title":"Revenue Dashboard","padding":"md"},"children":["metrics-grid"]}}
{"op":"add","path":"/elements/metrics-grid","value":{"key":"metrics-grid","type":"Grid","props":{"columns":2,"gap":"md"},"children":["revenue-metric"]}}
{"op":"add","path":"/elements/revenue-metric","value":{"key":"revenue-metric","type":"Metric","props":{"label":"Total Revenue","valuePath":"/analytics/revenue","format":"currency"}}}

Generate JSONL patches now:`;

export async function POST(req: Request) {
  const { prompt, context } = await req.json();

  let fullPrompt = prompt;

  // Add data context to help AI understand available data paths
  if (context?.data) {
    fullPrompt += `\n\nAVAILABLE DATA:\n${JSON.stringify(context.data, null, 2)}`;
  }

  const result = streamText({
    model: process.env.OPENAI_BASE_URL
      ? 'openai/gpt-4o' // adesso AI Hub
      : 'anthropic/claude-opus-4.5', // Anthropic direct
    system: SYSTEM_PROMPT,
    prompt: fullPrompt,
    temperature: 0.7,
  });

  return result.toTextStreamResponse();
}
```

### 4. Implement UI Component

Create the page/component that uses json-render:

```typescript
// app/(dashboard)/analytics/page.tsx
'use client';

import { useState } from 'react';
import {
  DataProvider,
  ActionProvider,
  VisibilityProvider,
  useUIStream,
  Renderer,
} from '@json-render/react';
import { componentRegistry } from '@/components/json-render/registry';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const INITIAL_DATA = {
  analytics: {
    revenue: 125000,
    growth: 0.15,
    customers: 1234,
    bitsWon: 42,
    salesByRegion: [
      { label: 'US', value: 45000 },
      { label: 'EU', value: 35000 },
      { label: 'Asia', value: 28000 },
    ],
  },
};

const ACTION_HANDLERS = {
  export_report: () => {
    console.log('Exporting report...');
    // Implement actual export logic
  },
  refresh_data: async () => {
    console.log('Refreshing data...');
    // Implement actual refresh logic
  },
  view_details: (params: { id: string }) => {
    console.log('View details:', params.id);
    // Navigate to details page
  },
};

function AnalyticsContent() {
  const [prompt, setPrompt] = useState('');
  const { tree, isStreaming, error, send, clear } = useUIStream({
    api: '/api/json-render/generate',
    onError: (err) => console.error('Generation error:', err),
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;
    await send(prompt, { data: INITIAL_DATA });
  };

  const examples = [
    'Revenue dashboard with metrics and trend',
    'Sales by region chart',
    'Customer metrics grid',
  ];

  const hasElements = tree && Object.keys(tree.elements).length > 0;

  return (
    <div className="max-w-6xl mx-auto p-8">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight">
          Analytics Dashboard
        </h1>
        <p className="text-muted-foreground mt-2">
          Generate custom widgets from natural language prompts
        </p>
      </header>

      <form onSubmit={handleSubmit} className="mb-8">
        <div className="flex gap-2 mb-4">
          <Input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe what you want to see..."
            disabled={isStreaming}
            className="flex-1"
          />
          <Button
            type="submit"
            disabled={isStreaming || !prompt.trim()}
          >
            {isStreaming ? 'Generating...' : 'Generate'}
          </Button>
          {hasElements && (
            <Button
              type="button"
              variant="outline"
              onClick={clear}
            >
              Clear
            </Button>
          )}
        </div>

        <div className="flex gap-2 flex-wrap">
          {examples.map((ex) => (
            <Button
              key={ex}
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPrompt(ex)}
            >
              {ex}
            </Button>
          ))}
        </div>
      </form>

      {error && (
        <div className="p-4 mb-6 bg-destructive/10 border border-destructive rounded-lg text-destructive">
          {error.message}
        </div>
      )}

      <div className="min-h-[300px] p-6 bg-card border rounded-lg">
        {!hasElements && !isStreaming ? (
          <div className="text-center py-16 text-muted-foreground">
            Enter a prompt to generate a widget
          </div>
        ) : tree ? (
          <Renderer
            tree={tree}
            registry={componentRegistry}
            loading={isStreaming}
          />
        ) : null}
      </div>

      {hasElements && (
        <details className="mt-6">
          <summary className="cursor-pointer text-sm text-muted-foreground">
            View JSON
          </summary>
          <pre className="mt-2 p-4 bg-card border rounded-lg overflow-auto text-xs text-muted-foreground">
            {JSON.stringify(tree, null, 2)}
          </pre>
        </details>
      )}
    </div>
  );
}

export default function AnalyticsPage() {
  return (
    <DataProvider initialData={INITIAL_DATA}>
      <VisibilityProvider>
        <ActionProvider handlers={ACTION_HANDLERS}>
          <AnalyticsContent />
        </ActionProvider>
      </VisibilityProvider>
    </DataProvider>
  );
}
```

## Advanced Features

### Conditional Visibility

Show/hide components based on data or auth state:

```typescript
// In catalog definition
const element = {
  key: 'error-alert',
  type: 'Alert',
  props: { message: 'Error occurred' },
  visible: {
    and: [
      { path: '/form/hasError' },
      { not: { path: '/form/errorDismissed' } },
    ],
  },
};

// Auth-based visibility
const adminPanel = {
  key: 'admin-panel',
  type: 'Card',
  props: { title: 'Admin Controls' },
  visible: { auth: 'signedIn' },
};
```

### Rich Actions with Confirmation

Actions with params, confirmation dialogs, and callbacks:

```typescript
// In component props
const buttonAction = {
  name: 'refund',
  params: {
    paymentId: { path: '/selected/id' },
    amount: { path: '/refund/amount' },
  },
  confirm: {
    title: 'Confirm Refund',
    message: 'Refund ${/refund/amount} to customer?',
    variant: 'danger',
  },
  onSuccess: { set: { '/ui/success': true } },
  onError: { set: { '/ui/error': '$error.message' } },
};
```

### Built-in Validation

Field validation with Zod schemas:

```typescript
// In catalog
TextField: {
  props: z.object({
    label: z.string(),
    valuePath: z.string(),
    checks: z.array(z.object({
      fn: z.enum(['required', 'email', 'min', 'max']),
      message: z.string(),
    })).optional(),
    validateOn: z.enum(['blur', 'change', 'submit']).optional(),
  }),
},
```

## Integration with Dealhunter

### Use Cases

1. **BD Dashboard Widgets**
   - Let users generate custom views of BIT/NO BIT data
   - Create on-demand analytics visualizations
   - Build personalized opportunity trackers

2. **Dynamic Reports**
   - AI-generated compliance reports from prompts
   - Custom risk assessment visualizations
   - Team performance dashboards

3. **Agent Output Visualization**
   - Render TECH Agent findings as structured UI
   - Display COMMERCIAL Agent analysis as charts
   - Present RISK Agent results as interactive tables

### Data Structure Example

```typescript
const DEALHUNTER_DATA = {
  bids: {
    total: 234,
    bitRate: 0.42,
    avgDecisionTime: 3.5,
  },
  pipeline: [
    { stage: 'EXTRACT', count: 45 },
    { stage: 'QUICK_SCAN', count: 38 },
    { stage: 'BIT_EVAL', count: 28 },
    { stage: 'DEEP_ANALYSIS', count: 12 },
  ],
  recentBids: [
    {
      id: 'BID-001',
      account: 'Acme Corp',
      status: 'BIT',
      confidence: 0.85,
      date: '2024-01-15',
    },
    // ...
  ],
};
```

## Best Practices

### 1. Catalog Design

- Keep component catalog focused and minimal
- Use clear, descriptive component names
- Provide comprehensive descriptions for AI understanding
- Use Zod schemas for type safety

### 2. Data Binding

- Use JSON Pointer paths (`/path/to/value`)
- Document available data structure in API route
- Validate data paths exist before rendering
- Handle missing data gracefully

### 3. Streaming Performance

- Stream elements progressively (parent → children)
- Use unique, stable keys for each element
- Avoid deep nesting (prefer flat structures)
- Optimize component registry for fast renders

### 4. Error Handling

- Always implement `onError` callback in `useUIStream`
- Display user-friendly error messages
- Log detailed errors for debugging
- Provide fallback UI when generation fails

### 5. Security

- Validate all AI-generated JSON against catalog schemas
- Sanitize user prompts before sending to AI
- Restrict action handlers to safe operations
- Never execute arbitrary code from AI output

## Debugging

### Enable Verbose Logging

```typescript
const { tree, error } = useUIStream({
  api: '/api/json-render/generate',
  onError: (err) => {
    console.error('Generation error:', err);
    console.log('Tree state:', tree);
  },
});
```

### Inspect JSON Output

```typescript
// Add to UI for debugging
<details>
  <summary>View JSON Tree</summary>
  <pre>{JSON.stringify(tree, null, 2)}</pre>
</details>
```

### Common Issues

1. **Components not rendering**
   - Check component registry includes all catalog components
   - Verify component names match exactly (case-sensitive)
   - Check console for React errors

2. **Data not binding**
   - Verify JSON Pointer paths are correct (`/path/to/value`)
   - Check data structure matches expected format
   - Use browser DevTools to inspect data

3. **Streaming fails**
   - Check API route returns `toTextStreamResponse()`
   - Verify JSONL format (one JSON object per line)
   - Check network tab for errors

4. **Actions not working**
   - Verify action names in catalog match handlers
   - Check ActionProvider wraps component
   - Implement all declared action handlers

## Resources

- **Official Docs**: https://json-render.dev
- **GitHub Repo**: https://github.com/vercel-labs/json-render
- **Example Dashboard**: https://github.com/vercel-labs/json-render/tree/master/examples/dashboard
- **Vercel AI SDK**: https://sdk.vercel.ai

## When to Use This Skill

Use this skill when you need to:

- ✅ Implement AI-generated UI components with safety guardrails
- ✅ Create customizable dashboards from natural language
- ✅ Build dynamic data visualizations with AI assistance
- ✅ Enable users to generate widgets without coding
- ✅ Constrain AI output to predefined component catalogs
- ✅ Stream progressive UI rendering with Vercel AI SDK

Do NOT use for:

- ❌ Static, predefined dashboards (use regular React components)
- ❌ Simple forms (use ShadCN form components directly)
- ❌ Arbitrary code generation without constraints
- ❌ Non-streaming, batch UI generation

## Implementation Checklist

When implementing json-render integration:

- [ ] Install `@json-render/core` and `@json-render/react`
- [ ] Define component catalog with Zod schemas
- [ ] Create component registry mapping catalog → React
- [ ] Implement API route with streaming (Vercel AI SDK)
- [ ] Set up providers (DataProvider, ActionProvider, VisibilityProvider)
- [ ] Implement UI with `useUIStream` hook and `Renderer`
- [ ] Define action handlers for all catalog actions
- [ ] Add error handling and loading states
- [ ] Test with example prompts
- [ ] Document available data paths for users
- [ ] Implement security validation
- [ ] Add debugging views (JSON tree viewer)

## Integration Pattern

```
┌─────────────────────────────────────────────────────────────┐
│                     Dealhunter Application                   │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  User: "Show me BIT rate by business line this quarter"     │
│                          ↓                                    │
│              [json-render useUIStream]                       │
│                          ↓                                    │
│        POST /api/json-render/generate                        │
│         { prompt, context: { data } }                        │
│                          ↓                                    │
│          [Vercel AI SDK streamText]                          │
│       + Component Catalog (guardrails)                       │
│       + System Prompt (JSONL format)                         │
│                          ↓                                    │
│            Streaming JSONL Patches                           │
│  {"op":"set","path":"/root","value":"card"}                 │
│  {"op":"add","path":"/elements/card","value":{...}}         │
│                          ↓                                    │
│              [json-render Renderer]                          │
│         + Component Registry (ShadCN UI)                     │
│         + Data Provider (BID data)                           │
│                          ↓                                    │
│           Progressive UI Rendering                           │
│     [Card → Chart → Metrics → Table]                        │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```
