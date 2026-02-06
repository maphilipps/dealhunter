# Agent-Native Parity Matrix

Audit of UI actions vs. agent tool coverage. Identifies gaps where the UI exposes functionality that agents cannot perform natively.

> Generated: 2026-02-06

## Legend

- **Tool exists** = An agent tool in `lib/agent-tools/tools/*.ts` covers this action
- **Gap** = No agent tool exists; agents cannot perform this action without calling a server action or API route directly

---

## Qualifications (Pre-Qualifications)

| UI Action                       | Route / Component                                              | Agent Tool                                             | Gap?                                                 |
| ------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------ | ---------------------------------------------------- |
| List qualifications             | `GET /api/bids`                                                | `preQualification.list`                                | --                                                   |
| Get qualification detail        | `app/(dashboard)/qualifications/[id]/page.tsx`                 | `preQualification.get`                                 | --                                                   |
| Create from freetext            | `app/(dashboard)/qualifications/new/page.tsx`                  | `preQualification.createFromFreetext`                  | --                                                   |
| Create from PDF upload          | `POST /api/submit` (FormData)                                  | --                                                     | **GAP** (requires file upload, not agent-compatible) |
| Update qualification            | --                                                             | `preQualification.update`                              | --                                                   |
| Delete (archive) qualification  | --                                                             | `preQualification.delete`                              | --                                                   |
| Transition status               | --                                                             | `preQualification.updateStatus`                        | --                                                   |
| Make BID/NO-BID decision        | `components/bids/phases/bl-decision-phase.tsx`                 | `preQualification.makeDecision`                        | --                                                   |
| Route to business unit          | `components/bids/bl-routing-card.tsx`                          | `preQualification.route`, `routing.assignBusinessUnit` | --                                                   |
| Archive as NO-BID               | --                                                             | `routing.archiveAsNoBid`                               | --                                                   |
| Get BU recommendation           | --                                                             | `routing.getRecommendation`                            | --                                                   |
| Get qualifications scan results | --                                                             | `preQualification.getQualificationsScan`               | --                                                   |
| List qualification documents    | --                                                             | `preQualification.listDocuments`                       | --                                                   |
| Duplicate check                 | `POST /api/qualifications/[id]/duplicate-check`                | --                                                     | **GAP**                                              |
| Start extraction                | --                                                             | `extraction.start`                                     | --                                                   |
| Start qualifications scan       | `POST /api/qualifications/[id]/quick-scan/start`               | --                                                     | **GAP** (no agent tool to start qual scan)           |
| Stream qualifications scan      | `GET /api/qualifications/[id]/quick-scan/stream`               | --                                                     | **GAP** (SSE stream, read-only)                      |
| Rescan qualifications           | `POST /api/qualifications/[id]/qualifications-scan/rescan`     | --                                                     | **GAP**                                              |
| Export qualifications scan      | `GET /api/qualifications/[id]/qualifications-scan/export`      | --                                                     | **GAP**                                              |
| Trigger deep analysis           | `POST /api/qualifications/[id]/deep-analysis/trigger`          | --                                                     | **GAP**                                              |
| Get deep analysis status        | `GET /api/qualifications/[id]/deep-analysis/status`            | --                                                     | **GAP**                                              |
| Get deep analysis results       | `GET /api/qualifications/[id]/deep-analysis/results`           | --                                                     | **GAP**                                              |
| Run expert agents               | `POST /api/qualifications/[id]/run-expert-agents`              | --                                                     | **GAP**                                              |
| Rerun summary                   | `POST /api/qualifications/[id]/rerun-summary`                  | --                                                     | **GAP**                                              |
| Get dashboard summary           | `GET /api/qualifications/[id]/dashboard-summary`               | --                                                     | **GAP**                                              |
| Get processing status           | `GET /api/qualifications/[id]/processing-status`               | --                                                     | **GAP**                                              |
| Stream evaluation               | `POST /api/qualifications/[id]/evaluate/stream`                | --                                                     | **GAP**                                              |
| Stream extraction               | `POST /api/qualifications/[id]/extraction/stream`              | --                                                     | **GAP**                                              |
| BU matching                     | `GET /api/qualifications/[id]/bu-matching`                     | --                                                     | **GAP**                                              |
| Facts visualization             | `GET /api/qualifications/[id]/facts-visualization`             | --                                                     | **GAP**                                              |
| CMS matrix stream               | `POST /api/qualifications/[id]/cms-matrix/stream`              | --                                                     | **GAP**                                              |
| Visualization                   | `POST /api/qualifications/[id]/visualization`                  | --                                                     | **GAP**                                              |
| View section data               | `GET /api/qualifications/[id]/sections/[sectionId]`            | --                                                     | **GAP** (no `qualification.get_section` tool)        |
| Visualize section               | `POST /api/qualifications/[id]/sections/[sectionId]/visualize` | --                                                     | **GAP**                                              |
| Background job trigger          | `POST /api/qualifications/[id]/background-job`                 | --                                                     | **GAP**                                              |

