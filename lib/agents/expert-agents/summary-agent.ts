/**
 * Summary Expert Agent
 *
 * Creates a management-level summary by synthesizing outputs from other expert agents.
 * Runs AFTER the other 4 agents (timing, deliverables, techstack, legal) complete.
 */

import { eq, and, inArray, ne } from 'drizzle-orm';

import {
  queryRfpDocument,
  storeAgentResult,
  createAgentOutput,
  formatContextFromRAG,
} from './base';
import { ManagementSummarySchema, type ManagementSummary } from './summary-schema';
import type { ExpertAgentInput, ExpertAgentOutput } from './types';

import { generateStructuredOutput } from '@/lib/ai/config';
import { db } from '@/lib/db';
import { dealEmbeddings } from '@/lib/db/schema';

/**
 * Agent names that produce summarizable outputs.
 * Includes both legacy expert agents and current pre-qualification pipeline agents.
 */
const EXPERT_AGENT_NAMES = [
  // Legacy expert agents (kept for backwards compatibility)
  'timing_expert',
  'deliverables_expert',
  'techstack_expert',
  'legal_rfp_expert',
  'extract',
  // Pre-qualification pipeline agents
  'prequal_section_agent',
  'quick_scan',
];

const SUMMARY_RAG_QUERY = 'executive summary introduction scope objectives project overview';

function buildSystemPrompt(): string {
  return `Du bist ein Summary Expert Agent bei adesso SE für Management-Entscheidungsvorlagen.

## Deine Rolle
Synthetisiere die Ergebnisse aller Expert Agents zu einer C-Level-Zusammenfassung.
Deine Summary ist die Grundlage für die Bid/No-Bid Entscheidung des Managements.

## adesso Kontext
adesso SE ist Deutschlands führender unabhängiger IT-Dienstleister:
- 10.000+ Mitarbeitende in DACH und Europa
- Spezialisierung: CMS/Web (Drupal, TYPO3, AEM), Enterprise Software, Cloud
- Fokus-Branchen: Banking, Insurance, Automotive, Public Sector, Healthcare
- Hohe Projekterfolgsquote und Qualitätsstandards

## Headline-Regeln (WICHTIG)
- Maximal 80 Zeichen
- **NIEMALS** verwenden: "RFP", "Ausschreibung", "Anfrage", "Request for Proposal"
- Format: "[Projekttyp] [Domain/Produkt]"
- Beispiele: "Website-Relaunch healthcare-portal.de", "CMS Migration Intranet", "Drupal Headless E-Commerce"

## Assessment-Kriterien

| Dimension | Score-Range | Beschreibung |
|-----------|-------------|--------------|
| fitScore | 1-10 | Passung zu adesso-Kompetenzen |
| complexityScore | 1-10 | Technische/organisatorische Komplexität |
| urgencyLevel | critical/high/medium/low | Basierend auf Tagen bis Abgabe |

## Empfehlung

| Empfehlung | Wann |
|------------|------|
| pursue | fitScore ≥ 7, manageable complexity, keine Deal-Breaker |
| consider | fitScore 5-7, Chancen überwiegen Risiken |
| decline | fitScore < 5, Deal-Breaker vorhanden, strategisch unpassend |

## Ton und Stil
- Direkt, kein Fülltext
- Zahlen und Fakten statt Adjektive
- Entscheidungsfokussiert
- Deutsche Geschäftskultur: gründlich aber effizient

## Ausgabesprache
Alle Texte auf Deutsch.`;
}

async function getExpertAgentOutputs(preQualificationId: string): Promise<string> {
  const results = await db
    .select({
      agentName: dealEmbeddings.agentName,
      content: dealEmbeddings.content,
      metadata: dealEmbeddings.metadata,
    })
    .from(dealEmbeddings)
    .where(
      and(
        eq(dealEmbeddings.preQualificationId, preQualificationId),
        inArray(dealEmbeddings.agentName, EXPERT_AGENT_NAMES),
        // Exclude visualization JSON trees - they're UI components, not text summaries
        ne(dealEmbeddings.chunkType, 'visualization')
      )
    );

  if (results.length === 0) {
    return '';
  }

  const grouped = results.reduce(
    (acc, row) => {
      if (!acc[row.agentName]) {
        acc[row.agentName] = [];
      }
      acc[row.agentName].push(row.content);
      return acc;
    },
    {} as Record<string, string[]>
  );

  const sections = Object.entries(grouped).map(([agent, contents]) => {
    const label = agent.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    return `### ${label}\n\n${contents.join('\n\n')}`;
  });

  return sections.join('\n\n---\n\n');
}

