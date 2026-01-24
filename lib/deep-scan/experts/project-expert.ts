import { z } from 'zod';

import { queryLeadRag, storeAuditAgentOutput, formatAuditContext } from './base';
import type { AuditAgentInput, AuditAgentOutput, AuditSection } from './types';

import { generateStructuredOutput } from '@/lib/ai/config';
import type { EventEmitter } from '@/lib/streaming/event-emitter';
import { AgentEventType } from '@/lib/streaming/event-types';

// Schema for project planning (with defaults for robustness)
// Use .optional().default() for fields AI might omit or set to undefined
const ProjectPlanSchema = z.object({
  phases: z
    .array(
      z.object({
        name: z.string().default('Phase'),
        duration: z
          .object({
            weeks: z.number().optional().default(1),
            startWeek: z.number().optional().default(1),
            endWeek: z.number().optional().default(1),
          })
          .optional()
          .default({ weeks: 1, startWeek: 1, endWeek: 1 }),
        deliverables: z.array(z.string()).optional().default([]),
        dependencies: z.array(z.string()).optional().default([]),
        resources: z
          .array(
            z.object({
              role: z.string().default('Developer'),
              allocation: z.number().optional().default(100),
            })
          )
          .optional()
          .default([]),
      })
    )
    .optional()
    .default([]),
  milestones: z
    .array(
      z.object({
        name: z.string(),
        week: z.number().default(1),
        type: z.enum(['kickoff', 'review', 'delivery', 'go-live', 'closure']).default('delivery'),
        description: z.string().default(''),
      })
    )
    .default([]),
  team: z
    .object({
      roles: z
        .array(
          z.object({
            role: z
              .enum([
                'project-manager',
                'tech-lead',
                'backend-developer',
                'frontend-developer',
                'ux-designer',
                'qa-engineer',
                'devops',
                'content-manager',
                'consultant',
              ])
              .default('backend-developer'),
            count: z.number().default(1),
            seniorityMix: z.string().default('Senior'),
            hoursPerWeek: z.number().default(40),
            totalHours: z.number().default(0),
          })
        )
        .default([]),
      totalFTE: z.number().default(0),
      peakFTE: z.number().default(0),
    })
    .default({ roles: [], totalFTE: 0, peakFTE: 0 }),
  timeline: z
    .object({
      totalWeeks: z.number().default(0),
      totalMonths: z.number().default(0),
      recommendedStart: z.string().optional(),
      goLiveDate: z.string().optional(),
    })
    .default({ totalWeeks: 0, totalMonths: 0 }),
  kpis: z
    .array(
      z.object({
        name: z.string(),
        target: z.string().default(''),
        measurement: z.string().default(''),
        frequency: z.enum(['weekly', 'sprint', 'monthly', 'phase', 'project']).default('monthly'),
      })
    )
    .default([]),
  risks: z
    .array(
      z.object({
        risk: z.string(),
        probability: z.enum(['low', 'medium', 'high']).default('medium'),
        impact: z.enum(['low', 'medium', 'high']).default('medium'),
        mitigation: z.string().default(''),
        owner: z.string().default('PM'),
      })
    )
    .default([]),
  confidence: z.number().min(0).max(100).default(50),
});

/**
 * Project Expert Agent
 *
 * Creates project plan with timeline, team structure, and KPIs.
 */
