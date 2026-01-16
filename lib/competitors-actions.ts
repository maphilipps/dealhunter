'use server';

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { competitors } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

export async function getCompetitors() {
  try {
    const comps = await db
      .select()
      .from(competitors)
      .orderBy(competitors.createdAt);

    return { success: true, competitors: comps };
  } catch (error) {
    console.error('Error fetching competitors:', error);
    return { success: false, error: 'Fehler beim Laden der Wettbewerber' };
  }
}

export async function createCompetitor(data: {
  name: string;
  strengths: string[];
  weaknesses: string[];
  technologyFocus: string[];
  industryFocus: string[];
  priceLevel: 'low' | 'medium' | 'high';
}) {
  const session = await auth();

  if (!session?.user?.id) {
    return { success: false, error: 'Nicht authentifiziert' };
  }

  try {
    const [competitor] = await db
      .insert(competitors)
      .values({
        userId: session.user.id,
        name: data.name.trim(),
        strengths: JSON.stringify(data.strengths),
        weaknesses: JSON.stringify(data.weaknesses),
        technologyFocus: JSON.stringify(data.technologyFocus),
        industryFocus: JSON.stringify(data.industryFocus),
        priceLevel: data.priceLevel,
        recentEncounters: JSON.stringify([]),
      })
      .returning();

    revalidatePath('/competitors');
    return { success: true, competitor };
  } catch (error) {
    console.error('Error creating competitor:', error);
    return { success: false, error: 'Fehler beim Erstellen des Wettbewerbers' };
  }
}

export async function addEncounter(competitorId: string, encounter: {
  outcome: 'won_against' | 'lost_to' | 'unknown';
  date: string;
  opportunityId?: string;
  notes?: string;
}) {
  const session = await auth();

  if (!session?.user?.id) {
    return { success: false, error: 'Nicht authentifiziert' };
  }

  try {
    const [competitor] = await db
      .select({ recentEncounters: competitors.recentEncounters })
      .from(competitors)
      .where(eq(competitors.id, competitorId));

    if (!competitor) {
      return { success: false, error: 'Wettbewerber nicht gefunden' };
    }

    const encounters = competitor.recentEncounters ? JSON.parse(competitor.recentEncounters) : [];
    const newEncounter = {
      ...encounter,
      id: crypto.randomUUID(),
      addedBy: session.user.id,
      addedAt: new Date().toISOString(),
    };

    encounters.unshift(newEncounter);

    const [updated] = await db
      .update(competitors)
      .set({
        recentEncounters: JSON.stringify(encounters.slice(0, 10)), // Keep last 10
        updatedAt: new Date(),
      })
      .where(eq(competitors.id, competitorId))
      .returning();

    revalidatePath('/competitors');
    return { success: true, competitor: updated };
  } catch (error) {
    console.error('Error adding encounter:', error);
    return { success: false, error: 'Fehler beim Hinzufügen des Encounters' };
  }
}
