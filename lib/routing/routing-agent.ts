'use server';

import { generateObject, type LanguageModel } from 'ai';
import { z } from 'zod';

import { type BusinessLineRoutingResult, type RouteBusinessUnitInput } from './schemas';

import { AI_TIMEOUTS } from '@/lib/ai/config';
import { openai } from '@/lib/ai/providers';
import { TECH_TO_BU_MAPPING } from '@/lib/config/business-rules';
import { db } from '@/lib/db';
import { businessUnits, technologies } from '@/lib/db/schema';

// Security: Prompt Injection Protection
import { wrapUserContent } from '@/lib/security/prompt-sanitizer';

/**
 * Deterministic Technology → Business Unit Mapping
 * Now sourced from centralized config
 */
// TECH_TO_BU_MAPPING imported from @/lib/config/business-rules

/**
 * Check if any detected technology has a deterministic Business Unit mapping
 *
 * @param technologies - Array of detected technology names
 * @returns Business Unit name if deterministic match found, null otherwise
 */
function getDeterministicBusinessUnit(technologies: string[]): string | null {
  if (!technologies || technologies.length === 0) {
    return null;
  }

  // Normalize technology names to lowercase for matching
  const normalizedTechs = technologies.map(t => t.toLowerCase().trim());

  // Check for deterministic matches
  for (const tech of normalizedTechs) {
    if (TECH_TO_BU_MAPPING[tech]) {
      return TECH_TO_BU_MAPPING[tech];
    }
  }

  return null;
}

/**
 * DEA-5: Routing Agent - matchBusinessLine Tool
 *
 * AI-based business line matching using:
 * - Deterministic technology mapping (Ibexa → PHP, FirstSpirit → WEM)
 * - NLP matching against Business Line keywords
 * - Technology stack matching
 * - Confidence-based recommendations
 *
 * @param input - Extracted requirements and project information
 * @returns Business line recommendation with confidence score
 */
