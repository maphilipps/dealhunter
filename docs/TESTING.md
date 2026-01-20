# Testing Guide

Comprehensive testing setup for Dealhunter with unit, integration, and E2E tests.

## Overview

The testing stack includes:

- **Vitest** - Fast unit and integration testing framework
- **Playwright** - Reliable E2E testing for real user journeys
- **Testing Library** - React component testing utilities
- **MSW (Mock Service Worker)** - API mocking for integration tests

## Test Structure

```
tests/
├── unit/              # Unit tests for pure logic
├── integration/       # Integration tests for flows
├── e2e/              # End-to-end tests with Playwright
├── fixtures/         # Test data and fixtures
├── mocks/            # MSW handlers and mock responses
├── utils/            # Test utilities and factories
└── setup.ts          # Global test setup
```

## Running Tests

### Unit & Integration Tests

```bash
# Run tests in watch mode (development)
npm test

# Run tests once (CI)
npm run test:run

# Run tests with UI
npm run test:ui

# Generate coverage report
npm run test:coverage
```

### E2E Tests

```bash
# Run E2E tests
npm run test:e2e

# Run E2E tests with UI (visual debugging)
npm run test:e2e:ui

# Run E2E tests in debug mode (step-by-step)
npm run test:e2e:debug
```

### All Tests

```bash
# Run all tests (unit + integration + E2E)
npm run test:all
```

## Writing Tests

### Unit Tests

Test pure logic and utility functions without external dependencies:

```typescript
import { describe, it, expect } from 'vitest';
import { normalizeUrl } from '@/lib/bids/duplicate-check';

describe('normalizeUrl', () => {
  it('should remove protocol and www', () => {
    expect(normalizeUrl('https://www.example.com')).toBe('example.com');
  });
});
```

### Integration Tests

Test complete workflows using factories and mocks:

```typescript
import { describe, it, expect } from 'vitest';
import { factories } from '../utils/factories';

describe('RFP Extraction Flow', () => {
  it('should extract requirements from RFP', () => {
    const requirements = factories.extractedRequirements();

    expect(requirements).toHaveProperty('clientName');
    expect(requirements.techStack).toBeInstanceOf(Array);
  });
});
```

### E2E Tests

Test real user journeys in the browser:

```typescript
import { test, expect } from '@playwright/test';

test('should complete full bid workflow', async ({ page }) => {
  await page.goto('/');
  await page.click('text=New Bid');

  // Fill form, submit, and verify results
  await page.fill('textarea[name="rawInput"]', 'Test RFP');
  await page.click('button[type="submit"]');

  await expect(page).toHaveURL(/\/bids\/[a-z0-9]+/);
});
```

## Test Utilities

### Factories

Use factories to create consistent test data:

```typescript
import { factories } from '../utils/factories';

// Create test user
const user = factories.user({ role: 'admin' });

// Create test RFP
const rfp = factories.rfp({
  status: 'draft',
  decision: 'pending',
});

// Create extracted requirements
const requirements = factories.extractedRequirements();
```

### Mock Responses

Use pre-defined mock AI responses:

```typescript
import { mockAIResponses } from '../mocks/ai-responses';

// Use mock extraction response
const extraction = mockAIResponses.extraction;

// Use mock quick scan response
const quickScan = mockAIResponses.quickScan;
```

### MSW Handlers

Mock API endpoints for integration tests:

```typescript
import { server } from '../mocks/server';
import { http, HttpResponse } from 'msw';

// Add custom handler
server.use(
  http.post('/api/custom-endpoint', () => {
    return HttpResponse.json({ success: true });
  })
);
```

## Coverage Goals

Target coverage metrics per DEA-28:

- **Unit Tests**: > 80% coverage for critical logic
- **Integration Tests**: All major workflows covered
- **E2E Tests**: All user journeys and happy paths covered

### Checking Coverage

```bash
# Generate coverage report
npm run test:coverage

# Open coverage report in browser
open coverage/index.html
```

## CI/CD Integration

Tests run automatically on:

- Push to `main` branch
- Pull requests to `main`

GitHub Actions workflow includes:

1. Unit & Integration Tests
2. E2E Tests
3. TypeScript Type Check
4. Linting

See `.github/workflows/test.yml` for configuration.

## Debugging Tests

### Vitest Debugging

```bash
# Run specific test file
npx vitest run tests/unit/duplicate-check.test.ts

# Run tests matching pattern
npx vitest run -t "normalizeUrl"

# Run with UI for visual debugging
npm run test:ui
```

### Playwright Debugging

```bash
# Run with headed browser (see what's happening)
npx playwright test --headed

# Debug specific test
npx playwright test --debug tests/e2e/happy-path.spec.ts

# Generate trace for failed tests
npx playwright test --trace on
npx playwright show-trace trace.zip
```

## Best Practices

### General

1. **Test behavior, not implementation** - Focus on what code does, not how
2. **Use descriptive test names** - Should read like documentation
3. **Arrange-Act-Assert pattern** - Structure tests clearly
4. **Keep tests independent** - No shared state between tests
5. **Use factories** - Consistent, maintainable test data

### Unit Tests

1. Test pure functions separately from side effects
2. Mock external dependencies (DB, API calls)
3. Test edge cases and error conditions
4. Keep tests fast (< 100ms each)

### Integration Tests

1. Test complete user workflows
2. Use realistic test data
3. Mock external services (AI APIs, email)
4. Verify state changes and side effects

### E2E Tests

1. Test critical user journeys only
2. Use stable selectors (test IDs, semantic text)
3. Avoid testing implementation details
4. Keep tests resilient to UI changes
5. Use fixtures for complex setup

## Common Patterns

### Testing AI Agent Outputs

```typescript
import { mockAIResponses } from '../mocks/ai-responses';

it('should extract requirements from RFP', async () => {
  const result = mockAIResponses.extraction;

  expect(result).toHaveProperty('clientName');
  expect(result).toHaveProperty('techStack');
  expect(result.techStack).toBeInstanceOf(Array);
});
```

### Testing Status Transitions

```typescript
it('should transition from draft to extracting', () => {
  const rfp = factories.rfp({ status: 'draft' });

  const updated = { ...rfp, status: 'extracting' as const };

  expect(updated.status).toBe('extracting');
});
```

### Testing Decision Logic

```typescript
it('should make bid decision based on scores', () => {
  const decisionData = factories.decisionData();

  expect(decisionData.decision).toBe('bid');
  expect(decisionData.confidence).toBeGreaterThan(0.8);
  expect(decisionData.scores.tech).toBeGreaterThan(0.7);
});
```

## Troubleshooting

### Tests Failing in CI but Passing Locally

- Check for environment-specific issues (file paths, env vars)
- Ensure deterministic test data (avoid `Date.now()`, use factories)
- Check for race conditions in async tests

### Flaky E2E Tests

- Add proper `waitFor` conditions
- Increase timeouts for slow operations
- Use `networkidle` state for page loads
- Avoid hardcoded delays (`setTimeout`)

### Coverage Not Meeting Goals

- Add tests for edge cases
- Test error handling paths
- Cover conditional branches
- Test async error scenarios

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Playwright Documentation](https://playwright.dev/)
- [Testing Library Best Practices](https://testing-library.com/docs/guiding-principles)
- [MSW Documentation](https://mswjs.io/)
