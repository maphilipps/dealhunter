'use server';

import { eq, desc } from 'drizzle-orm';
import { LRUCache } from 'lru-cache';
import { revalidatePath } from 'next/cache';
import { after } from 'next/server';

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { accounts, rfps } from '@/lib/db/schema';
import type { Account } from '@/lib/db/schema';

/**
 * Cache entry with metadata for stale-while-revalidate
 */
interface CacheEntry {
  data: Account[];
  fetchTime: number;
}

/**
 * LRU cache for accounts data
 * - max: 500 entries (supports up to 500 users)
 * - ttl: 5 minutes
 * - allowStale: Return stale data while revalidating
 */
const accountsCache = new LRUCache<string, CacheEntry>({
  max: 500,
  ttl: 1000 * 60 * 5, // 5 minutes
  allowStale: true,
});

/**
 * Cache statistics tracking
 */
let cacheHits = 0;
let cacheMisses = 0;
let backgroundRefreshes = 0;

/**
 * Helper function to fetch accounts from database
 */
async function fetchAccountsFromDB(userId: string, userRole: string): Promise<Account[]> {
  if (userRole === 'admin') {
    // Admin sees all accounts
    return await db.select().from(accounts).orderBy(desc(accounts.createdAt));
  } else {
    // Other users see only their own accounts
    return await db
      .select()
      .from(accounts)
      .where(eq(accounts.userId, userId))
      .orderBy(desc(accounts.createdAt));
  }
}

/**
 * Invalidate cache for a specific user
 */
function invalidateUserAccountsCache(userId: string): void {
  const keysToDelete: string[] = [];

  // Find all cache keys for this user
  for (const key of accountsCache.keys()) {
    if (key.startsWith(`accounts:${userId}`)) {
      keysToDelete.push(key);
    }
    // Also invalidate admin cache which includes all accounts
    if (key.startsWith('accounts:admin:')) {
      keysToDelete.push(key);
    }
  }

  // Delete all matching keys
  keysToDelete.forEach(key => accountsCache.delete(key));
}

/**
 * Helper function to check if user has access to an account
 * Admin can access all accounts, other users only their own
 */
function canAccessAccount(account: Account, userId: string, userRole: string): boolean {
  return userRole === 'admin' || account.userId === userId;
}

export async function getAccounts() {
  const session = await auth();

  if (!session?.user?.id) {
    return { success: false, error: 'Nicht authentifiziert', accounts: [] };
  }

  try {
    // Create cache key based on user ID and role
    const cacheKey = `accounts:${session.user.id}:${session.user.role}`;

    // Check cache
    const cached = accountsCache.get(cacheKey);

    if (cached) {
      const { data, fetchTime } = cached;
      const age = Date.now() - fetchTime;

      cacheHits++;

      // Stale-while-revalidate: If data is older than 1 minute, refresh in background
      if (age > 1000 * 60) {
        backgroundRefreshes++;

        after(async () => {
          try {
            const fresh = await fetchAccountsFromDB(session.user.id, session.user.role);
            accountsCache.set(cacheKey, { data: fresh, fetchTime: Date.now() });
          } catch (error) {
            console.error('Background refresh failed:', error);
            // Keep stale data on error
          }
        });
      }

      return { success: true, accounts: data };
    }

    // Cache miss - fetch from database
    cacheMisses++;
    const accounts = await fetchAccountsFromDB(session.user.id, session.user.role);

    // Store in cache
    accountsCache.set(cacheKey, { data: accounts, fetchTime: Date.now() });

    return { success: true, accounts };
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

    // Invalidate cache for this user
    invalidateUserAccountsCache(session.user.id);

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
    const [account] = await db.select().from(accounts).where(eq(accounts.id, accountId)).limit(1);

    if (!account) {
      return { success: false, error: 'Account nicht gefunden' };
    }

    // Check ownership
    if (!canAccessAccount(account, session.user.id, session.user.role)) {
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
    const [account] = await db.select().from(accounts).where(eq(accounts.id, accountId)).limit(1);

    if (!account) {
      return { success: false, error: 'Account nicht gefunden' };
    }

    // Check ownership
    if (!canAccessAccount(account, session.user.id, session.user.role)) {
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

    if (!canAccessAccount(existingAccount, session.user.id, session.user.role)) {
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

    // Invalidate cache for the account owner
    invalidateUserAccountsCache(existingAccount.userId);

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

    if (!canAccessAccount(existingAccount, session.user.id, session.user.role)) {
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

    // Invalidate cache for the account owner
    invalidateUserAccountsCache(existingAccount.userId);

    revalidatePath('/accounts');
    return { success: true };
  } catch (error) {
    console.error('Error deleting account:', error);
    return { success: false, error: 'Fehler beim Löschen des Accounts' };
  }
}
