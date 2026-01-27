import { z } from 'zod';

import { queryLeadRag, storeAuditAgentOutput, formatAuditContext } from './base';
import type { AuditAgentInput, AuditAgentOutput, AuditSection } from './types';

import { generateStructuredOutput } from '@/lib/ai/config';
import type { EventEmitter } from '@/lib/streaming/event-emitter';
import { AgentEventType } from '@/lib/streaming/event-types';

// Schema for cost estimation (with defaults for robustness)
const CostEstimationSchema = z.object({
  summary: z
    .object({
      totalHours: z.number().default(0),
      totalCost: z.number().default(0),
      currency: z.literal('EUR').default('EUR'),
      hourlyRate: z.number().default(120),
      contingency: z.number().default(15),
      confidenceRange: z
        .object({
          low: z.number().default(0),
          high: z.number().default(0),
        })
        .default({ low: 0, high: 0 }),
    })
    .default({
      totalHours: 0,
      totalCost: 0,
      currency: 'EUR',
      hourlyRate: 120,
      contingency: 15,
      confidenceRange: { low: 0, high: 0 },
    }),
  breakdown: z
    .array(
      z.object({
        category: z
          .enum([
            'discovery',
            'design',
            'backend',
            'frontend',
            'integration',
            'migration',
            'testing',
            'devops',
            'management',
            'training',
          ])
          .default('backend'),
        description: z.string().default(''),
        hours: z.number().default(0),
        cost: z.number().default(0),
        resources: z.array(z.string()).default([]),
      })
    )
    .default([]),
  features: z
    .array(
      z.object({
        name: z.string(),
        category: z.string().default(''),
        complexity: z.enum(['simple', 'medium', 'complex', 'very-complex']).default('medium'),
        hours: z.number().default(0),
        cost: z.number().default(0),
        optional: z.boolean().default(false),
        dependencies: z.array(z.string()).default([]),
      })
    )
    .default([]),
  recurringCosts: z
    .object({
      hosting: z.number().default(0),
      licenses: z.number().default(0),
      support: z.number().default(0),
      total: z.number().default(0),
      period: z.enum(['monthly', 'annual']).default('monthly'),
    })
    .default({ hosting: 0, licenses: 0, support: 0, total: 0, period: 'monthly' }),
  roi: z
    .object({
      breakEvenMonths: z.number().optional(),
      threeYearTCO: z.number().default(0),
      expectedBenefits: z.array(z.string()).default([]),
      costSavings: z
        .array(
          z.object({
            area: z.string(),
            annualSaving: z.number().default(0),
            description: z.string().default(''),
          })
        )
        .default([]),
    })
    .default({ threeYearTCO: 0, expectedBenefits: [], costSavings: [] }),
  budgetFit: z
    .object({
      assessment: z
        .enum(['within-budget', 'slightly-over', 'over-budget', 'unknown'])
        .default('unknown'),
      customerBudget: z.number().optional(),
      gap: z.number().optional(),
      recommendations: z.array(z.string()).default([]),
    })
    .default({ assessment: 'unknown', recommendations: [] }),
  confidence: z.number().min(0).max(100).default(50),
});

/**
 * Costs Expert Agent
 *
 * Creates detailed cost estimation with ROI analysis.
 */
