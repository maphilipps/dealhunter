import type { PhaseContext, PhaseResult } from '../types';
import type { EventEmitter } from '@/lib/streaming/in-process/event-emitter';
import { buildBaseUserPrompt, runPhaseAgent } from './shared';

const SYSTEM_PROMPT =
  `Du bist ein Migrations-Experte für CMS-Relaunches. Basierend auf allen bisherigen Analyseergebnissen, bewerte die Migrationskomplexität:
- Daten-Migration (Content-Volumen, Content-Typen, Medien)
- Template/Theme-Migration
- Modul/Plugin-Migration
- SEO-Migration (URL-Redirects, Meta-Daten)
- Integrations-Migration
- Risikofaktoren und Blocker
- Geschätzter Migrationsaufwand

Output: JSON gemaess Schema:
- content.summary
- content.findings (3-7)
- content.overallComplexity/complexityScore/factors/risks/estimatedEffort/recommendations als strukturierte Felder
- confidence, sources optional` as const;

export async function runMigrationPhase(
  context: PhaseContext,
  emit: EventEmitter
): Promise<PhaseResult> {
  return runPhaseAgent({
    sectionId: 'ps-migration',
    label: 'Migration',
    systemPrompt: SYSTEM_PROMPT,
    userPrompt: `${buildBaseUserPrompt(context)}\n\n# Phase: Migration\n- Identifiziere konkrete Blocker/Risiken und eine realistische Migrations-Strategie.\n- Recommendations sollen direkt in Tasks umsetzbar sein.`,
    context,
    emit,
  });
}
