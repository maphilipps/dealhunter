/**
 * CMS Advocate Orchestrator
 *
 * Runs multiple CMS advocates in parallel and synthesizes results
 * into a comparison matrix with recommendations.
 */

import { runCMSAdvocate, CMS_SPECIFIC_CONTEXT } from './base-advocate';
import {
  type CMSAdvocateInput,
  type CMSAdvocateOutput,
  type CMSComparisonOutput,
  CMSComparisonOutputSchema,
  type ProjectRequirement,
  type CustomerProfile,
} from './types';

import { generateStructuredOutput } from '@/lib/ai/config';
import { db } from '@/lib/db';
import { dealEmbeddings } from '@/lib/db/schema';
import { generateRawChunkEmbeddings } from '@/lib/rag/raw-embedding-service';

// ═══════════════════════════════════════════════════════════════════════════════
// ORCHESTRATOR TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface CMSAdvocateOrchestratorInput {
  leadId: string;
  rfpId: string;
  requirements: ProjectRequirement[];
  customerProfile: CustomerProfile;
  cmsOptions?: string[]; // Override default CMS list
}

export interface CMSAdvocateOrchestratorOutput {
  advocateResults: CMSAdvocateOutput[];
  comparison: CMSComparisonOutput;
  metadata: {
    runAt: string;
    cmsCount: number;
    requirementCount: number;
    averageFitScore: number;
    processingTimeMs: number;
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// DEFAULT CMS OPTIONS
// ═══════════════════════════════════════════════════════════════════════════════

const DEFAULT_CMS_OPTIONS = ['Drupal', 'Magnolia', 'Ibexa', 'FirstSpirit', 'Sulu'];

// ═══════════════════════════════════════════════════════════════════════════════
// ORCHESTRATOR
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Run all CMS advocates in parallel and synthesize results
 */
export async function runCMSAdvocateOrchestrator(
  input: CMSAdvocateOrchestratorInput
): Promise<CMSAdvocateOrchestratorOutput> {
  const startTime = Date.now();
  const cmsOptions = input.cmsOptions || DEFAULT_CMS_OPTIONS;

  // 1. Run all advocates in parallel
  const advocatePromises = cmsOptions.map(cmsName => {
    const advocateInput: CMSAdvocateInput = {
      leadId: input.leadId,
      requirements: input.requirements,
      customerProfile: input.customerProfile,
      competingCMS: cmsOptions.filter(c => c !== cmsName),
    };

    const additionalContext = CMS_SPECIFIC_CONTEXT[cmsName.toLowerCase()];

    return runCMSAdvocate(cmsName, advocateInput, additionalContext).catch(error => {
      console.error(`[CMS Orchestrator] ${cmsName} advocate failed:`, error);
      // Return a minimal fallback result
      return createFallbackAdvocateOutput(cmsName);
    });
  });

  const advocateResults = await Promise.all(advocatePromises);

  // 2. Synthesize comparison
  const comparison = await synthesizeComparison(advocateResults, input);

  // 3. Calculate metadata
  const processingTimeMs = Date.now() - startTime;
  const averageFitScore =
    advocateResults.reduce((sum, r) => sum + r.fitScore, 0) / advocateResults.length;

  const result: CMSAdvocateOrchestratorOutput = {
    advocateResults,
    comparison,
    metadata: {
      runAt: new Date().toISOString(),
      cmsCount: cmsOptions.length,
      requirementCount: input.requirements.length,
      averageFitScore: Math.round(averageFitScore),
      processingTimeMs,
    },
  };

  // 4. Store in RAG
  await storeInRAG(input.rfpId, result);

  return result;
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPARISON SYNTHESIZER
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Synthesize comparison from advocate results
 */
async function synthesizeComparison(
  advocateResults: CMSAdvocateOutput[],
  input: CMSAdvocateOrchestratorInput
): Promise<CMSComparisonOutput> {
  // Build context from advocate results
  const advocateSummaries = advocateResults
    .map(
      r => `
### ${r.cmsName} (Fit-Score: ${r.fitScore})
**Pitch:** ${r.pitchSummary}

**Top Arguments:**
${r.arguments
  .filter(a => a.strength === 'strong')
  .slice(0, 3)
  .map(a => `- ${a.argument}`)
  .join('\n')}

**Risiken:**
${r.risks
  .slice(0, 2)
  .map(risk => `- ${risk.risk} (${risk.likelihood}/${risk.impact})`)
  .join('\n')}

**Geschätzte Stunden:** ${r.estimation.totalHours}h (Faktor: ${r.estimation.adjustmentFactor})
`
    )
    .join('\n');

  const prompt = `Du bist ein neutraler CMS-Berater bei adesso SE. Analysiere die Ergebnisse der CMS-Advocates und erstelle eine objektive Vergleichsmatrix.

## Advocate-Ergebnisse
${advocateSummaries}

## Projekt-Anforderungen
${input.requirements.map(r => `- ${r.requirement} (${r.priority})`).join('\n')}

## Kunden-Profil
- Branche: ${input.customerProfile.industry}
- Größe: ${input.customerProfile.companySize}
- Tech-Reife: ${input.customerProfile.techMaturity}
- Budget: ${input.customerProfile.budget}

## Deine Aufgabe

### 1. Empfehlung
Welches CMS ist die beste Wahl? Wie stark ist diese Empfehlung (strong/moderate/weak)?
Begründe sachlich.

### 2. Vergleichsmatrix
Erstelle eine Matrix mit Kriterien wie:
- Funktionsumfang
- Skalierbarkeit
- Kosten (Lizenz + Entwicklung)
- Community & Support
- Entwickler-Verfügbarkeit
- Zukunftssicherheit

Gewichte jedes Kriterium (0-1, Summe sollte ~1 sein).
Bewerte jedes CMS pro Kriterium (0-100).

### 3. Pro/Contra per CMS
Fasse die wichtigsten Vor- und Nachteile zusammen.
"Ideal für..." und "Nicht geeignet für..."

### 4. Szenarien
Beschreibe 2-3 Szenarien und welches CMS dort am besten passt:
- "Wenn Budget kritisch ist..."
- "Wenn maximale Flexibilität gefragt ist..."
- "Wenn Enterprise-Support wichtig ist..."

### 5. Finale Empfehlung
Primary Choice, Fallback, Entscheidungsfaktoren, nächste Schritte.
`;

  const comparison = await generateStructuredOutput({
    model: 'quality',
    schema: CMSComparisonOutputSchema,
    system:
      'Du bist ein neutraler CMS-Berater. Analysiere objektiv und gib eine klare Empfehlung basierend auf den Projektanforderungen.',
    prompt,
    temperature: 0.5,
  });

  return comparison;
}

// ═══════════════════════════════════════════════════════════════════════════════
// FALLBACK
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create a minimal fallback advocate output when an advocate fails
 */
function createFallbackAdvocateOutput(cmsName: string): CMSAdvocateOutput {
  return {
    cmsName,
    fitScore: 50,
    arguments: [
      {
        category: 'feature',
        argument: `${cmsName} ist ein etabliertes CMS mit breitem Funktionsumfang.`,
        strength: 'medium',
        evidence: 'Allgemeines Wissen',
      },
      {
        category: 'community',
        argument: `${cmsName} hat eine aktive Community und regelmäßige Updates.`,
        strength: 'medium',
        evidence: 'Allgemeines Wissen',
      },
      {
        category: 'expertise',
        argument: 'adesso hat Erfahrung mit diesem CMS.',
        strength: 'medium',
        evidence: 'adesso Expertise',
      },
    ],
    counterArguments: [],
    featureMapping: [],
    estimation: {
      baselineHours: 500,
      adjustmentFactor: 1.0,
      totalHours: 500,
      reasoning: 'Standard-Schätzung ohne detaillierte Analyse',
    },
    risks: [
      {
        risk: 'Keine detaillierte Analyse verfügbar',
        likelihood: 'medium',
        impact: 'medium',
        mitigation: 'Manuelle Evaluierung durchführen',
      },
    ],
    adessoAdvantages: ['adesso bietet Beratung und Implementierung für dieses CMS.'],
    pitchSummary: `${cmsName} könnte eine Option sein, aber eine detaillierte Evaluierung ist erforderlich.`,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// RAG STORAGE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Store orchestrator results in RAG for retrieval
 */
async function storeInRAG(rfpId: string, result: CMSAdvocateOrchestratorOutput): Promise<void> {
  try {
    // Build searchable content
    const advocateSummaries = result.advocateResults
      .map(
        (a, idx) => `
CMS ${idx + 1}: ${a.cmsName}
Fit-Score: ${a.fitScore}%
Pitch: ${a.pitchSummary}
Top-Argumente: ${a.arguments
          .filter(arg => arg.strength === 'strong')
          .map(arg => arg.argument)
          .join('; ')}
Geschätzte Stunden: ${a.estimation.totalHours}h
`
      )
      .join('\n');

    const chunkText = `CMS Advocate Vergleich

## Empfehlung
**${result.comparison.summary.recommendedCMS}** (${result.comparison.summary.recommendationStrength})
${result.comparison.summary.reasoning}

${result.comparison.summary.alternativeCMS ? `Alternative: ${result.comparison.summary.alternativeCMS}` : ''}

## CMS Bewertungen
${advocateSummaries}

## Vergleichsmatrix
${result.comparison.comparisonMatrix.map(c => `- ${c.criterion}: Gewinner ${c.winner}`).join('\n')}

## Finale Empfehlung
Primary: ${result.comparison.finalRecommendation.primaryChoice}
${result.comparison.finalRecommendation.fallbackChoice ? `Fallback: ${result.comparison.finalRecommendation.fallbackChoice}` : ''}

Entscheidungsfaktoren:
${result.comparison.finalRecommendation.decisionFactors.map(d => `- ${d}`).join('\n')}

Nächste Schritte:
${result.comparison.finalRecommendation.nextSteps.map(s => `- ${s}`).join('\n')}
`;

    // Generate embedding
    const chunks = [
      {
        chunkIndex: 0,
        content: chunkText,
        tokenCount: Math.ceil(chunkText.length / 4),
        metadata: {
          startPosition: 0,
          endPosition: chunkText.length,
          type: 'section' as const,
        },
      },
    ];

    const chunksWithEmbeddings = await generateRawChunkEmbeddings(chunks);

    if (chunksWithEmbeddings && chunksWithEmbeddings.length > 0) {
      await db.insert(dealEmbeddings).values({
        preQualificationId: rfpId,
        agentName: 'cms_advocate_orchestrator',
        chunkType: 'analysis',
        chunkIndex: 0,
        content: chunkText,
        embedding: JSON.stringify(chunksWithEmbeddings[0].embedding),
        metadata: JSON.stringify({
          recommendedCMS: result.comparison.summary.recommendedCMS,
          recommendationStrength: result.comparison.summary.recommendationStrength,
          alternativeCMS: result.comparison.summary.alternativeCMS,
          cmsCount: result.metadata.cmsCount,
          requirementCount: result.metadata.requirementCount,
          averageFitScore: result.metadata.averageFitScore,
          // Store full advocate outputs for detailed view
          advocateResults: result.advocateResults.map(a => ({
            cmsName: a.cmsName,
            fitScore: a.fitScore,
            pitchSummary: a.pitchSummary,
            estimatedHours: a.estimation.totalHours,
          })),
          comparisonMatrix: result.comparison.comparisonMatrix,
        }),
      });
    }
  } catch (error) {
    console.error('[CMS Orchestrator] Failed to store in RAG:', error);
    // Don't throw - analysis still succeeded
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

export { runCMSAdvocate } from './base-advocate';
export * from './types';