export async function runCostsExpert(
  input: AuditAgentInput,
  emit?: EventEmitter
): Promise<AuditAgentOutput> {
  const log = (msg: string) => {
    console.error(`[Costs Expert] ${msg}`);
    emit?.({
      type: AgentEventType.AGENT_PROGRESS,
      data: { agent: 'Costs Expert', message: msg },
    });
  };

  log('Starte Kosten-Kalkulation...');

  try {
    // Query RAG for all effort-related data
    const projectData = await queryLeadRag(input.leadId, 'project phases team hours', 'audit', 15);
    const migrationData = await queryLeadRag(
      input.leadId,
      'migration effort hours complexity',
      'audit',
      10
    );
    const integrationData = await queryLeadRag(
      input.leadId,
      'integrations effort hours',
      'audit',
      10
    );
    const architectureData = await queryLeadRag(
      input.leadId,
      'architecture content types paragraphs',
      'audit',
      10
    );
    const hostingData = await queryLeadRag(input.leadId, 'hosting costs monthly', 'audit', 5);

    const combinedContext = formatAuditContext([
      ...projectData,
      ...migrationData,
      ...integrationData,
      ...architectureData,
      ...hostingData,
    ]);
    const sections: AuditSection[] = [];

    log('Generiere Kosten-Estimation...');

    const costs = await generateStructuredOutput({
      model: 'quality',
      schema: CostEstimationSchema,
      system: `Du bist ein Projektcontroller. Erstelle eine detaillierte Aufwandsschätzung für ein Web-Projekt.

TAGESSÄTZE (Marktüblich):
- Junior Developer: 80-100€/h
- Developer: 100-130€/h
- Senior Developer: 130-160€/h
- Tech Lead: 160-200€/h
- Consultant: 140-180€/h
- Project Manager: 130-170€/h
- UX Designer: 100-150€/h

BLENDED RATE: 130€/h (Durchschnitt)

AUFWANDS-KATEGORIEN:
- discovery: Anforderungen, Workshops, Konzeption (10-15%)
- design: UX/UI Design, Prototyping (10-15%)
- backend: CMS/Backend Development, APIs (25-35%)
- frontend: UI Development, JavaScript, Styling (15-25%)
- integration: Drittanbieter-Anbindungen (10-20%)
- migration: Content-Migration, Scripts (5-15%)
- testing: QA, Testautomatisierung (10-15%)
- devops: CI/CD, Hosting Setup (5-10%)
- management: PM, Meetings, Dokumentation (10-15%)
- training: Redaktionsschulungen (2-5%)

CONTINGENCY:
- Kleine Projekte (<500h): 15%
- Mittlere Projekte (500-2000h): 20%
- Große Projekte (>2000h): 25%

RECURRING COSTS:
- Hosting, Support, Lizenzen angeben
- "period": "monthly" oder "annual" je nach Abrechnungsmodell
- Für TCO-Berechnung entsprechend hochrechnen

TCO (3 Jahre):
- Initial: Projektkosten
- Recurring: Hosting + Support + Lizenzen
- Formel: Initial + (Recurring * 36) wenn monthly, (Recurring * 3) wenn annual

ROI-FAKTOREN:
- Reduzierte Wartungskosten
- Schnellere Time-to-Market
- Bessere Conversion Rates
- Reduzierte Lizenzkosten`,
      prompt: `Erstelle eine detaillierte Kosten-Estimation:\n\n${combinedContext}`,
      temperature: 0.2,
    });

    sections.push({
      slug: 'summary',
      title: `Gesamt: ${costs.summary.totalCost.toLocaleString('de-DE')}€`,
      content: costs.summary,
    });

    sections.push({
      slug: 'breakdown',
      title: 'Aufwands-Breakdown',
      content: costs.breakdown,
    });

    sections.push({
      slug: 'features',
      title: `Feature-Liste (${costs.features.length})`,
      content: costs.features,
    });

    sections.push({
      slug: 'recurring',
      title: `Laufende Kosten: ${costs.recurringCosts.total}€/Monat`,
      content: costs.recurringCosts,
    });

    sections.push({
      slug: 'roi',
      title: `ROI & TCO (3J: ${costs.roi.threeYearTCO.toLocaleString('de-DE')}€)`,
      content: costs.roi,
    });

    sections.push({
      slug: 'budget',
      title: `Budget-Fit: ${costs.budgetFit.assessment}`,
      content: costs.budgetFit,
    });

    log(
      `Kosten: ${costs.summary.totalCost.toLocaleString('de-DE')}€ (${costs.summary.totalHours}h)`
    );

    const navigation = {
      title: 'Kosten & Budget',
      items: sections.map(s => ({ slug: s.slug, title: s.title })),
    };

    const output: AuditAgentOutput = {
      success: true,
      category: 'kosten',
      sections,
      navigation,
      confidence: costs.confidence,
      analyzedAt: new Date().toISOString(),
    };

    await storeAuditAgentOutput(input.leadId, 'audit_costs_expert', output);

    log('Kosten-Kalkulation abgeschlossen');

    emit?.({
      type: AgentEventType.AGENT_COMPLETE,
      data: {
        agent: 'Costs Expert',
        result: {
          totalHours: costs.summary.totalHours,
          totalCost: costs.summary.totalCost,
          budgetFit: costs.budgetFit.assessment,
        },
      },
    });

    return output;
  } catch (error) {
    console.error('[Costs Expert] Error:', error);
    return {
      success: false,
      category: 'kosten',
      sections: [],
      navigation: { title: 'Kosten & Budget', items: [] },
      confidence: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
      analyzedAt: new Date().toISOString(),
    };
  }
}
