# Testing Strategy

## Overview

**Minimum 80% Test Coverage ist REQUIRED für alle Features.**

Das Projekt nutzt:

- **Vitest** - Unit & Integration Tests
- **Playwright** - E2E Browser Tests
- **Testing Library** - React Component Testing
- **MSW** - API Mocking
- **Axe** - Accessibility Testing

---

## Unit & Integration Tests (Vitest)

### Commands

```bash
npm test                  # Watch mode (development)
npm run test:ui           # Interactive UI
npm run test:run          # Single run (CI)
npm run test:coverage     # Generate coverage report
```

### Configuration

- **Config:** `vitest.config.ts`
- **Environment:** happy-dom (faster als jsdom)
- **Coverage:** v8 provider (80% minimum)

### Writing Tests

```typescript
// src/lib/extraction/__tests__/agent.test.ts
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { extractionAgent } from '../agent';

describe('Extraction Agent', () => {
  it('should extract tender data from PDF', async () => {
    const mockPdf = Buffer.from('...');
    const result = await extractionAgent(mockPdf);

    expect(result.title).toBeDefined();
    expect(result.deadline).toMatch(/\d{4}-\d{2}-\d{2}/);
  });
});
```

### React Component Tests

```typescript
// src/components/bids/__tests__/bid-card.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BidCard } from '../bid-card';

describe('BidCard', () => {
  it('should render bid information', () => {
    render(<BidCard bid={mockBid} />);

    expect(screen.getByText('Project Alpha')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /evaluate/i })).toBeVisible();
  });

  it('should handle click events', async () => {
    const user = userEvent.setup();
    const onEvaluate = vi.fn();

    render(<BidCard bid={mockBid} onEvaluate={onEvaluate} />);

    await user.click(screen.getByRole('button', { name: /evaluate/i }));
    expect(onEvaluate).toHaveBeenCalledWith(mockBid.id);
  });
});
```

### Mocking API Calls (MSW)

```typescript
// src/lib/__tests__/mocks/handlers.ts
import { http, HttpResponse } from 'msw';

export const handlers = [
  http.post('/api/bids/evaluate', async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({
      recommendation: 'BID',
      confidence: 0.85,
    });
  }),
];
```

### Testing Server Actions

```typescript
// src/lib/bids/__tests__/actions.test.ts
import { evaluateBid } from '../actions';

describe('evaluateBid Server Action', () => {
  it('should validate input with Zod', async () => {
    const result = await evaluateBid({ bidId: 'invalid' });

    expect(result.error).toBeDefined();
  });
});
```

---

## E2E Tests (Playwright)

### Commands

```bash
npm run test:e2e          # Run all E2E tests (headless)
npm run test:e2e:ui       # Interactive UI mode
npm run test:e2e:debug    # Debug mode with browser
```

### Writing E2E Tests

```typescript
// e2e/bid-workflow.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Bid Evaluation Workflow', () => {
  test('should upload and evaluate tender', async ({ page }) => {
    await page.goto('/bids/new');

    // Upload PDF
    await page.setInputFiles('input[type="file"]', 'fixtures/tender.pdf');
    await page.getByRole('button', { name: /upload/i }).click();

    // Wait for extraction
    await expect(page.getByText(/preview/i)).toBeVisible({ timeout: 10000 });

    // Check result
    const recommendation = page.getByTestId('quick-scan-result');
    await expect(recommendation).toContainText(/BID|NO-BID/);
  });
});
```

### Accessibility Testing

```typescript
// e2e/accessibility.spec.ts
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('should not have accessibility violations', async ({ page }) => {
  await page.goto('/dashboard');

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});
```

---

## Browser Testing (agent-browser CLI)

**WICHTIG:** Nutze `agent-browser` CLI für manuelle Browser-Tests!

```bash
# Dev Server starten
d3k

# Browser öffnen
agent-browser open http://localhost:3000

# Snapshot mit Interactive Elements
agent-browser snapshot -i
# Output: textbox "Email" [ref=e1], button "Login" [ref=e2]

# Element Interaktionen
agent-browser fill @e1 "test@adesso.de"
agent-browser click @e2

# Screenshot
agent-browser screenshot screenshots/dashboard.png

# Console Errors prüfen
agent-browser console
agent-browser errors
```

**Workflow für UI Verification:**

1. Feature implementieren
2. `agent-browser open http://localhost:3000/feature`
3. `agent-browser snapshot -i` → Elements prüfen
4. `agent-browser screenshot` → Visual verification
5. `agent-browser console` → Console errors prüfen

---

## Coverage Requirements

### Minimum Thresholds

- **Statements:** 80%
- **Branches:** 80%
- **Functions:** 80%
- **Lines:** 80%

### Enforcement

**Wenn Coverage < 80%:**

1. Feature nicht mergen
2. Linear Sub-Issue erstellen: "Add test coverage for [Feature]"
3. Issue als Blocker markieren
4. Coverage erhöhen, dann merge

### Coverage Report

```bash
npm run test:coverage

# HTML Report öffnen
open coverage/index.html
```

---

## Test Organization

```
src/
├── lib/
│   ├── extraction/
│   │   ├── agent.ts
│   │   └── __tests__/
│   │       └── agent.test.ts
│   └── bids/
│       ├── actions.ts
│       └── __tests__/
│           └── actions.test.ts
├── components/
│   └── bids/
│       ├── bid-card.tsx
│       └── __tests__/
│           └── bid-card.test.tsx
e2e/
├── bid-workflow.spec.ts
├── authentication.spec.ts
└── fixtures/
    └── tender.pdf
```

**Naming Convention:**

- Unit Tests: `*.test.ts`
- E2E Tests: `*.spec.ts`
- Test Fixtures: `fixtures/`

---

## Testing Agents (AI SDK)

### Mocking AI Responses

```typescript
import { streamText } from 'ai';

vi.mock('ai', () => ({
  streamText: vi.fn(() => ({
    textStream: async function* () {
      yield 'Mocked AI response';
    },
  })),
}));

test('should handle agent response', async () => {
  const result = await extractionAgent(mockPdf);
  expect(result.title).toBe('Mocked AI response');
});
```

---

## Best Practices

### DO ✅

- Test user flows, nicht implementation details
- Mock externe APIs (Slack, Resend, OpenAI)
- Nutze `@testing-library/react` für User-centric Tests
- Accessibility als first-class concern
- Integration Tests > Unit Tests für Business Logic

### DON'T ❌

- Private functions direkt testen
- Über-mocken (mock nur external dependencies)
- Flaky tests committen
- Tests ohne Assertions
- `@ts-ignore` in Tests

---

## Debugging Tests

### Vitest

```bash
# Single test file
npm test -- extraction.test.ts

# Specific test
npm test -- extraction.test.ts -t "should extract title"
```

### Playwright

```bash
# Debug mode
npm run test:e2e:debug

# Headed mode
npm run test:e2e -- --headed
```

---

## Troubleshooting

**Problem:** Tests timeout

```typescript
test('slow test', { timeout: 30000 }, async () => { ... });
```

**Problem:** Flaky E2E tests

```typescript
// Use auto-wait
await expect(page.getByText(/loading/i)).toBeVisible();
await expect(page.getByText(/loading/i)).not.toBeVisible();
```

**Problem:** Coverage nicht 80%

```bash
npm run test:coverage
open coverage/index.html
```
