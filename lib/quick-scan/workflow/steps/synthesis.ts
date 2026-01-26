// ═══════════════════════════════════════════════════════════════════════════════
// SYNTHESIS STEPS - QuickScan 2.0 Workflow
// Final step that creates the Business Line recommendation
// ═══════════════════════════════════════════════════════════════════════════════

import { generateStructuredOutput } from '../../../ai/config';
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
}

// ═══════════════════════════════════════════════════════════════════════════════
// RECOMMEND BUSINESS LINE STEP
// ═══════════════════════════════════════════════════════════════════════════════

export async function generateBLRecommendation(
  input: SynthesisInput,
  contextSection?: string
): Promise<BLRecommendation> {
  const systemPrompt = `Du bist ein Business Development Experte bei adesso SE und empfiehlst die passende Business Line basierend auf Website-Analyse.

Verfügbare Business Lines:
${input.businessUnits.map(bu => `- ${bu.name}: Keywords: ${bu.keywords.join(', ')}`).join('\n')}

Analysiere die Website-Daten und empfehle die beste Business Line.`;

  const userPrompt = `Website: ${input.url}
${input.companyName ? `Unternehmen: ${input.companyName}` : ''}

Tech Stack:
- CMS: ${input.techStack.cms || 'Nicht erkannt'}
- Framework: ${input.techStack.framework || 'Nicht erkannt'}
- Backend: ${input.techStack.backend?.join(', ') || 'Nicht erkannt'}

Content:
- Geschätzte Seiten: ${input.contentVolume.estimatedPageCount}
- Komplexität: ${input.contentVolume.complexity || 'Unbekannt'}

Features:
- E-Commerce: ${input.features.ecommerce ? 'Ja' : 'Nein'}
- User Accounts: ${input.features.userAccounts ? 'Ja' : 'Nein'}
- Multi-Language: ${input.features.multiLanguage ? 'Ja' : 'Nein'}
- API Integration: ${input.features.api ? 'Ja' : 'Nein'}

${input.extractedRequirements ? `Anforderungen aus Dokument: ${JSON.stringify(input.extractedRequirements)}` : ''}

Empfehle die passende Business Line mit Begründung.`;

  const fullSystemPrompt = contextSection ? `${systemPrompt}\n\n${contextSection}` : systemPrompt;

  const result = await generateStructuredOutput({
    schema: blRecommendationSchema,
    system: fullSystemPrompt,
    prompt: userPrompt,
  });

  return result;
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