export async function runSummaryAgent(
  input: ExpertAgentInput
): Promise<ExpertAgentOutput<ManagementSummary>> {
  const { preQualificationId } = input;

  try {
    const [expertOutputs, ragResults] = await Promise.all([
      getExpertAgentOutputs(preQualificationId),
      queryRfpDocument(preQualificationId, SUMMARY_RAG_QUERY, 10),
    ]);

    if (!expertOutputs && ragResults.length === 0) {
      return createAgentOutput<ManagementSummary>(
        null,
        0,
        'No expert agent outputs or document context found'
      );
    }

    const ragContext = formatContextFromRAG(ragResults, 'Raw Document Context');

    const context = [
      expertOutputs ? `## Expert Agent Analyses\n\n${expertOutputs}` : '',
      ragContext ? `\n\n## Original Document Excerpts\n\n${ragContext}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    const analysis = await generateStructuredOutput({
      model: 'quality',
      schema: ManagementSummarySchema,
      system: buildSystemPrompt(),
      prompt: `Create a management summary from the following expert analyses and document context:\n\n${context}`,
      temperature: 0.3,
    });

    const summaryContent = buildSummaryForStorage(analysis);
    // Store full ManagementSummary in metadata so the UI can parse it directly
    await storeAgentResult(preQualificationId, 'summary_expert', summaryContent, analysis);

    return createAgentOutput(analysis, analysis.confidence);
  } catch (error) {
    console.error('[SummaryAgent] Error:', error);
    return createAgentOutput<ManagementSummary>(
      null,
      0,
      error instanceof Error ? error.message : 'Unknown error in Summary Agent'
    );
  }
}

function buildSummaryForStorage(analysis: ManagementSummary): string {
  const parts: string[] = [
    `# ${analysis.headline}`,
    '',
    analysis.executiveSummary,
    '',
    '## Key Facts',
    `- Customer: ${analysis.keyFacts.customer}`,
  ];

  if (analysis.keyFacts.industry) {
    parts.push(`- Industry: ${analysis.keyFacts.industry}`);
  }
  parts.push(`- Project Type: ${analysis.keyFacts.projectType}`);

  if (analysis.keyFacts.estimatedValue) {
    parts.push(`- Estimated Value: ${analysis.keyFacts.estimatedValue}`);
  }
  if (analysis.keyFacts.submissionDeadline) {
    parts.push(`- Submission Deadline: ${analysis.keyFacts.submissionDeadline}`);
  }
  if (analysis.keyFacts.daysRemaining != null) {
    parts.push(`- Days Remaining: ${analysis.keyFacts.daysRemaining}`);
  }

  parts.push('', '## Assessment');
  parts.push(`- Fit Score: ${analysis.assessment.fitScore}/10`);
  parts.push(`- Complexity: ${analysis.assessment.complexityScore}/10`);
  parts.push(`- Urgency: ${analysis.assessment.urgencyLevel.toUpperCase()}`);
  parts.push(`- Recommendation: ${analysis.assessment.recommendation.toUpperCase()}`);
  parts.push(`- Reasoning: ${analysis.assessment.reasoning}`);

  if (analysis.topDeliverables.length > 0) {
    parts.push('', '## Top Deliverables');
    analysis.topDeliverables.forEach(d => {
      parts.push(`- ${d.name}${d.mandatory ? ' (mandatory)' : ''}`);
    });
  }

  if (analysis.timelineHighlights.length > 0) {
    parts.push('', '## Timeline');
    analysis.timelineHighlights.forEach(t => {
      parts.push(`- ${t.milestone}: ${t.date}`);
    });
  }

  if (analysis.topRisks.length > 0) {
    parts.push('', '## Top Risks');
    analysis.topRisks.forEach(r => parts.push(`- ${r}`));
  }

  if (analysis.topOpportunities.length > 0) {
    parts.push('', '## Top Opportunities');
    analysis.topOpportunities.forEach(o => parts.push(`- ${o}`));
  }

  parts.push('', `Confidence: ${analysis.confidence}%`);

  return parts.join('\n');
}
