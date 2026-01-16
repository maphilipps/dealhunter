---
status: pending
priority: p3
issue_id: "009"
tags: [code-review, refactoring, code-quality, duplication]
dependencies: []
---

# Code Duplication in Color Mapping Logic

## Problem Statement

Color determination logic (confidence thresholds → colors) is duplicated 3-4 times across ConfidenceIndicator component. The same mapping (80%+ = green, 60-79% = yellow, <60% = red) is implemented in separate functions for different purposes.

**Why it matters:**
- DRY violation (Don't Repeat Yourself)
- Maintenance burden (change color scheme = update 4 places)
- Inconsistency risk (mappings drift apart)
- Code clarity reduced
- Violates clean code principles

## Findings

**Location:** `components/ai-elements/confidence-indicator.tsx:24-69`

**Evidence:**
```typescript
// DUPLICATION 1: Determine base color
const getConfidenceColor = () => {
  if (confidence >= 80) return 'green';
  if (confidence >= 60) return 'yellow';
  return 'red';
};

// DUPLICATION 2: CSS background classes
const getColorClasses = () => {
  switch (color) {
    case 'green': return 'bg-green-500';
    case 'yellow': return 'bg-yellow-500';
    case 'red': return 'bg-red-500';
  }
};

// DUPLICATION 3: Text color classes
const getTextColor = () => {
  switch (color) {
    case 'green': return 'text-green-700';
    case 'yellow': return 'text-yellow-700';
    case 'red': return 'text-red-700';
  }
};

// DUPLICATION 4: Badge variants
const getBadgeVariant = () => {
  switch (color) {
    case 'green': return 'default';
    case 'yellow': return 'secondary';
    case 'red': return 'destructive';
  }
};
```

**Source:** Pattern Recognition Specialist review agent

## Proposed Solutions

### Solution 1: Color Config Object (Recommended)

Extract all color mappings to single config object.

**Pros:**
- Single source of truth
- Easy to change color scheme
- Type-safe with TypeScript
- Clear and maintainable

**Cons:**
- None

**Effort:** Small (30 minutes)
**Risk:** Low

**Implementation:**
```typescript
const CONFIDENCE_COLORS = {
  high: {
    threshold: 80,
    name: 'green' as const,
    bg: 'bg-green-500',
    text: 'text-green-700',
    badge: 'default' as const,
    label: 'High',
  },
  medium: {
    threshold: 60,
    name: 'yellow' as const,
    bg: 'bg-yellow-500',
    text: 'text-yellow-700',
    badge: 'secondary' as const,
    label: 'Medium',
  },
  low: {
    threshold: 0,
    name: 'red' as const,
    bg: 'bg-red-500',
    text: 'text-red-700',
    badge: 'destructive' as const,
    label: 'Low',
  },
} as const;

export function ConfidenceIndicator({ confidence, showLabel, size }) {
  // Single function to get config
  const getConfig = () => {
    if (confidence >= CONFIDENCE_COLORS.high.threshold) return CONFIDENCE_COLORS.high;
    if (confidence >= CONFIDENCE_COLORS.medium.threshold) return CONFIDENCE_COLORS.medium;
    return CONFIDENCE_COLORS.low;
  };

  const config = getConfig();

  return (
    <div className=\"flex items-center gap-2\">
      <div className=\"flex-1 min-w-[60px] bg-gray-200 rounded-full overflow-hidden\">
        <div
          className={`${sizeClasses[size]} ${config.bg} transition-all duration-300`}
          style={{ width: `${confidence}%` }}
        />
      </div>
      {showLabel && (
        <div className=\"flex items-center gap-2\">
          <span className={`text-sm font-medium tabular-nums ${config.text}`}>
            {confidence}%
          </span>
          <Badge variant={config.badge} className=\"text-xs\">
            {config.label}
          </Badge>
        </div>
      )}
    </div>
  );
}
```

### Solution 2: Utility Functions

Extract to shared utility module.

**Pros:**
- Reusable across components
- Can be tested independently

**Cons:**
- Overkill if only used in one component
- More files to manage

**Effort:** Small (1 hour)
**Risk:** Low

**Not Recommended** - Solution 1 is simpler for single-component use.

### Solution 3: CSS Variables

Use CSS custom properties for theming.

**Pros:**
- Dynamic theming support
- No JS needed for colors

**Cons:**
- Doesn't eliminate logic duplication
- More complex for this use case

**Effort:** Medium (2 hours)
**Risk:** Low

**Not Recommended** - over-engineered.

## Recommended Action

*(To be filled during triage)*

## Technical Details

**Affected Files:**
- `components/ai-elements/confidence-indicator.tsx`

**Changes:**
- Remove 4 separate functions
- Add single CONFIDENCE_COLORS config
- Simplify component logic

**Benefits:**
- Reduced code from ~70 lines to ~40 lines
- Easier to change color scheme (1 object vs 4 functions)
- Type-safe color mappings

## Acceptance Criteria

- [ ] All color logic in single config object
- [ ] No duplicate threshold checks
- [ ] Type-safe color configuration
- [ ] Component behavior unchanged
- [ ] Tests still pass
- [ ] Easy to modify color scheme (prove by changing to blue/orange/purple)
- [ ] Code review confirms duplication eliminated

## Work Log

**2026-01-16**: Todo created from Pattern Recognition Specialist review findings

## Resources

- Pattern Recognition Specialist review report
- TypeScript const assertions: https://www.typescriptlang.org/docs/handbook/release-notes/typescript-3-4.html#const-assertions
- React component refactoring: https://kentcdodds.com/blog/colocation
