/**
 * CMS Architecture Section Synthesizer
 *
 * Analyzes current CMS architecture including content model, configuration,
 * content types, and relationships.
 */

import { z } from 'zod';

import type { SectionSynthesizerInput, SectionSynthesizerOutput } from './base';
import { SectionSynthesizerBase } from './base';

// ===== Zod Output Schema =====

const contentTypeSchema = z.object({
  name: z.string().min(1),
  machineName: z.string().min(1),
  description: z.string().optional(),
  fields: z.array(
    z.object({
      name: z.string(),
      type: z.string(),
      required: z.boolean().optional(),
      description: z.string().optional(),
    })
  ),
  relationships: z.array(z.string()).optional(),
});

const paragraphTypeSchema = z.object({
  name: z.string().min(1),
  machineName: z.string().min(1),
  description: z.string().optional(),
  fields: z.array(
    z.object({
      name: z.string(),
      type: z.string(),
      required: z.boolean().optional(),
    })
  ),
  usage: z.string().optional(),
});

const taxonomySchema = z.object({
  name: z.string().min(1),
  machineName: z.string().min(1),
  description: z.string().optional(),
  termCount: z.number().optional(),
  usedIn: z.array(z.string()).optional(),
});

const cmsArchitectureOutputSchema = z.object({
  summary: z.string().min(50).describe('Executive summary of CMS architecture'),

  contentTypes: z
    .array(contentTypeSchema)
    .min(1)
    .describe('List of detected or recommended content types'),

  paragraphTypes: z
    .array(paragraphTypeSchema)
    .optional()
    .describe('Paragraph/component types for flexible content'),

  taxonomies: z
    .array(taxonomySchema)
    .optional()
    .describe('Taxonomy vocabularies for categorization'),

  contentModel: z.object({
    complexity: z.enum(['low', 'medium', 'high', 'very-high']),
    assessment: z.string().describe('Assessment of content model complexity and quality'),
    strengths: z.array(z.string()).min(0).max(5),
    weaknesses: z.array(z.string()).min(0).max(5),
  }),

  migrationMapping: z
    .object({
      strategy: z.string().describe('How to map current content model to new CMS'),
      contentTypeMappings: z
        .array(
          z.object({
            source: z.string(),
            target: z.string(),
            complexity: z.enum(['low', 'medium', 'high']),
            notes: z.string().optional(),
          })
        )
        .optional(),
      dataTransformations: z.array(z.string()).optional(),
    })
    .optional(),

  recommendations: z
    .array(
      z.object({
        category: z.enum([
          'content-model',
          'structure',
          'relationships',
          'migration',
          'governance',
        ]),
        title: z.string(),
        description: z.string(),
        priority: z.enum(['low', 'medium', 'high', 'critical']),
      })
    )
    .min(1),

  architecturalRisks: z.array(z.string()).min(0).max(5),
});

export type CMSArchitectureOutput = z.infer<typeof cmsArchitectureOutputSchema>;

// ===== Synthesizer Implementation =====

export class CMSArchitectureSynthesizer extends SectionSynthesizerBase {
  readonly sectionId = 'cms-architecture';
  readonly sectionTitle = 'Drupal-Architektur';

  async synthesize(input: SectionSynthesizerInput): Promise<SectionSynthesizerOutput> {
    const { leadId } = input;

    // Step 1: Query RAG for CMS architecture data
    const ragResults = await this.queryRAG(leadId, undefined, {
      maxResults: 15,
      minConfidence: 25,
    });

    if (ragResults.length === 0) {
      return {
        success: false,
        sectionId: this.sectionId,
        error: 'Keine RAG-Daten für CMS-Architektur verfügbar. Deep Scan erforderlich.',
      };
    }

    // Step 2: Build context from RAG chunks
    const ragContext = this.formatRAGResultsForPrompt(ragResults, 15);

    // Step 3: Generate CMS architecture analysis
    const systemPrompt = `Du bist ein erfahrener CMS-Architekt bei adesso SE, spezialisiert auf Drupal und Content-Modellierung.

Analysiere die bereitgestellten Website-Daten und extrahiere oder empfehle:
1. **Content Types** - Hauptentitäten (z.B. Article, Page, Product) mit Fields
2. **Paragraph Types** - Flexible Content-Komponenten (z.B. Text, Image, Video)
3. **Taxonomies** - Klassifikations-Vokabulare (z.B. Tags, Kategorien)
4. **Content Model Assessment** - Komplexität, Qualität, Stärken, Schwächen
5. **Migration Mapping** - Mapping von aktueller zu neuer CMS-Architektur
6. **Recommendations** - Verbesserungen für Architektur
7. **Architectural Risks** - Potenzielle Probleme

Sei spezifisch und technisch. Nutze Machine Names (z.B. 'field_hero_image') wenn möglich.
Falls Daten unvollständig sind, gib vernünftige Empfehlungen basierend auf typischen Patterns.

WICHTIG: Antworte mit validem JSON ohne Markdown-Code-Blöcke.`;

    const userPrompt = `Lead ID: ${leadId}

**RAG-Ergebnisse:**
${ragContext}

Analysiere die CMS-Architektur basierend auf diesen Daten. Extrahiere aktuelle Architektur falls erkennbar,
oder empfehle eine passende Architektur falls Daten limitiert sind.

Antworte mit JSON gemäß Schema.`;

    const responseText = await this.generateContent(userPrompt, systemPrompt, 0.3);

    // Step 4: Parse and validate response
    const cleanedResponse = responseText
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    const rawResult = JSON.parse(cleanedResponse);
    const analysisOutput: CMSArchitectureOutput = cmsArchitectureOutputSchema.parse(rawResult);

    // Step 5: Calculate confidence and extract sources
    const confidence = this.calculateConfidence(ragResults);
    const sources = this.extractSources(ragResults);

    // Step 6: Save to database
    await this.saveSectionData(leadId, analysisOutput, {
      agentName: 'cms-architecture-synthesizer',
      generatedAt: new Date(),
      sources,
      confidence,
    });

    return {
      success: true,
      sectionId: this.sectionId,
      content: analysisOutput,
      metadata: {
        generatedAt: new Date(),
        agentName: 'cms-architecture-synthesizer',
        sources,
        confidence,
      },
    };
  }
}

// Singleton instance
export const cmsArchitectureSynthesizer = new CMSArchitectureSynthesizer();
