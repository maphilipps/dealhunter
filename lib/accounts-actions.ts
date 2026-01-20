'use server';

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { accounts, rfps } from '@/lib/db/schema';
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
        id: rfps.id,
        status: rfps.status,
        source: rfps.source,
        stage: rfps.stage,
        inputType: rfps.inputType,
        createdAt: rfps.createdAt,
      })
      .from(rfps)
      .where(eq(rfps.accountId, accountId))
      .orderBy(desc(rfps.createdAt));

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

export async function updateAccount(
  accountId: string,
  data: {
    name: string;
    industry: string;
    website?: string;
    notes?: string;
  }
) {
  const session = await auth();

  if (!session?.user?.id) {
    return { success: false, error: 'Nicht authentifiziert' };
  }

  try {
    // Check ownership
    const [existingAccount] = await db
      .select()
      .from(accounts)
      .where(eq(accounts.id, accountId))
      .limit(1);

    if (!existingAccount) {
      return { success: false, error: 'Account nicht gefunden' };
    }

    if (existingAccount.userId !== session.user.id) {
      return { success: false, error: 'Keine Berechtigung' };
    }

    // Update account
    const [updatedAccount] = await db
      .update(accounts)
      .set({
        name: data.name.trim(),
        industry: data.industry.trim(),
        website: data.website?.trim() || null,
        notes: data.notes?.trim() || null,
        updatedAt: new Date(),
      })
      .where(eq(accounts.id, accountId))
      .returning();

    revalidatePath('/accounts');
    revalidatePath(`/accounts/${accountId}`);
    return { success: true, account: updatedAccount };
  } catch (error) {
    console.error('Error updating account:', error);
    return { success: false, error: 'Fehler beim Aktualisieren des Accounts' };
  }
}

export async function deleteAccount(accountId: string) {
  const session = await auth();

  if (!session?.user?.id) {
    return { success: false, error: 'Nicht authentifiziert' };
  }

  try {
    // Check ownership
    const [existingAccount] = await db
      .select()
      .from(accounts)
      .where(eq(accounts.id, accountId))
      .limit(1);

    if (!existingAccount) {
      return { success: false, error: 'Account nicht gefunden' };
    }

    if (existingAccount.userId !== session.user.id) {
      return { success: false, error: 'Keine Berechtigung' };
    }

    // Check if account has linked opportunities
    const linkedOpportunities = await db
      .select()
      .from(rfps)
      .where(eq(rfps.accountId, accountId))
      .limit(1);

    if (linkedOpportunities.length > 0) {
      return {
        success: false,
        error: 'Account kann nicht gelöscht werden, da noch Opportunities verknüpft sind',
      };
    }

    // Delete account
    await db.delete(accounts).where(eq(accounts.id, accountId));

    revalidatePath('/accounts');
    return { success: true };
  } catch (error) {
    console.error('Error deleting account:', error);
    return { success: false, error: 'Fehler beim Löschen des Accounts' };
  }
}
