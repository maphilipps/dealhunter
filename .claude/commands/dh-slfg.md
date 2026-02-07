---
name: dh-slfg
description: DealHunter autonomous engineering workflow with ralph-loop and swarm execution
argument-hint: '[feature description or brainstorm/plan file path]'
---

DealHunter swarm-enabled autonomous workflow. Run these steps in order, parallelizing where indicated.

## Sequential Phase

1. `/ralph-loop:ralph-loop "finish all slash commands" --completion-promise "DONE"`
2. `/workflows:plan $ARGUMENTS`
3. `/compound-engineering:deepen-plan`
4. `/ship $ARGUMENTS` — Use the DealHunter ship command which spawns expert teams with bypassPermissions and sonnet model

## Parallel Phase

After ship completes, launch steps 5 and 6 as **parallel swarm agents** (both only need code to be written):

5. `/workflows:review` — spawn as background Task agent. Must also invoke `react-best-practices` and `ai-sdk` skills during review.
6. `/compound-engineering:test-browser` — spawn as background Task agent

Wait for both to complete before continuing.

## Finalize Phase

7. `/compound-engineering:resolve_todo_parallel` — resolve any findings from the review
8. Run `npx tsc --noEmit` and `npm test` — ensure everything is clean
9. `/compound-engineering:feature-video` — record the final walkthrough and add to PR
10. Output `<promise>DONE</promise>` when video is in PR

Start with step 1 now.
