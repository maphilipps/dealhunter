import { db } from '@/lib/db';
import { references, referenceMatches, leads, websiteAudits } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import type { NewReferenceMatch } from '@/lib/db/schema';

/**
 * DEA-99: Reference Project Matching
 *
 * Matches a lead against validated reference projects using:
 * - Tech Stack Matching (60% weight)
 * - Industry Matching (40% weight)
 *
 * Returns Top 5 ranked references with matched technologies and industries
 */

interface TechStackMatch {
  score: number; // 0-100
  matchedTechnologies: string[];
  totalLeadTechs: number;
  totalReferenceTechs: number;
}

interface IndustryMatch {
  score: number; // 0-100
  matchedIndustries: string[];
}

interface ReferenceMatchScore {
  referenceId: string;
  reference: unknown;
  techStackScore: number;
  industryScore: number;
  totalScore: number;
  matchedTechnologies: string[];
  matchedIndustries: string[];
  reasoning: string;
  rank?: number;
}

/**
 * Calculate tech stack matching score
 * Uses Jaccard similarity: |intersection| / |union|
 */
function calculateTechStackMatch(
  leadTechStack: string[],
  referenceTechStack: string[]
): TechStackMatch {
  if (!leadTechStack || leadTechStack.length === 0) {
    return {
      score: 0,
      matchedTechnologies: [],
      totalLeadTechs: 0,
      totalReferenceTechs: referenceTechStack?.length || 0,
    };
  }

  if (!referenceTechStack || referenceTechStack.length === 0) {
    return {
      score: 0,
      matchedTechnologies: [],
      totalLeadTechs: leadTechStack.length,
      totalReferenceTechs: 0,
    };
  }

  // Normalize to lowercase for case-insensitive matching
  const leadTechsNormalized = leadTechStack.map(t => t.toLowerCase().trim());
  const refTechsNormalized = referenceTechStack.map(t => t.toLowerCase().trim());

  // Find intersection (matched technologies)
  const matchedTechs = leadTechsNormalized.filter(lt => refTechsNormalized.includes(lt));

  // Find union (all unique technologies)
  const allTechs = new Set([...leadTechsNormalized, ...refTechsNormalized]);

  // Jaccard similarity
  const jaccardScore = matchedTechs.length / allTechs.size;

  // Convert to 0-100 scale
  const score = Math.round(jaccardScore * 100);

  // Map back to original case for display
  const matchedTechnologies = leadTechStack.filter(t =>
    matchedTechs.includes(t.toLowerCase().trim())
  );

  return {
    score,
    matchedTechnologies,
    totalLeadTechs: leadTechStack.length,
    totalReferenceTechs: referenceTechStack.length,
  };
}

/**
 * Calculate industry matching score
 * Simple exact match (100) or no match (0)
 */
function calculateIndustryMatch(leadIndustry: string | null, referenceIndustry: string): IndustryMatch {
  if (!leadIndustry) {
    return { score: 0, matchedIndustries: [] };
  }

  const leadIndustryNormalized = leadIndustry.toLowerCase().trim();
  const refIndustryNormalized = referenceIndustry.toLowerCase().trim();

  if (leadIndustryNormalized === refIndustryNormalized) {
    return {
      score: 100,
      matchedIndustries: [referenceIndustry],
    };
  }

  // Partial match (e.g., "Banking" in "Banking & Insurance")
  if (
    leadIndustryNormalized.includes(refIndustryNormalized) ||
    refIndustryNormalized.includes(leadIndustryNormalized)
  ) {
    return {
      score: 70,
      matchedIndustries: [referenceIndustry],
    };
  }

  return { score: 0, matchedIndustries: [] };
}

/**
 * Match a lead against all validated references
 * @param leadId - Lead ID to match
 * @returns Top 5 ranked reference matches
 */
