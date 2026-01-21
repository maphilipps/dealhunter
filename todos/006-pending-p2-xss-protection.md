---
status: pending
priority: p2
issue_id: '006'
tags: [code-review, security, xss, sanitization]
dependencies: []
---

# XSS Risks in Dynamic Agent Content

## Problem Statement

Agent messages render dynamic content (reasoning text, tool call parameters, error messages) directly without sanitization. If an AI agent outputs malicious HTML/JavaScript (either through injection attack or model misbehavior), it will execute in the user's browser.

**Why it matters:**

- XSS vulnerability in agent-generated content
- Session hijacking risk
- Potential data exfiltration
- Attacker could craft malicious bid content that triggers XSS through agent output
- Violates security best practices

## Findings

**Location:** `components/ai-elements/agent-message.tsx:45-68`
**Location:** `components/ai-elements/reasoning.tsx` (similar issue)

**Evidence:**

```typescript
// agent-message.tsx
<div className="text-sm text-gray-700">
  {event.data.message}  // UNSANITIZED USER-CONTROLLED CONTENT
</div>

// If agent outputs: "<img src=x onerror=alert('XSS')>"
// This will execute in browser
```

**Attack Vectors:**

1. Malicious bid content → AI agent includes in reasoning → XSS
2. Crafted prompt injection → agent outputs malicious HTML
3. Error messages containing user input → reflected XSS
4. Tool call parameters containing scripts

**Source:** Security Sentinel review agent

## Proposed Solutions

### Solution 1: DOMPurify Sanitization (Recommended)

Sanitize all agent-generated HTML before rendering.

**Pros:**

- Industry standard XSS protection
- Allows safe HTML formatting (bold, links)
- Battle-tested library
- Configurable whitelist

**Cons:**

- Adds dependency
- Small performance overhead
- Need to sanitize all dynamic content

**Effort:** Small (2-3 hours)
**Risk:** Low

**Implementation:**

```typescript
import DOMPurify from 'isomorphic-dompurify';

// agent-message.tsx
<div
  className="text-sm text-gray-700"
  dangerouslySetInnerHTML={{
    __html: DOMPurify.sanitize(event.data.message, {
      ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'code', 'pre'],
      ALLOWED_ATTR: ['href', 'target', 'rel']
    })
  }}
/>

// For plain text (no HTML needed)
<div className="text-sm text-gray-700">
  {DOMPurify.sanitize(event.data.message, { ALLOWED_TAGS: [] })}
</div>
```

### Solution 2: Content Security Policy (CSP) Headers

Add CSP headers to prevent inline script execution.

**Pros:**

- Defense-in-depth approach
- Protects against all XSS vectors
- No code changes in components

**Cons:**

- Doesn't fix root cause (still need sanitization)
- Can break legitimate inline scripts
- Requires careful configuration

**Effort:** Small (2-3 hours)
**Risk:** Low

**Should be combined** with Solution 1, not used alone.

**Implementation:**

```typescript
// next.config.js
const securityHeaders = [
  {
    key: 'Content-Security-Policy',
    value: "default-src 'self'; script-src 'self' 'unsafe-eval'; style-src 'self' 'unsafe-inline';",
  },
];

module.exports = {
  async headers() {
    return [{ source: '/(.*)', headers: securityHeaders }];
  },
};
```

### Solution 3: Markdown-Only Rendering

Force all agent output through markdown parser (strips HTML).

**Pros:**

- Simple solution
- No HTML allowed at all
- Safe by default

**Cons:**

- Loses formatting flexibility
- Agents can't use HTML for rich output
- May break existing agent outputs

**Effort:** Small (2 hours)
**Risk:** Low

**Recommended** as secondary defense.

## Recommended Action

_(To be filled during triage)_

## Technical Details

**Affected Files:**

- `components/ai-elements/agent-message.tsx`
- `components/ai-elements/reasoning.tsx`
- `components/ai-elements/sources.tsx`
- Any component rendering agent-generated content

**Dependencies:**

```json
{
  "dependencies": {
    "isomorphic-dompurify": "^2.0.0"
  }
}
```

**Testing:**

- Inject XSS payloads in agent outputs
- Verify sanitization strips scripts
- Test with legitimate HTML (should preserve safe tags)

## Acceptance Criteria

- [ ] All agent-generated content sanitized before rendering
- [ ] XSS payloads in agent output are neutralized
- [ ] Safe HTML tags (bold, italic, links) still work
- [ ] Error messages sanitized
- [ ] Tool call parameters sanitized
- [ ] CSP headers configured
- [ ] Tests for XSS attack vectors
- [ ] Security audit confirms no XSS vulnerabilities
- [ ] Documentation warns against unsafe rendering

## Work Log

**2026-01-16**: Todo created from Security Sentinel review findings

## Resources

- Security Sentinel review report
- DOMPurify: https://github.com/cure53/DOMPurify
- OWASP XSS Guide: https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html
- CSP MDN: https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP
