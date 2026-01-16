import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isAuth = !!req.auth;
  const userRole = req.auth?.user?.role;

  const publicRoutes = ['/', '/login', '/register'];
  const isPublicRoute = publicRoutes.includes(pathname);

  // Allow public routes
  if (isPublicRoute) {
    // Redirect to dashboard if already authenticated
    if (isAuth && (pathname === '/login' || pathname === '/register')) {
      return NextResponse.redirect(new URL('/', req.url));
    }
    return NextResponse.next();
  }

  // Require authentication for all other routes
  if (!isAuth) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  // Admin-only routes
  const adminRoutes = ['/admin'];
  const isAdminRoute = adminRoutes.some((route) => pathname.startsWith(route));
  if (isAdminRoute && userRole !== 'admin') {
    return NextResponse.redirect(new URL('/', req.url));
  }

  // BL-only routes (BL and Admin can access)
  const blRoutes = ['/bl-review'];
  const isBLRoute = blRoutes.some((route) => pathname.startsWith(route));
  if (isBLRoute && userRole !== 'bl' && userRole !== 'admin') {
    return NextResponse.redirect(new URL('/', req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)']
};

// Force Node.js runtime for middleware (required for better-sqlite3)
export const runtime = 'nodejs';
