'use server';

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { accounts, bidOpportunities } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

export async function getAccounts() {
  const session = await auth();

  if (!session?.user?.id) {
    return { success: false, error: 'Nicht authentifiziert', accounts: [] };
  }

  try {
    const userAccounts = await db
      .select()
      .from(accounts)
      .where(eq(accounts.userId, session.user.id))
      .orderBy(desc(accounts.createdAt));

    return { success: true, accounts: userAccounts };
  } catch (error) {
    console.error('Error fetching accounts:', error);
    return { success: false, error: 'Fehler beim Laden der Accounts', accounts: [] };
  }
}

export async function createAccount(data: {
  name: string;
  industry: string;
  website?: string;
  notes?: string;
}) {
  const session = await auth();

  if (!session?.user?.id) {
    return { success: false, error: 'Nicht authentifiziert' };
  }

  try {
    const [account] = await db
      .insert(accounts)
      .values({
        userId: session.user.id,
        name: data.name.trim(),
        industry: data.industry.trim(),
        website: data.website?.trim() || null,
        notes: data.notes?.trim() || null,
      })
      .returning();

    revalidatePath('/accounts');
    return { success: true, account };
  } catch (error) {
    console.error('Error creating account:', error);
    return { success: false, error: 'Fehler beim Erstellen des Accounts' };
  }
}

export async function getAccountById(accountId: string) {
  const session = await auth();

  if (!session?.user?.id) {
    return { success: false, error: 'Nicht authentifiziert' };
  }

  try {
    const [account] = await db
      .select()
      .from(accounts)
      .where(eq(accounts.id, accountId))
      .limit(1);

    if (!account) {
      return { success: false, error: 'Account nicht gefunden' };
    }

    // Check ownership
    if (account.userId !== session.user.id) {
      return { success: false, error: 'Keine Berechtigung' };
    }

    return { success: true, account };
  } catch (error) {
    console.error('Error fetching account:', error);
    return { success: false, error: 'Fehler beim Laden des Accounts' };
  }
}

export async function getAccountWithOpportunities(accountId: string) {
  const session = await auth();

  if (!session?.user?.id) {
    return { success: false, error: 'Nicht authentifiziert' };
  }

  try {
    const [account] = await db
      .select()
      .from(accounts)
      .where(eq(accounts.id, accountId))
      .limit(1);

    if (!account) {
      return { success: false, error: 'Account nicht gefunden' };
    }

    // Check ownership
    if (account.userId !== session.user.id) {
      return { success: false, error: 'Keine Berechtigung' };
    }

    // Get opportunities linked to this account
    const opportunities = await db
      .select({
        id: bidOpportunities.id,
        projectName: bidOpportunities.projectName,
        status: bidOpportunities.status,
        source: bidOpportunities.source,
        stage: bidOpportunities.stage,
        createdAt: bidOpportunities.createdAt,
      })
      .from(bidOpportunities)
      .where(eq(bidOpportunities.accountId, accountId))
      .orderBy(desc(bidOpportunities.createdAt));

    return {
      success: true,
      account,
      opportunities,
    };
  } catch (error) {
    console.error('Error fetching account details:', error);
    return { success: false, error: 'Fehler beim Laden der Account-Details' };
  }
}
