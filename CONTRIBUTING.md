# Contributing to Dealhunter

Thank you for your interest in contributing to Dealhunter! This guide will help you get started with development.

## Development Setup

### Prerequisites

- Node.js 20 or higher
- npm 10 or higher
- Git
- Access to adesso AI Hub API

### Getting Started

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd dealhunter
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env.local
   ```

   Edit `.env.local` and add your API keys:
   ```bash
   OPENAI_API_KEY=your-api-key
   OPENAI_BASE_URL=https://adesso-ai-hub.3asabc.de/v1
   AUTH_SECRET=generate-with-openssl-rand-base64-32
   ```

4. **Initialize database**
   ```bash
   npm run db:push    # Apply schema
   npm run db:seed    # Load seed data
   ```

5. **Start development server**
   ```bash
   npm run dev
   ```

6. **Open browser**

   Visit [http://localhost:3000](http://localhost:3000)

   Login with:
   - Email: `admin@adesso.de`
   - Password: `admin123`

## Development Workflow

### Branch Strategy

We use **trunk-based development**:

- `main` - Production-ready code
- Feature branches - Short-lived, merged quickly
- No long-running feature branches

### Making Changes

1. **Create a feature branch**
   ```bash
   git checkout -b feat/your-feature-name
   ```

2. **Make your changes**
   - Write code following our style guide
   - Add tests for new features
   - Update documentation as needed

3. **Test your changes**
   ```bash
   npm run build        # Verify build works
   npm run type-check   # Check TypeScript (if available)
   ```

4. **Commit your changes**
   ```bash
   git add .
   git commit -m "feat: add new feature"
   ```

### Commit Message Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

**Types:**
- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `style:` - Code style changes (formatting, etc.)
- `refactor:` - Code refactoring
- `test:` - Adding or updating tests
- `chore:` - Maintenance tasks

**Examples:**
```bash
feat(bids): add quick scan agent
fix(auth): resolve session timeout issue
docs: update deployment guide
refactor(agents): simplify extraction logic
```

### Pull Request Process

1. **Push your branch**
   ```bash
   git push origin feat/your-feature-name
   ```

2. **Create Pull Request**
   - Use a descriptive title
   - Reference related issues
   - Describe what changed and why
   - Add screenshots for UI changes

3. **Code Review**
   - Address review comments
   - Keep commits clean and logical
   - Rebase if needed

4. **Merge**
   - Squash and merge is preferred
   - Delete branch after merge

## Code Style Guide

### TypeScript

- Use TypeScript for all new code
- Define proper types, avoid `any`
- Use Zod schemas for runtime validation
- Export types from component files

**Good:**
```typescript
import { z } from 'zod'

const UserSchema = z.object({
  name: z.string(),
  email: z.string().email(),
})

type User = z.infer<typeof UserSchema>
```

**Bad:**
```typescript
const user: any = { name: 'John', email: 'invalid' }
```

### React Components

- Use functional components with hooks
- Keep components small and focused
- Use ShadCN UI components (never custom UI)
- Follow the component structure:

```typescript
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

interface MyComponentProps {
  title: string
  onAction: () => void
}

export function MyComponent({ title, onAction }: MyComponentProps) {
  const [isLoading, setIsLoading] = useState(false)

  return (
    <div>
      <h2>{title}</h2>
      <Button onClick={onAction}>Action</Button>
    </div>
  )
}
```

### File Organization

```
app/
├── (dashboard)/              # Protected routes
│   ├── layout.tsx           # Shared layout
│   └── page.tsx             # Page component
├── (auth)/                  # Public routes
└── api/                     # API routes

components/
├── ui/                      # ShadCN components
├── bids/                    # Feature components
└── ai-elements/             # AI-specific components

lib/
├── agents/                  # AI agents
├── db/                      # Database
├── actions/                 # Server actions
└── utils/                   # Utilities
```

### Server Actions

- Use `'use server'` directive
- Validate inputs with Zod
- Return type-safe results
- Handle errors gracefully

```typescript
'use server'

import { z } from 'zod'
import { db } from '@/lib/db'

const CreateBidSchema = z.object({
  title: z.string().min(1),
  description: z.string(),
})

export async function createBid(input: unknown) {
  const data = CreateBidSchema.parse(input)

  try {
    const bid = await db.insert(bids).values(data).returning()
    return { success: true, data: bid }
  } catch (error) {
    return { success: false, error: 'Failed to create bid' }
  }
}
```

### AI Agents

- Use Vercel AI SDK v5
- Stream responses for better UX
- Use structured outputs with Zod
- Add proper error handling

```typescript
import { streamText } from 'ai'
import { openai } from '@ai-sdk/openai'

export async function analyzeBid(bidId: string) {
  const result = streamText({
    model: openai('gpt-4o-mini'),
    system: 'You are a bid analysis expert.',
    prompt: `Analyze bid ${bidId}`,
    onFinish: async ({ text }) => {
      await saveToDB(bidId, text)
    },
  })

  return result.toDataStreamResponse()
}
```

## Testing

### Unit Tests

```bash
npm test
```

Write tests for:
- Utility functions
- Data transformations
- Validation logic
- Agent tools

**Example:**
```typescript
import { describe, it, expect } from '@jest/globals'
import { calculateBidScore } from '@/lib/scoring'

