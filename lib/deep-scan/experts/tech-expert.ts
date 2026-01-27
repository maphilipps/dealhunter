import { z } from 'zod';

import { queryLeadRag, storeAuditAgentOutput, formatAuditContext } from './base';
import type { AuditAgentInput, AuditAgentOutput, AuditSection } from './types';
import { techExpertToVisualization } from '../output-to-json-render';

import { generateStructuredOutput } from '@/lib/ai/config';
import type { EventEmitter } from '@/lib/streaming/event-emitter';
import { AgentEventType } from '@/lib/streaming/event-types';

// Schema for tech stack overview (with defaults for robustness)
const TechStackOverviewSchema = z.object({
  cms: z
    .object({
      name: z.string(),
      version: z.string().optional(),
      confidence: z.number().default(0),
      evidence: z.array(z.string()).default([]),
    })
    .optional(),
  frameworks: z
    .array(
      z.object({
        name: z.string(),
        category: z.string().default('unknown'),
        confidence: z.number().default(50),
      })
    )
    .default([]),
  libraries: z.array(z.string()).default([]),
  analytics: z.array(z.string()).default([]),
  hosting: z
    .object({
      provider: z.string().optional(),
      cdn: z.string().optional(),
      evidence: z.array(z.string()).default([]),
    })
    .default({ evidence: [] }),
  confidence: z.number().min(0).max(100).default(50),
});

// Schema for CMS deep-dive analysis (with defaults for robustness)
const CMSDeepDiveSchema = z.object({
  name: z.string().default('Unknown CMS'),
  version: z.string().optional(),
  edition: z.string().optional(),
  strengths: z.array(z.string()).default([]),
  weaknesses: z.array(z.string()).default([]),
  marketPosition: z.string().default('Unknown'),
  typicalUseCases: z.array(z.string()).default([]),
  migrationComplexity: z.enum(['low', 'medium', 'high']).default('medium'),
  confidence: z.number().default(50),
});

type TechStackOverview = z.infer<typeof TechStackOverviewSchema>;
type CMSDeepDive = z.infer<typeof CMSDeepDiveSchema>;

/**
 * Tech Expert Agent
 *
 * Analyzes website technology stack and generates:
 * 1. tech_analysis.json (Full tech stack)
 * 2. tech_summary.md (Report)
 * 3. [cms]_deepdive.json (if CMS detected)
 * 4. json-render visualization
 */