## Leads (Pitches)

| UI Action                      | Route / Component                                       | Agent Tool              | Gap?                                                 |
| ------------------------------ | ------------------------------------------------------- | ----------------------- | ---------------------------------------------------- |
| List leads                     | `app/(dashboard)/pitches/page.tsx`                      | `lead.list`             | --                                                   |
| Get lead detail                | `app/(dashboard)/pitches/[id]/page.tsx`                 | `lead.get`              | --                                                   |
| Create lead from qualification | --                                                      | `lead.create`           | --                                                   |
| Update lead                    | --                                                      | `lead.update`           | --                                                   |
| Delete (archive) lead          | --                                                      | `lead.delete`           | --                                                   |
| Transition lead status         | --                                                      | `lead.transitionStatus` | --                                                   |
| Request more info              | --                                                      | `lead.requestMoreInfo`  | --                                                   |
| Submit BL vote                 | `POST /api/pitches/[id]/vote`                           | `lead.submitBLVote`     | --                                                   |
| Update lead section            | --                                                      | `lead.updateSection`    | --                                                   |
| Delete lead section            | --                                                      | `lead.deleteSection`    | --                                                   |
| Start audit scan               | `POST /api/pitches/[id]/audit-scan/start`               | `auditScan.start`       | --                                                   |
| Chat with lead data            | `POST /api/pitches/[id]/chat`                           | --                      | **GAP**                                              |
| Answer follow-up question      | `POST /api/pitches/[id]/answer`                         | --                      | **GAP**                                              |
| Retry failed agent             | `POST /api/pitches/[id]/retry`                          | --                      | **GAP**                                              |
| Visualize all sections         | `POST /api/pitches/[id]/visualize-all`                  | --                      | **GAP**                                              |
| Run CMS advocates              | `POST /api/pitches/[id]/cms-advocates/run`              | --                      | **GAP**                                              |
| Get CMS advocates data         | `GET /api/pitches/[id]/cms-advocates`                   | --                      | **GAP**                                              |
| Get quick scan data            | `GET /api/pitches/[id]/quick-scan-data`                 | --                      | **GAP**                                              |
| Get section data               | `GET /api/pitches/[id]/section-data`                    | --                      | **GAP** (no `lead.list_sections` equivalent in REST) |
| Update section data            | `PATCH /api/pitches/[id]/section-data/[sectionId]`      | `lead.updateSection`    | --                                                   |
| Delete section data            | `DELETE /api/pitches/[id]/section-data/[sectionId]`     | `lead.deleteSection`    | --                                                   |
| Get lead progress (SSE)        | `GET /api/pitches/[id]/progress`                        | --                      | **GAP** (SSE stream)                                 |
| Get calc sheet                 | `GET /api/pitches/[id]/calc-sheet`                      | --                      | **GAP**                                              |
| Share lead (public link)       | `GET /api/pitches/share/[token]`                        | --                      | **GAP** (no tool to create share tokens)             |
| Research section               | `POST /api/pitches/[id]/sections/[sectionId]/research`  | --                      | **GAP**                                              |
| Visualize section              | `POST /api/pitches/[id]/sections/[sectionId]/visualize` | --                      | **GAP**                                              |

