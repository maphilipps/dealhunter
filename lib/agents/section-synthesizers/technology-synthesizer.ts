/**
 * Technology Synthesizer (Sprint 1.3)
 *
 * Analyzes current technology stack of customer website.
 * Synthesizes tech-focused insights from RAG data.
 *
 * Output includes:
 * - Detected technologies (CMS, frameworks, hosting, etc.)
 * - Technology stack assessment
 * - Migration complexity estimation
 * - Recommended tech stack for adesso
 */

import { z } from 'zod';

import {
  SectionSynthesizerBase,
  type SectionSynthesizerInput,
  type SectionSynthesizerOutput,
  type SectionMetadata,
} from './base';

// ========================================
// Output Schema
// ========================================

const technologySchema = z.object({
  name: z.string(),
  version: z.string().optional(),
  category: z.enum([
    'cms',
    'framework',
    'backend',
    'frontend',
    'hosting',
    'database',
    'library',
    'tool',
    'integration',
  ]),
  confidence: z.number().min(0).max(100),
  details: z.string().optional(), // Additional context
});

const technologyOutputSchema = z.object({
  summary: z.string().min(50), // 2-3 sentence tech stack summary
  detectedTechnologies: z.array(technologySchema).min(1), // All detected technologies
  primaryCMS: z
    .object({
      name: z.string(),
      version: z.string().optional(),
      confidence: z.number().min(0).max(100),
      assessment: z.string(), // How well is it suited for customer needs?
    })
    .optional(),
  techStackAssessment: z.object({
    modernity: z.enum(['outdated', 'current', 'modern', 'cutting-edge']),
    maintainability: z.enum(['low', 'medium', 'high']),
    scalability: z.enum(['low', 'medium', 'high']),
    securityPosture: z.enum(['poor', 'adequate', 'good', 'excellent']),
  }),
  migrationComplexity: z.object({
    score: z.number().min(0).max(100), // 0 = easy, 100 = very complex
    factors: z.array(z.string()), // What makes it complex?
    estimatedEffort: z.string().optional(), // e.g., "3-6 Monate"
  }),
  recommendedStack: z.object({
    cms: z.string(), // e.g., "Drupal CMS", "Magnolia", "Next.js + Headless CMS"
    reasoning: z.string(), // Why this recommendation?
    benefits: z.array(z.string()).min(1).max(5),
  }),
  integrationRequirements: z.array(z.string()).optional(), // Required integrations
  technicalRisks: z.array(z.string()).min(0).max(5), // Top technical risks
});

export type TechnologyOutput = z.infer<typeof technologyOutputSchema>;

// ========================================
// Technology Synthesizer
// ========================================

export class TechnologySynthesizer extends SectionSynthesizerBase {
  readonly sectionId = 'technology';
  readonly sectionTitle = 'Aktuelle Technologie';

