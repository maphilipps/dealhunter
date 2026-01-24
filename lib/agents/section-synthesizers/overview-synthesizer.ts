/**
 * Overview Synthesizer (Sprint 1.3)
 *
 * Generates executive summary for Lead Overview section.
 * Synthesizes high-level insights from all available RAG data.
 *
 * Output includes:
 * - Executive summary (2-3 sentences)
 * - Key opportunities
 * - Key risks
 * - Strategic fit score
 * - Recommended next actions
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

const overviewOutputSchema = z.object({
  executiveSummary: z.string().min(50), // 2-3 sentence summary
  keyOpportunities: z.array(z.string()).min(1).max(5), // Top 5 opportunities
  keyRisks: z.array(z.string()).min(0).max(5), // Top 5 risks
  strategicFitScore: z.number().min(0).max(100), // 0-100 strategic fit
  recommendedActions: z.array(z.string()).min(1).max(3), // Next steps
  projectScope: z.object({
    estimatedBudget: z.string().optional(), // e.g., "€150k-€300k"
    estimatedTimeline: z.string().optional(), // e.g., "6-9 Monate"
    complexity: z.enum(['low', 'medium', 'high']),
  }),
  confidenceFactors: z.object({
    dataAvailability: z.number().min(0).max(100), // How much data is available
    requirementClarity: z.number().min(0).max(100), // How clear are requirements
    technicalFeasibility: z.number().min(0).max(100), // How feasible technically
  }),
});

export type OverviewOutput = z.infer<typeof overviewOutputSchema>;

// ========================================
// Overview Synthesizer
// ========================================

export class OverviewSynthesizer extends SectionSynthesizerBase {
  readonly sectionId = 'overview';
  readonly sectionTitle = 'Übersicht';

  async synthesize(input: SectionSynthesizerInput): Promise<SectionSynthesizerOutput> {
    const { leadId, forceRegenerate } = input;

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

      // Query RAG for overview data
      // Get broad insights from all agents
      const ragResults = await this.queryRAG(leadId, undefined, {
        maxResults: 15,
        minConfidence: 20, // Lower threshold for overview
      });

      if (ragResults.length === 0) {
        return {
          success: false,
          sectionId: this.sectionId,
          error: 'Keine RAG-Daten für Overview verfügbar',
        };
      }

      // Format RAG data for AI
      const ragContent = this.formatRAGResultsForPrompt(ragResults, 15);

      // Generate overview via AI
      const userPrompt = `Erstelle eine Executive Summary für dieses Lead basierend auf den folgenden Informationen.

**RAG-Ergebnisse:**
${ragContent}

**Anweisungen:**
Analysiere die Informationen und erstelle:
1. **Executive Summary**: 2-3 Sätze, die das Projekt zusammenfassen
2. **Key Opportunities**: Top 3-5 Chancen für adesso (z.B. strategischer Kunde, Referenzprojekt, neue Technologie)
3. **Key Risks**: Top 3-5 Risiken (z.B. unrealistisches Budget, unklar definierter Scope, technische Herausforderungen)
4. **Strategic Fit Score**: 0-100, wie gut passt das Projekt zu adesso? (Kriterien: Kundengröße, Branche, Technologie, Budget)
5. **Recommended Actions**: 2-3 nächste Schritte (z.B. "Deep Scan starten", "Kundengespräch vereinbaren")
6. **Project Scope**: Geschätztes Budget, Timeline, Komplexität
7. **Confidence Factors**: Wie vollständig sind die Daten? (0-100 für Daten, Requirements, Technical Feasibility)

**Output Format (JSON):**
{
  "executiveSummary": "...",
  "keyOpportunities": ["...", "..."],
  "keyRisks": ["...", "..."],
  "strategicFitScore": 75,
  "recommendedActions": ["...", "..."],
  "projectScope": {
    "estimatedBudget": "€150k-€300k",
    "estimatedTimeline": "6-9 Monate",
    "complexity": "medium"
  },
  "confidenceFactors": {
    "dataAvailability": 80,
    "requirementClarity": 60,
    "technicalFeasibility": 70
  }
}`;

      const systemPrompt = `Du bist ein Senior Business Development Consultant bei adesso SE.
Du erstellst Executive Summaries für Lead-Opportunities, die Geschäftsentscheidungen unterstützen.

WICHTIG:
- Fokus auf geschäftsrelevante Insights, nicht technische Details
- Strategic Fit Score basiert auf: Kundengröße (30%), Branche (20%), Technologie (20%), Budget (20%), Projekt-Komplexität (10%)
- Opportunities: Was macht dieses Projekt attraktiv für adesso?
- Risks: Was könnte schief gehen? Wo sind Unsicherheiten?
- Recommended Actions: Konkrete nächste Schritte für BD Team

Antworte mit validem JSON ohne Markdown-Code-Blöcke.`;

      const responseText = await this.generateContent(userPrompt, systemPrompt, 0.3);

      // Parse and validate response
      const cleanedResponse = responseText
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();

      const rawResult = JSON.parse(cleanedResponse) as Record<string, unknown>;
      const validatedContent = overviewOutputSchema.parse(rawResult);

      // Calculate confidence and metadata
      const confidence = this.calculateConfidence(ragResults);
      const sources = this.extractSources(ragResults);

      const metadata: SectionMetadata = {
        generatedAt: new Date(),
        agentName: 'overview-synthesizer',
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
      console.error('[OverviewSynthesizer] Error:', error);
      return {
        success: false,
        sectionId: this.sectionId,
        error: error instanceof Error ? error.message : 'Overview synthesis failed',
      };
    }
  }
}

// Export singleton instance
export const overviewSynthesizer = new OverviewSynthesizer();
