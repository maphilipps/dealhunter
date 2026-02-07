import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';

export default auth(req => {
  const { pathname } = req.nextUrl;
  const isAuth = !!req.auth;
  const userRole = req.auth?.user?.role;

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

  // Allow public routes
  if (isPublicRoute) {
    // Redirect to leads if already authenticated
    if (isAuth && (pathname === '/login' || pathname === '/register')) {
      return NextResponse.redirect(new URL('/qualifications', req.url));
    }
    return NextResponse.next();
  }

  // Require authentication for all other routes
  if (!isAuth) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  // Admin-only routes
  const adminRoutes = ['/admin'];
  const isAdminRoute = adminRoutes.some(route => pathname.startsWith(route));
  if (isAdminRoute && userRole !== 'admin') {
    return NextResponse.redirect(new URL('/qualifications', req.url));
  }

  // BL-only routes (BL and Admin can access)
  const blRoutes = ['/bl-review'];
  const isBLRoute = blRoutes.some(route => pathname.startsWith(route));
  if (isBLRoute && userRole !== 'bl' && userRole !== 'admin') {
    return NextResponse.redirect(new URL('/qualifications', req.url));
  }

  return NextResponse.next();
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

// Force Node.js runtime for middleware
export const runtime = 'nodejs';
