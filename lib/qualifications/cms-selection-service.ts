/**
 * CMS Selection Service (DEA-151)
 *
 * Provides BU-specific CMS filtering and selection for qualifications.
 * Each Business Unit has its own set of supported CMS options.
 *
 * Features:
 * - BU-specific CMS filtering
 * - 2-factor scoring (requirements match + BU preference)
 * - Lead requirements analysis
 * - CMS comparison helpers
 */

import { eq, and } from 'drizzle-orm';

import { db } from '@/lib/db';
import { qualifications, technologies, businessUnits } from '@/lib/db/schema';
import { queryRagForLead, formatLeadContext } from '@/lib/rag/lead-retrieval-service';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * CMS option with scoring
 */
export interface CMSOption {
  id: string;
  name: string;
  category: string;
  description: string | null;
  logoUrl: string | null;
  websiteUrl: string | null;
  license: string | null;
  latestVersion: string | null;
  githubUrl: string | null;
  githubStars: number | null;
  isDefault: boolean;

  // Scoring
  requirementsScore: number; // 0-100 based on lead requirements
  buPreferenceScore: number; // 0-100 based on BU default/preference
  overallScore: number; // Combined score
  matchReasons: string[]; // Why this CMS matches
}

/**
 * CMS Selection result
 */
export interface CMSSelectionResult {
  leadId: string;
  businessUnitId: string;
  businessUnitName: string;
  availableCMS: CMSOption[];
  recommendedCMS: CMSOption | null;
  currentSelection: string | null;
}

/**
 * CMS requirements extracted from lead
 */
export interface CMSRequirements {
  needsHeadless: boolean;
  needsEnterprise: boolean;
  needsOpenSource: boolean;
  needsMultilingual: boolean;
  needsEcommerce: boolean;
  preferredTech: string[]; // e.g., ['PHP', 'JavaScript']
  budgetTier: 'low' | 'medium' | 'high' | 'enterprise';
}

// ═══════════════════════════════════════════════════════════════════════════════
// CMS METADATA
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * CMS feature metadata for scoring
 * This supplements database info with known CMS capabilities
 */
const CMS_FEATURES: Record<
  string,
  {
    isHeadless: boolean;
    isEnterprise: boolean;
    isOpenSource: boolean;
    hasMultilingual: boolean;
    hasEcommerce: boolean;
    techStack: string[];
    budgetTier: 'low' | 'medium' | 'high' | 'enterprise';
  }
> = {
  drupal: {
    isHeadless: true,
    isEnterprise: true,
    isOpenSource: true,
    hasMultilingual: true,
    hasEcommerce: true,
    techStack: ['PHP', 'Symfony'],
    budgetTier: 'medium',
  },
  wordpress: {
    isHeadless: true,
    isEnterprise: false,
    isOpenSource: true,
    hasMultilingual: true,
    hasEcommerce: true,
    techStack: ['PHP'],
    budgetTier: 'low',
  },
  typo3: {
    isHeadless: true,
    isEnterprise: true,
    isOpenSource: true,
    hasMultilingual: true,
    hasEcommerce: false,
    techStack: ['PHP', 'Symfony'],
    budgetTier: 'medium',
  },
  contentful: {
    isHeadless: true,
    isEnterprise: true,
    isOpenSource: false,
    hasMultilingual: true,
    hasEcommerce: false,
    techStack: ['JavaScript', 'API-first'],
    budgetTier: 'enterprise',
  },
  strapi: {
    isHeadless: true,
    isEnterprise: false,
    isOpenSource: true,
    hasMultilingual: true,
    hasEcommerce: false,
    techStack: ['JavaScript', 'Node.js'],
    budgetTier: 'low',
  },
  sanity: {
    isHeadless: true,
    isEnterprise: true,
    isOpenSource: false,
    hasMultilingual: true,
    hasEcommerce: false,
    techStack: ['JavaScript', 'React'],
    budgetTier: 'high',
  },
  'adobe experience manager': {
    isHeadless: true,
    isEnterprise: true,
    isOpenSource: false,
    hasMultilingual: true,
    hasEcommerce: true,
    techStack: ['Java'],
    budgetTier: 'enterprise',
  },
  sitecore: {
    isHeadless: true,
    isEnterprise: true,
    isOpenSource: false,
    hasMultilingual: true,
    hasEcommerce: true,
    techStack: ['.NET', 'C#'],
    budgetTier: 'enterprise',
  },
};

