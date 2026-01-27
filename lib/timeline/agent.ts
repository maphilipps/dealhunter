import { generateText } from 'ai';

import { projectTimelineSchema, COMPLEXITY_MULTIPLIERS, type ProjectTimeline } from './schema';
import { PHASE_DISTRIBUTION, STANDARD_PHASES } from './schema';

import { modelNames } from '@/lib/ai/config';
import { getProviderForSlot } from '@/lib/ai/providers';

/**
 * Input for Timeline Agent
 * Gathered during Quick Scan phase
 */
export interface TimelineAgentInput {
  // RAG Context (DEA-107)
  preQualificationId?: string; // Enable RAG tool for cross-agent context

  // From extracted requirements
  projectName: string;
  projectDescription: string;
  targetDeadline?: string; // From Pre-Qualification if specified
  budget?: number;

  // From Quick Scan
  websiteUrl: string;
  estimatedPageCount?: number;
  contentTypes?: number;
  detectedFeatures?: string[];
  detectedIntegrations?: string[];
  techStack?: string[];
  cms?: string;

  // Additional context
  rfpTimeline?: string; // Free text from Pre-Qualification
  specialRequirements?: string[];
}

/**
 * Calculate base timeline in days based on content volume and complexity
 *
 * Formula: Base = (Pages * 0.5) + (ContentTypes * 5) + (Integrations * 10) + 30
 * This gives a rough working days estimate
 */
function calculateBaseDays(input: TimelineAgentInput): number {
  const pages = input.estimatedPageCount || 50; // Default assumption
  const contentTypes = input.contentTypes || 5;
  const integrations = input.detectedIntegrations?.length || 0;

  const baseDays = pages * 0.5 + contentTypes * 5 + integrations * 10 + 30;

  return Math.ceil(baseDays);
}

/**
 * Determine complexity level based on input signals
 */
function assessComplexity(input: TimelineAgentInput): 'low' | 'medium' | 'high' | 'very_high' {
  const pages = input.estimatedPageCount || 50;
  const contentTypes = input.contentTypes || 5;
  const integrations = input.detectedIntegrations?.length || 0;
  const features = input.detectedFeatures?.length || 0;

  // Scoring system
  let complexityScore = 0;

  // Page count factor
  if (pages < 30) complexityScore += 1;
  else if (pages < 100) complexityScore += 2;
  else if (pages < 300) complexityScore += 3;
  else complexityScore += 4;

  // Content types factor
  if (contentTypes < 5) complexityScore += 1;
  else if (contentTypes < 10) complexityScore += 2;
  else if (contentTypes < 20) complexityScore += 3;
  else complexityScore += 4;

  // Integrations factor
  if (integrations === 0) complexityScore += 0;
  else if (integrations < 3) complexityScore += 2;
  else if (integrations < 6) complexityScore += 3;
  else complexityScore += 4;

  // Features factor
  if (features < 5) complexityScore += 0;
  else if (features < 10) complexityScore += 1;
  else if (features < 20) complexityScore += 2;
  else complexityScore += 3;

  // Total score to complexity mapping
  if (complexityScore <= 4) return 'low';
  if (complexityScore <= 8) return 'medium';
  if (complexityScore <= 12) return 'high';
  return 'very_high';
}

function buildFallbackTimeline(
  input: TimelineAgentInput,
  totalDays: number,
  complexity: 'low' | 'medium' | 'high' | 'very_high'
): ProjectTimeline {
  const totalWeeks = Math.max(1, Math.ceil(totalDays / 5));
  const totalMonths = Number((totalWeeks / 4.33).toFixed(1));

  const phases: ProjectTimeline['phases'] = [];
  let currentDay = 0;

  STANDARD_PHASES.forEach((name, index) => {
    const pct = PHASE_DISTRIBUTION[name];
    const isLast = index === STANDARD_PHASES.length - 1;
    const rawDuration = Math.max(1, Math.round(totalDays * pct));
    const durationDays = isLast ? Math.max(1, totalDays - currentDay) : rawDuration;
    const startDay = currentDay;
    const endDay = currentDay + durationDays - 1;
    currentDay += durationDays;

    phases.push({
      name,
      durationDays,
      startDay,
      endDay,
      dependencies: index === 0 ? [] : [STANDARD_PHASES[index - 1]],
      keyActivities: [`${name}: Standard-Setup für Phase 1`],
      canParallelize: name === 'Design & Prototyping' || name === 'Frontend Development',
    });
  });

  const teamSize =
    totalDays < 50
      ? { min: 2, optimal: 3, max: 4 }
      : totalDays < 150
        ? { min: 3, optimal: 4, max: 5 }
        : totalDays < 300
          ? { min: 4, optimal: 6, max: 8 }
          : { min: 6, optimal: 8, max: 12 };

  const confidenceMap = {
    low: 85,
    medium: 75,
    high: 60,
    very_high: 45,
  } as const;

  return {
    totalDays,
    totalWeeks,
    totalMonths,
    estimatedStart: null,
    estimatedGoLive: input.targetDeadline ?? null,
    phases,
    assumedTeamSize: teamSize,
    confidence: confidenceMap[complexity],
    assumptions: [
      'Standard-Projektphasen und typische Aufwandsverteilung',
      'Teamverfügbarkeit über die Laufzeit konstant',
      'Keine wesentlichen Scope-Änderungen während der Umsetzung',
    ],
    risks: [
      {
        factor: input.targetDeadline ? 'Feste Deadline kann Umsetzung verkürzen' : 'Deadline unklar',
        impact: 'medium',
        likelihood: input.targetDeadline ? 'high' : 'medium',
      },
      {
        factor: 'Unklare Anforderungen in frühen Phasen',
        impact: 'medium',
        likelihood: 'medium',
      },
      {
        factor: 'Integrationsaufwand höher als initial angenommen',
        impact: 'high',
        likelihood: 'low',
      },
    ],
    calculationBasis: {
      contentVolume: `~${input.estimatedPageCount ?? 50} Seiten, ${input.contentTypes ?? 5} Content-Typen`,
      complexity,
      integrations: input.detectedIntegrations?.length || 0,
      hasCriticalDeadline: Boolean(input.targetDeadline),
    },
    generatedAt: new Date().toISOString(),
    phase: 'quick_scan',
  };
}

