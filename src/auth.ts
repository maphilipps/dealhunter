import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { db } from '@/db'
import { users } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { loginSchema } from '@/lib/validations/auth'
import { UserRole, parseUserRole } from '@/lib/roles'

// Dynamic import to avoid Edge Runtime issues
async function verifyPassword(hash: string, password: string): Promise<boolean> {
  const { verifyPassword: verify } = await import('@/lib/auth/password')
  return verify(hash, password)
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        const validatedFields = loginSchema.safeParse(credentials)

        if (!validatedFields.success) {
          return null
        }

        const { email, password } = validatedFields.data

        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.email, email))
          .limit(1)

        if (!user) {
          return null
        }

        // ✅ NEW: Check if user is active
        if (!user.isActive) {
          console.warn(`Inactive user login attempt: ${email}`)
          return null
        }

        const isValidPassword = await verifyPassword(user.password, password)

        if (!isValidPassword) {
          return null
        }

        // ✅ NEW: Parse and validate role
        const validRole = parseUserRole(user.role)
        if (!validRole) {
          console.error(`Invalid role in database: ${user.role} for user ${user.id}`)
          return null
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: validRole,
          tokenVersion: user.tokenVersion
        }
      }
    })
  ],
  pages: {
    signIn: '/login'
  },
  session: {
    strategy: 'jwt'
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = user.role
        token.tokenVersion = user.tokenVersion
      }
      return token
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string
        session.user.role = token.role as UserRole
      }
      return session
    }
  }
})
