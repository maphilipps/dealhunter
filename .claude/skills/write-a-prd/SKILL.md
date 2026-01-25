---
name: write-a-prd
description: Use this skill when writing a PRD for a feature.
---

# PRD Writing Skill - Interview-Based Approach

This skill uses a **deep, continuous interview process** to gather all requirements before writing the PRD. The interview continues until you have complete clarity on every aspect.

## Phase 1: Initial Context

1. If the user references a SPEC file (e.g., `@SPEC.md` or similar), **read it first** to understand the baseline.
2. Explore the relevant parts of the codebase to understand the current state and validate any assertions from the spec.

## Phase 2: Deep Interview Loop

**CRITICAL: Use `AskUserQuestionTool` for ALL questions.**

Interview the user in depth about **literally everything**. Cover these categories but don't limit yourself to them:

### Technical Implementation

- Architecture decisions and tradeoffs
- Data models and schema implications
- API design choices
- State management approach
- Performance considerations
- Error handling strategies
- Migration paths from current state

### UI & UX

- User flows and edge cases
- Loading states and feedback
- Error states and recovery
- Accessibility requirements
- Mobile/responsive considerations
- Animation and interaction patterns

### Concerns & Risks

- Security implications
- Scalability bottlenecks
- Backwards compatibility
- Data integrity during transitions
- Third-party dependencies
- Failure modes and fallbacks

### Tradeoffs

- Build vs buy decisions
- Complexity vs flexibility
- Speed vs completeness
- Consistency vs autonomy
- Short-term vs long-term

### Scope & Boundaries

- What's explicitly IN scope
- What's explicitly OUT of scope
- MVP vs full feature set
- Dependencies on other work

### Testing Strategy

- What needs unit tests
- What needs integration tests
- What needs E2E tests
- Edge cases to cover

**Interview Rules:**

- **NO OBVIOUS QUESTIONS** - Don't ask things clearly stated in the spec or that any competent developer would already know
- **BE SPECIFIC** - Ask about concrete scenarios, not abstract concepts
- **GO DEEP** - Follow up on answers to uncover hidden assumptions
- **CHALLENGE ASSUMPTIONS** - Probe decisions that might have alternatives
- **CONTINUE UNTIL COMPLETE** - Keep interviewing until you have zero open questions

Use `AskUserQuestionTool` with 2-4 targeted questions per round. After each answer, determine if you need more clarity and continue the interview loop.

**Exit the interview loop ONLY when:**

- All ambiguities are resolved
- All edge cases are addressed
- All tradeoffs are explicitly decided
- The user confirms they have nothing more to add

## Phase 3: Write the PRD

Once the interview is complete, write the PRD using this template and submit it as a GitHub issue:

<prd-template>

## Problem Statement

The problem that the user is facing, from the user's perspective.

## Solution

The solution to the problem, from the user's perspective.

## User Stories

A LONG, numbered list of user stories. Each user story should be in the format of:

1. As an <actor>, I want a <feature>, so that <benefit>

<user-story-example>
1. As a mobile bank customer, I want to see balance on my accounts, so that I can make better informed decisions about my spending
</user-story-example>

This list of user stories should be extremely extensive and cover all aspects of the feature.

## Implementation Decisions

A list of implementation decisions that were made. This can include:

- The modules that will be built/modified
- The interfaces of those modules that will be modified
- Technical clarifications from the developer
- Architectural decisions
- Schema changes
- API contracts
- Specific interactions

Do NOT include specific file paths or code snippets. They may end up being outdated very quickly.

## Testing Decisions

A list of testing decisions that were made. Include:

- A description of what makes a good test (only test external behavior, not implementation details)
- Which modules will be tested
- Prior art for the tests (i.e. similar types of tests in the codebase)

## Out of Scope

A description of the things that are out of scope for this PRD.

## Further Notes

Any further notes about the feature.

</prd-template>