export async function runProjectExpert(
  input: AuditAgentInput,
  emit?: EventEmitter
): Promise<AuditAgentOutput> {
  const log = (msg: string) => {
    console.error(`[Project Expert] ${msg}`);
    emit?.({
      type: AgentEventType.AGENT_PROGRESS,
      data: { agent: 'Project Expert', message: msg },
    });
  };

  log('Starte Projekt-Planung...');

  try {
    // Query RAG for all relevant data
    const migrationData = await queryLeadRag(
      input.leadId,
      'migration complexity effort',
      'audit',
      10
    );
    const architectureData = await queryLeadRag(
      input.leadId,
      'architecture content types paragraphs',
      'audit',
      10
    );
    const integrationData = await queryLeadRag(input.leadId, 'integrations effort', 'audit', 10);
    const websiteData = await queryLeadRag(input.leadId, 'pages components', 'scraper', 10);

    const combinedContext = formatAuditContext([
      ...migrationData,
      ...architectureData,
      ...integrationData,
      ...websiteData,
    ]);
    const sections: AuditSection[] = [];

    log('Generiere Projektplan...');

    const projectPlan = await generateStructuredOutput({
      model: 'sonnet-4-5',
      schema: ProjectPlanSchema,
      system: `Du bist ein erfahrener IT-Projektleiter bei adesso. Erstelle einen realistischen Projektplan für ein Drupal-Relaunch-Projekt.

PHASEN (Standard Drupal-Projekt):
1. Discovery & Konzept (2-4 Wochen)
   - Anforderungsanalyse, Workshops, Konzeption
   - Team: PM, Consultant, UX Designer

2. Design & Architektur (2-4 Wochen)
   - UX/UI Design, Technische Architektur
   - Team: UX Designer, Tech Lead

3. Development Sprint 1-N (6-16 Wochen)
   - Content Types, Paragraphs, Views
   - Integrationen, Custom Module
   - Team: Backend, Frontend, DevOps

4. Content Migration (2-4 Wochen)
   - Migrations-Scripts, Content-Import
   - Team: Backend, Content Manager

5. QA & Testing (2-4 Wochen)
   - Funktionale Tests, Performance, Security
   - Team: QA Engineer, alle Entwickler

6. Go-Live & Stabilisierung (1-2 Wochen)
   - Deployment, Monitoring, Hotfixes
   - Team: DevOps, PM, Support

TEAM-ROLLEN (adesso-Standard):
- project-manager: Projektleitung, Stakeholder-Management
- tech-lead: Technische Verantwortung, Code Reviews
- backend-developer: Drupal-Entwicklung, APIs
- frontend-developer: Theming, JavaScript
- ux-designer: Design, Prototyping
- qa-engineer: Testing, Testautomatisierung
- devops: CI/CD, Hosting, Monitoring
- content-manager: Content-Migration, Redaktionsschulung
- consultant: Fachliche Beratung, Workshops

KPIs:
- Sprint Velocity, Burn-Down
- Code Coverage, Tech Debt
- Performance Scores, Accessibility
- Content Migration Progress
- Budget Burn Rate`,
      prompt: `Erstelle einen detaillierten Projektplan basierend auf dieser Analyse:\n\n${combinedContext}`,
      temperature: 0.3,
    });

    sections.push({
      slug: 'phases',
      title: `Projektphasen (${projectPlan.timeline.totalWeeks} Wochen)`,
      content: projectPlan.phases,
    });

    sections.push({
      slug: 'milestones',
      title: `Meilensteine (${projectPlan.milestones.length})`,
      content: projectPlan.milestones,
    });

    sections.push({
      slug: 'team',
      title: `Team (${projectPlan.team.totalFTE} FTE)`,
      content: projectPlan.team,
    });

    sections.push({
      slug: 'timeline',
      title: `Timeline (${projectPlan.timeline.totalMonths} Monate)`,
      content: projectPlan.timeline,
    });

    sections.push({
      slug: 'kpis',
      title: `KPIs (${projectPlan.kpis.length})`,
      content: projectPlan.kpis,
    });

    sections.push({
      slug: 'risks',
      title: `Risiken (${projectPlan.risks.length})`,
      content: projectPlan.risks,
    });

    log(`Projektplan: ${projectPlan.timeline.totalWeeks} Wochen, ${projectPlan.team.totalFTE} FTE`);

    const navigation = {
      title: 'Projekt-Organisation',
      items: sections.map(s => ({ slug: s.slug, title: s.title })),
    };

    const output: AuditAgentOutput = {
      success: true,
      category: 'projekt',
      sections,
      navigation,
      confidence: projectPlan.confidence,
      analyzedAt: new Date().toISOString(),
    };

    await storeAuditAgentOutput(input.leadId, 'audit_project_expert', output);

    log('Projekt-Planung abgeschlossen');

    emit?.({
      type: AgentEventType.AGENT_COMPLETE,
      data: {
        agent: 'Project Expert',
        result: {
          weeks: projectPlan.timeline.totalWeeks,
          phases: projectPlan.phases.length,
          teamFTE: projectPlan.team.totalFTE,
        },
      },
    });

    return output;
  } catch (error) {
    console.error('[Project Expert] Error:', error);
    return {
      success: false,
      category: 'projekt',
      sections: [],
      navigation: { title: 'Projekt-Organisation', items: [] },
      confidence: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
      analyzedAt: new Date().toISOString(),
    };
  }
}