/**
 * Timeline Agent
 *
 * Generates early timeline estimate during Quick Scan (Phase 1).
 * Provides realistic project timeline based on content volume,
 * complexity, and standard adesso project phases.
 *
 * This is DIFFERENT from detailed Project Planning (Phase 7) which
 * includes discipline matrices and detailed PT estimates.
 */
export async function generateTimeline(input: TimelineAgentInput): Promise<ProjectTimeline> {
  const baseDays = calculateBaseDays(input);
  const complexity = assessComplexity(input);
  const complexityMultiplier = COMPLEXITY_MULTIPLIERS[complexity];
  const totalDays = Math.ceil(baseDays * complexityMultiplier);

  // Prepare context for AI
  const contextDescription = `
Projekt: ${input.projectName}
Website: ${input.websiteUrl}

## Detected Information
- Geschätzte Seiten: ${input.estimatedPageCount || 'unbekannt'}
- Content-Typen: ${input.contentTypes || 'unbekannt'}
- Features: ${input.detectedFeatures?.length || 0} (${input.detectedFeatures?.join(', ') || 'keine'})
- Integrationen: ${input.detectedIntegrations?.length || 0} (${input.detectedIntegrations?.join(', ') || 'keine'})
- Tech Stack: ${input.techStack?.join(', ') || 'unbekannt'}
- CMS: ${input.cms || 'unbekannt'}

## Berechnung
- Basis-Tage: ${baseDays}
- Komplexität: ${complexity} (Multiplikator: ${complexityMultiplier}x)
- Geschätzte Gesamt-Tage: ${totalDays}

${input.targetDeadline ? `## Pre-Qualification Deadline\n${input.targetDeadline}` : ''}
${input.rfpTimeline ? `## Pre-Qualification Timeline Info\n${input.rfpTimeline}` : ''}
${input.specialRequirements?.length ? `## Special Requirements\n${input.specialRequirements.join('\n')}` : ''}
`.trim();

  // DEA-107: Optional RAG context retrieval
  // Note: generateObject doesn't support tools, so we pre-fetch RAG context
  let ragContext = '';
  if (input.preQualificationId) {
    try {
      const { queryRAG } = await import('@/lib/rag/retrieval-service');

      // Query for relevant performance and complexity data
      const [performanceResults, contentResults] = await Promise.all([
        queryRAG({
          preQualificationId: input.preQualificationId,
          question: 'What are the website performance indicators and issues?',
          maxResults: 3,
        }),
        queryRAG({
          preQualificationId: input.preQualificationId,
          question: 'What is the content architecture and complexity?',
          maxResults: 3,
        }),
      ]);

      if (performanceResults.length > 0 || contentResults.length > 0) {
        ragContext = '\n\n## Additional Context from Knowledge Base\n\n';
        if (performanceResults.length > 0) {
          ragContext += '### Performance Data:\n';
          ragContext += performanceResults
            .map(r => `- ${r.agentName}: ${r.content.slice(0, 200)}...`)
            .join('\n');
          ragContext += '\n\n';
        }
        if (contentResults.length > 0) {
          ragContext += '### Content Architecture:\n';
          ragContext += contentResults
            .map(r => `- ${r.agentName}: ${r.content.slice(0, 200)}...`)
            .join('\n');
        }
      }
    } catch (error) {
      console.warn('[Timeline Agent] RAG query failed:', error);
      // Continue without RAG context
    }
  }

  const prompt = `Du bist ein erfahrener Projektplaner bei adesso SE.

Erstelle einen **realistischen Projekt-Timeline** für die initiale Bewertung (Phase 1 - Quick Scan).

**WICHTIG:** Dies ist eine FRÜHE SCHÄTZUNG basierend auf Quick-Scan-Daten. Sei realistisch, nicht optimistisch.

${contextDescription}${ragContext}

## Standard-Phasen (anpassbar)

Die 6 Standard-Phasen bei adesso-Projekten:
1. **Setup & Discovery** (10% des Aufwands)
   - Kickoff, Anforderungsanalyse, Workshops

2. **Design & Prototyping** (15% des Aufwands)
   - UX/UI Design, Design System, Prototypen

3. **Frontend Development** (25% des Aufwands)
   - Component-Entwicklung, Templates, Responsive Design

4. **Backend & CMS Integration** (25% des Aufwands)
   - Content-Modellierung, CMS-Konfiguration, API-Integration

5. **QA & Testing** (15% des Aufwands)
   - Systemtests, UAT, Bug-Fixing, Performance-Tests

6. **Go-Live & Deployment** (10% des Aufwands)
   - Deployment, Migration, Schulung, Hypercare

## Regeln

1. **Realistische Zeiträume:** Nutze die berechneten ${totalDays} Arbeitstage als Basis
2. **Team-Annahme:** Gehe von 3-4 Personen im Team aus (Standard-Größe)
3. **Phasen-Verteilung:** Nutze die Standard-Prozentsätze oder passe sie an
4. **Parallelisierung:** Manche Phasen können überlappen (z.B. Design + Konzeption)
5. **Puffer:** Plane genug Puffer ein (10-20% extra Zeit)
6. **Abhängigkeiten:** Berücksichtige Abhängigkeiten zwischen Phasen

## Team-Größe Empfehlung

- Kleine Projekte (< 50 Tage): 2-3 Personen
- Mittelgroße Projekte (50-150 Tage): 3-4 Personen
- Große Projekte (150-300 Tage): 5-6 Personen
- Sehr große Projekte (> 300 Tage): 6-10 Personen

## Konfidenz-Level

- Hohe Konfidenz (80-100%): Klare Anforderungen, bekannte Technologie, Standard-Projekt
- Mittlere Konfidenz (60-79%): Einige Unklarheiten, neue Technologie, mittlere Komplexität
- Niedrige Konfidenz (< 60%): Viele Unbekannte, sehr hohe Komplexität, unrealistische Deadline

## Annahmen dokumentieren

Liste alle Annahmen die du triffst:
- Team-Größe
- Verfügbarkeit
- Technologie-Kenntnisse
- Scope-Klarheit
- Keine größeren Blocker

## Risiken identifizieren

Liste mögliche Timeline-Risiken:
- Unrealistische Deadline
- Unklare Anforderungen
- Komplexe Integrationen
- Neue/unbekannte Technologie
- Abhängigkeiten von Kunden

Antworte AUSSCHLIESSLICH als gültiges JSON, das exakt dem Schema entspricht.`;

  const { text } = await generateText({
    model: getProviderForSlot('quality')(modelNames.quality),
    prompt: `${prompt}\n\n${contextDescription}${ragContext}`,
  });

  try {
    const jsonStart = text.indexOf('{');
    const jsonEnd = text.lastIndexOf('}');
    if (jsonStart === -1 || jsonEnd === -1) {
      throw new Error('Timeline JSON not found in model output');
    }

    const jsonString = text.slice(jsonStart, jsonEnd + 1);
    const parsed = JSON.parse(jsonString);
    const result = projectTimelineSchema.safeParse(parsed);
    if (!result.success) {
      throw new Error(`Timeline JSON schema validation failed: ${result.error.message}`);
    }

    return result.data;
  } catch (error) {
    console.warn('[Timeline Agent] Falling back to heuristic timeline:', {
      message: error instanceof Error ? error.message : String(error),
    });
    return buildFallbackTimeline(input, totalDays, complexity);
  }
}

/**
 * Calculate working days between two dates (excluding weekends)
 * Utility function for timeline calculations
 */
export function calculateWorkingDays(startDate: Date, endDate: Date): number {
  let count = 0;
  const current = new Date(startDate);

  while (current <= endDate) {
    const dayOfWeek = current.getDay();
    // Skip Saturday (6) and Sunday (0)
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }

  return count;
}

/**
 * Add working days to a date (excluding weekends)
 * Utility function for timeline date calculations
 */
export function addWorkingDays(startDate: Date, days: number): Date {
  const result = new Date(startDate);
  let daysAdded = 0;

  while (daysAdded < days) {
    result.setDate(result.getDate() + 1);
    const dayOfWeek = result.getDay();
    // Skip Saturday (6) and Sunday (0)
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      daysAdded++;
    }
  }

  return result;
}