  async synthesize(input: SectionSynthesizerInput): Promise<SectionSynthesizerOutput> {
    const { leadId, context, forceRegenerate } = input;

    try {
      // Check if we should use cached data
      if (!forceRegenerate) {
        const existing = await this.loadExistingSectionData(leadId);
        if (existing) {
          return {
            success: true,
            sectionId: this.sectionId,
            content: existing.content,
            confidence: existing.metadata.confidence,
            metadata: existing.metadata,
          };
        }
      }

      // Query RAG for technology data
      // Focus on tech detection agents
      const ragResults = await this.queryRAG(leadId, undefined, {
        maxResults: 15,
        agentNameFilter: ['quick_scan', 'tech_analysis', 'website_crawler', 'accessibility_audit'],
        minConfidence: 30,
      });

      if (ragResults.length === 0) {
        return {
          success: false,
          sectionId: this.sectionId,
          error: 'Keine Technologie-Daten verfügbar',
        };
      }

      // Format RAG data for AI
      const ragContent = this.formatRAGResultsForPrompt(ragResults, 15);

      // Generate technology analysis via AI
      const userPrompt = `Analysiere den Tech Stack des Kunden basierend auf den folgenden Informationen.

**RAG-Ergebnisse:**
${ragContent}

**Anweisungen:**
Erstelle eine umfassende Technologie-Analyse mit:
1. **Summary**: 2-3 Sätze über den aktuellen Tech Stack
2. **Detected Technologies**: Liste aller erkannten Technologien mit:
   - Name, Version (wenn bekannt), Category (cms/framework/backend/frontend/hosting/database/library/tool/integration)
   - Confidence Score (0-100)
   - Details (optional)
3. **Primary CMS**: Haupt-CMS (falls vorhanden) mit Assessment
4. **Tech Stack Assessment**: Bewertung nach:
   - Modernity: outdated/current/modern/cutting-edge
   - Maintainability: low/medium/high
   - Scalability: low/medium/high
   - Security Posture: poor/adequate/good/excellent
5. **Migration Complexity**: Migrations-Komplexität (0-100), Faktoren, geschätzter Aufwand
6. **Recommended Stack**: Empfohlener Tech Stack für adesso (z.B. Drupal CMS, Magnolia, Next.js + Headless)
   - CMS Name
   - Reasoning (Warum diese Empfehlung?)
   - Benefits (3-5 Vorteile)
7. **Integration Requirements**: Benötigte Integrationen (optional)
8. **Technical Risks**: Top 5 technische Risiken

**adesso Tech Stack Präferenzen:**
- CMS: Drupal CMS (Marktführer in Deutschland), Magnolia, Next.js + Headless CMS
- Hosting: Azure (adesso Partnership), AWS, Kubernetes
- Backend: Node.js, PHP, Java
- Frontend: React, Next.js, TypeScript

**Output Format (JSON):**
{
  "summary": "...",
  "detectedTechnologies": [
    { "name": "Drupal", "version": "9.5", "category": "cms", "confidence": 95, "details": "..." }
  ],
  "primaryCMS": { "name": "Drupal", "version": "9.5", "confidence": 95, "assessment": "..." },
  "techStackAssessment": {
    "modernity": "current",
    "maintainability": "high",
    "scalability": "high",
    "securityPosture": "good"
  },
  "migrationComplexity": {
    "score": 45,
    "factors": ["...", "..."],
    "estimatedEffort": "3-4 Monate"
  },
  "recommendedStack": {
    "cms": "Drupal CMS",
    "reasoning": "...",
    "benefits": ["...", "..."]
  },
  "integrationRequirements": ["CRM", "Payment Gateway"],
  "technicalRisks": ["...", "..."]
}`;

      const systemPrompt = `Du bist ein Senior Technical Architect bei adesso SE mit Fokus auf CMS-Lösungen.
Du analysierst Tech Stacks und gibst fundierte Empfehlungen für Migrationen.

WICHTIG:
- Erkenne ALLE Technologien aus RAG-Daten (nicht nur CMS!)
- Sei konservativ bei Confidence Scores (nur 90%+ wenn eindeutig detektiert)
- Migration Complexity basiert auf: Alter der Tech (30%), Custom Code (30%), Datenvolumen (20%), Integrationen (20%)
- Recommended Stack sollte auf adesso Kompetenzen basieren
- Security Posture: "poor" = keine Updates, "adequate" = regelmäßige Updates, "good" = Best Practices, "excellent" = Security-first Ansatz

Antworte mit validem JSON ohne Markdown-Code-Blöcke.`;

      const responseText = await this.generateContent(userPrompt, systemPrompt, 0.3);

      // Parse and validate response
      const cleanedResponse = responseText
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();

      const rawResult = JSON.parse(cleanedResponse);
      const validatedContent = technologyOutputSchema.parse(rawResult);

      // Calculate confidence and metadata
      const confidence = this.calculateConfidence(ragResults);
      const sources = this.extractSources(ragResults);

      const metadata: SectionMetadata = {
        generatedAt: new Date(),
        agentName: 'technology-synthesizer',
        sources,
        confidence,
      };

      // Save to database
      await this.saveSectionData(leadId, validatedContent, metadata);

      return {
        success: true,
        sectionId: this.sectionId,
        content: validatedContent,
        confidence,
        metadata,
      };
    } catch (error) {
      console.error('[TechnologySynthesizer] Error:', error);
      return {
        success: false,
        sectionId: this.sectionId,
        error: error instanceof Error ? error.message : 'Technology synthesis failed',
      };
    }
  }
}

// Export singleton instance
export const technologySynthesizer = new TechnologySynthesizer();
