import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { auth } from '@/auth'
import { getRequiredRole } from '@/lib/route-protection'
import { UserRole } from '@/lib/roles'

export default auth(async (req) => {
  const { nextUrl } = req
  const pathname = nextUrl.pathname
  const session = req.auth
  const isLoggedIn = !!session?.user

  // Public routes (no authentication required)
  const publicRoutes = ['/', '/login', '/register', '/api/auth']
  const isPublicRoute = publicRoutes.some((route) => pathname.startsWith(route))

  if (isPublicRoute) {
    // Redirect authenticated users away from auth pages
    if (isLoggedIn && (pathname === '/login' || pathname === '/register')) {
      return NextResponse.redirect(new URL('/dashboard', nextUrl))
    }
    return NextResponse.next()
  }

  // Check authentication
  if (!isLoggedIn) {
    const loginUrl = new URL('/login', nextUrl)
    loginUrl.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // ✅ NEW: Check tokenVersion for session invalidation
  // TODO: Implement database check (requires DB query in middleware)
  // For now, we skip this to avoid performance impact
  // Will be implemented in Phase 7 with Redis caching

  // Check role-based access
  const requiredRoles = getRequiredRole(pathname)

  if (requiredRoles) {
    const userRole = session.user.role as UserRole

    if (!requiredRoles.includes(userRole)) {
      // User doesn't have required role
      const isApiRoute = pathname.startsWith('/api')

      if (isApiRoute) {
        // Return 403 JSON for API routes
        return NextResponse.json(
          { error: 'Forbidden', message: 'Insufficient permissions' },
          { status: 403 }
        )
      } else {
        // Redirect to /unauthorized for page routes
        return NextResponse.redirect(
          new URL(`/unauthorized?required=${requiredRoles[0]}&current=${userRole}`, nextUrl)
        )
      }
    }
  }

  return NextResponse.next()
})

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)',
  ],
}
