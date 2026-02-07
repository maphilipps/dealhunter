// ═══════════════════════════════════════════════════════════════════════════════
// SYNTHESIS STEPS - QualificationScan 2.0 Workflow
// Final step that creates the Business Line recommendation
// ═══════════════════════════════════════════════════════════════════════════════

import {
  blRecommendationSchema,
  type BLRecommendation,
  type TechStack,
  type ContentVolume,
  type Features,
} from '../../schema';
import { wrapTool } from '../tool-wrapper';
import type { BusinessUnit } from '../types';

// ═══════════════════════════════════════════════════════════════════════════════
// SYNTHESIS INPUT TYPE
// ═══════════════════════════════════════════════════════════════════════════════

export interface SynthesisInput {
  url: string;
  companyName?: string;
  techStack: TechStack;
  contentVolume: ContentVolume;
  features: Features;
  businessUnits: BusinessUnit[];
  extractedRequirements?: unknown;
  cmsRecommendation?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// RECOMMEND BUSINESS LINE STEP
// ═══════════════════════════════════════════════════════════════════════════════

export async function generateBLRecommendation(
  input: SynthesisInput,
  contextSection?: string
): Promise<BLRecommendation> {
  // Agent-native + non-hallucinating: derive BU deterministically from *explicit* CMS constraints.
  // We MUST NOT invent a CMS ("Sulu") or claim "explicitly recommends" unless the document evidence says so.
  const validBUNames = input.businessUnits.map(bu => bu.name);
  if (validBUNames.length === 0) {
    throw new Error('No business units available');
  }

  const cmsEvidence = extractExplicitCmsEvidence(input.extractedRequirements);

  // Pick BU based on explicit CMS if present; otherwise pick a conservative default with low confidence.
  const primary = pickBusinessUnit({
    cms: cmsEvidence?.cms,
    businessUnits: input.businessUnits,
    techStack: input.techStack,
  });

  const primaryConfidence = cmsEvidence ? Math.min(90, Math.max(55, cmsEvidence.confidence)) : 35;
  const reasoning = cmsEvidence
    ? [
        `CMS-Vorgabe im Dokument: "${cmsEvidence.cms}".`,
        cmsEvidence.rawTextSnippet ? `Beleg (Auszug): "${cmsEvidence.rawTextSnippet}".` : null,
        `Daher Zuordnung zur Business Line "${primary}" (CMS/Stack-Keywords match).`,
      ]
        .filter(Boolean)
        .join(' ')
    : [
        'Keine belastbare CMS-Vorgabe im Dokument erkannt (cmsConstraints fehlt/zu geringe Confidence).',
        `Vorlaeufige Zuordnung: "${primary}" (niedrige Confidence).`,
        'Empfehlung: CMS-Vorgabe in Rueckfragen/Bieterfragen explizit klaeren, bevor Annahmen getroffen werden.',
      ].join(' ');

  const alternatives = validBUNames
    .filter(n => n !== primary)
    .map((name, idx) => ({
      name,
      confidence: Math.max(15, primaryConfidence - 20 - idx * 10),
      reason: cmsEvidence
        ? `Alternative falls die CMS-Vorgabe nicht bindend ist oder sich aendert.`
        : `Alternative bei anderem Technologie-Fokus.`,
    }));

  const requiredSkills = deriveRequiredSkills({
    cms: cmsEvidence?.cms,
    techStack: input.techStack,
    features: input.features,
  });

  const out: BLRecommendation = {
    primaryBusinessLine: primary,
    confidence: primaryConfidence,
    reasoning,
    alternativeBusinessLines: alternatives,
    requiredSkills,
  };

  // Runtime validation (safety net)
  blRecommendationSchema.parse(out);
  return out;
}

function normalizeCmsName(raw: string): string {
  return raw.trim().toLowerCase();
}

function extractExplicitCmsEvidence(extractedRequirements: unknown): {
  cms: string;
  confidence: number;
  rawTextSnippet?: string;
} | null {
  const cms = (extractedRequirements as any)?.cmsConstraints;
  if (!cms || typeof cms !== 'object') return null;

  const confidence = typeof cms.confidence === 'number' ? cms.confidence : 0;
  const rawText = typeof cms.rawText === 'string' ? cms.rawText : '';
  const required = Array.isArray(cms.required) ? cms.required : [];
  const preferred = Array.isArray(cms.preferred) ? cms.preferred : [];

  // We treat only explicit required/preferred CMS as "evidence".
  const candidates: string[] = [...required, ...preferred].filter(
    (s): s is string => typeof s === 'string'
  );
  if (candidates.length === 0) return null;

  // Guardrail: we only accept as explicit if confidence is reasonable OR raw text mentions the CMS.
  // This prevents hallucinations like "explicitly recommends Sulu".
  const best = candidates[0];
  const normBest = normalizeCmsName(best);
  const rawMentions = rawText.toLowerCase().includes(normBest);
  if (confidence < 55 && !rawMentions) return null;

  const snippet = rawText ? rawText.replace(/\s+/g, ' ').trim().slice(0, 220) : undefined;

  return { cms: best, confidence, rawTextSnippet: snippet };
}

function pickBusinessUnit(input: {
  cms?: string;
  businessUnits: BusinessUnit[];
  techStack: TechStack;
}): string {
  const valid = input.businessUnits.map(b => b.name);
  const fallback = valid.includes('PHP') ? 'PHP' : valid[0];

  if (!input.cms) return fallback;

  const cmsNorm = normalizeCmsName(input.cms);
  let bestName = fallback;
  let bestScore = -1;

  for (const bu of input.businessUnits) {
    const keywords = bu.keywords.map(k => k.toLowerCase());
    const score = keywords.some(k => k.includes(cmsNorm) || cmsNorm.includes(k)) ? 10 : 0;
    if (score > bestScore) {
      bestScore = score;
      bestName = bu.name;
    }
  }

  return bestScore >= 0 ? bestName : fallback;
}

function deriveRequiredSkills(input: {
  cms?: string;
  techStack: TechStack;
  features: Features;
}): string[] {
  const skills: string[] = [];
  if (input.cms) skills.push(input.cms);
  if (input.techStack.framework) skills.push(input.techStack.framework);
  for (const b of input.techStack.backend ?? []) skills.push(b);

  if (input.features.multiLanguage) skills.push('Mehrsprachigkeit');
  if (input.features.api) skills.push('API-Integration');
  if (input.features.userAccounts) skills.push('Identity / Accounts');
  if (input.features.ecommerce) skills.push('E-Commerce');

  // Always relevant in public tenders / portals
  skills.push('Barrierefreiheit (BITV/WCAG)');
  skills.push('DSGVO');

  // De-dup
  return Array.from(new Set(skills.filter(Boolean)));
}

function formatBLRecommendationForRAG(result: unknown): string {
  const bl = result as BLRecommendation;
  const parts: string[] = [
    `Empfohlene Business Line: ${bl.primaryBusinessLine || 'Nicht bestimmt'}`,
    `Confidence: ${bl.confidence}%`,
    `Begründung: ${bl.reasoning || 'Keine Begründung verfügbar'}`,
  ];

  if (bl.alternativeBusinessLines?.length) {
    const alts = bl.alternativeBusinessLines.map(a => a.name).join(', ');
    parts.push(`Alternativen: ${alts}`);
  }

  return parts.join('. ');
}

// Input type that matches the actual input from dependencies
interface RecommendBLInput {
  techStack: TechStack;
  contentVolume: ContentVolume;
  features: Features;
  loadBusinessUnits: BusinessUnit[]; // Key matches dependency name
}

export const recommendBusinessLineStep = wrapTool<RecommendBLInput, BLRecommendation>(
  {
    name: 'recommendBusinessLine',
    displayName: 'BL Recommendation',
    phase: 'synthesis',
    dependencies: ['techStack', 'contentVolume', 'features', 'loadBusinessUnits'],
    optional: false,
    timeout: 60000,
    // Agent-Native: Auto-store BL recommendation
    ragStorage: {
      chunkType: 'bl_recommendation',
      category: 'recommendation',
      formatContent: formatBLRecommendationForRAG,
      getConfidence: result => (result as BLRecommendation).confidence ?? 60,
    },
  },
  async (input, ctx) => {
    // Map input to SynthesisInput format
    const synthesisInput: SynthesisInput = {
      url: ctx.fullUrl,
      techStack: input.techStack,
      contentVolume: input.contentVolume,
      features: input.features,
      businessUnits: input.loadBusinessUnits, // Map from loadBusinessUnits to businessUnits
      extractedRequirements: ctx.input.extractedRequirements,
    };
    return generateBLRecommendation(synthesisInput, ctx.contextSection);
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// ALL SYNTHESIS STEPS
// ═══════════════════════════════════════════════════════════════════════════════

export const synthesisSteps = [recommendBusinessLineStep];
