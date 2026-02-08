import type { PhaseContext, PhaseResult } from '../types';
import type { EventEmitter } from '@/lib/streaming/in-process/event-emitter';
import { buildBaseUserPrompt, runPhaseAgent } from './shared';

const SYSTEM_PROMPT =
  `Du bist ein Integrations-Experte. Erkenne alle externen Services und APIs der Website:
- Analytics (Google Analytics, Matomo, etc.)
- Marketing (HubSpot, Salesforce, Marketo)
- Payment (Stripe, PayPal, Klarna)
- CRM-Systeme
- ERP-Anbindungen
- Social Media APIs
- Chat/Support-Tools (Intercom, Zendesk)
- Newsletter-Dienste (Mailchimp, CleverReach)
- CDN und Asset-Management
- PIM/DAM-Systeme

Output: JSON gemaess Schema:
- content.summary
- content.findings (3-7) mit konkreten Tools + Migrations-Impact
- content.integrations/apiEndpoints/migrationConsiderations als strukturierte Felder
- confidence, sources optional` as const;

export async function runIntegrationsPhase(
  context: PhaseContext,
  emit: EventEmitter
): Promise<PhaseResult> {
  return runPhaseAgent({
    sectionId: 'ps-integrations',
    label: 'Integrationen',
    systemPrompt: SYSTEM_PROMPT,
    userPrompt: `${buildBaseUserPrompt(context)}\n\n# Phase: Integrationen\n- Nenne konkrete Integrationen (Vendor/Produkt) und wieso sie relevant sind.\n- Empfehlungen: konkrete Migrations-/Ablauf-Strategie.`,
    context,
    emit,
  });
}
