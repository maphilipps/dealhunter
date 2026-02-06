// ═══════════════════════════════════════════════════════════════════════════════
// EXECUTIVE SUMMARY STEP - QualificationScan 2.0 Workflow
// Aggregates all analysis results into a concise executive summary
// ═══════════════════════════════════════════════════════════════════════════════

import { z } from 'zod';

import { generateStructuredOutput } from '../../../ai/config';
import type {
  BLRecommendation,
  TechStack,
  ContentVolume,
  Features,
  MigrationComplexity,
  CompanyIntelligence,
} from '../../schema';
import { wrapTool } from '../tool-wrapper';

// ═══════════════════════════════════════════════════════════════════════════════
// EXECUTIVE SUMMARY SCHEMA
// ═══════════════════════════════════════════════════════════════════════════════

export const executiveSummarySchema = z.object({
  /** Recommended business line */
  blRecommendation: z.string().describe('Empfohlene Business Line'),
  /** Confidence in recommendation (0-100) */
  blConfidence: z.number().min(0).max(100).describe('Confidence der BL-Empfehlung'),
  /** Budget range estimation */
  budgetRange: z
    .object({
      min: z.number().describe('Minimum Budget in EUR'),
      max: z.number().describe('Maximum Budget in EUR'),
      confidence: z.number().min(0).max(100).describe('Confidence der Schätzung'),
    })
    .describe('Budget-Einschätzung'),
  /** T-Shirt size estimation */
  tShirtSize: z.enum(['XS', 'S', 'M', 'L', 'XL', 'XXL']).describe('T-Shirt Size des Projekts'),
  /** Go/No-Go score (0-100) */
  goNoGoScore: z.number().min(0).max(100).describe('Go/No-Go Score (0 = No-Go, 100 = Go)'),
  /** Top 3 risks */
  topRisks: z
    .array(
      z.object({
        title: z.string().describe('Risiko-Titel'),
        severity: z.enum(['low', 'medium', 'high', 'critical']).describe('Schweregrad'),
        description: z.string().describe('Beschreibung'),
      })
    )
    .min(1)
    .max(5)
    .describe('Top Risiken'),
  /** Key opportunities */
  opportunities: z.array(z.string()).max(5).describe('Wichtigste Chancen'),
  /** One-sentence summary */
  oneLiner: z.string().describe('Ein-Satz Zusammenfassung'),
});

export type ExecutiveSummary = z.infer<typeof executiveSummarySchema>;

// ═══════════════════════════════════════════════════════════════════════════════
// EXECUTIVE SUMMARY GENERATION
// ═══════════════════════════════════════════════════════════════════════════════

interface ExecutiveSummaryInput {
  recommendBusinessLine: BLRecommendation;
  techStack: TechStack;
  contentVolume: ContentVolume;
  features: Features;
  migrationComplexity?: MigrationComplexity;
  companyIntelligence?: CompanyIntelligence;
  loadBusinessUnits: Array<{ name: string; keywords: string[] }>;
}