## Audit Scan (Website Audit)

| UI Action                 | Route / Component                                        | Agent Tool                | Gap?                                         |
| ------------------------- | -------------------------------------------------------- | ------------------------- | -------------------------------------------- |
| Create audit scan run     | --                                                       | `auditScanRun.create`     | --                                           |
| List audit scan runs      | --                                                       | `auditScanRun.list`       | --                                           |
| Get audit scan run        | --                                                       | `auditScanRun.get`        | --                                           |
| Update audit scan run     | --                                                       | `auditScanRun.update`     | --                                           |
| Cancel audit scan run     | --                                                       | `auditScanRun.cancel`     | --                                           |
| Get latest run            | --                                                       | `auditScanRun.get_latest` | --                                           |
| List audit scan results   | --                                                       | `auditScanResult.list`    | --                                           |
| Get audit scan result     | --                                                       | `auditScanResult.get`     | --                                           |
| Start audit scan pipeline | `POST /api/pitches/[id]/audit-scan/start`                | `auditScan.start`         | --                                           |
| Chat with audit scan data | `POST /api/pitches/[id]/audit-scan/chat`                 | --                        | **GAP**                                      |
| Get audit scan section    | `GET /api/pitches/[id]/audit-scan/sections/[sectionId]`  | --                        | **GAP** (no agent tool to read scan section) |
| Write audit scan section  | `POST /api/pitches/[id]/audit-scan/sections/[sectionId]` | --                        | **GAP**                                      |
| Get audit status          | `POST /api/pitches/[id]/audit/status`                    | --                        | **GAP**                                      |

## Audit Results (Legacy)

| UI Action           | Route / Component                                  | Agent Tool             | Gap?                                  |
| ------------------- | -------------------------------------------------- | ---------------------- | ------------------------------------- |
| List audit results  | `GET /api/pitches/[id]/audit-results`              | `auditScanResult.list` | --                                    |
| Create audit result | `POST /api/pitches/[id]/audit-results`             | --                     | **GAP** (no `auditScanResult.create`) |
| Get audit result    | `GET /api/pitches/[id]/audit-results/[auditId]`    | `auditScanResult.get`  | --                                    |
| Update audit result | `PATCH /api/pitches/[id]/audit-results/[auditId]`  | --                     | **GAP** (no `auditScanResult.update`) |
| Delete audit result | `DELETE /api/pitches/[id]/audit-results/[auditId]` | --                     | **GAP** (no `auditScanResult.delete`) |

## Pitch Scan Runs

| UI Action      | Route / Component                    | Agent Tool          | Gap? |
| -------------- | ------------------------------------ | ------------------- | ---- |
| List runs      | `GET /api/pitches/[id]/runs`         | `auditScanRun.list` | --   |
| Get run detail | `GET /api/pitches/[id]/runs/[runId]` | `auditScanRun.get`  | --   |

## Documents (Bid Documents)

| UI Action                | Route / Component                                  | Agent Tool                                           | Gap?                           |
| ------------------------ | -------------------------------------------------- | ---------------------------------------------------- | ------------------------------ |
| List documents           | --                                                 | `document.list`, `document.get_by_pre_qualification` | --                             |
| Get document             | --                                                 | `document.get`                                       | --                             |
| Delete document          | --                                                 | `document.delete`                                    | --                             |
| Upload document          | `POST /api/pitches/[id]/documents` (FormData)      | --                                                   | **GAP** (requires file upload) |
| Update document metadata | `PATCH /api/pitches/[id]/documents/[docId]`        | --                                                   | **GAP**                        |
| Delete pitch document    | `DELETE /api/pitches/[id]/documents/[docId]`       | `document.delete`                                    | --                             |
| Download document        | `GET /api/pitches/[id]/documents/[docId]/download` | --                                                   | **GAP** (binary download)      |
| Download (standalone)    | `GET /api/documents/[id]/download`                 | --                                                   | **GAP** (binary download)      |

## Pitch Documents (Generated)

