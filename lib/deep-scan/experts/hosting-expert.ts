import { generateStructuredOutput } from '@/lib/ai/config';
import { z } from 'zod';
import { queryLeadRag, storeAuditAgentOutput, formatAuditContext } from './base';
import type { AuditAgentInput, AuditAgentOutput, AuditSection } from './types';
import type { EventEmitter } from '@/lib/streaming/event-emitter';
import { AgentEventType } from '@/lib/streaming/event-types';

// Schema for hosting recommendation (with defaults for robustness)
const HostingSchema = z.object({
  currentHosting: z
    .object({
      provider: z.string().optional(),
      type: z
        .enum(['shared', 'vps', 'dedicated', 'cloud', 'managed', 'unknown'])
        .default('unknown'),
      cdn: z.string().optional(),
      location: z.string().optional(),
      evidence: z.array(z.string()).default([]),
    })
    .default({ type: 'unknown', evidence: [] }),
  requirements: z
    .object({
      expectedTraffic: z.enum(['low', 'medium', 'high', 'very-high']).default('medium'),
      peakEvents: z.boolean().default(false),
      multiRegion: z.boolean().default(false),
      compliance: z.array(z.string()).default([]),
      sla: z.enum(['99', '99.5', '99.9', '99.99']).default('99.9'),
    })
    .default({
      expectedTraffic: 'medium',
      peakEvents: false,
      multiRegion: false,
      compliance: [],
      sla: '99.9',
    }),
  recommendation: z
    .object({
      provider: z.string().default('TBD'),
      tier: z.string().default('Standard'),
      reasoning: z.string().default(''),
      architecture: z
        .object({
          webServers: z.number().default(1),
          database: z.string().default('PostgreSQL'),
          caching: z.string().default('Redis'),
          cdn: z.string().default('Cloudflare'),
          loadBalancer: z.boolean().default(false),
          autoScaling: z.boolean().default(false),
        })
        .default({
          webServers: 1,
          database: 'PostgreSQL',
          caching: 'Redis',
          cdn: 'Cloudflare',
          loadBalancer: false,
          autoScaling: false,
        }),
      alternatives: z
        .array(
          z.object({
            provider: z.string(),
            reasoning: z.string().default(''),
            monthlyCost: z.number().default(0),
          })
        )
        .default([]),
    })
    .default({
      provider: 'TBD',
      tier: 'Standard',
      reasoning: '',
      architecture: {
        webServers: 1,
        database: 'PostgreSQL',
        caching: 'Redis',
        cdn: 'Cloudflare',
        loadBalancer: false,
        autoScaling: false,
      },
      alternatives: [],
    }),
  monthlyCost: z
    .object({
      estimate: z.number().default(0),
      currency: z.literal('EUR').default('EUR'),
      breakdown: z
        .array(
          z.object({
            service: z.string(),
            cost: z.number().default(0),
          })
        )
        .default([]),
    })
    .default({ estimate: 0, currency: 'EUR', breakdown: [] }),
  confidence: z.number().min(0).max(100).default(50),
});

/**
 * Hosting Expert Agent
 *
 * Analyzes hosting requirements and recommends infrastructure.
 */
