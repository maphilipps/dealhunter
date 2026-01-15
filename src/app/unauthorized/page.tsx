import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { ROLE_DISPLAY_NAMES, UserRole } from '@/lib/roles'

export default async function UnauthorizedPage({
  searchParams,
}: {
  searchParams: Promise<{ required?: string; current?: string }>
}) {
  const session = await auth()

  if (!session) {
    redirect('/login')
  }

  const params = await searchParams
  const requiredRole = params.required as UserRole
  const currentRole = session.user.role as UserRole

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-8">
        <div className="text-center">
          {/* Warning Icon */}
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
            <svg
              className="h-6 w-6 text-red-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>

          {/* Main Heading */}
          <h1 className="mt-4 text-2xl font-bold text-gray-900">
            Zugriff verweigert
          </h1>

          {/* Error Message */}
          <p className="mt-2 text-sm text-gray-600">
            Sie haben nicht die erforderlichen Berechtigungen für diese Seite.
          </p>

          {/* Role Information Box */}
          <div className="mt-6 bg-blue-50 border border-blue-200 rounded-md p-4">
            <p className="text-sm text-blue-800">
              <span className="font-semibold">Aktuelle Rolle:</span>{' '}
              {ROLE_DISPLAY_NAMES[currentRole] || currentRole}
            </p>
            {requiredRole && (
              <p className="text-sm text-blue-800 mt-1">
                <span className="font-semibold">Erforderliche Rolle:</span>{' '}
                {ROLE_DISPLAY_NAMES[requiredRole] || requiredRole}
              </p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="mt-6 flex flex-col gap-3">
            <a
              href="/dashboard"
              className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:text-sm"
            >
              Zurück zum Dashboard
            </a>
            <a
              href="/"
              className="w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:text-sm"
            >
              Zur Startseite
            </a>
          </div>

          {/* Contact Information */}
          <div className="mt-6 text-xs text-gray-500">
            <p>Falls Sie dies für einen Fehler halten, kontaktieren Sie bitte:</p>
            <a href="mailto:support@adesso.de" className="text-blue-600 hover:underline">
              support@adesso.de
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
