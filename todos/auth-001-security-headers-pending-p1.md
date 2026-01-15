# P1: Add Security Headers

**Status:** pending
**Priority:** P1 (Important - Should Fix Before Production)
**Feature:** AUTH-001
**File:** next.config.ts

## Problem

The application is missing critical security headers:

1. **Content-Security-Policy (CSP)** - Prevents XSS attacks
2. **X-Frame-Options** - Prevents clickjacking
3. **X-Content-Type-Options** - Prevents MIME sniffing
4. **Referrer-Policy** - Controls referrer information
5. **Permissions-Policy** - Restricts browser features

## Solution

Add security headers to Next.js configuration:

```typescript
// next.config.ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload'
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block'
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin'
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()'
          },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline'", // Next.js requires unsafe-inline for dev
              "style-src 'self' 'unsafe-inline'", // Tailwind requires unsafe-inline
              "img-src 'self' data: https:",
              "font-src 'self' data:",
              "connect-src 'self'",
              "frame-ancestors 'none'"
            ].join('; ')
          }
        ]
      }
    ]
  }
}

export default nextConfig
```

## CSP Considerations for Next.js + Tailwind

- **'unsafe-inline' for styles:** Required by Tailwind CSS
- **'unsafe-eval' for scripts:** Required by Next.js in development
- **Production CSP:** Consider using nonce-based CSP for production

### Production-Grade CSP with Nonces (Future Enhancement)
```typescript
// middleware.ts
import { NextResponse } from 'next/server'
import { randomBytes } from 'crypto'

export function middleware(request: NextRequest) {
  const nonce = randomBytes(16).toString('base64')
  const csp = `
    default-src 'self';
    script-src 'self' 'nonce-${nonce}' 'strict-dynamic';
    style-src 'self' 'nonce-${nonce}';
  `.replace(/\s+/g, ' ').trim()

  const response = NextResponse.next()
  response.headers.set('Content-Security-Policy', csp)
  response.headers.set('x-nonce', nonce)

  return response
}
```

## Testing Security Headers

```bash
# Test with curl
curl -I http://localhost:3000

# Or use online tools
# - https://securityheaders.com/
# - https://observatory.mozilla.org/
```

## Acceptance Criteria

- [ ] Add headers configuration to next.config.ts
- [ ] Test all pages load correctly with CSP
- [ ] Verify no console CSP violations in browser
- [ ] Test on both development and production build
- [ ] Verify X-Frame-Options prevents iframe embedding
- [ ] Document any CSP exceptions needed

## References

- OWASP: Secure Headers Project
- Next.js: Security Headers configuration
- MDN: Content Security Policy
- Mozilla Observatory: Security header scanner
