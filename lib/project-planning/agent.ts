import { generateObject } from 'ai';
import { projectPlanSchema, type ProjectPlan } from './schema';
import type { PTEstimation } from '@/lib/deep-analysis/schemas';
import type { BaselineComparisonResult } from '@/lib/baseline-comparison/schema';

/**
 * Input für den Project-Planning Agent
 */
export interface ProjectPlanningInput {
  bidId: string;
  projectName: string;
  ptEstimation: PTEstimation;
  baselineComparison?: BaselineComparisonResult;
  technologies?: string[];
  targetTimeline?: string;
}

/**
 * ProjectPlanningAgent
 *
 * Generiert einen Projekt-Plan mit Phasen und Disziplinen-Matrix.
 * Technologie-agnostisch - funktioniert für alle Projekt-Typen.
 */
export async function generateProjectPlan(input: ProjectPlanningInput): Promise<ProjectPlan> {
  const { projectName, ptEstimation, baselineComparison, technologies = [], targetTimeline } = input;

  // Calculate base metrics
  const totalHours = ptEstimation.totalHours;
  const baselineHours = baselineComparison?.estimatedSavings.hoursFromBaseline || 0;
  const newDevHours = baselineComparison?.estimatedSavings.hoursNewDevelopment || totalHours;
  const baselineCoverage = baselineComparison?.baselineCoverage || 0;

  const { object } = await generateObject({
    model: 'openai/gpt-4o-mini',
    schema: projectPlanSchema,
    prompt: `Du bist ein erfahrener Projektplaner bei adesso SE.

Erstelle einen realistischen Projekt-Plan basierend auf der PT-Schätzung - TECHNOLOGIE-AGNOSTISCH.

## Projekt: ${projectName}

## PT-Schätzung
- **Gesamtstunden:** ${totalHours} PT
- **Konfidenz:** ${ptEstimation.confidence}%
- **Breakdown:**
  - Basis/Baseline: ${ptEstimation.breakdown.baselineHours} PT
  - Datenstrukturen: ${ptEstimation.breakdown.contentTypeHours} PT
  - Komponenten: ${ptEstimation.breakdown.paragraphHours} PT
  - Komplexitätsfaktor: ${ptEstimation.breakdown.complexityMultiplier}x
  - Puffer: ${ptEstimation.breakdown.bufferHours} PT

${baselineComparison ? `
## Baseline-Analyse
- **Baseline-Abdeckung:** ${baselineCoverage.toFixed(1)}%
- **Stunden aus Baseline:** ${baselineHours} PT (gespart)
- **Neuentwicklung:** ${newDevHours} PT
` : ''}

${technologies.length > 0 ? `## Technologien: ${technologies.join(', ')}` : ''}
${targetTimeline ? `## Ziel-Timeline: ${targetTimeline}` : ''}

## Standard-Phasen (anpassbar)

1. **Discovery (10-15% des Aufwands)**
   - Anforderungsanalyse, Workshops, Konzeption
   - Disziplinen: PL (lead), CON (lead), UX (major)

2. **Design (15-20% des Aufwands)**
   - UX/UI Design, Architektur, Technische Konzeption
   - Disziplinen: UX (lead), DEV (support), CON (review)

3. **Development (40-50% des Aufwands)**
   - Implementierung, Integration, Unit Tests
   - Disziplinen: DEV (lead), UX (support), QA (major)

4. **QA & Testing (15-20% des Aufwands)**
   - Systemtests, UAT, Bug-Fixing
   - Disziplinen: QA (lead), DEV (major), CON (review)

5. **Go-Live (5-10% des Aufwands)**
   - Deployment, Migration, Schulung, Hypercare
   - Disziplinen: OPS (lead), DEV (major), PL (major)

## Disziplinen-Kürzel
- PL: Projektleitung
- CON: Consulting/Business Analyse
- UX: UX/UI Design
- DEV: Development
- SEO: SEO/Content (optional)
- QA: Quality Assurance
- OPS: DevOps/Operations

## Regeln für die Planung

1. **Wochen berechnen:** 1 PT = 8h, 1 Woche = 40h pro Person
2. **Überlappung:** Phasen können sich überlappen (z.B. Design + Development)
3. **Team-Größe:** Basierend auf Gesamtstunden und Timeline
4. **Parallelisierung:** Berücksichtige, was parallel laufen kann

## Teamgröße-Empfehlung (basierend auf PT)
- < 200 PT: 2-4 Personen
- 200-500 PT: 4-6 Personen
- 500-1000 PT: 6-10 Personen
- > 1000 PT: 10+ Personen

## Deine Aufgabe

1. Erstelle einen realistischen Phasen-Plan
2. Berechne Wochen-Dauer pro Phase
3. Weise Disziplinen mit Involvement-Level zu
4. Berechne Stunden pro Disziplin
5. Empfehle Team-Größe
6. Liste Annahmen und Risiken

**WICHTIG:**
- Sei REALISTISCH, nicht optimistisch
- Plane genug Puffer ein
- Berücksichtige Abhängigkeiten zwischen Phasen

Antworte im vorgegebenen JSON-Schema.`,
    temperature: 0.3,
  });

  return object;
}
