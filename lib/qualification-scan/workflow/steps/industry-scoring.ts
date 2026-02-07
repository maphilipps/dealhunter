// ═══════════════════════════════════════════════════════════════════════════════
// INDUSTRY SCORING STEP - QualificationScan 2.0 Workflow
// Matches company industry against adesso core industries and counts references
// ═══════════════════════════════════════════════════════════════════════════════

import { eq } from 'drizzle-orm';
import { db } from '../../../db';
import { references as referencesTable } from '../../../db/schema';
import type { CompanyIntelligence } from '../../schema';
import { wrapTool } from '../tool-wrapper';
import type { BusinessUnit } from '../types';

// ═══════════════════════════════════════════════════════════════════════════════
// RESULT TYPE
// ═══════════════════════════════════════════════════════════════════════════════

export interface IndustryScoringResult {
  industry: string;
  matchedBusinessUnits: Array<{ name: string; score: number }>;
  referenceCount: number;
  isCoreBranch: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// INPUT TYPE
// ═══════════════════════════════════════════════════════════════════════════════

interface IndustryScoringInput {
  companyIntelligence: CompanyIntelligence | null;
  loadBusinessUnits: BusinessUnit[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCORING LOGIC
// ═══════════════════════════════════════════════════════════════════════════════

function matchIndustryToBusinessUnits(
  industry: string,
  businessUnits: BusinessUnit[]
): Array<{ name: string; score: number }> {
  const industryLower = industry.toLowerCase();
  const industryWords = industryLower.split(/[\s,;/&]+/).filter(w => w.length > 2);

  const scored: Array<{ name: string; score: number }> = [];

  for (const bu of businessUnits) {
    let score = 0;
    const buKeywords = bu.keywords.map(k => k.toLowerCase());

    for (const keyword of buKeywords) {
      // Exact match in industry string
      if (industryLower.includes(keyword)) {
        score += 3;
      }
      // Partial word match
      else if (industryWords.some(w => keyword.includes(w) || w.includes(keyword))) {
        score += 1;
      }
    }

    if (score > 0) {
      scored.push({ name: bu.name, score });
    }
  }

  return scored.sort((a, b) => b.score - a.score);
}

// ═══════════════════════════════════════════════════════════════════════════════
// RAG FORMAT
// ═══════════════════════════════════════════════════════════════════════════════

function formatIndustryScoringForRAG(result: unknown): string {
  const r = result as IndustryScoringResult;
  const parts = [`Branche: ${r.industry}`];
  if (r.isCoreBranch) {
    parts.push('Kernbranche von adesso');
  }
  if (r.matchedBusinessUnits.length > 0) {
    const matches = r.matchedBusinessUnits
      .slice(0, 3)
      .map(m => `${m.name} (Score: ${m.score})`)
      .join(', ');
    parts.push(`Passende Business Units: ${matches}`);
  }
  parts.push(`${r.referenceCount} Referenzen in dieser Branche`);
  return parts.join('. ');
}

// ═══════════════════════════════════════════════════════════════════════════════
// INDUSTRY SCORING STEP
// ═══════════════════════════════════════════════════════════════════════════════

export const industryScoringStep = wrapTool<IndustryScoringInput, IndustryScoringResult>(
  {
    name: 'industryScoring',
    displayName: 'Industry Scoring',
    phase: 'analysis',
    dependencies: ['companyIntelligence', 'loadBusinessUnits'],
    optional: true,
    timeout: 15000,
    ragStorage: {
      chunkType: 'industry_scoring',
      category: 'fact',
      formatContent: formatIndustryScoringForRAG,
      getConfidence: result => {
        const r = result as IndustryScoringResult;
        return r.isCoreBranch ? 85 : r.matchedBusinessUnits.length > 0 ? 65 : 40;
      },
    },
  },
  async (input, _ctx) => {
    const industry = input.companyIntelligence?.basicInfo?.industry ?? 'Unbekannt';

    // Match against business units
    const matchedBusinessUnits = matchIndustryToBusinessUnits(industry, input.loadBusinessUnits);

    const isCoreBranch = matchedBusinessUnits.length > 0 && matchedBusinessUnits[0].score >= 3;

    // Count references in this industry from DB
    let referenceCount = 0;
    try {
      const refs = await db
        .select()
        .from(referencesTable)
        .where(eq(referencesTable.status, 'approved'));

      referenceCount = refs.filter(ref => {
        const refIndustry = ref.industry?.toLowerCase() ?? '';
        const targetIndustry = industry.toLowerCase();
        return (
          refIndustry.includes(targetIndustry) ||
          targetIndustry.includes(refIndustry) ||
          targetIndustry
            .split(/[\s,;/&]+/)
            .filter((w: string) => w.length > 2)
            .some((w: string) => refIndustry.includes(w))
        );
      }).length;
    } catch (error) {
      console.warn('[IndustryScoring] Error querying references:', error);
    }

    return {
      industry,
      matchedBusinessUnits,
      referenceCount,
      isCoreBranch,
    };
  }
);
