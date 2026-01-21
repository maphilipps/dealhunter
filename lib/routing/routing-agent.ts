'use server';

import { generateObject } from 'ai';
import { z } from 'zod';

import { openai } from '@/lib/ai/providers';
import { db } from '@/lib/db';
import { businessUnits, technologies } from '@/lib/db/schema';

/**
 * Business Line Routing Result Schema
 * Defines the structured output from the routing agent
 */
export const BusinessLineRoutingSchema = z.object({
  recommendedBU: z.string().describe('Name of the recommended business unit'),
  confidence: z.number().min(0).max(100).describe('Confidence score (0-100)'),
  reasoning: z.string().describe('Explanation of why this business unit was recommended'),
  alternativeBUs: z
    .array(
      z.object({
        name: z.string(),
        confidence: z.number().min(0).max(100),
        reasoning: z.string(),
      })
    )
    .describe('Alternative business units with lower confidence scores'),
  matchedKeywords: z.array(z.string()).describe('Keywords from BU that matched'),
  matchedTechnologies: z.array(z.string()).describe('Technologies from BU that matched'),
});

export type BusinessLineRoutingResult = z.infer<typeof BusinessLineRoutingSchema>;

/**
 * Input for the routing agent
 */
export interface RouteBusinessUnitInput {
  customerName?: string;
  projectDescription?: string;
  technologies?: string[];
  requirements?: string;
  websiteUrl?: string;
  industry?: string;
}

/**
 * DEA-5: Routing Agent - matchBusinessLine Tool
 *
 * AI-based business line matching using:
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
    // Get all business units with their keywords and technologies
    const { eq } = await import('drizzle-orm');
    const allBusinessUnits = await db
      .select({
        name: businessUnits.name,
        keywords: businessUnits.keywords,
        leaderName: businessUnits.leaderName,
        technologies: technologies.name,
      })
      .from(businessUnits)
      .leftJoin(technologies, eq(technologies.businessUnitId, businessUnits.id));

    // Group technologies by business unit
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
        if (row.technologies) {
          acc[row.name].technologies.push(row.technologies);
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

    // Build context for AI
    const projectContext = `
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

    // Call AI to match business line
    const result = await generateObject({
      model: openai('gpt-4o'),
      schema: BusinessLineRoutingSchema,
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
