import type { PhaseContext, PhaseResult } from '../types';
import type { EventEmitter } from '@/lib/streaming/event-emitter';
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
- content.summary: 1-2 Saetze Kurzfassung
- content.markdown: Vollstaendige Analyse als Markdown mit Migrations-Phasen-Tabelle (| Phase | Beschreibung | Aufwand | Risiko |). Keine kuenstliche Kuerzung — alle relevanten Details ausfuehren.
- confidence: 0-100
- sources: optional` as const;

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
