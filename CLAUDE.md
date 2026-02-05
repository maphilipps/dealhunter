Use npm for all package management.

## Code Reviews

Always use these skills during code reviews:

- `react-best-practices` — React/Next.js performance and patterns
- `ai-sdk` — AI SDK usage and best practices
- `code-simplifier` — Simplify and refine code for clarity and maintainability

## Agent Tool Naming Conventions

Agent tools in `lib/agent-tools/tools/` follow a consistent naming pattern to maintain clarity and predictability.

### Standard CRUD Tools

Use the **`entity.operation`** pattern for database operations:

| Operation  | Pattern         | Example             | Purpose                                      |
| ---------- | --------------- | ------------------- | -------------------------------------------- |
| **List**   | `entity.list`   | `reference.list`    | Query multiple records with optional filters |
| **Get**    | `entity.get`    | `competency.get`    | Retrieve a single record by ID               |
| **Create** | `entity.create` | `employee.create`   | Insert a new record                          |
| **Update** | `entity.update` | `technology.update` | Modify an existing record                    |
| **Delete** | `entity.delete` | `competitor.delete` | Remove or soft-delete a record               |

**Examples:**

- ✅ `preQualification.list` — list pre-qualifications
- ✅ `reference.get` — get single reference by ID
- ✅ `competency.create` — create new competency
- ❌ `getPreQualifications()` — avoid function-style naming
- ❌ `createNewCompetency()` — avoid verbose action verbs

### Data Primitives

Use **`domain.operation_noun`** (with underscores) for stateless data operations that don't involve complex business logic:

| Prefix               | Purpose                 | Examples                          |
| -------------------- | ----------------------- | --------------------------------- |
| `domain.list_*`      | Raw data retrieval      | `decision.list_sections`          |
| `domain.*_stats`     | Stateless calculations  | `decision.section_stats`          |
| `domain.parse_*`     | Text parsing/extraction | `optimizer.parseConfidenceField`  |
| `domain.detect_*`    | Pattern detection       | `optimizer.detectFeatures`        |
| `domain.match_*`     | Pattern matching        | `optimizer.matchCMSPatterns`      |
| `domain.extract_*`   | Information extraction  | `optimizer.extractEmployeeCount`  |
| `domain.calculate_*` | Math/aggregation        | `evaluator.calculateCompleteness` |
| `domain.validate_*`  | Validation checks       | `evaluator.validateFields`        |

**Examples:**

- ✅ `decision.list_sections` — retrieve raw section data
- ✅ `decision.section_stats` — calculate completeness metrics
- ✅ `optimizer.matchCMSPatterns` — CMS pattern matching
- ❌ `decision.aggregate` — deprecated, mixes retrieval + calculation
- ❌ `optimizer.optimizeResults` — deprecated, action-oriented verb

### Workflow Tools

Use **`workflow.verb_noun`** for tools that orchestrate multi-step processes or trigger side effects:

| Pattern               | Purpose                   | Examples                                               |
| --------------------- | ------------------------- | ------------------------------------------------------ |
| `workflow.start_*`    | Begin async process       | `extraction.start`, `pitchScan.start`                  |
| `workflow.update_*`   | Workflow state transition | `preQualification.updateStatus`                        |
| `workflow.*_decision` | Decision points           | `preQualification.makeDecision`                        |
| `workflow.route*`     | Routing operations        | `routing.assignBusinessUnit`, `preQualification.route` |

**Examples:**

- ✅ `extraction.start` — start extraction workflow
- ✅ `pitchScan.start` — start scan pipeline
- ✅ `preQualification.updateStatus` — transition workflow status
- ✅ `routing.assignBusinessUnit` — route to business unit
- ❌ `startExtraction()` — avoid bare function names

### Tool Naming Anti-Patterns

**Avoid these patterns:**

- ❌ `analyze.*` — analysis is the agent's job, not the tool's
- ❌ `evaluate.*` — evaluation/judgment is the agent's job (use `calculate_*` or `validate_*` instead)
- ❌ `optimize.*` — optimization is the agent's job
- ❌ Bare verbs like `process()`, `handle()`, `manage()` — too vague
- ❌ Function-style names like `getUserById()` — use dot notation
- ❌ CamelCase tool names like `preQualification.createFromFreetext` — use snake_case for multi-word operations or keep it concise

**Deprecated patterns to avoid in new tools:**

- `decision.aggregate` — use `decision.list_sections` + `decision.section_stats`
- `notification.sendTeamAlert` — use `notification.send_email` or `notification.send_team_emails`

### Categories

Tools are grouped by category in the registry. Use these standard categories:

- `pre-qualification` — Pre-qualification/bid management
- `reference` — Reference project management
- `competency` — Competency management
- `competitor` — Competitor management
- `employee` — Employee management
- `technology` — Technology management
- `business-unit` — Business unit management
- `user` — User management
- `decision` — BID/NO-BID decision support
- `scan` — Website scanning and analysis
- `extraction` — Data extraction workflows
- `routing` — Business line routing
- `notification` — Email and notifications
- `audit` — Audit trail and logging
- `document` — Document management
- `staffing` — Staffing and team assignment

### Principles

1. **Tools provide data, agents provide intelligence** — Tools should be data-retrieval primitives or stateless calculations. Let agents do the thinking.

2. **Predictable naming reduces cognitive load** — Consistent patterns make it easy for agents (and developers) to find the right tool.

3. **Avoid action-oriented verbs in CRUD tools** — `reference.get` is better than `reference.fetch` or `getReferenceById`. Use the standard CRUD verbs: list, get, create, update, delete.

4. **Use underscores for multi-word operations** — `decision.list_sections` not `decision.listSections`.

5. **Deprecate, don't delete** — When refactoring, keep old tools marked as deprecated to maintain backward compatibility.
