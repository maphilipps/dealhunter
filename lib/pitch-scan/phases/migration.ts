import type { PhaseContext, PhaseResult } from '../types';
import type { EventEmitter } from '@/lib/streaming/event-emitter';
import { runPhaseAgent, formatPreviousResults } from './shared';

const SYSTEM_PROMPT = `Du bist ein Migrations-Experte für CMS-Relaunches. Basierend auf allen bisherigen Analyseergebnissen, bewerte die Migrationskomplexität:
- Daten-Migration (Content-Volumen, Content-Typen, Medien)
- Template/Theme-Migration
- Modul/Plugin-Migration
- SEO-Migration (URL-Redirects, Meta-Daten)
- Integrations-Migration
- Risikofaktoren und Blocker
- Geschätzter Migrationsaufwand

Antworte als JSON:
\`\`\`json
{
  "content": {
    "overallComplexity": "low|medium|high|very_high",
    "complexityScore": 0,
    "factors": [
      { "name": "...", "score": 0, "impact": "low|medium|high", "notes": "..." }
    ],
    "risks": [{ "risk": "...", "probability": "low|medium|high", "mitigation": "..." }],
    "estimatedEffort": { "minPT": 0, "maxPT": 0, "confidence": 0.7 },
    "recommendations": ["..."]
  },
  "confidence": 65,
  "sources": ["Migrations-Analyse"]
}
\`\`\``;

export async function runMigrationPhase(
  context: PhaseContext,
  emit: EventEmitter
): Promise<PhaseResult> {
  return runPhaseAgent({
    sectionId: 'ps-migration',
    label: 'Migration',
    systemPrompt: SYSTEM_PROMPT,
    userPrompt: `Website: ${context.websiteUrl}\n\nVorherige Ergebnisse:\n${formatPreviousResults(context)}`,
    context,
    emit,
  });
}