describe('calculateBidScore', () => {
  it('should return high score for good fit', () => {
    const score = calculateBidScore({ tech: 0.9, commercial: 0.8 })
    expect(score).toBeGreaterThan(0.8)
  })
})
```

### Integration Tests

Test full workflows:
- File upload → Extraction → Quick Scan
- Bid evaluation flow
- Team assignment

### E2E Tests (Playwright)

```bash
npx playwright test
```

Test critical user journeys:
- Login flow
- Create new bid
- Run evaluation
- Assign to team

## Database Changes

### Schema Changes

1. Update schema in `lib/db/schema.ts`
2. Push changes to database:
   ```bash
   npm run db:push
   ```
3. Update seed data if needed in `lib/db/seed.ts`

### Migrations

For production, generate migrations:

```bash
drizzle-kit generate
```

This creates a migration file in `drizzle/` directory.

### Seed Data

Update `lib/db/seed.ts` for new reference data:
- Business Lines
- Technologies
- Competencies
- Default admin user

## Debugging

### Local Development

1. **Enable verbose logging**
   ```typescript
   console.log('[DEBUG]', data)
   ```

2. **Use Drizzle Studio**
   ```bash
   npm run db:studio
   ```
   View and edit database data at [https://local.drizzle.studio](https://local.drizzle.studio)

3. **Check AI responses**
   Enable debug mode in agent code:
   ```typescript
   const result = await streamText({
     model: openai('gpt-4o-mini'),
     onFinish: ({ text, usage }) => {
       console.log('[AI Response]', { text, usage })
     },
   })
   ```

### Browser DevTools

- React DevTools - Inspect component state
- Network tab - Check API requests
- Console - View logs and errors

## Performance Guidelines

### Optimize Database Queries

```typescript
// Bad - N+1 query
const bids = await db.select().from(bids)
for (const bid of bids) {
  const user = await db.select().from(users).where(eq(users.id, bid.userId))
}

// Good - Single query with join
const bids = await db
  .select()
  .from(bids)
  .leftJoin(users, eq(bids.userId, users.id))
```

### Optimize AI Requests

```typescript
// Use smaller models for simple tasks
const model = isSimpleTask ? openai('gpt-4o-mini') : openai('gpt-4o')

// Stream for better UX
const result = streamText({ model, prompt })

// Cache results
const cached = await redis.get(key)
if (cached) return cached
```

### Optimize React Rendering

```typescript
// Memoize expensive computations
const result = useMemo(() => computeExpensive(data), [data])

// Avoid unnecessary re-renders
const Component = memo(({ data }) => <div>{data}</div>)

// Use React Server Components
// No 'use client' directive = Server Component by default
```

## Documentation

### Code Comments

- Add JSDoc for public functions
- Explain "why", not "what"
- Update comments when code changes

```typescript
/**
 * Calculates bid score based on multiple factors.
 *
 * @param factors - Scoring factors (tech, commercial, risk)
 * @returns Normalized score between 0 and 1
 */
export function calculateBidScore(factors: ScoringFactors): number {
  // Weight technical fit higher for technical projects
  const techWeight = factors.projectType === 'technical' ? 0.6 : 0.4
  return factors.tech * techWeight + factors.commercial * (1 - techWeight)
}
```

### Update Documentation

When adding features, update:
- README.md (if user-facing)
- ARCHITECTURE.md (if architectural change)
- API.md (if new API endpoint)
- This file (if workflow change)

## Common Tasks

### Add a new ShadCN component

```bash
npx shadcn@latest add button
```

### Add a new page

1. Create page file: `app/(dashboard)/my-page/page.tsx`
2. Add navigation link in sidebar
3. Add route to middleware if protected

### Add a new agent

1. Create agent file: `lib/agents/my-agent.ts`
2. Define tools and system prompt
3. Create API route: `app/api/my-agent/route.ts`
4. Add UI component to call agent

### Add a new database table

1. Define schema in `lib/db/schema.ts`
2. Run `npm run db:push`
3. Add seed data if needed
4. Create server actions for CRUD

## Getting Help

- **Code Questions:** Ask in team Slack channel
- **AI SDK Issues:** Check [Vercel AI SDK Docs](https://sdk.vercel.ai)
- **Next.js Questions:** See [Next.js Documentation](https://nextjs.org/docs)
- **Database Issues:** Refer to [Drizzle ORM Docs](https://orm.drizzle.team)

## Code Review Checklist

Before submitting a PR:

- [ ] Code follows style guide
- [ ] TypeScript types are defined
- [ ] Tests are added/updated
- [ ] Build succeeds (`npm run build`)
- [ ] No console errors
- [ ] Documentation updated
- [ ] Commit messages follow convention
- [ ] No sensitive data in code
- [ ] Performance considered
- [ ] Accessibility checked

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
