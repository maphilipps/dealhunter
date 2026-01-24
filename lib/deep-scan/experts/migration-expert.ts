import { generateStructuredOutput } from '@/lib/ai/config';
import { z } from 'zod';
import { queryLeadRag, storeAuditAgentOutput, formatAuditContext } from './base';
import type { AuditAgentInput, AuditAgentOutput, AuditSection } from './types';
import type { EventEmitter } from '@/lib/streaming/event-emitter';
import { AgentEventType } from '@/lib/streaming/event-types';

// Schema for migration analysis (with defaults for robustness)
const MigrationAnalysisSchema = z.object({
  complexity: z.enum(['low', 'medium', 'high', 'very-high']).default('medium'),
  complexityScore: z.number().min(1).max(10).default(5),
  complexityFactors: z
    .array(
      z.object({
        factor: z.string(),
        impact: z.enum(['low', 'medium', 'high']).default('medium'),
        description: z.string().default(''),
      })
    )
    .default([]),
  contentMigration: z
    .object({
      estimatedPages: z.number().default(0),
      contentTypes: z
        .array(
          z.object({
            type: z.string(),
            count: z.number().default(0),
            complexity: z.enum(['simple', 'moderate', 'complex']).default('moderate'),
          })
        )
        .default([]),
      mediaAssets: z
        .object({
          images: z.number().optional(),
          documents: z.number().optional(),
          videos: z.number().optional(),
        })
        .default({}),
    })
    .default({ estimatedPages: 0, contentTypes: [], mediaAssets: {} }),
  technicalMigration: z
    .object({
      currentCms: z.string().optional(),
      customCode: z.enum(['none', 'minimal', 'moderate', 'extensive']).default('minimal'),
      integrations: z.array(z.string()).default([]),
      dataFormats: z.array(z.string()).default([]),
    })
    .default({ customCode: 'minimal', integrations: [], dataFormats: [] }),
  effortEstimate: z
    .object({
      totalHours: z.number().default(0),
      breakdown: z
        .array(
          z.object({
            phase: z.string(),
            hours: z.number().default(0),
            description: z.string().default(''),
          })
        )
        .default([]),
    })
    .default({ totalHours: 0, breakdown: [] }),
  risks: z
    .array(
      z.object({
        risk: z.string(),
        probability: z.enum(['low', 'medium', 'high']).default('medium'),
        impact: z.enum(['low', 'medium', 'high']).default('medium'),
        mitigation: z.string().default(''),
      })
    )
    .default([]),
  recommendations: z
    .array(z.string())
    .nullable()
    .default([])
    .transform(v => v ?? []),
  confidence: z.number().min(0).max(100).default(50),
});

/**
 * Migration Expert Agent
 *
 * Analyzes migration complexity and generates strategy recommendations.
 */