| UI Action                | Route / Component | Agent Tool           | Gap? |
| ------------------------ | ----------------- | -------------------- | ---- |
| List generated documents | --                | `pitchDocument.list` | --   |
| Get generated document   | --                | `pitchDocument.get`  | --   |

## Pitchdeck

| UI Action              | Route / Component                                               | Agent Tool                     | Gap?                       |
| ---------------------- | --------------------------------------------------------------- | ------------------------------ | -------------------------- |
| Create pitchdeck       | --                                                              | `pitchdeck.create`             | --                         |
| Get pitchdeck          | --                                                              | `pitchdeck.get`                | --                         |
| List pitchdecks        | --                                                              | `pitchdeck.list`               | --                         |
| Update pitchdeck       | --                                                              | `pitchdeck.update`             | --                         |
| Delete pitchdeck       | --                                                              | `pitchdeck.delete`             | --                         |
| Add deliverable        | --                                                              | `pitchdeck.add_deliverable`    | --                         |
| Update deliverable     | --                                                              | `pitchdeck.update_deliverable` | --                         |
| Delete deliverable     | --                                                              | `pitchdeck.delete_deliverable` | --                         |
| Add team member        | --                                                              | `pitchdeck.add_team_member`    | --                         |
| Remove team member     | --                                                              | `pitchdeck.remove_team_member` | --                         |
| Update pitchdeck team  | `POST /api/pitches/[id]/pitchdeck/update-team`                  | --                             | **GAP** (bulk team update) |
| Confirm pitchdeck team | `POST /api/pitches/[id]/pitchdeck/confirm-team`                 | --                             | **GAP**                    |
| Regenerate deliverable | `POST /api/pitches/[id]/pitchdeck/deliverables/[id]/regenerate` | --                             | **GAP**                    |

## Accounts

| UI Action      | Route / Component                             | Agent Tool       | Gap? |
| -------------- | --------------------------------------------- | ---------------- | ---- |
| List accounts  | `app/(dashboard)/accounts/page.tsx`           | `account.list`   | --   |
| Get account    | `app/(dashboard)/accounts/[id]/page.tsx`      | `account.get`    | --   |
| Create account | `app/(dashboard)/accounts/new/page.tsx`       | `account.create` | --   |
| Update account | `app/(dashboard)/accounts/[id]/edit/page.tsx` | `account.update` | --   |
| Delete account | --                                            | `account.delete` | --   |

## References

| UI Action        | Route / Component                                 | Agent Tool         | Gap? |
| ---------------- | ------------------------------------------------- | ------------------ | ---- |
| List references  | `app/(dashboard)/master-data/references/page.tsx` | `reference.list`   | --   |
| Get reference    | `GET /api/master-data/references/[id]`            | `reference.get`    | --   |
| Create reference | `POST /api/master-data/references`                | `reference.create` | --   |
| Update reference | `PATCH /api/master-data/references`               | `reference.update` | --   |
| Delete reference | `DELETE /api/master-data/references/[id]`         | `reference.delete` | --   |

## Competencies

| UI Action         | Route / Component                                        | Agent Tool          | Gap? |
| ----------------- | -------------------------------------------------------- | ------------------- | ---- |
| List competencies | `app/(dashboard)/master-data/competencies/page.tsx`      | `competency.list`   | --   |
| Get competency    | `app/(dashboard)/master-data/competencies/[id]/page.tsx` | `competency.get`    | --   |
| Create competency | `POST /api/master-data/competencies`                     | `competency.create` | --   |
| Update competency | `PATCH /api/master-data/competencies`                    | `competency.update` | --   |
| Delete competency | `DELETE /api/master-data/competencies/[id]`              | `competency.delete` | --   |

## Competitors

| UI Action          | Route / Component                                       | Agent Tool                 | Gap? |
| ------------------ | ------------------------------------------------------- | -------------------------- | ---- |
| List competitors   | `app/(dashboard)/master-data/competitors/page.tsx`      | `competitor.list`          | --   |
| Get competitor     | `app/(dashboard)/master-data/competitors/[id]/page.tsx` | `competitor.get`           | --   |
| Create competitor  | `POST /api/master-data/competitors`                     | `competitor.create`        | --   |
| Update competitor  | `PATCH /api/master-data/competitors`                    | `competitor.update`        | --   |
| Delete competitor  | `DELETE /api/master-data/competitors/[id]`              | `competitor.delete`        | --   |
| Search competitors | --                                                      | `competitor.search`        | --   |
| Add encounter note | --                                                      | `competitor.add_encounter` | --   |

## Employees

| UI Action       | Route / Component                                     | Agent Tool        | Gap? |
| --------------- | ----------------------------------------------------- | ----------------- | ---- |
| List employees  | `app/(dashboard)/master-data/employees/page.tsx`      | `employee.list`   | --   |
| Get employee    | `app/(dashboard)/master-data/employees/[id]/page.tsx` | `employee.get`    | --   |
| Create employee | `app/(dashboard)/master-data/employees/new/page.tsx`  | `employee.create` | --   |
| Update employee | --                                                    | `employee.update` | --   |
| Delete employee | --                                                    | `employee.delete` | --   |

## Technologies

| UI Action                | Route / Component                                        | Agent Tool                     | Gap?    |
| ------------------------ | -------------------------------------------------------- | ------------------------------ | ------- |
| List technologies        | `app/(dashboard)/master-data/technologies/page.tsx`      | `technology.list`              | --      |
| Get technology           | `app/(dashboard)/master-data/technologies/[id]/page.tsx` | `technology.get`               | --      |
| Create technology        | `app/(dashboard)/master-data/technologies/new/page.tsx`  | `technology.create`            | --      |
| Update technology        | --                                                       | `technology.update`            | --      |
| Delete technology        | --                                                       | `technology.delete`            | --      |
| Discover features        | --                                                       | `technology.discover_features` | --      |
| Check EOL status         | --                                                       | `technology.check_eol`         | --      |
| Research technology (AI) | `POST /api/admin/technologies/[id]/research`             | --                             | **GAP** |
| Research feature (AI)    | `POST /api/admin/technologies/[id]/research-feature`     | --                             | **GAP** |
| Review features (AI)     | `POST /api/admin/technologies/[id]/review-features`      | --                             | **GAP** |
| Run tech orchestrator    | `POST /api/admin/technologies/[id]/orchestrator`         | --                             | **GAP** |

## Business Units

| UI Action            | Route / Component                                         | Agent Tool                      | Gap? |
| -------------------- | --------------------------------------------------------- | ------------------------------- | ---- |
| List business units  | `app/(dashboard)/master-data/business-units/page.tsx`     | `businessUnit.list`             | --   |
| Get business unit    | --                                                        | `businessUnit.get`              | --   |
| Create business unit | `app/(dashboard)/master-data/business-units/new/page.tsx` | `businessUnit.create`           | --   |
| Update business unit | --                                                        | `businessUnit.update`           | --   |
| Delete business unit | --                                                        | `businessUnit.delete`           | --   |
| List capabilities    | --                                                        | `businessUnit.listCapabilities` | --   |

## Users

| UI Action    | Route / Component                      | Agent Tool    | Gap?                       |
| ------------ | -------------------------------------- | ------------- | -------------------------- |
| List users   | `app/(dashboard)/admin/users/page.tsx` | `user.list`   | --                         |
| Get user     | --                                     | `user.get`    | --                         |
| Search users | --                                     | `user.search` | --                         |
| Create user  | --                                     | --            | **GAP** (no `user.create`) |
| Update user  | --                                     | --            | **GAP** (no `user.update`) |
| Delete user  | --                                     | --            | **GAP** (no `user.delete`) |

## Team Assignments

| UI Action             | Route / Component | Agent Tool                              | Gap? |
| --------------------- | ----------------- | --------------------------------------- | ---- |
| List assignments      | --                | `teamAssignment.list`                   | --   |
| Get assignment        | --                | `teamAssignment.get`                    | --   |
| Create assignment     | --                | `teamAssignment.create`                 | --   |
| Update assignment     | --                | `teamAssignment.update`                 | --   |
| Delete assignment     | --                | `teamAssignment.delete`                 | --   |
| Mark as notified      | --                | `teamAssignment.markNotified`           | --   |
| List by qualification | --                | `teamAssignment.listByPreQualification` | --   |

