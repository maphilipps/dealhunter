/**
 * Business Unit Matching Logic
 *
 * Multi-Kriterien Match mit gleichmäßiger Gewichtung (je 20%)
 * für die Zuordnung von Bids zu Business Units
 */

import { eq } from 'drizzle-orm';

import { db } from '@/lib/db';
import type { BusinessUnit, QuickScan, Reference } from '@/lib/db/schema';
import { businessUnits, references, technologies } from '@/lib/db/schema';

/**
 * Match-Kriterien (je 20%)
 */
export interface BUMatchCriteria {
  techStackScore: number; // 20% - CMS/Framework Match
  featuresScore: number; // 20% - Feature-Set Übereinstimmung
  referencesScore: number; // 20% - Passende Referenzen
  industryScore: number; // 20% - Branche Match
  keywordsScore: number; // 20% - NLP Match
}

export interface BUMatchResult {
  businessUnit: BusinessUnit;
  totalScore: number; // 0-100
  criteria: BUMatchCriteria;
  matchedTechnologies: string[];
  matchedReferences: Reference[];
  reasoning: string;
}

/**
 * Berechnet Tech Stack Match Score (0-100)
 * Vergleicht erkanntes CMS/Framework mit den Technologies der BU
 */
async function calculateTechStackScore(
  quickScan: QuickScan,
  businessUnit: BusinessUnit
): Promise<{ score: number; matched: string[] }> {
  const matched: string[] = [];

  // Parse tech stack from quick scan
  const techStack = quickScan.techStack ? JSON.parse(quickScan.techStack) : {};
  const detectedTechs: string[] = [];

  if (techStack.cms) detectedTechs.push(techStack.cms.toLowerCase());
  if (techStack.framework) detectedTechs.push(techStack.framework.toLowerCase());
  if (techStack.backend)
    detectedTechs.push(...techStack.backend.map((t: string) => t.toLowerCase()));

  if (detectedTechs.length === 0) {
    return { score: 0, matched: [] };
  }

  // Get technologies for this BU
  const buTechs = await db
    .select()
    .from(technologies)
    .where(eq(technologies.businessUnitId, businessUnit.id));

  const buTechNames = buTechs.map(t => t.name.toLowerCase());

  // Calculate matches
  for (const detectedTech of detectedTechs) {
    for (const buTech of buTechNames) {
      // Exact match or contains
      if (buTech.includes(detectedTech) || detectedTech.includes(buTech)) {
        matched.push(detectedTech);
        break;
      }
    }
  }

  // Score: percentage of detected techs that matched
  const score = (matched.length / detectedTechs.length) * 100;

  return { score, matched };
}

/**
 * Berechnet Features Match Score (0-100)
 * Vergleicht erkannte Features mit typischen Features der BU
 */
function calculateFeaturesScore(quickScan: QuickScan, _businessUnit: BusinessUnit): number {
  const features = quickScan.features ? JSON.parse(quickScan.features) : {};

  // Count detected features
  let detectedCount = 0;
  if (features.ecommerce) detectedCount++;
  if (features.userAccounts) detectedCount++;
  if (features.search) detectedCount++;
  if (features.multiLanguage) detectedCount++;
  if (features.blog) detectedCount++;
  if (features.forms) detectedCount++;
  if (features.api) detectedCount++;

  // Baseline: More features = more complex = better for specialized BUs
  // For now, simple heuristic: normalize to 0-100
  const maxFeatures = 7;
  const score = (detectedCount / maxFeatures) * 100;

  return score;
}

/**
 * Berechnet Referenzen Match Score (0-100)
 * Zählt Referenzen der BU, die passende Technologies haben
 */
async function calculateReferencesScore(
  quickScan: QuickScan,
  businessUnit: BusinessUnit
): Promise<{ score: number; matched: Reference[] }> {
  const techStack = quickScan.techStack ? JSON.parse(quickScan.techStack) : {};
  const detectedTechs: string[] = [];

  if (techStack.cms) detectedTechs.push(techStack.cms.toLowerCase());
  if (techStack.framework) detectedTechs.push(techStack.framework.toLowerCase());

  if (detectedTechs.length === 0) {
    return { score: 0, matched: [] };
  }

  // Get all validated references
  const allRefs = await db.select().from(references).where(eq(references.isValidated, true));

  // Find references that match detected technologies
  const matchedRefs: Reference[] = [];

  for (const ref of allRefs) {
    const refTechs = JSON.parse(ref.technologies) as string[];
    const refTechsLower = refTechs.map(t => t.toLowerCase());

    // Check if any detected tech is in reference
    for (const detectedTech of detectedTechs) {
      if (refTechsLower.some(rt => rt.includes(detectedTech) || detectedTech.includes(rt))) {
        matchedRefs.push(ref);
        break;
      }
    }
  }

  // Score based on number of matching references
  // 0 refs = 0%, 1-5 refs = 20-60%, 6+ refs = 80-100%
  let score = 0;
  if (matchedRefs.length === 0) score = 0;
  else if (matchedRefs.length === 1) score = 20;
  else if (matchedRefs.length <= 5) score = 20 + (matchedRefs.length - 1) * 10;
  else score = 80 + Math.min((matchedRefs.length - 5) * 4, 20);

  return { score: Math.min(score, 100), matched: matchedRefs };
}