async function generateExecutiveSummary(
  input: ExecutiveSummaryInput,
  contextSection?: string
): Promise<ExecutiveSummary> {
  const systemPrompt = `Du bist ein Senior Business Development Consultant bei adesso SE.
Erstelle eine Executive Summary basierend auf den Analyse-Ergebnissen eines Website-Scans.

REGELN:
- Sei präzise und faktenbasiert
- Budget-Schätzung basiert auf T-Shirt Size, Content-Volumen und Migrations-Komplexität
- Go/No-Go Score: 80+ = Go, 50-79 = Go mit Einschränkungen, <50 = No-Go
- Risiken nach Schweregrad sortieren
- Immer die tatsächliche BL-Empfehlung übernehmen

BUDGET ORIENTIERUNG:
- XS: 20.000-50.000 EUR (einfache Website, <50 Seiten)
- S: 50.000-100.000 EUR (Standard-Website, 50-200 Seiten)
- M: 100.000-250.000 EUR (Mittelgroßes Projekt, 200-500 Seiten)
- L: 250.000-500.000 EUR (Großes Projekt, 500-2000 Seiten, Integrationen)
- XL: 500.000-1.000.000 EUR (Enterprise, 2000+ Seiten, komplex)
- XXL: 1.000.000+ EUR (Konzern-Plattform, sehr komplex)`;

  const bl = input.recommendBusinessLine;
  const tech = input.techStack;
  const content = input.contentVolume;
  const features = input.features;
  const migration = input.migrationComplexity;
  const company = input.companyIntelligence;

  const userPrompt = `Analyse-Ergebnisse:

BL-EMPFEHLUNG:
- Business Line: ${bl.primaryBusinessLine}
- Confidence: ${bl.confidence}%
- Begründung: ${bl.reasoning}

TECH STACK:
- CMS: ${tech.cms || 'Unbekannt'} ${tech.cmsVersion ? `v${tech.cmsVersion}` : ''}
- Framework: ${tech.framework || 'Unbekannt'}
- Backend: ${tech.backend?.join(', ') || 'Unbekannt'}
- Hosting: ${tech.hosting || 'Unbekannt'}

CONTENT:
- Geschätzte Seiten: ${content.estimatedPageCount}
- Komplexität: ${content.complexity || 'Unbekannt'}
- Sprachen: ${content.languages?.join(', ') || 'Deutsch'}

FEATURES:
- E-Commerce: ${features.ecommerce ? 'Ja' : 'Nein'}
- User Accounts: ${features.userAccounts ? 'Ja' : 'Nein'}
- Multi-Language: ${features.multiLanguage ? 'Ja' : 'Nein'}
- API Integration: ${features.api ? 'Ja' : 'Nein'}
- Suche: ${features.search ? 'Ja' : 'Nein'}

${
  migration
    ? `MIGRATION:
- Komplexität: ${migration.recommendation} (Score: ${migration.score}/100)
- Warnungen: ${migration.warnings?.join(', ') || 'Keine'}
${migration.estimatedEffort ? `- Aufwand: ${migration.estimatedEffort.minPT}-${migration.estimatedEffort.maxPT} PT` : ''}`
    : ''
}

${
  company
    ? `UNTERNEHMEN:
- Name: ${company.basicInfo.name}
- Branche: ${company.basicInfo.industry || 'Unbekannt'}
- Mitarbeiter: ${company.basicInfo.employeeCount || 'Unbekannt'}
- Standort: ${company.basicInfo.headquarters || 'Unbekannt'}`
    : ''
}

Erstelle eine Executive Summary.`;

  const fullSystemPrompt = contextSection ? `${systemPrompt}\n\n${contextSection}` : systemPrompt;

  return generateStructuredOutput({
    schema: executiveSummarySchema,
    system: fullSystemPrompt,
    prompt: userPrompt,
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// RAG FORMATTING
// ═══════════════════════════════════════════════════════════════════════════════

function formatExecutiveSummaryForRAG(result: unknown): string {
  const summary = result as ExecutiveSummary;
  const parts: string[] = [
    `Executive Summary: ${summary.oneLiner}`,
    `BL-Empfehlung: ${summary.blRecommendation} (${summary.blConfidence}% Confidence)`,
    `T-Shirt Size: ${summary.tShirtSize}`,
    `Budget: ${summary.budgetRange.min.toLocaleString('de-DE')}–${summary.budgetRange.max.toLocaleString('de-DE')} EUR`,
    `Go/No-Go Score: ${summary.goNoGoScore}/100`,
    `Top Risiken: ${summary.topRisks.map(r => `${r.title} (${r.severity})`).join(', ')}`,
  ];
  if (summary.opportunities.length > 0) {
    parts.push(`Chancen: ${summary.opportunities.join(', ')}`);
  }
  return parts.join('. ');
}

// ═══════════════════════════════════════════════════════════════════════════════
// WORKFLOW STEP DEFINITION
// ═══════════════════════════════════════════════════════════════════════════════

export const executiveSummaryStep = wrapTool<ExecutiveSummaryInput, ExecutiveSummary>(
  {
    name: 'executiveSummary',
    displayName: 'Executive Summary',
    phase: 'synthesis',
    dependencies: [
      'recommendBusinessLine',
      'techStack',
      'contentVolume',
      'features',
      'loadBusinessUnits',
    ],
    optional: false,
    timeout: 90000,
    ragStorage: {
      chunkType: 'executive_summary',
      category: 'recommendation',
      formatContent: formatExecutiveSummaryForRAG,
      getConfidence: result => (result as ExecutiveSummary).goNoGoScore ?? 60,
    },
  },
  async (input, ctx) => {
    return generateExecutiveSummary(input, ctx.contextSection);
  }
);
