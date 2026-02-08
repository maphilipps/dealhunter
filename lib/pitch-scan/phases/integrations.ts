import type { PhaseContext, PhaseResult } from '../types';
import type { EventEmitter } from '@/lib/streaming/in-process/event-emitter';
import { runPhaseAgent, formatPreviousResults } from './shared';

const SYSTEM_PROMPT = `Du bist ein Integrations-Experte. Erkenne alle externen Services und APIs der Website:
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

Antworte als JSON:
\`\`\`json
{
  "content": {
    "integrations": [
      { "name": "...", "category": "analytics|marketing|payment|crm|erp|social|support|newsletter|cdn|pim", "confidence": 0.8, "migrationImpact": "low|medium|high" }
    ],
    "apiEndpoints": ["..."],
    "migrationConsiderations": ["..."]
  },
  "confidence": 68,
  "sources": ["Script-Analyse", "Network-Analyse"]
}
\`\`\``;

export async function runIntegrationsPhase(
  context: PhaseContext,
  emit: EventEmitter
): Promise<PhaseResult> {
  return runPhaseAgent({
    sectionId: 'ps-integrations',
    label: 'Integrationen',
    systemPrompt: SYSTEM_PROMPT,
    userPrompt: `Website: ${context.websiteUrl}\n\nVorherige Ergebnisse:\n${formatPreviousResults(context)}`,
    context,
    emit,
  });
}
