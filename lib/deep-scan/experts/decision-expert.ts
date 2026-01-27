import { z } from 'zod';

import { queryLeadRag, storeAuditAgentOutput, formatAuditContext } from './base';
import type { AuditAgentInput, AuditAgentOutput, AuditSection } from './types';
import { decisionExpertToVisualization } from '../output-to-json-render';

import { generateStructuredOutput } from '@/lib/ai/config';
import type { EventEmitter } from '@/lib/streaming/event-emitter';
import { AgentEventType } from '@/lib/streaming/event-types';

// Helper: AI sometimes returns numbers as strings
const robustNumber = (min: number, max: number, defaultVal: number) =>
  z.preprocess(
    val => (typeof val === 'string' ? parseFloat(val) : val),
    z.number().min(min).max(max).optional().default(defaultVal)
  );

// Schema for BID/NO-BID decision (with defaults for robustness)
const DecisionSchema = z.object({
  recommendation: z
    .enum(['BID', 'NO-BID', 'CONDITIONAL-BID'])
    .optional()
    .default('CONDITIONAL-BID'),
  confidence: robustNumber(0, 100, 50),
  overallScore: robustNumber(0, 100, 50),
  reasoning: z.string().optional().default(''),
  executiveSummary: z.string().optional().default(''), // Removed max(500) - AI generates longer summaries
  scores: z
    .object({
      strategicFit: z
        .object({
          score: z.number().min(0).max(100).default(50),
          weight: z.number().default(20),
          factors: z.array(z.string()).default([]),
        })
        .default({ score: 50, weight: 20, factors: [] }),
      technicalFit: z
        .object({
          score: z.number().min(0).max(100).default(50),
          weight: z.number().default(25),
          factors: z.array(z.string()).default([]),
        })
        .default({ score: 50, weight: 25, factors: [] }),
      commercialFit: z
        .object({
          score: z.number().min(0).max(100).default(50),
          weight: z.number().default(25),
          factors: z.array(z.string()).default([]),
        })
        .default({ score: 50, weight: 25, factors: [] }),
      riskAssessment: z
        .object({
          score: z.number().min(0).max(100).default(50),
          weight: z.number().default(15),
          factors: z.array(z.string()).default([]),
        })
        .default({ score: 50, weight: 15, factors: [] }),
      resourceAvailability: z
        .object({
          score: z.number().min(0).max(100).default(50),
          weight: z.number().default(15),
          factors: z.array(z.string()).default([]),
        })
        .default({ score: 50, weight: 15, factors: [] }),
    })
    .default({
      strategicFit: { score: 50, weight: 20, factors: [] },
      technicalFit: { score: 50, weight: 25, factors: [] },
      commercialFit: { score: 50, weight: 25, factors: [] },
      riskAssessment: { score: 50, weight: 15, factors: [] },
      resourceAvailability: { score: 50, weight: 15, factors: [] },
    }),
  pros: z
    .array(
      z.object({
        point: z.string(),
        category: z
          .enum(['strategic', 'technical', 'commercial', 'reference'])
          .default('technical'),
        impact: z.enum(['high', 'medium', 'low']).default('medium'),
      })
    )
    .default([]),
  cons: z
    .array(
      z.object({
        point: z.string(),
        category: z.enum(['risk', 'resource', 'technical', 'commercial']).default('risk'),
        impact: z.enum(['high', 'medium', 'low']).default('medium'),
        mitigation: z.string().optional(),
      })
    )
    .default([]),
  conditions: z.array(z.string()).optional(),
  nextSteps: z
    .array(
      z.object({
        action: z.string(),
        owner: z.string().default('PM'),
        deadline: z.string().optional(),
        priority: z.enum(['high', 'medium', 'low']).default('medium'),
      })
    )
    .default([]),
  keyMetrics: z
    .object({
      estimatedValue: z.number().optional(),
      estimatedCost: z.number().default(0),
      margin: z.number().optional(),
      duration: z.string().default('TBD'),
      teamSize: z.number().default(0),
    })
    .default({ estimatedCost: 0, duration: 'TBD', teamSize: 0 }),
});

