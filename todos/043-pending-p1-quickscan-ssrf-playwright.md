---
status: pending
priority: p1
issue_id: '043'
tags: [code-review, security, quickscan, playwright, ssrf]
dependencies: []
---

# SSRF-Lücke in Playwright Navigation

## Problem Statement

Die Playwright-basierte URL-Navigation im QuickScan validiert URLs nicht ausreichend gegen Server-Side Request Forgery (SSRF) Angriffe. Ein Angreifer könnte interne Netzwerk-Ressourcen über die QuickScan-Funktion auslesen.

## Findings

**Source:** security-sentinel Review Agent (Plan Review)

**Betroffene Dateien:**

- `lib/quick-scan/tools/playwright.ts` - URL wird ohne Validierung an Playwright übergeben
- `lib/quick-scan/agent.ts` - URLs aus User-Input werden nicht sanitized

**Risiko-Szenario:**

```
User gibt URL ein: http://169.254.169.254/latest/meta-data/
→ QuickScan navigiert zu AWS Metadata Service
→ Interne Credentials werden geleakt
```

**Fehlende Validierung:**

1. Keine Blocklist für interne IP-Ranges (10.x, 172.16-31.x, 192.168.x, 127.x, 169.254.x)
2. Keine DNS-Rebinding Protection
3. Keine Protocol-Einschränkung (file://, ftp://, etc.)

## Proposed Solutions

### Option A: URL Validation Helper (Empfohlen)

**Pros:** Zentrale Lösung, wiederverwendbar, vollständige Abdeckung
**Cons:** Erfordert neue Datei
**Effort:** Small (2-4h)
**Risk:** Low

```typescript
// lib/security/url-validator.ts
const BLOCKED_IP_RANGES = [
  /^127\./, // Localhost
  /^10\./, // Private Class A
  /^172\.(1[6-9]|2\d|3[01])\./, // Private Class B
  /^192\.168\./, // Private Class C
  /^169\.254\./, // Link-local
  /^0\./, // Current network
  /^::1$/, // IPv6 localhost
  /^fe80:/, // IPv6 link-local
];

export function validateExternalUrl(url: string): { valid: boolean; reason?: string } {
  // Implementation
}
```

### Option B: Playwright Wrapper mit Validation

**Pros:** Nahe an der Verwendung, keine neue Datei
**Cons:** Weniger wiederverwendbar
**Effort:** Small (1-2h)
**Risk:** Low

### Option C: Network-Level Blocking

**Pros:** Defense in Depth
**Cons:** Erfordert Infrastruktur-Änderungen, komplexer
**Effort:** Medium (1-2 Tage)
**Risk:** Medium

## Recommended Action

Option A implementieren - zentrale URL-Validierung vor jedem Playwright-Aufruf.

## Technical Details

**Affected Files:**

- `lib/quick-scan/tools/playwright.ts:runPlaywrightAudit()`
- `lib/quick-scan/agent.ts:runQuickScan()`
- Neues File: `lib/security/url-validator.ts`

**Database Changes:** Keine

## Acceptance Criteria

- [ ] URL Validator blockiert alle internen IP-Ranges
- [ ] URL Validator blockiert file://, ftp://, gopher:// Protokolle
- [ ] DNS-Lookup vor Navigation prüft aufgelöste IP
- [ ] Alle Playwright-Aufrufe nutzen den Validator
- [ ] Unit Tests für alle Edge Cases
- [ ] Logging bei blockierten URLs

## Work Log

| Date       | Action                        | Learnings                         |
| ---------- | ----------------------------- | --------------------------------- |
| 2026-01-20 | Todo erstellt aus Plan Review | security-sentinel fand SSRF-Lücke |

## Resources

- Plan: `/Users/marc.philipps/.claude/plans/composed-percolating-falcon.md`
- OWASP SSRF Prevention: https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html
- Related Todo: `016-resolved-p0-ssrf-unrestricted-url-fetching.md` (teilweise behoben)
