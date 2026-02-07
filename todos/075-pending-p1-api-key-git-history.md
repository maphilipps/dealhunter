---
status: pending
priority: p1
issue_id: '075'
tags: [code-review, security, credentials]
dependencies: []
---

# API Key in Git History

## Problem Statement

The file `.claude/settings-aihub.json` containing a hardcoded API token (`sk-5k6CwWffBgbhd0k5_xz9Xg`) for the adesso AI Hub was committed to git history in commit `cd3e8dd`. While the current diff deletes the file and adds a `.gitignore` pattern, the secret remains in git history and can be extracted with `git show cd3e8dd:.claude/settings-aihub.json`.

## Findings

- **Source:** Security Sentinel agent
- **Location:** `.claude/settings-aihub.json` (deleted in current diff), commit `cd3e8dd`
- **Severity:** CRITICAL — trivial exploitation via `git log` / `git show`
- **Impact:** Anyone with repo read access can extract the credential

## Proposed Solutions

### Option A: Rotate Key Immediately (Recommended)

- **Pros:** Immediate risk mitigation, no repo surgery needed
- **Cons:** Requires access to adesso AI Hub admin
- **Effort:** Small (5 min)
- **Risk:** None

### Option B: Rotate + Purge History

- **Pros:** Complete remediation
- **Cons:** Requires force-push, disrupts collaborators
- **Effort:** Medium (30 min)
- **Risk:** Force-push can disrupt other branches

## Technical Details

- **Affected files:** `.claude/settings-aihub.json`
- **Service:** adesso AI Hub proxy at `https://adesso-ai-hub.3asabc.de`

## Acceptance Criteria

- [ ] API key `sk-5k6CwWffBgbhd0k5_xz9Xg` rotated at adesso AI Hub
- [ ] New key stored only in environment variables, never in git
- [ ] `.gitignore` pattern `.claude/settings*.json` confirmed in place

## Work Log

- 2026-02-07: Created from code review (security-sentinel agent)
