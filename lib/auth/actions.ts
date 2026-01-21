'use server';

import bcrypt from 'bcryptjs';
import { AuthError } from 'next-auth';

import { signIn, signOut } from '@/lib/auth';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';

export async function login(_prevState: { error: string } | null, formData: FormData) {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  try {
    await signIn('credentials', {
      email,
      password,
      redirectTo: '/',
    });
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.type) {
        case 'CredentialsSignin':
          return { error: 'Ungültige Anmeldedaten' };
        default:
          return { error: 'Ein Fehler ist aufgetreten' };
      }
    }
    // NEXT_REDIRECT error should be re-thrown
    throw error;
  }

  // This line should not be reached due to redirect
  return null;
}

export async function register(_prevState: { error: string } | null, formData: FormData) {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;
  const name = formData.get('name') as string;

  if (!email || !password || !name) {
    return { error: 'Alle Felder sind erforderlich' };
  }

  const existingUser = await db.query.users.findFirst({
    where: (users, { eq }) => eq(users.email, email),
  });

  if (existingUser) {
    return { error: 'Diese E-Mail existiert bereits' };
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  await db.insert(users).values({
    email,
    password: hashedPassword,
    name,
    role: 'bd',
  });

  try {
    await signIn('credentials', {
      email,
      password,
      redirectTo: '/',
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: 'Registrierung erfolgreich, aber Login fehlgeschlagen' };
    }
    throw error;
  }

  return null;
}

export async function logout() {
  await signOut({ redirectTo: '/login' });
}
