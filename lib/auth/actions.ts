'use server';

import { signIn, signOut } from '@/lib/auth';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import bcrypt from 'bcryptjs';
import { AuthError } from 'next-auth';
import { redirect } from 'next/navigation';

export async function login(formData: FormData) {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  try {
    await signIn('credentials', {
      email,
      password,
      redirect: false
    });
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.type) {
        case 'CredentialsSignin':
          return { error: 'Invalid credentials' };
        default:
          return { error: 'Something went wrong' };
      }
    }
    throw error;
  }

  redirect('/dashboard');
}

export async function register(formData: FormData) {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;
  const name = formData.get('name') as string;

  if (!email || !password || !name) {
    return { error: 'All fields are required' };
  }

  const existingUser = await db.query.users.findFirst({
    where: (users, { eq }) => eq(users.email, email)
  });

  if (existingUser) {
    return { error: 'Email already exists' };
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  await db.insert(users).values({
    email,
    password: hashedPassword,
    name,
    role: 'bd'
  });

  await signIn('credentials', {
    email,
    password,
    redirect: false
  });

  redirect('/dashboard');
}

export async function logout() {
  await signOut({ redirect: false });
  redirect('/login');
}
