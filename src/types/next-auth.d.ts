import 'next-auth'
import { UserRole } from '@/lib/roles'

declare module 'next-auth' {
  interface User {
    id: string
    name: string | null
    email: string
    role: UserRole
    isActive?: boolean
    tokenVersion?: number
  }

  interface Session {
    user: {
      id: string
      name: string | null
      email: string
      role: UserRole
    }
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
    role: UserRole
    tokenVersion?: number
  }
}