export async function matchBusinessLine(
  input: RouteBusinessUnitInput
): Promise<{ success: boolean; result?: BusinessLineRoutingResult; error?: string }> {
  try {
    // STEP 1: Check for deterministic technology mapping (Ibexa → PHP, FirstSpirit → WEM)
    const deterministicBU = getDeterministicBusinessUnit(input.technologies || []);

    if (deterministicBU) {
      // Direct mapping found - skip AI, return deterministic result with 100% confidence
      const detectedTech = input.technologies?.find(
        t => TECH_TO_BU_MAPPING[t.toLowerCase().trim()]
      );
      return {
        success: true,
        result: {
          recommendedBU: deterministicBU,
          confidence: 100,
          reasoning: `Automatisches Routing basierend auf erkannter Technologie: ${detectedTech}. Diese Technologie wird direkt der Business Unit "${deterministicBU}" zugeordnet.`,
          alternativeBUs: [], // No alternatives for deterministic mappings
          matchedKeywords: [],
          matchedTechnologies: [detectedTech || ''],
        },
      };
    }

    // STEP 2: No deterministic match - use AI for matching
    // Get all business units with their keywords, technologies, and features
    const { eq } = await import('drizzle-orm');
    const allBusinessUnits = await db
      .select({
        name: businessUnits.name,
        keywords: businessUnits.keywords,
        leaderName: businessUnits.leaderName,
        techName: technologies.name,
        techFeatures: technologies.features,
        techDescription: technologies.description,
        techUseCases: technologies.useCases,
      })
      .from(businessUnits)
      .leftJoin(technologies, eq(technologies.businessUnitId, businessUnits.id));

    // Group technologies by business unit with features
    const businessUnitsMap = allBusinessUnits.reduce(
      (acc, row) => {
        if (!acc[row.name]) {
          acc[row.name] = {
            name: row.name,
            keywords: JSON.parse(row.keywords || '[]') as string[],
            technologies: [],
            leaderName: row.leaderName,
          };
        }
        if (row.techName) {
          // Parse features if available
          let featuresStr = '';
          if (row.techFeatures) {
            try {
              const features = JSON.parse(row.techFeatures) as Record<
                string,
                { supported: boolean; score: number }
              >;
              const supportedFeatures = Object.entries(features)
                .filter(([, v]) => v.supported)
                .map(([k, v]) => `${k}(${v.score}%)`)
                .slice(0, 5);
              if (supportedFeatures.length > 0) {
                featuresStr = ` [${supportedFeatures.join(', ')}]`;
              }
            } catch {
              /* ignore */
            }
          }

          // Parse use cases if available
          let useCasesStr = '';
          if (row.techUseCases) {
            try {
              const useCases = JSON.parse(row.techUseCases) as string[];
              if (useCases.length > 0) {
                useCasesStr = ` - Use Cases: ${useCases.slice(0, 3).join(', ')}`;
              }
            } catch {
              /* ignore */
            }
          }

          acc[row.name].technologies.push(`${row.techName}${featuresStr}${useCasesStr}`);
        }
        return acc;
      },
      {} as Record<
        string,
        {
          name: string;
          keywords: string[];
          technologies: string[];
          leaderName: string;
        }
      >
    );

    const businessUnitsData = Object.values(businessUnitsMap);

    if (businessUnitsData.length === 0) {
      return {
        success: false,
        error: 'Keine Business Units in der Datenbank gefunden',
      };
    }

    // Create dynamic schema with actual BU names as enum
    const buNames = businessUnitsData.map(bu => bu.name);
    const DynamicRoutingSchema = z.object({
      recommendedBU: z
        .enum(buNames as [string, ...string[]])
        .describe('Name der empfohlenen Business Unit - MUSS einer der verfügbaren sein'),
      confidence: z.number().min(0).max(100).describe('Confidence score (0-100)'),
      reasoning: z.string().describe('Begründung für die Empfehlung'),
      alternativeBUs: z
        .array(
          z.object({
            name: z.enum(buNames as [string, ...string[]]),
            confidence: z.number().min(0).max(100),
            reasoning: z.string(),
          })
        )
        .describe('Alternative Business Units mit niedrigeren Confidence Scores'),
      matchedKeywords: z.array(z.string()).describe('Keywords der BU, die gematcht haben'),
      matchedTechnologies: z.array(z.string()).describe('Technologien der BU, die gematcht haben'),
    });

    // Build context for AI (user-provided content needs wrapping)
    const rawProjectContext = `
Kunde: ${input.customerName || 'Nicht angegeben'}
Industrie: ${input.industry || 'Nicht angegeben'}
Website: ${input.websiteUrl || 'Nicht angegeben'}

Projektbeschreibung:
${input.projectDescription || 'Nicht angegeben'}

Anforderungen:
${input.requirements || 'Nicht angegeben'}

Identifizierte Technologien:
${input.technologies?.join(', ') || 'Keine angegeben'}
    `.trim();

    // Wrap user content for prompt injection protection
    const projectContext = wrapUserContent(rawProjectContext, 'document');

    const businessUnitsContext = businessUnitsData
      .map(bu =>
        `
Business Unit: ${bu.name}
Leader: ${bu.leaderName}
Keywords: ${bu.keywords.join(', ')}
Technologies: ${bu.technologies.join(', ') || 'Keine'}
    `.trim()
      )
      .join('\n\n---\n\n');

    // Call AI to match business line with dynamic schema
    const result = await generateObject({
      model: openai('gemini-3-flash-preview') as unknown as LanguageModel,
      schema: DynamicRoutingSchema,
      maxRetries: 2,
      abortSignal: AbortSignal.timeout(AI_TIMEOUTS.AGENT_STANDARD),
      system: `Du bist ein Business Line Routing Agent für adesso SE.

Deine Aufgabe ist es, Projekt-Anforderungen zu analysieren und die passende Business Line zu empfehlen.

WICHTIGE REGELN:
1. Analysiere Keywords, Technologien und Projektbeschreibung
2. Matche gegen die verfügbaren Business Units
3. Gib einen Confidence Score (0-100) an
4. Bei Confidence < 70%: Empfehle dem User, manuell zu wählen
5. Nenne IMMER alternative Business Units (mindestens 2)
6. Erkläre WARUM du diese BU empfiehlst

MATCHING-LOGIK:
- Exakte Technology-Matches sind wichtiger als Keywords
- CMS-Projekte sollten zu CMS-fokussierten BUs geroutet werden
- Framework-Projekte (React, Vue, etc.) zu entsprechenden BUs
- Bei Multi-Technology-Projekten: Wähle BU mit breitester Abdeckung

CONFIDENCE-SCORING:
- 90-100%: Perfekte Technology + Keyword Matches
- 70-89%: Gute Technology Match, teilweise Keywords
- 50-69%: Teilweise Match, User sollte überprüfen
- 0-49%: Schwaches Match, manuelle Entscheidung erforderlich`,
      prompt: `Analysiere dieses Projekt und empfehle die passende Business Line.

=== PROJEKT-INFORMATIONEN ===
${projectContext}

=== VERFÜGBARE BUSINESS UNITS ===
${businessUnitsContext}

Erstelle jetzt eine fundierte Empfehlung mit Confidence Score, Reasoning und Alternativen.`,
    });

    return {
      success: true,
      result: result.object,
    };
  } catch (error) {
    console.error('Business Line Matching Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unbekannter Fehler beim Routing',
    };
  }
}

/**
 * Get all available business units (for manual selection)
 */
export async function getAvailableBusinessUnits() {
  try {
    const units = await db
      .select({
        id: businessUnits.id,
        name: businessUnits.name,
        leaderName: businessUnits.leaderName,
        keywords: businessUnits.keywords,
      })
      .from(businessUnits)
      .orderBy(businessUnits.name);

    return {
      success: true,
      businessUnits: units.map(u => ({
        ...u,
        keywords: JSON.parse(u.keywords || '[]') as string[],
      })),
    };
  } catch (error) {
    console.error('Get Business Units Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Fehler beim Laden der Business Units',
      businessUnits: [],
    };
  }
}