export async function runHostingExpert(
  input: AuditAgentInput,
  emit?: EventEmitter
): Promise<AuditAgentOutput> {
  const log = (msg: string) => {
    console.error(`[Hosting Expert] ${msg}`);
    emit?.({
      type: AgentEventType.AGENT_PROGRESS,
      data: { agent: 'Hosting Expert', message: msg },
    });
  };

  log('Starte Hosting-Analyse...');

  try {
    // Query RAG for tech and performance data
    const techData = await queryLeadRag(
      input.leadId,
      'hosting server cdn cloud provider',
      'scraper',
      15
    );
    const perfData = await queryLeadRag(
      input.leadId,
      'performance ttfb response time',
      'scraper',
      10
    );

    if (techData.length === 0) {
      return {
        success: false,
        category: 'hosting',
        sections: [],
        navigation: { title: 'Hosting & Infrastruktur', items: [] },
        confidence: 0,
        error: 'Keine Hosting-Daten gefunden',
        analyzedAt: new Date().toISOString(),
      };
    }

    log(`${techData.length + perfData.length} Hosting-Einträge gefunden`);

    const combinedContext = formatAuditContext([...techData, ...perfData]);
    const sections: AuditSection[] = [];

    log('Generiere Hosting-Empfehlung...');

    const hosting = await generateStructuredOutput({
      model: 'sonnet-4-5',
      schema: HostingSchema,
      system: `Du bist ein Cloud-Infrastruktur-Experte. Analysiere die Anforderungen und empfehle passende Hosting-Lösungen.

PROVIDER-OPTIONEN (alphabetisch):
- Acquia: CMS-spezialisiert, Enterprise-Features
- AWS: Flexibilität, breites Angebot, globale Reichweite
- Azure: Enterprise-Standard, gute Compliance
- DigitalOcean: Entwicklerfreundlich, kostengünstig
- Google Cloud: AI/ML-Integration, Kubernetes
- Hetzner: Deutsches Rechenzentrum, kostengünstig
- On-Premise: Eigene Infrastruktur
- Platform.sh: Git-basiert, Auto-Scaling
- Vercel/Netlify: JAMstack, Headless

ARCHITEKTUR-KOMPONENTEN:
- Web Server: Anzahl, Load Balancing
- Datenbank: MySQL, PostgreSQL, etc.
- Caching: Redis, Memcached, Varnish
- CDN: Cloudflare, Akamai, Fastly
- Storage: Object Storage für Media

KOSTEN-SCHÄTZUNG (EUR/Monat):
- Basic (Low Traffic): 100-300€
- Standard (Medium): 300-800€
- Enterprise (High): 1000-3000€
- High-Scale (Very High): 3000-10000€

Gib immer 2-3 Alternativen mit Begründung.`,
      prompt: `Analysiere Hosting-Anforderungen und erstelle Empfehlung:\n\n${combinedContext}`,
      temperature: 0.3,
    });

    sections.push({
      slug: 'current',
      title: 'Aktuelle Infrastruktur',
      content: hosting.currentHosting,
    });

    sections.push({
      slug: 'requirements',
      title: 'Anforderungen',
      content: hosting.requirements,
    });

    sections.push({
      slug: 'recommendation',
      title: `Empfehlung: ${hosting.recommendation.provider}`,
      content: hosting.recommendation,
    });

    sections.push({
      slug: 'alternatives',
      title: `Alternativen (${hosting.recommendation.alternatives.length})`,
      content: hosting.recommendation.alternatives,
    });

    sections.push({
      slug: 'costs',
      title: `Kosten: ${hosting.monthlyCost.estimate}€/Monat`,
      content: hosting.monthlyCost,
    });

    log(
      `Hosting-Empfehlung: ${hosting.recommendation.provider} (${hosting.monthlyCost.estimate}€/Monat)`
    );

    const navigation = {
      title: 'Hosting & Infrastruktur',
      items: sections.map(s => ({ slug: s.slug, title: s.title })),
    };

    const output: AuditAgentOutput = {
      success: true,
      category: 'hosting',
      sections,
      navigation,
      confidence: hosting.confidence,
      analyzedAt: new Date().toISOString(),
    };

    await storeAuditAgentOutput(input.leadId, 'audit_hosting_expert', output);

    log('Hosting-Analyse abgeschlossen');

    emit?.({
      type: AgentEventType.AGENT_COMPLETE,
      data: {
        agent: 'Hosting Expert',
        result: {
          provider: hosting.recommendation.provider,
          monthlyCost: hosting.monthlyCost.estimate,
          tier: hosting.recommendation.tier,
        },
      },
    });

    return output;
  } catch (error) {
    console.error('[Hosting Expert] Error:', error);
    return {
      success: false,
      category: 'hosting',
      sections: [],
      navigation: { title: 'Hosting & Infrastruktur', items: [] },
      confidence: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
      analyzedAt: new Date().toISOString(),
    };
  }
}
