'use server'

import { redirect } from 'next/navigation'
import { db } from '@/db'
import { users } from '@/db/schema'
import { registerSchema } from '@/lib/validations/auth'
import { hashPassword } from '@/lib/auth/password'
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
