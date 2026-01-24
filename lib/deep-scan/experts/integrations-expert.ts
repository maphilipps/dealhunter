import { z } from 'zod';

import { queryLeadRag, storeAuditAgentOutput, formatAuditContext } from './base';
import type { AuditAgentInput, AuditAgentOutput, AuditSection } from './types';

import { generateStructuredOutput } from '@/lib/ai/config';
import type { EventEmitter } from '@/lib/streaming/event-emitter';
import { AgentEventType } from '@/lib/streaming/event-types';

// Schema for integrations analysis (with defaults for robustness)
const IntegrationsSchema = z.object({
  detected: z
    .array(
      z.object({
        name: z.string(),
        category: z
          .enum([
            'analytics',
            'marketing',
            'crm',
            'erp',
            'payment',
            'search',
            'social',
            'chat',
            'forms',
            'video',
            'maps',
            'authentication',
            'newsletter',
            'personalization',
            'cdn',
            'other',
          ])
          .default('other'),
        provider: z.string().default('Unknown'),
        integrationMethod: z
          .enum(['script', 'api', 'iframe', 'sdk', 'webhook', 'unknown'])
          .default('unknown'),
        migrationComplexity: z.enum(['trivial', 'easy', 'moderate', 'complex']).default('moderate'),
        drupalModule: z.string().optional(),
        evidence: z.string().default(''),
      })
    )
    .default([]),
  systemLandscape: z
    .object({
      primarySystems: z.array(z.string()).default([]),
      dataFlows: z
        .array(
          z.object({
            from: z.string(),
            to: z.string(),
            type: z.enum(['sync', 'async', 'batch', 'realtime']).default('sync'),
            description: z.string().default(''),
          })
        )
        .default([]),
      criticalIntegrations: z.array(z.string()).default([]),
    })
    .default({ primarySystems: [], dataFlows: [], criticalIntegrations: [] }),
  recommendations: z
    .array(
      z.object({
        integration: z.string(),
        approach: z.enum(['keep', 'replace', 'upgrade', 'remove']).default('keep'),
        reason: z.string().default(''),
        alternative: z.string().optional(),
        effortHours: z.number().default(0),
      })
    )
    .default([]),
  totalIntegrationEffort: z.number().default(0),
  confidence: z.number().min(0).max(100).default(50),
});

/**
 * Integrations Expert Agent
 *
 * Analyzes third-party integrations and system landscape.
 */
export async function runIntegrationsExpert(
  input: AuditAgentInput,
  emit?: EventEmitter
): Promise<AuditAgentOutput> {
  const log = (msg: string) => {
    console.error(`[Integrations Expert] ${msg}`);
    emit?.({
      type: AgentEventType.AGENT_PROGRESS,
      data: { agent: 'Integrations Expert', message: msg },
    });
  };

  log('Starte Integrations-Analyse...');

  try {
    // Query RAG for external requests and scripts
    const externalData = await queryLeadRag(
      input.leadId,
      'external requests scripts tracking analytics api',
      'scraper',
      25
    );
    const iframeData = await queryLeadRag(
      input.leadId,
      'iframe embed video map form',
      'scraper',
      15
    );

    if (externalData.length === 0) {
      return {
        success: false,
        category: 'integrationen',
        sections: [],
        navigation: { title: 'Integrationen', items: [] },
        confidence: 0,
        error: 'Keine Integrations-Daten gefunden',
        analyzedAt: new Date().toISOString(),
      };
    }

    log(`${externalData.length + iframeData.length} Integration-Einträge gefunden`);

    const combinedContext = formatAuditContext([...externalData, ...iframeData]);
    const sections: AuditSection[] = [];

    log('Analysiere Integrationen...');

    const integrations = await generateStructuredOutput({
      model: 'sonnet-4-5',
      schema: IntegrationsSchema,
      system: `Du bist ein Integration-Spezialist. Analysiere externe Requests und identifiziere Integrationen.

HÄUFIGE INTEGRATIONEN:
- Analytics: Google Analytics, Matomo, Hotjar, Adobe Analytics
- Marketing: Google Tag Manager, HubSpot, Marketo, Mailchimp
- CRM: Salesforce, HubSpot CRM, Microsoft Dynamics
- Payment: Stripe, PayPal, Adyen, Klarna
- Search: Algolia, Elasticsearch, Solr
- Chat: Intercom, Zendesk, LiveChat, Drift
- Video: YouTube, Vimeo, Wistia
- Maps: Google Maps, OpenStreetMap, Mapbox
- Social: Facebook, Twitter, LinkedIn, Instagram embeds
- Newsletter: Mailchimp, Sendinblue, CleverReach

DRUPAL-MODULE für Integrationen:
- google_analytics: GA4 Integration
- google_tag: GTM
- webform: Formulare mit CRM-Anbindung
- commerce: Payment-Integrationen
- social_media: Social Sharing
- search_api_solr: Solr Search

MIGRATIONS-AUFWAND:
- trivial (1-4h): Script-Tag, einfache Einbindung
- easy (4-16h): API-Anbindung mit existierendem Modul
- moderate (16-40h): Custom Integration, Datensync
- complex (40-80h+): Enterprise-Integration, bidirektional`,
      prompt: `Analysiere alle Integrationen dieser Website:\n\n${combinedContext}`,
      temperature: 0.2,
    });

    sections.push({
      slug: 'detected',
      title: `Erkannte Integrationen (${integrations.detected.length})`,
      content: integrations.detected,
    });

    sections.push({
      slug: 'landscape',
      title: 'Systemlandschaft',
      content: integrations.systemLandscape,
    });

    sections.push({
      slug: 'recommendations',
      title: 'Migrations-Empfehlungen',
      content: integrations.recommendations,
    });

    sections.push({
      slug: 'effort',
      title: `Gesamtaufwand: ${integrations.totalIntegrationEffort}h`,
      content: {
        totalHours: integrations.totalIntegrationEffort,
        byCategory: integrations.detected.reduce(
          (acc, i) => {
            acc[i.category] = (acc[i.category] || 0) + 1;
            return acc;
          },
          {} as Record<string, number>
        ),
      },
    });

    log(
      `${integrations.detected.length} Integrationen erkannt (${integrations.totalIntegrationEffort}h Aufwand)`
    );

    const navigation = {
      title: 'Integrationen',
      items: sections.map(s => ({ slug: s.slug, title: s.title })),
    };

    const output: AuditAgentOutput = {
      success: true,
      category: 'integrationen',
      sections,
      navigation,
      confidence: integrations.confidence,
      analyzedAt: new Date().toISOString(),
    };

    await storeAuditAgentOutput(input.leadId, 'audit_integrations_expert', output);

    log('Integrations-Analyse abgeschlossen');

    emit?.({
      type: AgentEventType.AGENT_COMPLETE,
      data: {
        agent: 'Integrations Expert',
        result: {
          detected: integrations.detected.length,
          effort: integrations.totalIntegrationEffort,
          critical: integrations.systemLandscape.criticalIntegrations.length,
        },
      },
    });

    return output;
  } catch (error) {
    console.error('[Integrations Expert] Error:', error);
    return {
      success: false,
      category: 'integrationen',
      sections: [],
      navigation: { title: 'Integrationen', items: [] },
      confidence: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
      analyzedAt: new Date().toISOString(),
    };
  }
}
