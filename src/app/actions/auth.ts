'use server'

import { redirect } from 'next/navigation'
import { AuthError } from 'next-auth'
import { db } from '@/db'
import { users } from '@/db/schema'
import { registerSchema, loginSchema } from '@/lib/validations/auth'
import { hashPassword } from '@/lib/auth/password'
import { signIn } from '@/auth'
import { eq } from 'drizzle-orm'

export type RegisterFormState = {
  errors?: {
    name?: string[]
    email?: string[]
    password?: string[]
    confirmPassword?: string[]
    _form?: string[]
  }
  message?: string
}

export type LoginFormState = {
  errors?: {
    email?: string[]
    password?: string[]
    _form?: string[]
  }
  message?: string
}

export async function registerUser(
  prevState: RegisterFormState,
  formData: FormData
): Promise<RegisterFormState> {
  // 1. Validate form fields
  const validatedFields = registerSchema.safeParse({
    name: formData.get('name'),
    email: formData.get('email'),
    password: formData.get('password'),
    confirmPassword: formData.get('confirmPassword')
  })

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors
    }
  }

  const { name, email, password } = validatedFields.data

  try {
    // 2. Check if user already exists
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1)

    if (existingUser.length > 0) {
      return {
        errors: {
          email: ['Email already registered']
        }
      }
    }

    // 3. Hash password with Argon2id
    const hashedPassword = await hashPassword(password)

    // 4. Create user
    await db.insert(users).values({
      name,
      email,
      password: hashedPassword,
      role: 'bd_manager' // Default role
    })

    // 5. Success - handled by redirect
  } catch (error) {
    console.error('Registration error:', error)
    return {
      errors: {
        _form: ['An error occurred during registration. Please try again.']
      }
    }
  }

  // Redirect to login page
  redirect('/login')
}

export async function loginUser(
  prevState: LoginFormState,
  formData: FormData
): Promise<LoginFormState> {
  // 1. Validate form fields
  const validatedFields = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password')
  })

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors
    }
  }

  const { email, password } = validatedFields.data

  try {
    // 2. Sign in with NextAuth
    await signIn('credentials', {
      email,
      password,
      redirect: false
    })
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.type) {
        case 'CredentialsSignin':
          return {
            errors: {
              _form: ['Invalid email or password']
            }
          }
        default:
          return {
            errors: {
              _form: ['An error occurred during login. Please try again.']
            }
          }
      }
    }
    throw error
  }

  // Redirect to dashboard
  redirect('/dashboard')
}