/**
 * Get CMS features by name (case-insensitive)
 */
function getCMSFeatures(cmsName: string) {
  const normalized = cmsName.toLowerCase();
  for (const [key, features] of Object.entries(CMS_FEATURES)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return features;
    }
  }
  // Default features for unknown CMS
  return {
    isHeadless: false,
    isEnterprise: false,
    isOpenSource: true,
    hasMultilingual: false,
    hasEcommerce: false,
    techStack: [],
    budgetTier: 'medium' as const,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// REQUIREMENTS EXTRACTION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Extract CMS requirements from lead data and RAG context
 */
async function extractCMSRequirements(
  leadId: string,
  requirements: string | null,
  budget: string | null
): Promise<CMSRequirements> {
  // Query RAG for technology and CMS preferences
  const ragResults = await queryRagForLead({
    qualificationId: leadId,
    question:
      'CMS requirements, headless, content management, editorial workflow, multilingual, ecommerce',
    maxResults: 5,
  });

  const ragContext = formatLeadContext(ragResults, false);
  const combinedText = `${requirements || ''} ${budget || ''} ${ragContext}`.toLowerCase();

  // Extract requirements from text
  const needsHeadless = ['headless', 'decoupled', 'api-first', 'jamstack'].some(k =>
    combinedText.includes(k)
  );

  const needsEnterprise = ['enterprise', 'large-scale', 'high-traffic', 'mission-critical'].some(
    k => combinedText.includes(k)
  );

  const needsOpenSource = ['open source', 'open-source', 'oss', 'no vendor lock'].some(k =>
    combinedText.includes(k)
  );

  const needsMultilingual = [
    'multilingual',
    'multi-language',
    'multiple languages',
    'i18n',
    'localization',
  ].some(k => combinedText.includes(k));

  const needsEcommerce = ['ecommerce', 'e-commerce', 'online shop', 'webshop', 'shopping'].some(k =>
    combinedText.includes(k)
  );

  // Extract tech preferences
  const techKeywords = ['php', 'javascript', 'node', 'java', '.net', 'python', 'react', 'vue'];
  const preferredTech = techKeywords.filter(t => combinedText.includes(t));

  // Determine budget tier
  let budgetTier: 'low' | 'medium' | 'high' | 'enterprise' = 'medium';
  if (budget) {
    const budgetLower = budget.toLowerCase();
    if (
      budgetLower.includes('enterprise') ||
      budgetLower.includes('1m') ||
      budgetLower.includes('million')
    ) {
      budgetTier = 'enterprise';
    } else if (budgetLower.includes('500k') || budgetLower.includes('high')) {
      budgetTier = 'high';
    } else if (
      budgetLower.includes('small') ||
      budgetLower.includes('low') ||
      budgetLower.includes('50k')
    ) {
      budgetTier = 'low';
    }
  }

  return {
    needsHeadless,
    needsEnterprise,
    needsOpenSource,
    needsMultilingual,
    needsEcommerce,
    preferredTech,
    budgetTier,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCORING
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Calculate requirements match score for a CMS
 */
function calculateRequirementsScore(
  cmsName: string,
  requirements: CMSRequirements
): { score: number; reasons: string[] } {
  const features = getCMSFeatures(cmsName);
  let score = 50; // Base score
  const reasons: string[] = [];

  // Headless match
  if (requirements.needsHeadless && features.isHeadless) {
    score += 15;
    reasons.push('Supports headless/decoupled architecture');
  } else if (requirements.needsHeadless && !features.isHeadless) {
    score -= 20;
  }

  // Enterprise match
  if (requirements.needsEnterprise && features.isEnterprise) {
    score += 15;
    reasons.push('Enterprise-grade capabilities');
  } else if (requirements.needsEnterprise && !features.isEnterprise) {
    score -= 15;
  }

  // Open source match
  if (requirements.needsOpenSource && features.isOpenSource) {
    score += 10;
    reasons.push('Open source license');
  } else if (requirements.needsOpenSource && !features.isOpenSource) {
    score -= 10;
  }

  // Multilingual match
  if (requirements.needsMultilingual && features.hasMultilingual) {
    score += 10;
    reasons.push('Built-in multilingual support');
  } else if (requirements.needsMultilingual && !features.hasMultilingual) {
    score -= 10;
  }

  // Ecommerce match
  if (requirements.needsEcommerce && features.hasEcommerce) {
    score += 10;
    reasons.push('E-commerce capabilities');
  } else if (requirements.needsEcommerce && !features.hasEcommerce) {
    score -= 5;
  }

  // Tech stack match
  const techOverlap = requirements.preferredTech.filter(t =>
    features.techStack.some(ft => ft.toLowerCase().includes(t))
  );
  if (techOverlap.length > 0) {
    score += techOverlap.length * 5;
    reasons.push(`Technology stack match: ${techOverlap.join(', ')}`);
  }

  // Budget tier match
  const budgetOrder = ['low', 'medium', 'high', 'enterprise'];
  const reqBudgetIdx = budgetOrder.indexOf(requirements.budgetTier);
  const cmsBudgetIdx = budgetOrder.indexOf(features.budgetTier);
  const budgetDiff = Math.abs(reqBudgetIdx - cmsBudgetIdx);

  if (budgetDiff === 0) {
    score += 10;
    reasons.push('Budget tier match');
  } else if (budgetDiff === 1) {
    score += 5;
  } else if (budgetDiff > 1) {
    score -= 10;
  }

  return {
    score: Math.max(0, Math.min(100, score)),
    reasons,
  };
}

/**
 * Calculate BU preference score
 */
function calculateBUPreferenceScore(isDefault: boolean): number {
  return isDefault ? 100 : 50;
}

/**
 * Calculate overall score (60% requirements, 40% BU preference)
 */
function calculateOverallScore(requirementsScore: number, buPreferenceScore: number): number {
  return Math.round(requirementsScore * 0.6 + buPreferenceScore * 0.4);
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN SERVICE FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get available CMS options for a lead's Business Unit
 *
 * Flow:
 * 1. Get lead's BU
 * 2. Fetch all CMS technologies for that BU
 * 3. Extract lead requirements
 * 4. Score and rank CMS options
 *
 * @param leadId - Lead ID
 * @returns CMS selection result with scored options
 */
export async function getCMSOptionsForLead(leadId: string): Promise<CMSSelectionResult> {
  // 1. Fetch lead with BU
  const leadData = await db
    .select({
      leadId: qualifications.id,
      businessUnitId: qualifications.businessUnitId,
      requirements: qualifications.requirements,
      budget: qualifications.budget,
      selectedCmsId: qualifications.selectedCmsId,
    })
    .from(qualifications)
    .where(eq(qualifications.id, leadId));

  if (leadData.length === 0) {
    throw new Error(`Lead ${leadId} not found`);
  }

  const lead = leadData[0];

  // 2. Fetch BU name
  const buData = await db
    .select({ name: businessUnits.name })
    .from(businessUnits)
    .where(eq(businessUnits.id, lead.businessUnitId));

  const buName = buData[0]?.name || 'Unknown BU';

  // 3. Fetch all CMS technologies for this BU
  const cmsOptions = await db
    .select()
    .from(technologies)
    .where(
      and(eq(technologies.businessUnitId, lead.businessUnitId), eq(technologies.category, 'CMS'))
    );

  if (cmsOptions.length === 0) {
    return {
      leadId,
      businessUnitId: lead.businessUnitId,
      businessUnitName: buName,
      availableCMS: [],
      recommendedCMS: null,
      currentSelection: lead.selectedCmsId,
    };
  }

  // 4. Extract lead requirements
  const requirements = await extractCMSRequirements(leadId, lead.requirements, lead.budget);

  // 5. Score each CMS option
  const scoredOptions: CMSOption[] = cmsOptions.map(cms => {
    const { score: reqScore, reasons } = calculateRequirementsScore(cms.name, requirements);
    const buScore = calculateBUPreferenceScore(cms.isDefault);
    const overallScore = calculateOverallScore(reqScore, buScore);

    return {
      id: cms.id,
      name: cms.name,
      category: cms.category || 'CMS',
      description: cms.description,
      logoUrl: cms.logoUrl,
      websiteUrl: cms.websiteUrl,
      license: cms.license,
      latestVersion: cms.latestVersion,
      githubUrl: cms.githubUrl,
      githubStars: cms.githubStars,
      isDefault: cms.isDefault,
      requirementsScore: reqScore,
      buPreferenceScore: buScore,
      overallScore,
      matchReasons: reasons,
    };
  });

  // 6. Sort by overall score
  scoredOptions.sort((a, b) => b.overallScore - a.overallScore);

  return {
    leadId,
    businessUnitId: lead.businessUnitId,
    businessUnitName: buName,
    availableCMS: scoredOptions,
    recommendedCMS: scoredOptions[0] || null,
    currentSelection: lead.selectedCmsId,
  };
}

/**
 * Select a CMS for a lead
 *
 * @param leadId - Lead ID
 * @param cmsId - Technology ID of the selected CMS
 * @returns Updated lead
 */
export async function selectCMSForLead(leadId: string, cmsId: string): Promise<void> {
  // Verify CMS exists and is valid for the lead's BU
  const lead = await db
    .select({ businessUnitId: qualifications.businessUnitId })
    .from(qualifications)
    .where(eq(qualifications.id, leadId));

  if (lead.length === 0) {
    throw new Error(`Lead ${leadId} not found`);
  }

  const cms = await db
    .select()
    .from(technologies)
    .where(
      and(
        eq(technologies.id, cmsId),
        eq(technologies.businessUnitId, lead[0].businessUnitId),
        eq(technologies.category, 'CMS')
      )
    );

  if (cms.length === 0) {
    throw new Error(`CMS ${cmsId} not found or not available for this Business Unit`);
  }

  // Update lead
  await db
    .update(qualifications)
    .set({
      selectedCmsId: cmsId,
      updatedAt: new Date(),
    })
    .where(eq(qualifications.id, leadId));
}

/**
 * Clear CMS selection for a lead
 */
export async function clearCMSSelection(leadId: string): Promise<void> {
  await db
    .update(qualifications)
    .set({
      selectedCmsId: null,
      updatedAt: new Date(),
    })
    .where(eq(qualifications.id, leadId));
}

/**
 * Get CMS comparison for a lead
 * Compares multiple CMS options side-by-side
 */
export async function compareCMSOptions(
  leadId: string,
  cmsIds?: string[]
): Promise<{
  lead: { id: string; requirements: CMSRequirements };
  comparison: CMSOption[];
}> {
  const result = await getCMSOptionsForLead(leadId);

  // Filter to specific CMS if provided
  let comparison = result.availableCMS;
  if (cmsIds && cmsIds.length > 0) {
    comparison = comparison.filter(cms => cmsIds.includes(cms.id));
  }

  // Extract requirements for display
  const lead = await db
    .select({ requirements: qualifications.requirements, budget: qualifications.budget })
    .from(qualifications)
    .where(eq(qualifications.id, leadId));

  const requirements = await extractCMSRequirements(
    leadId,
    lead[0]?.requirements || null,
    lead[0]?.budget || null
  );

  return {
    lead: { id: leadId, requirements },
    comparison,
  };
}
