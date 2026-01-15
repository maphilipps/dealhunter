import { auth, signOut } from '@/auth'
import { Button } from '@/components/ui/button'
import { redirect } from 'next/navigation'
import { ROLE_DISPLAY_NAMES, UserRole } from '@/lib/roles'

export default async function DashboardPage() {
  const session = await auth()

  if (!session) {
    redirect('/login')
  }

  const userRole = session.user.role as UserRole

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background">
      <div className="w-full max-w-2xl space-y-8 rounded-lg border bg-card p-8 shadow-sm">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="mt-2 text-muted-foreground">
            Welcome to Dealhunter, {session.user?.name || session.user?.email}
          </p>
        </div>

        <div className="space-y-4">
          {/* Admin-specific banner */}
          {userRole === UserRole.ADMIN && (
            <div className="rounded-lg border-l-4 border-blue-500 bg-blue-50 p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-blue-700">
                    Sie haben Administrator-Zugriff. Sie können alle Bereiche verwalten.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Bereichsleiter-specific banner */}
          {userRole === UserRole.BEREICHSLEITER && (
            <div className="rounded-lg border-l-4 border-green-500 bg-green-50 p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-green-700">
                    Sie können Angebote prüfen und Teams zuweisen.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="rounded-lg border p-4">
            <h2 className="font-semibold">User Information</h2>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Name:</dt>
                <dd>{session.user?.name || 'N/A'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Email:</dt>
                <dd>{session.user?.email}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Rolle:</dt>
                <dd>{ROLE_DISPLAY_NAMES[userRole]}</dd>
              </div>
            </dl>
          </div>

          <form
            action={async () => {
              'use server'
              await signOut({ redirectTo: '/login' })
            }}
          >
            <Button type="submit" variant="outline" className="w-full">
              Sign out
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