## Staffing

| UI Action                | Route / Component | Agent Tool                          | Gap? |
| ------------------------ | ----------------- | ----------------------------------- | ---- |
| Calculate skill match    | --                | `staffing.calculate_skill_match`    | --   |
| Find employees by skills | --                | `staffing.find_employees_by_skills` | --   |
| Check availability       | --                | `staffing.check_availability`       | --   |

## Notifications

| UI Action         | Route / Component | Agent Tool                       | Gap? |
| ----------------- | ----------------- | -------------------------------- | ---- |
| Send email        | --                | `notification.send_email`        | --   |
| Send team emails  | --                | `notification.send_team_emails`  | --   |
| Schedule reminder | --                | `notification.schedule_reminder` | --   |
| List reminders    | --                | `notification.list_reminders`    | --   |
| Cancel reminder   | --                | `notification.cancel_reminder`   | --   |

## Workflow / Background Jobs

| UI Action           | Route / Component                                          | Agent Tool                | Gap?                  |
| ------------------- | ---------------------------------------------------------- | ------------------------- | --------------------- |
| List jobs           | `GET /api/jobs`                                            | `workflow.list_jobs`      | --                    |
| Get job status      | `GET /api/jobs/[id]`                                       | `workflow.get_job_status` | --                    |
| Cancel job          | `DELETE /api/jobs/[id]`                                    | `workflow.cancel_job`     | --                    |
| Retry job           | --                                                         | `workflow.retry_job`      | --                    |
| Stream job progress | `GET /api/jobs/[id]/progress`, `GET /api/jobs/[id]/stream` | --                        | **GAP** (SSE streams) |

## Audit Trail

| UI Action        | Route / Component                      | Agent Tool                 | Gap? |
| ---------------- | -------------------------------------- | -------------------------- | ---- |
| List audit trail | `app/(dashboard)/admin/audit/page.tsx` | `audittrail.list`          | --   |
| Get audit entry  | --                                     | `audittrail.get`           | --   |
| Get by entity    | --                                     | `audittrail.get_by_entity` | --   |
| Get by user      | --                                     | `audittrail.get_by_user`   | --   |

## Knowledge Base (RAG)

| UI Action              | Route / Component                               | Agent Tool                    | Gap?                           |
| ---------------------- | ----------------------------------------------- | ----------------------------- | ------------------------------ |
| Search knowledge       | `GET /api/pitches/knowledge/search`             | `createRagTool` (AI SDK tool) | --                             |
| Upload knowledge doc   | `POST /api/pitches/knowledge/upload` (FormData) | --                            | **GAP** (requires file upload) |
| Delete knowledge chunk | `DELETE /api/pitches/knowledge/[chunkId]`       | --                            | **GAP**                        |

## Analytics

| UI Action                | Route / Component                    | Agent Tool | Gap?    |
| ------------------------ | ------------------------------------ | ---------- | ------- |
| Get analytics overview   | `GET /api/analytics/overview`        | --         | **GAP** |
| View analytics dashboard | `app/(dashboard)/analytics/page.tsx` | --         | **GAP** |

## Master Data Matching

| UI Action         | Route / Component             | Agent Tool | Gap?    |
| ----------------- | ----------------------------- | ---------- | ------- |
| Match master data | `POST /api/master-data/match` | --         | **GAP** |

## Admin Config

| UI Action                  | Route / Component                            | Agent Tool | Gap?                                               |
| -------------------------- | -------------------------------------------- | ---------- | -------------------------------------------------- |
| View/Edit AI model configs | `app/(dashboard)/admin/configs/page.tsx`     | --         | **GAP** (no `config.list` / `config.update` tools) |
| View validations           | `app/(dashboard)/admin/validations/page.tsx` | --         | **GAP**                                            |

## Slack Integration