/**
 * Decision Expert Agent
 *
 * Synthesizes all expert analyses into final BID/NO-BID recommendation.
 */
export async function runDecisionExpert(
  input: AuditAgentInput,
  emit?: EventEmitter
): Promise<AuditAgentOutput> {
  const log = (msg: string) => {
    console.error(`[Decision Expert] ${msg}`);
    emit?.({
      type: AgentEventType.AGENT_PROGRESS,
      data: { agent: 'Decision Expert', message: msg },
    });
  };

  log('Starte Entscheidungs-Synthese...');

  try {
    // Query RAG for all expert outputs
    const techData = await queryLeadRag(input.leadId, 'technology cms framework', 'audit', 10);
    const architectureData = await queryLeadRag(
      input.leadId,
      'architecture complexity',
      'audit',
      10
    );
    const migrationData = await queryLeadRag(input.leadId, 'migration risks effort', 'audit', 10);
    const costsData = await queryLeadRag(input.leadId, 'costs budget estimation', 'audit', 10);
    const projectData = await queryLeadRag(input.leadId, 'project timeline team', 'audit', 10);
    const hostingData = await queryLeadRag(input.leadId, 'hosting infrastructure', 'audit', 5);
    const integrationsData = await queryLeadRag(input.leadId, 'integrations systems', 'audit', 5);

    const combinedContext = formatAuditContext([
      ...techData,
      ...architectureData,
      ...migrationData,
      ...costsData,
      ...projectData,
      ...hostingData,
      ...integrationsData,
    ]);
    const sections: AuditSection[] = [];

    log('Generiere BID/NO-BID Empfehlung...');

    const decision = await generateStructuredOutput({
      model: 'quality',
      schema: DecisionSchema,
      system: `Du bist ein erfahrener Business Development Manager. Erstelle eine fundierte BID/NO-BID Empfehlung.

BEWERTUNGSKRITERIEN (Gewichtung):
1. Strategic Fit (25%): Passt das Projekt zur Unternehmensstrategie?
   - Kernkompetenzen anwendbar
   - Neue Branche/Kunde = Referenzpotenzial
   - Langfristiges Potenzial (Wartung, Erweiterungen)

2. Technical Fit (25%): Ist das Projekt technisch umsetzbar?
   - Expertise vorhanden
   - Komplexität beherrschbar
   - Bekannte Technologien

3. Commercial Fit (20%): Ist es wirtschaftlich attraktiv?
   - Ausreichende Marge (Ziel: 15-25%)
   - Budget realistisch
   - Zahlungsbedingungen akzeptabel

4. Risk Assessment (20%): Sind die Risiken tragbar?
   - Technische Risiken
   - Timeline-Risiken
   - Abhängigkeiten vom Kunden

5. Resource Availability (10%): Ist die Kapazität vorhanden?
   - Team verfügbar
   - Keine Überlastung

DECISION THRESHOLDS:
- BID: Score >= 70, keine kritischen Risiken
- CONDITIONAL-BID: Score 50-70, beherrschbare Risiken
- NO-BID: Score < 50 oder kritische Blocker

GRUNDSÄTZE:
- Präferenz für langfristige Kundenbeziehungen
- Qualität vor Preis
- Nachhaltige Projekte bevorzugt`,
      prompt: `Erstelle eine BID/NO-BID Empfehlung basierend auf allen Analysen:\n\n${combinedContext}`,
      temperature: 0.2,
    });

    sections.push({
      slug: 'recommendation',
      title: `Empfehlung: ${decision.recommendation}`,
      content: {
        recommendation: decision.recommendation,
        confidence: decision.confidence,
        overallScore: decision.overallScore,
        reasoning: decision.reasoning,
      },
    });

    sections.push({
      slug: 'summary',
      title: 'Executive Summary',
      content: decision.executiveSummary,
    });

    sections.push({
      slug: 'scores',
      title: `Bewertung (${decision.overallScore}/100)`,
      content: decision.scores,
    });

    sections.push({
      slug: 'pros',
      title: `Pro-Argumente (${decision.pros.length})`,
      content: decision.pros,
    });

    sections.push({
      slug: 'cons',
      title: `Contra-Argumente (${decision.cons.length})`,
      content: decision.cons,
    });

    if (decision.conditions && decision.conditions.length > 0) {
      sections.push({
        slug: 'conditions',
        title: 'Bedingungen',
        content: decision.conditions,
      });
    }

    sections.push({
      slug: 'next-steps',
      title: 'Nächste Schritte',
      content: decision.nextSteps,
    });

    sections.push({
      slug: 'metrics',
      title: 'Key Metrics',
      content: decision.keyMetrics,
    });

    log(`Empfehlung: ${decision.recommendation} (Score: ${decision.overallScore}/100)`);

    const navigation = {
      title: 'BID/NO-BID Entscheidung',
      items: sections.map(s => ({ slug: s.slug, title: s.title })),
    };

    // ═══════════════════════════════════════════════════════════════
    // AGENT-NATIVE: Store findings and visualization directly
    // ═══════════════════════════════════════════════════════════════
    if (input.ragTools) {
      log('Speichere Findings und Visualisierung via Agent-Native RAG...');

      // Store decision recommendation
      await input.ragTools.storeFinding({
        category: 'recommendation',
        chunkType: 'bid_decision',
        content: `BID/NO-BID Empfehlung: ${decision.recommendation}. Score: ${decision.overallScore}/100. ${decision.reasoning}`,
        confidence: decision.confidence,
        metadata: {
          recommendation: decision.recommendation,
          overallScore: decision.overallScore,
          scores: decision.scores
        },
      });

      // Store executive summary
      if (decision.executiveSummary) {
        await input.ragTools.storeFinding({
          category: 'elaboration',
          chunkType: 'executive_summary',
          content: decision.executiveSummary,
          confidence: decision.confidence,
        });
      }

      // Store pros/cons as risk assessments
      if (decision.cons.length > 0) {
        const riskContent = decision.cons
          .map(c => `${c.point} (${c.impact} impact)${c.mitigation ? ` - Mitigation: ${c.mitigation}` : ''}`)
          .join('. ');

        await input.ragTools.storeFinding({
          category: 'risk',
          chunkType: 'project_risks',
          content: `Identifizierte Risiken: ${riskContent}`,
          confidence: decision.confidence,
          metadata: { risks: decision.cons },
        });
      }

      // Generate and store visualization
      const visualization = decisionExpertToVisualization({
        recommendation: decision.recommendation as 'BID' | 'NO-BID' | 'CONDITIONAL',
        confidence: decision.confidence,
        reasoning: decision.reasoning,
        pros: decision.pros.map(p => p.point),
        cons: decision.cons.map(c => c.point),
        nextSteps: decision.nextSteps.map(s => s.action),
      });
      await input.ragTools.storeVisualization({
        sectionId: 'recommendation',
        visualization,
        confidence: decision.confidence,
      });

      log('Agent-Native RAG Speicherung abgeschlossen');
    }

    // ═══════════════════════════════════════════════════════════════
    // LEGACY: Store via storeAuditAgentOutput (fallback)
    // ═══════════════════════════════════════════════════════════════
    const output: AuditAgentOutput = {
      success: true,
      category: 'empfehlung',
      sections,
      navigation,
      confidence: decision.confidence,
      analyzedAt: new Date().toISOString(),
    };

    // Only store via legacy path if ragTools not available
    if (!input.ragTools) {
      await storeAuditAgentOutput(input.leadId, 'audit_decision_expert', output);
    }

    log('Entscheidungs-Synthese abgeschlossen');

    emit?.({
      type: AgentEventType.AGENT_COMPLETE,
      data: {
        agent: 'Decision Expert',
        result: {
          recommendation: decision.recommendation,
          score: decision.overallScore,
          confidence: decision.confidence,
        },
      },
    });

    return output;
  } catch (error) {
    console.error('[Decision Expert] Error:', error);
    return {
      success: false,
      category: 'empfehlung',
      sections: [],
      navigation: { title: 'BID/NO-BID Entscheidung', items: [] },
      confidence: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
      analyzedAt: new Date().toISOString(),
    };
  }
}