export async function runTechExpert(
  input: AuditAgentInput,
  emit?: EventEmitter
): Promise<AuditAgentOutput> {
  const log = (msg: string) => {
    console.error(`[Tech Expert] ${msg}`);
    emit?.({
      type: AgentEventType.AGENT_PROGRESS,
      data: { agent: 'Tech Expert', message: msg },
    });
  };

  log('Starte Technologie-Analyse...');

  try {
    // Query RAG for tech detection data
    const techData = await queryLeadRag(
      input.leadId,
      'technology detection cms framework library',
      'scraper',
      20
    );
    const headerData = await queryLeadRag(
      input.leadId,
      'headers server response meta generator',
      'scraper',
      10
    );

    if (techData.length === 0) {
      return {
        success: false,
        category: 'technologie',
        sections: [],
        navigation: { title: 'Technologie', items: [] },
        confidence: 0,
        error: 'Keine Technologie-Daten gefunden',
        analyzedAt: new Date().toISOString(),
      };
    }

    log(`${techData.length} Technologie-Einträge im RAG gefunden`);

    const combinedContext = formatAuditContext([...techData, ...headerData]);
    const sections: AuditSection[] = [];

    // ═══════════════════════════════════════════════════════════════
    // ANALYZE TECH STACK
    // ═══════════════════════════════════════════════════════════════
    log('Analysiere Tech-Stack...');

    const techStackAnalysis = await generateStructuredOutput({
      model: 'quality',
      schema: TechStackOverviewSchema,
      system: `Du bist ein Tech-Stack-Analyse-Experte. Analysiere die erkannten Technologien einer Website.

Typische CMS-Indikatoren:
- WordPress: wp-content, wp-includes, generator meta tag
- Drupal: drupal.js, /core/, /modules/, generator
- TYPO3: typo3/, EXT:, tx_
- Joomla: /media/jui/, generator
- Contentful: cdn.contentful.com
- Shopify: cdn.shopify.com, /checkouts/
- Magento: /static/version, Mage
- SAP Hybris: /medias/, /yacceleratorstorefront/
- Adobe Experience Manager: /content/dam/, /etc.clientlibs/

Framework-Kategorien:
- Frontend: React, Vue, Angular, Svelte
- CSS: Tailwind, Bootstrap, Foundation
- Build: Webpack, Vite, Parcel
- SSR: Next.js, Nuxt, Gatsby

Bewerte Confidence basierend auf Evidenz-Stärke.`,
      prompt: `Analysiere den Tech-Stack dieser Website:\n\n${combinedContext}`,
      temperature: 0.2,
    });

    sections.push({
      slug: 'tech-stack',
      title: 'Tech Stack Overview',
      content: techStackAnalysis,
    });

    log(`Tech-Stack analysiert: ${techStackAnalysis.cms?.name || 'Kein CMS erkannt'}`);

    // ═══════════════════════════════════════════════════════════════
    // CMS DEEP-DIVE (if detected)
    // ═══════════════════════════════════════════════════════════════
    let cmsDeepDive: CMSDeepDive | null = null;
    if (techStackAnalysis.cms && techStackAnalysis.cms.confidence >= 50) {
      log(`CMS Deep-Dive für ${techStackAnalysis.cms.name}...`);

      cmsDeepDive = await generateStructuredOutput({
        model: 'quality',
        schema: CMSDeepDiveSchema,
        system: `Du bist ein CMS-Experte mit tiefem Wissen über Enterprise-CMS-Systeme.

Analysiere das erkannte CMS und gib detaillierte Einschätzungen:

Für WordPress:
- Editions: WordPress.com, self-hosted, VIP
- Stärken: Riesiges Ecosystem, einfache Bedienung, SEO-Plugins
- Schwächen: Sicherheit, Performance bei Scale, Plugin-Abhängigkeit

Für Drupal:
- Editions: Core, Drupal Commerce, Acquia
- Stärken: Enterprise-Features, Flexibilität, Multi-Site
- Schwächen: Lernkurve, Entwicklungskosten

Für TYPO3:
- Editions: TYPO3 CMS, TYPO3 Enterprise
- Stärken: Deutsche Herkunft, Multi-Domain, Redaktions-Workflows
- Schwächen: Komplexität, Entwickler-Verfügbarkeit

Bewerte Migrations-Komplexität nach Drupal:
- low: Einfache CMS, wenig Custom-Code
- medium: Komplexe Strukturen, viele Integrationen
- high: Enterprise-System, umfangreiche Customizations`,
        prompt: `Erstelle einen Deep-Dive für ${techStackAnalysis.cms.name}:
        
Erkannte Version: ${techStackAnalysis.cms.version || 'unbekannt'}
Evidenz: ${techStackAnalysis.cms.evidence.join(', ')}

Zusätzlicher Kontext:
${combinedContext}`,
        temperature: 0.3,
      });

      sections.push({
        slug: 'cms-deepdive',
        title: `${techStackAnalysis.cms.name} Deep-Dive`,
        content: cmsDeepDive,
      });

      log(`CMS Deep-Dive abgeschlossen: Migration Complexity = ${cmsDeepDive.migrationComplexity}`);
    }

    // ═══════════════════════════════════════════════════════════════
    // BUILD NAVIGATION
    // ═══════════════════════════════════════════════════════════════
    const navigation = {
      title: 'Technologie',
      items: sections.map(s => ({ slug: s.slug, title: s.title })),
    };

    // ═══════════════════════════════════════════════════════════════
    // AGENT-NATIVE: Store findings and visualization directly
    // ═══════════════════════════════════════════════════════════════
    if (input.ragTools) {
      log('Speichere Findings und Visualisierung via Agent-Native RAG...');

      // Store tech stack finding
      const techFindingContent = [
        `CMS: ${techStackAnalysis.cms?.name || 'Nicht erkannt'}`,
        techStackAnalysis.cms?.version ? `Version: ${techStackAnalysis.cms.version}` : null,
        `Frameworks: ${techStackAnalysis.frameworks.map(f => f.name).join(', ') || 'Keine'}`,
        `Analytics: ${techStackAnalysis.analytics.join(', ') || 'Keine'}`,
        techStackAnalysis.hosting.provider ? `Hosting: ${techStackAnalysis.hosting.provider}` : null,
        techStackAnalysis.hosting.cdn ? `CDN: ${techStackAnalysis.hosting.cdn}` : null,
      ]
        .filter(Boolean)
        .join('. ');

      await input.ragTools.storeFinding({
        category: 'fact',
        chunkType: 'tech_stack',
        content: techFindingContent,
        confidence: techStackAnalysis.confidence,
        metadata: { raw: techStackAnalysis },
      });

      // Store CMS deep-dive if available
      if (cmsDeepDive) {
        const cmsContent = [
          `${cmsDeepDive.name} Analyse:`,
          `Stärken: ${cmsDeepDive.strengths.join(', ')}`,
          `Schwächen: ${cmsDeepDive.weaknesses.join(', ')}`,
          `Migration Complexity: ${cmsDeepDive.migrationComplexity}`,
        ].join(' ');

        await input.ragTools.storeFinding({
          category: 'elaboration',
          chunkType: 'cms_deepdive',
          content: cmsContent,
          confidence: cmsDeepDive.confidence,
          metadata: { raw: cmsDeepDive },
        });
      }

      // Generate and store visualization
      const visualization = techExpertToVisualization(techStackAnalysis, cmsDeepDive ?? undefined);
      await input.ragTools.storeVisualization({
        sectionId: 'technology',
        visualization,
        confidence: techStackAnalysis.confidence,
      });

      log('Agent-Native RAG Speicherung abgeschlossen');
    }

    // ═══════════════════════════════════════════════════════════════
    // LEGACY: Store via storeAuditAgentOutput (fallback)
    // ═══════════════════════════════════════════════════════════════
    const output: AuditAgentOutput = {
      success: true,
      category: 'technologie',
      sections,
      navigation,
      confidence: techStackAnalysis.confidence,
      analyzedAt: new Date().toISOString(),
    };

    // Only store via legacy path if ragTools not available
    if (!input.ragTools) {
      await storeAuditAgentOutput(input.leadId, 'audit_tech_expert', output);
    }

    log('Technologie-Analyse abgeschlossen');

    return output;
  } catch (error) {
    console.error('[Tech Expert] Error:', error);
    return {
      success: false,
      category: 'technologie',
      sections: [],
      navigation: { title: 'Technologie', items: [] },
      confidence: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
      analyzedAt: new Date().toISOString(),
    };
  }
}