| UI Action             | Route / Component | Agent Tool | Gap?                           |
| --------------------- | ----------------- | ---------- | ------------------------------ |
| Receive Slack webhook | `POST /api/slack` | --         | **GAP** (inbound webhook only) |

---

## Gap Summary

### High Priority Gaps (frequently used write operations)

| #   | Gap                       | Suggested Tool Name                      | Notes                                                  |
| --- | ------------------------- | ---------------------------------------- | ------------------------------------------------------ |
| 1   | Start qualifications scan | `qualificationsScan.start`               | Wraps `/api/qualifications/[id]/quick-scan/start`      |
| 2   | Trigger deep analysis     | `deepAnalysis.start`                     | Wraps `/api/qualifications/[id]/deep-analysis/trigger` |
| 3   | Run expert agents         | `expertAgents.start`                     | Wraps `/api/qualifications/[id]/run-expert-agents`     |
| 4   | Duplicate check           | `preQualification.check_duplicate`       | Wraps `/api/qualifications/[id]/duplicate-check`       |
| 5   | Chat with lead            | `lead.chat`                              | Wraps `/api/pitches/[id]/chat`                         |
| 6   | Retry failed agent        | `lead.retry_agent`                       | Wraps `/api/pitches/[id]/retry`                        |
| 7   | Run CMS advocates         | `cmsAdvocate.start`                      | Wraps `/api/pitches/[id]/cms-advocates/run`            |
| 8   | Analytics overview        | `analytics.get_overview`                 | Wraps `/api/analytics/overview`                        |
| 9   | Get processing status     | `preQualification.get_processing_status` | Wraps `/api/qualifications/[id]/processing-status`     |
| 10  | Get dashboard summary     | `preQualification.get_dashboard_summary` | Wraps `/api/qualifications/[id]/dashboard-summary`     |

### Medium Priority Gaps (useful but less critical)

| #   | Gap                      | Suggested Tool Name                | Notes                          |
| --- | ------------------------ | ---------------------------------- | ------------------------------ |
| 11  | Rescan qualifications    | `qualificationsScan.rescan`        | Re-trigger scan                |
| 12  | Rerun summary            | `preQualification.rerun_summary`   | Regenerate summary             |
| 13  | Research section         | `lead.research_section`            | AI research for a section      |
| 14  | Visualize section        | `lead.visualize_section`           | Generate section visualization |
| 15  | Visualize all sections   | `lead.visualize_all`               | Bulk visualization             |
| 16  | BU matching data         | `preQualification.get_bu_matching` | Read BU matching results       |
| 17  | Audit scan section read  | `auditScan.get_section`            | Read scan section data         |
| 18  | Audit scan section write | `auditScan.write_section`          | Write scan section data        |
| 19  | Create audit result      | `auditScanResult.create`           | Missing CRUD operation         |
| 20  | Update audit result      | `auditScanResult.update`           | Missing CRUD operation         |
| 21  | Delete audit result      | `auditScanResult.delete`           | Missing CRUD operation         |

### Low Priority / Not Feasible for Agents

| #   | Gap                                | Reason                                                  |
| --- | ---------------------------------- | ------------------------------------------------------- |
| 22  | PDF document upload                | Requires FormData/binary; not practical for agent tools |
| 23  | Knowledge doc upload               | Same as above                                           |
| 24  | Document download                  | Binary response; not useful for agents                  |
| 25  | SSE progress streams               | Real-time streams; agents poll instead                  |
| 26  | Slack webhook                      | Inbound-only; not an agent action                       |
| 27  | Pitchdeck bulk team update/confirm | Complex UI workflow; individual tools suffice           |
| 28  | Technology AI research/review      | Admin-only AI orchestration; complex multi-step         |

### Statistics

| Metric                     | Count    |
| -------------------------- | -------- |
| Total UI actions audited   | ~130     |
| Actions with agent tool    | ~85      |
| Actions missing agent tool | ~45      |
| **Coverage rate**          | **~65%** |
| High priority gaps         | 10       |
| Medium priority gaps       | 11       |
| Not feasible for agents    | 7        |
