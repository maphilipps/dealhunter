import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';

const REDIRECT_CACHE_BUST_COOKIE = 'dh_redirect_cache_bust_v1';

export default auth(req => {
  const { pathname } = req.nextUrl;
  const isAuth = !!req.auth;
  const userRole = req.auth?.user?.role;

  const maybeBustRedirectCache = (res: NextResponse) => {
    // Only clear once per browser to avoid repeatedly nuking the HTTP cache.
    // Cache clear is scoped to this origin and does not clear cookies/storage.
    res.headers.set('Clear-Site-Data', '"cache"');
    res.cookies.set(REDIRECT_CACHE_BUST_COOKIE, '1', {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: req.nextUrl.protocol === 'https:',
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });
    return res;
  };

  const publicRoutes = ['/login', '/register'];
  const isPublicRoute = publicRoutes.includes(pathname);

  /**
   * API Route Exemptions (with signature verification)
   *
   * These routes are exempt from middleware auth but have their own security:
   * - /api/inngest: Inngest signing key verification (INNGEST_SIGNING_KEY)
   * - /api/slack: Slack signing secret verification (SLACK_SIGNING_SECRET)
   * - /api/submit: Public form submission with bot protection (BotID)
   * - /api/auth/*: NextAuth.js handles its own authentication
   *
   * Security Model:
   * - User access control happens at trigger endpoints (e.g., /api/qualifications/[id]/deep-analysis/trigger)
   * - Webhook endpoints validate signatures to ensure requests come from trusted services
   * - This implements "defense in depth" where multiple layers validate security
   */
  const apiExemptions = ['/api/inngest', '/api/slack', '/api/submit', '/api/auth'];

  if (apiExemptions.some(route => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Self-heal: some browsers cache old permanent redirects (301) indefinitely.
  // If a user has a stale redirect cached for `/qualifications -> /pitches`, we can only fix it
  // after they hit *any* server response. `/pitches` is a common landing page in that scenario,
  // so we clear only the HTTP cache once per browser via a cookie gate.
  //
  // This avoids telling users to manually clear their browser cache.
  const isGet = req.method === 'GET';
  const isPrefetch =
    req.headers.get('x-middleware-prefetch') === '1' ||
    req.headers.get('next-router-prefetch') === '1' ||
    req.headers.get('purpose') === 'prefetch' ||
    req.headers.get('sec-purpose') === 'prefetch';
  const shouldBustRedirectCache =
    isGet &&
    !isPrefetch &&
    pathname.startsWith('/pitches') &&
    !req.cookies.get(REDIRECT_CACHE_BUST_COOKIE);

  // Allow public routes
  if (isPublicRoute) {
    // Redirect to leads if already authenticated
    if (isAuth && (pathname === '/login' || pathname === '/register')) {
      const res = NextResponse.redirect(new URL('/qualifications', req.url));
      return shouldBustRedirectCache ? maybeBustRedirectCache(res) : res;
    }
    const res = NextResponse.next();
    return shouldBustRedirectCache ? maybeBustRedirectCache(res) : res;
  }

  // Require authentication for all other routes
  if (!isAuth) {
    const res = NextResponse.redirect(new URL('/login', req.url));
    return shouldBustRedirectCache ? maybeBustRedirectCache(res) : res;
  }

  // Admin-only routes
  const adminRoutes = ['/admin'];
  const isAdminRoute = adminRoutes.some(route => pathname.startsWith(route));
  if (isAdminRoute && userRole !== 'admin') {
    const res = NextResponse.redirect(new URL('/qualifications', req.url));
    return shouldBustRedirectCache ? maybeBustRedirectCache(res) : res;
  }

  // BL-only routes (BL and Admin can access)
  const blRoutes = ['/bl-review'];
  const isBLRoute = blRoutes.some(route => pathname.startsWith(route));
  if (isBLRoute && userRole !== 'bl' && userRole !== 'admin') {
    const res = NextResponse.redirect(new URL('/qualifications', req.url));
    return shouldBustRedirectCache ? maybeBustRedirectCache(res) : res;
  }

  const res = NextResponse.next();
  return shouldBustRedirectCache ? maybeBustRedirectCache(res) : res;
});

export const config = {
  matcher: [
    // Protect all pages except static assets and public files
    '/((?!_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.svg$|.*\\.ico$|.*\\.jpg$|.*\\.jpeg$|.*\\.gif$|.*\\.webp$).*)',
    /**
     * Explicitly protect ALL API routes
     *
     * This ensures all API routes pass through middleware authentication.
     * Specific routes with external signature verification (Inngest, Slack)
     * are exempted in the middleware function above.
     *
     * Without this matcher, API routes would bypass middleware entirely.
     */
    '/api/:path*',
  ],
};

// Force Node.js runtime for middleware (required by NextAuth crypto)
export const runtime = 'nodejs';