/**
 * Berechnet Industry Match Score (0-100)
 * Vergleicht erkannte Branche mit typischen Branchen der BU
 */
function calculateIndustryScore(quickScan: QuickScan, _businessUnit: BusinessUnit): number {
  const companyIntelligence = quickScan.companyIntelligence
    ? JSON.parse(quickScan.companyIntelligence)
    : null;

  if (!companyIntelligence?.basicInfo?.industry) {
    return 50; // Neutral score if no industry detected
  }

  const industry = companyIntelligence.basicInfo.industry.toLowerCase();

  // Simple industry categorization
  // In a real system, this would match against BU-specific industry expertise
  const knownIndustries = [
    'automotive',
    'finance',
    'healthcare',
    'retail',
    'manufacturing',
    'energy',
  ];

  if (knownIndustries.some(i => industry.includes(i))) {
    return 80; // Good match for known industries
  }

  return 50; // Neutral for unknown industries
}

/**
 * Berechnet Keywords Match Score (0-100)
 * NLP Match gegen Anforderungen
 */
function calculateKeywordsScore(quickScan: QuickScan, businessUnit: BusinessUnit): number {
  const buKeywords = JSON.parse(businessUnit.keywords) as string[];
  const buKeywordsLower = buKeywords.map(k => k.toLowerCase());

  // Combine all text from quick scan for matching
  const searchText: string[] = [];

  // Add tech stack
  if (quickScan.cms) searchText.push(quickScan.cms.toLowerCase());
  if (quickScan.framework) searchText.push(quickScan.framework.toLowerCase());

  // Add recommended BL
  if (quickScan.recommendedBusinessUnit) {
    searchText.push(quickScan.recommendedBusinessUnit.toLowerCase());
  }

  // Add reasoning
  if (quickScan.reasoning) {
    searchText.push(quickScan.reasoning.toLowerCase());
  }

  const combinedText = searchText.join(' ');

  // Count keyword matches
  let matchedKeywords = 0;
  for (const keyword of buKeywordsLower) {
    if (combinedText.includes(keyword)) {
      matchedKeywords++;
    }
  }

  // Score: percentage of BU keywords found
  if (buKeywords.length === 0) return 0;

  const score = (matchedKeywords / buKeywords.length) * 100;
  return score;
}

/**
 * Berechnet vollständigen BU Match
 */
export async function calculateBUMatch(
  quickScan: QuickScan,
  businessUnit: BusinessUnit
): Promise<BUMatchResult> {
  // Calculate all criteria (each worth 20%)
  const techStack = await calculateTechStackScore(quickScan, businessUnit);
  const features = calculateFeaturesScore(quickScan, businessUnit);
  const refs = await calculateReferencesScore(quickScan, businessUnit);
  const industry = calculateIndustryScore(quickScan, businessUnit);
  const keywords = calculateKeywordsScore(quickScan, businessUnit);

  const criteria: BUMatchCriteria = {
    techStackScore: techStack.score,
    featuresScore: features,
    referencesScore: refs.score,
    industryScore: industry,
    keywordsScore: keywords,
  };

  // Total score: weighted average (each 20%)
  const totalScore =
    criteria.techStackScore * 0.2 +
    criteria.featuresScore * 0.2 +
    criteria.referencesScore * 0.2 +
    criteria.industryScore * 0.2 +
    criteria.keywordsScore * 0.2;

  // Generate reasoning
  const reasons: string[] = [];
  if (techStack.score >= 80)
    reasons.push(`Starke Tech-Stack Übereinstimmung (${techStack.matched.join(', ')})`);
  if (refs.score >= 80) reasons.push(`${refs.matched.length} passende Referenzen`);
  if (industry >= 80) reasons.push('Branchenerfahrung vorhanden');
  if (keywords >= 80) reasons.push('Keywords matchen gut');

  const reasoning =
    reasons.length > 0 ? reasons.join('; ') : 'Moderater Match basierend auf verfügbaren Daten';

  return {
    businessUnit,
    totalScore,
    criteria,
    matchedTechnologies: techStack.matched,
    matchedReferences: refs.matched,
    reasoning,
  };
}

/**
 * Berechnet Matches für alle Business Units und sortiert nach Score
 */
export async function getAllBUMatches(quickScan: QuickScan): Promise<BUMatchResult[]> {
  // Get all business units
  const allBUs = await db.select().from(businessUnits);

  // Calculate match for each BU
  const matches = await Promise.all(allBUs.map(bu => calculateBUMatch(quickScan, bu)));

  // Sort by total score descending
  matches.sort((a, b) => b.totalScore - a.totalScore);

  return matches;
}
