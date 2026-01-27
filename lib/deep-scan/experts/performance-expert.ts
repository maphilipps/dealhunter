import { z } from 'zod';

import { queryLeadRag, storeAuditAgentOutput, formatAuditContext } from './base';
import type { AuditAgentInput, AuditAgentOutput, AuditSection } from './types';

import { generateStructuredOutput } from '@/lib/ai/config';
import type { EventEmitter } from '@/lib/streaming/event-emitter';
import { AgentEventType } from '@/lib/streaming/event-types';

// Schema for performance analysis (with defaults for robustness)
const PerformanceAnalysisSchema = z.object({
  coreWebVitals: z
    .object({
      lcp: z
        .object({
          value: z.number().default(2500),
          unit: z.literal('ms').default('ms'),
          rating: z.enum(['good', 'needs-improvement', 'poor']).default('needs-improvement'),
        })
        .default({ value: 2500, unit: 'ms', rating: 'needs-improvement' }),
      cls: z
        .object({
          value: z.number().default(0.1),
          rating: z.enum(['good', 'needs-improvement', 'poor']).default('needs-improvement'),
        })
        .default({ value: 0.1, rating: 'needs-improvement' }),
      fid: z
        .object({
          value: z.number().default(100),
          unit: z.literal('ms').default('ms'),
          rating: z.enum(['good', 'needs-improvement', 'poor']).default('good'),
        })
        .optional(),
      ttfb: z
        .object({
          value: z.number().default(800),
          unit: z.literal('ms').default('ms'),
          rating: z.enum(['good', 'needs-improvement', 'poor']).default('needs-improvement'),
        })
        .default({ value: 800, unit: 'ms', rating: 'needs-improvement' }),
    })
    .default({
      lcp: { value: 2500, unit: 'ms', rating: 'needs-improvement' },
      cls: { value: 0.1, rating: 'needs-improvement' },
      ttfb: { value: 800, unit: 'ms', rating: 'needs-improvement' },
    }),
  overallScore: z.number().min(0).max(100).default(50),
  grade: z.enum(['A+', 'A', 'B+', 'B', 'C', 'D', 'F']).default('C'),
  bottlenecks: z
    .array(
      z.object({
        issue: z.string(),
        impact: z.enum(['critical', 'high', 'medium', 'low']).default('medium'),
        category: z
          .enum(['images', 'javascript', 'css', 'fonts', 'server', 'caching', 'other'])
          .default('other'),
        recommendation: z.string().default(''),
      })
    )
    .default([]),
  resourceAnalysis: z
    .object({
      totalRequests: z.number().optional(),
      totalSize: z.string().optional(),
      largestResources: z
        .array(
          z.object({
            url: z.string(),
            size: z.string(),
            type: z.string(),
          })
        )
        .optional(),
    })
    .optional(),
  confidence: z.number().min(0).max(100).default(50),
});

/**
 * Performance Expert Agent
 *
 * Analyzes website performance from scraped data and generates
 * performance insights with recommendations.
 */
export async function runPerformanceExpert(
  input: AuditAgentInput,
  emit?: EventEmitter
): Promise<AuditAgentOutput> {
  const log = (msg: string) => {
    console.error(`[Performance Expert] ${msg}`);
    emit?.({
      type: AgentEventType.AGENT_PROGRESS,
      data: { agent: 'Performance Expert', message: msg },
    });
  };

  log('Starte Performance-Analyse...');

  try {
    // Query RAG for performance-related data
    const resourceData = await queryLeadRag(
      input.leadId,
      'external requests scripts images css resources',
      'scraper',
      20
    );
    const techData = await queryLeadRag(
      input.leadId,
      'technology framework javascript library caching',
      'scraper',
      15
    );

    if (resourceData.length === 0) {
      return {
        success: false,
        category: 'performance',
        sections: [],
        navigation: { title: 'Performance', items: [] },
        confidence: 0,
        error: 'Keine Performance-Daten gefunden',
        analyzedAt: new Date().toISOString(),
      };
    }

    log(`${resourceData.length} Resource-Einträge im RAG gefunden`);

    const combinedContext = formatAuditContext([...resourceData, ...techData]);
    const sections: AuditSection[] = [];

    // ═══════════════════════════════════════════════════════════════
    // ANALYZE PERFORMANCE
    // ═══════════════════════════════════════════════════════════════
    log('Analysiere Core Web Vitals und Bottlenecks...');

    const performanceAnalysis = await generateStructuredOutput({
      model: 'quality',
      schema: PerformanceAnalysisSchema,
      system: `Du bist ein Web Performance Experte. Analysiere die gescrapten Website-Daten und erstelle eine Performance-Einschätzung.

BEWERTUNGSKRITERIEN (Core Web Vitals):
- LCP (Largest Contentful Paint): good < 2500ms, poor > 4000ms
- CLS (Cumulative Layout Shift): good < 0.1, poor > 0.25
- FID (First Input Delay): good < 100ms, poor > 300ms
- TTFB (Time To First Byte): good < 800ms, poor > 1800ms

BOTTLENECK-KATEGORIEN:
- images: Unoptimierte Bilder, fehlende WebP/AVIF
- javascript: Zu viel JS, Blocking Scripts, keine Code Splitting
- css: Render-blocking CSS, unused CSS
- fonts: Langsame Webfonts, kein font-display
- server: Langsamer TTFB, fehlende Kompression
- caching: Fehlende Cache-Header

GRADE-BERECHNUNG:
- A+: 95-100, A: 90-94, B+: 85-89, B: 75-84, C: 60-74, D: 40-59, F: <40

Schätze die Werte basierend auf erkannten Technologien und Patterns.`,
      prompt: `Analysiere die Performance dieser Website basierend auf den gescrapten Daten:\n\n${combinedContext}`,
      temperature: 0.2,
    });

    sections.push({
      slug: 'core-web-vitals',
      title: `Core Web Vitals (${performanceAnalysis.grade})`,
      content: performanceAnalysis,
    });

    log(
      `Performance-Score: ${performanceAnalysis.overallScore}/100 (${performanceAnalysis.grade})`
    );

    // ═══════════════════════════════════════════════════════════════
    // BUILD NAVIGATION
    // ═══════════════════════════════════════════════════════════════
    const navigation = {
      title: 'Performance',
      items: sections.map(s => ({ slug: s.slug, title: s.title })),
    };

    // ═══════════════════════════════════════════════════════════════
    // STORE IN RAG
    // ═══════════════════════════════════════════════════════════════
    const output: AuditAgentOutput = {
      success: true,
      category: 'performance',
      sections,
      navigation,
      confidence: performanceAnalysis.confidence,
      analyzedAt: new Date().toISOString(),
    };

    await storeAuditAgentOutput(input.leadId, 'audit_performance_expert', output);

    log('Performance-Analyse abgeschlossen');

    emit?.({
      type: AgentEventType.AGENT_COMPLETE,
      data: {
        agent: 'Performance Expert',
        result: {
          score: performanceAnalysis.overallScore,
          grade: performanceAnalysis.grade,
          bottlenecks: performanceAnalysis.bottlenecks.length,
        },
      },
    });

    return output;
  } catch (error) {
    console.error('[Performance Expert] Error:', error);
    return {
      success: false,
      category: 'performance',
      sections: [],
      navigation: { title: 'Performance', items: [] },
      confidence: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
      analyzedAt: new Date().toISOString(),
    };
  }
}