export async function matchLeadAgainstReferences(leadId: string): Promise<ReferenceMatchScore[]> {
  // 1. Fetch lead with website audit (for tech stack)
  const [lead] = await db.select().from(leads).where(eq(leads.id, leadId)).limit(1);

  if (!lead) {
    throw new Error(`Lead ${leadId} not found`);
  }

  const [websiteAudit] = await db
    .select()
    .from(websiteAudits)
    .where(eq(websiteAudits.leadId, leadId))
    .limit(1);

  // Extract tech stack from website audit
  let leadTechStack: string[] = [];
  if (websiteAudit?.techStack) {
    const techStackData =
      typeof websiteAudit.techStack === 'string'
        ? (JSON.parse(websiteAudit.techStack) as Record<string, unknown>)
        : (websiteAudit.techStack as Record<string, unknown>);

    // Extract technologies from tech stack object
    const techs: unknown[] = [
      techStackData.cms,
      techStackData.cmsVersion,
      techStackData.framework,
      techStackData.hosting,
      techStackData.server,
      ...((techStackData.libraries as string[] | undefined) || []),
      ...((techStackData.frontendFrameworks as string[] | undefined) || []),
      ...((techStackData.backendTechnologies as string[] | undefined) || []),
    ];
    leadTechStack = techs.filter((t): t is string => typeof t === 'string' && t.length > 0);
  }

  const leadIndustry = lead.industry;

  // 2. Fetch all validated references
  const validatedReferences = await db
    .select()
    .from(references)
    .where(and(eq(references.isValidated, true), eq(references.status, 'approved')));

  if (validatedReferences.length === 0) {
    console.warn(`[Reference Matcher] No validated references found`);
    return [];
  }

  // 3. Calculate scores for each reference
  const matches: ReferenceMatchScore[] = validatedReferences.map(reference => {
    const referenceTechStack: string[] =
      typeof reference.technologies === 'string'
        ? (JSON.parse(reference.technologies) as string[])
        : (reference.technologies as string[]);

    const techMatch = calculateTechStackMatch(leadTechStack, referenceTechStack);
    const industryMatch = calculateIndustryMatch(leadIndustry, reference.industry);

    // Weighted total score: 60% tech + 40% industry
    const totalScore = Math.round(techMatch.score * 0.6 + industryMatch.score * 0.4);

    // Generate reasoning
    let reasoning = `Tech Stack Match: ${techMatch.score}% (${techMatch.matchedTechnologies.length}/${leadTechStack.length} technologies). `;
    reasoning += `Industry Match: ${industryMatch.score}%. `;
    if (techMatch.matchedTechnologies.length > 0) {
      reasoning += `Matched: ${techMatch.matchedTechnologies.join(', ')}.`;
    }

    return {
      referenceId: reference.id,
      reference,
      techStackScore: techMatch.score,
      industryScore: industryMatch.score,
      totalScore,
      matchedTechnologies: techMatch.matchedTechnologies,
      matchedIndustries: industryMatch.matchedIndustries,
      reasoning,
    };
  });

  // 4. Sort by total score (descending) and return top 5
  const topMatches = matches
    .sort((a, b) => b.totalScore - a.totalScore)
    .slice(0, 5)
    .map((match, index) => ({
      ...match,
      rank: index + 1,
    }));

  return topMatches;
}

/**
 * Save reference matches to database
 * @param leadId - Lead ID
 * @param matches - Matched references with scores
 */
export async function saveReferenceMatches(
  leadId: string,
  matches: ReferenceMatchScore[]
): Promise<void> {
  // Delete existing matches for this lead
  await db.delete(referenceMatches).where(eq(referenceMatches.leadId, leadId));

  // Insert new matches
  const newMatches: NewReferenceMatch[] = matches.map((match, index) => ({
    leadId,
    referenceId: match.referenceId,
    totalScore: match.totalScore,
    techStackScore: match.techStackScore,
    industryScore: match.industryScore,
    matchedTechnologies: JSON.stringify(match.matchedTechnologies),
    matchedIndustries: JSON.stringify(match.matchedIndustries),
    reasoning: match.reasoning,
    rank: index + 1,
  }));

  if (newMatches.length > 0) {
    await db.insert(referenceMatches).values(newMatches);
    // Log only when matches are saved
    if (newMatches.length > 0) {
      console.info(`[Reference Matcher] Saved ${newMatches.length} matches for lead ${leadId}`);
    }
  }
}

/**
 * Main function: Match and save reference matches for a lead
 * @param leadId - Lead ID
 * @returns Top 5 reference matches
 */
export async function matchAndSaveReferences(leadId: string): Promise<ReferenceMatchScore[]> {
  const matches = await matchLeadAgainstReferences(leadId);
  await saveReferenceMatches(leadId, matches);
  return matches;
}