export async function runMigrationExpert(
  input: AuditAgentInput,
  emit?: EventEmitter
): Promise<AuditAgentOutput> {
  const log = (msg: string) => {
    console.error(`[Migration Expert] ${msg}`);
    emit?.({
      type: AgentEventType.AGENT_PROGRESS,
      data: { agent: 'Migration Expert', message: msg },
    });
  };

  log('Starte Migrations-Analyse...');

  try {
    // Query RAG for content and structure data
    const contentData = await queryLeadRag(
      input.leadId,
      'page types content structure headings',
      'scraper',
      20
    );
    const techData = await queryLeadRag(
      input.leadId,
      'technology cms framework database',
      'scraper',
      15
    );
    const structureData = await queryLeadRag(
      input.leadId,
      'navigation sections forms media images',
      'scraper',
      15
    );

    if (contentData.length === 0) {
      return {
        success: false,
        category: 'migration',
        sections: [],
        navigation: { title: 'Migration', items: [] },
        confidence: 0,
        error: 'Keine Content-Daten gefunden',
        analyzedAt: new Date().toISOString(),
      };
    }

    log(`${contentData.length + techData.length + structureData.length} Einträge im RAG gefunden`);

    const combinedContext = formatAuditContext([...contentData, ...techData, ...structureData]);
    const sections: AuditSection[] = [];

    // ═══════════════════════════════════════════════════════════════
    // ANALYZE MIGRATION COMPLEXITY
    // ═══════════════════════════════════════════════════════════════
    log('Analysiere Migrations-Komplexität...');

    const migrationAnalysis = await generateStructuredOutput({
      model: 'sonnet-4-5',
      schema: MigrationAnalysisSchema,
      system: `Du bist ein CMS-Migrations-Experte mit Fokus auf Drupal-Projekte. Analysiere die Website-Daten und erstelle eine Migrations-Einschätzung.

KOMPLEXITÄTS-FAKTOREN:
- Anzahl Seitentypen und Content Types
- Custom Code und Integrationen
- Media Assets (Bilder, Videos, Dokumente)
- Mehrsprachigkeit
- Formulare und interaktive Elemente
- SEO-Anforderungen (URL-Struktur, Redirects)

AUFWANDS-SCHÄTZUNG (Drupal-Migration):
- Analysis Phase: 10-20% des Gesamtaufwands
- Content Modeling: 15-25%
- Development: 30-40%
- Content Migration: 10-20%
- QA & Testing: 10-15%
- Go-Live: 5-10%

RISIKO-BEWERTUNG:
- Datenverlust: Immer "medium" oder höher wenn kein strukturiertes CMS
- SEO-Drop: Bewerte basierend auf URL-Struktur und Redirect-Komplexität
- Timeline-Risiko: Bewerte basierend auf Abhängigkeiten

Gib realistische Schätzungen basierend auf den erkannten Patterns.`,
      prompt: `Analysiere die Migrations-Komplexität für diese Website:\n\n${combinedContext}`,
      temperature: 0.2,
    });

    sections.push({
      slug: 'complexity',
      title: `Komplexität: ${migrationAnalysis.complexity.toUpperCase()} (${migrationAnalysis.complexityScore}/10)`,
      content: {
        complexity: migrationAnalysis.complexity,
        score: migrationAnalysis.complexityScore,
        factors: migrationAnalysis.complexityFactors,
      },
    });

    sections.push({
      slug: 'effort',
      title: `Aufwand: ${migrationAnalysis.effortEstimate.totalHours}h`,
      content: migrationAnalysis.effortEstimate,
    });

    sections.push({
      slug: 'risks',
      title: `Risiken (${migrationAnalysis.risks.length})`,
      content: migrationAnalysis.risks,
    });

    log(
      `Migrations-Komplexität: ${migrationAnalysis.complexity} (${migrationAnalysis.effortEstimate.totalHours}h)`
    );

    // ═══════════════════════════════════════════════════════════════
    // BUILD NAVIGATION
    // ═══════════════════════════════════════════════════════════════
    const navigation = {
      title: 'Migration',
      items: sections.map(s => ({ slug: s.slug, title: s.title })),
    };

    // ═══════════════════════════════════════════════════════════════
    // STORE IN RAG
    // ═══════════════════════════════════════════════════════════════
    const output: AuditAgentOutput = {
      success: true,
      category: 'migration',
      sections,
      navigation,
      confidence: migrationAnalysis.confidence,
      analyzedAt: new Date().toISOString(),
    };

    await storeAuditAgentOutput(input.leadId, 'audit_migration_expert', output);

    log('Migrations-Analyse abgeschlossen');

    emit?.({
      type: AgentEventType.AGENT_COMPLETE,
      data: {
        agent: 'Migration Expert',
        result: {
          complexity: migrationAnalysis.complexity,
          hours: migrationAnalysis.effortEstimate.totalHours,
          risks: migrationAnalysis.risks.length,
        },
      },
    });

    return output;
  } catch (error) {
    console.error('[Migration Expert] Error:', error);
    return {
      success: false,
      category: 'migration',
      sections: [],
      navigation: { title: 'Migration', items: [] },
      confidence: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
      analyzedAt: new Date().toISOString(),
    };
  }
}
