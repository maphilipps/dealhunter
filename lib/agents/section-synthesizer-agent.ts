/**
 * Section Synthesizer Agent
 *
 * Transforms RAG results into structured JSON Render Trees for visualization.
 * Takes raw RAG chunks and synthesizes them into a coherent, visual representation.
 *
 * Workflow:
 * 1. RAG Query → Raw chunks with content and similarity scores
 * 2. Section Synthesizer → AI processes and structures the data
 * 3. JSON Render Tree → Structured UI tree for rendering
 * 4. QuickScanRenderer → Visual display
 */

import OpenAI from 'openai';

import type { LeadRAGResult } from '@/lib/rag/lead-retrieval-service';

// Initialize OpenAI client with adesso AI Hub
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL || 'https://adesso-ai-hub.3asabc.de/v1',
});

// ========================================
// Types
// ========================================

export interface JsonRenderTree {
  root: string | null;
  elements: Record<
    string,
    {
      key: string;
      type: string;
      props: Record<string, unknown>;
      children?: string[];
    }
  >;
}

export interface SynthesizerInput {
  sectionId: string;
  ragResults: LeadRAGResult[];
  leadId: string;
  context?: Record<string, unknown>;
}

export interface SynthesizerOutput {
  tree: JsonRenderTree;
  confidence: number;
  synthesisMethod: 'ai' | 'fallback';
  error?: string;
}

// ========================================
// JSONL Parser
// ========================================

/**
 * Parse JSONL patches into a tree structure
 */
export function parseJsonlPatches(jsonl: string): JsonRenderTree {
  const tree: JsonRenderTree = {
    root: null,
    elements: {},
  };

  // Extract content from markdown code blocks if present
  let content = jsonl;
  const codeBlockMatch = jsonl.match(/```(?:json|jsonl)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    content = codeBlockMatch[1];
  }

  const lines = content.split('\n').filter(line => {
    const trimmed = line.trim();
    // Skip empty lines and non-JSON lines
    return trimmed && trimmed.startsWith('{') && trimmed.endsWith('}');
  });

  for (const line of lines) {
    try {
      const patch = JSON.parse(line) as { op?: string; path?: string; value?: unknown };

      if (patch.op === 'set' && patch.path === '/root') {
        tree.root = patch.value as string | null;
      } else if (patch.op === 'add' && patch.path?.startsWith('/elements/')) {
        const key = patch.path.replace('/elements/', '');
        tree.elements[key] = patch.value as {
          key: string;
          type: string;
          props: Record<string, unknown>;
          children?: string[];
        };
      }
    } catch {
      // Skip invalid JSON lines silently
    }
  }

  return tree;
}

// ========================================
// Base System Prompt
// ========================================

const BASE_SYSTEM_PROMPT = `Du bist ein Visualization Expert Agent, der RAG-Ergebnisse in strukturierte UI-Layouts transformiert.
Du erhältst RAG-Chunks (Textauszüge mit Relevanz-Scores) und erstellst daraus eine visuell ansprechende Zusammenfassung.

WICHTIG: Liefere nicht nur Fakten, sondern auch BEGRÜNDUNGEN und ERKLÄRUNGEN! Der Nutzer will verstehen WARUM.

OUTPUT FORMAT (JSONL):
{"op":"set","path":"/root","value":"main-grid"}
{"op":"add","path":"/elements/main-grid","value":{"key":"main-grid","type":"Grid","props":{"columns":1,"gap":"md"},"children":["card-1"]}}

VERFÜGBARE KOMPONENTEN:

**LAYOUT:**
- Grid: { columns?: number, gap?: "sm"|"md"|"lg" } - Layout grid (HAS CHILDREN)
- ResultCard: { title, description?, variant?: "default"|"highlight"|"warning"|"success"|"info", icon?: "tech"|"content"|"features"|"recommendation"|"accessibility"|"seo"|"legal"|"performance"|"navigation"|"company"|"migration"|"team"|"timeline"|"kpi" } - Container card (HAS CHILDREN)
- Section: { title, description?, badge?, badgeVariant? } - Section header

**METRICS:**
- Metric: { label, value, subValue?, trend?: "up"|"down"|"neutral" } - Single metric
- ScoreCard: { label, score: number, maxScore?, variant?: "default"|"success"|"warning"|"danger", showProgress? } - Score with progress

**CONTENT:**
- FeatureList: { title?, features: [{name, detected: boolean, details?}] } - Feature checklist
- TechStack: { title?, technologies: [{name, version?, confidence?, category?}] } - Technology list
- TechBadge: { name, version?, confidence?, category?: "cms"|"framework"|"backend"|"hosting"|"library"|"tool" }

**TEXT (WICHTIG - nutze diese für Begründungen!):**
- Paragraph: { text: string } - Fließtext für Erklärungen, Begründungen, Analysen
- BulletList: { items: string[] } - Aufzählung mit Details
- KeyValue: { label: string, value: string } - Schlüssel-Wert-Paar
- Insight: { title: string, text: string, type?: "info"|"warning"|"success"|"tip" } - Hervorgehobene Erkenntnis mit Begründung

REGELN:
1. Setze /root zuerst auf das Root-Element
2. Füge jedes Element mit /elements/{key} hinzu
3. Nur ResultCard, Grid, Section können children haben
4. Nutze aussagekräftige Keys (z.B., "tech-summary", "key-findings")
5. Fasse zusammenhängende Informationen zusammen - KEINE rohen Chunks anzeigen!
6. Priorisiere die wichtigsten Erkenntnisse
7. JEDE Card sollte mindestens einen erklärenden Text (Paragraph/Insight) enthalten!

BEST PRACTICES:
- Nutze Grid als Root für responsive Layouts
- Gruppiere verwandte Daten in ResultCards
- Zeige die wichtigsten Infos zuerst
- Nutze ScoreCard für Scores und Bewertungen
- Nutze FeatureList für ja/nein Checks
- Maximal 4-5 Cards für Übersichtlichkeit
- WICHTIG: Füge zu jeder Metrik/Liste eine Begründung hinzu (Paragraph oder Insight)
- Erkläre dem Leser WARUM etwas so ist, nicht nur WAS`;

// ========================================
// Section-Specific Prompts
// ========================================

const SECTION_PROMPTS: Record<string, string> = {
  technology: `Du analysierst TECHNOLOGIE-INFORMATIONEN aus RAG-Ergebnissen.

FOKUS:
- Aktueller Tech Stack (CMS, Frameworks, Libraries)
- Backend-Technologien
- Hosting & Infrastructure
- Third-Party Integrationen

LAYOUT-EMPFEHLUNG:
1. Übersicht mit Haupt-CMS/Framework als Highlight
2. Tech Stack Grid mit TechBadges
3. Integrationen als FeatureList`,

  'website-analysis': `Du analysierst WEBSITE-ANALYSE-ERGEBNISSE aus RAG-Chunks.

FOKUS:
- Performance Metriken
- SEO Status
- Accessibility Score
- Content Volumen

LAYOUT-EMPFEHLUNG:
1. Übersicht mit Key Metrics (ScoreCards)
2. SEO Checks als FeatureList
3. Performance Indikatoren`,

  'cms-architecture': `Du analysierst CMS & ARCHITEKTUR Informationen.

FOKUS:
- CMS-spezifische Struktur
- Content Types
- Taxonomien
- API/Headless Capabilities

LAYOUT-EMPFEHLUNG:
1. CMS Highlight Card
2. Content Structure Grid
3. Features/Capabilities Liste`,

  requirements: `Du analysierst ANFORDERUNGEN aus dem RFP/Ausschreibung.

FOKUS:
- Funktionale Anforderungen
- Technische Anforderungen
- Zeitliche Vorgaben
- Budget-Indikatoren

LAYOUT-EMPFEHLUNG:
1. Key Requirements als Highlight
2. Anforderungen nach Kategorie gruppiert
3. Must-haves vs Nice-to-haves`,

  competitors: `Du analysierst WETTBEWERBER-INFORMATIONEN.

FOKUS:
- Bekannte Mitbewerber
- Deren Tech Stacks
- Stärken/Schwächen
- Marktpositionierung

LAYOUT-EMPFEHLUNG:
1. Competitors Liste
2. Vergleichsmatrix
3. Differenzierungsmerkmale`,

  timeline: `Du analysierst ZEITPLAN & TERMINE.

FOKUS:
- Projektphasen
- Deadlines
- Meilensteine
- Go-Live Datum

LAYOUT-EMPFEHLUNG:
1. Key Dates als Metrics
2. Phasen als Timeline
3. Kritische Deadlines hervorheben`,

  budget: `Du analysierst BUDGET-INFORMATIONEN.

FOKUS:
- Gesamtbudget
- Budget-Aufteilung
- Zahlungsmodalitäten
- Preismodelle

LAYOUT-EMPFEHLUNG:
1. Budget-Übersicht
2. Kostenaufteilung
3. Konditionsdetails`,

  stakeholders: `Du analysierst STAKEHOLDER-INFORMATIONEN.

FOKUS:
- Entscheidungsträger
- Projektteam
- Kontaktpersonen
- Rollen & Verantwortlichkeiten

LAYOUT-EMPFEHLUNG:
1. Key Stakeholders als Cards
2. Organisationsstruktur
3. Kontaktinformationen`,

  risks: `Du analysierst RISIKEN und MITIGATION-STRATEGIEN.

FOKUS:
- Technische Risiken (Legacy-Systeme, Komplexität, Datenqualität)
- Organisatorische Risiken (Stakeholder-Verfügbarkeit, Change Management)
- Zeitliche Risiken (Deadlines, Abhängigkeiten)
- Budget-Risiken (Scope Creep, unvorhergesehene Kosten)
- Mitigation-Strategien pro Risiko

LAYOUT-EMPFEHLUNG:
1. Risiko-Übersicht mit ScoreCards (Gesamtrisiko, Anzahl kritischer Risiken)
2. Risiko-Matrix mit FeatureList (Risiken nach Schweregrad gruppiert)
3. Detaillierte Risiko-Cards mit:
   - Risiko-Beschreibung (Paragraph)
   - Eintrittswahrscheinlichkeit und Impact als Metrics
   - Mitigation-Strategie als Insight (type: "tip")
4. Zusammenfassung der Top-3 Handlungsempfehlungen`,
};

// ========================================
// Main Synthesizer Function
// ========================================

/**
 * Synthesize RAG results into a JSON Render Tree
 */
export async function synthesizeSectionData(input: SynthesizerInput): Promise<SynthesizerOutput> {
  const { sectionId, ragResults, context } = input;

  // No results → return empty state
  if (!ragResults || ragResults.length === 0) {
    return {
      tree: generateEmptyStateTree(sectionId),
      confidence: 0,
      synthesisMethod: 'fallback',
      error: 'Keine RAG-Ergebnisse verfügbar',
    };
  }

  // Build prompt from RAG results
  const ragContent = formatRagResultsForPrompt(ragResults);
  const sectionPrompt = SECTION_PROMPTS[sectionId] || '';

  const userPrompt = `Analysiere die folgenden RAG-Ergebnisse und erstelle eine strukturierte Visualisierung:

SEKTION: ${sectionId}
${sectionPrompt ? `\n${sectionPrompt}\n` : ''}
${context ? `\nKONTEXT:\n${JSON.stringify(context, null, 2)}\n` : ''}

RAG-ERGEBNISSE:
${ragContent}

ANWEISUNGEN:
1. Extrahiere die wichtigsten Erkenntnisse
2. Fasse zusammenhängende Informationen zusammen
3. Erstelle ein übersichtliches Layout
4. Priorisiere nach Relevanz (höhere similarity = wichtiger)
5. Ignoriere irrelevante oder doppelte Informationen`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gemini-3-flash-preview',
      messages: [
        { role: 'system', content: BASE_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.4,
      max_tokens: 4000,
    });

    const responseText = completion.choices[0]?.message?.content || '';
    const tree = parseJsonlPatches(responseText);

    // Validate tree
    if (!tree.root || Object.keys(tree.elements).length === 0) {
      console.warn('[SectionSynthesizer] Invalid tree, using fallback');
      return {
        tree: generateFallbackTree(sectionId, ragResults),
        confidence: calculateConfidence(ragResults),
        synthesisMethod: 'fallback',
        error: 'AI generated invalid tree',
      };
    }

    return {
      tree,
      confidence: calculateConfidence(ragResults),
      synthesisMethod: 'ai',
    };
  } catch (error) {
    console.error('[SectionSynthesizer] AI Error:', error);
    return {
      tree: generateFallbackTree(sectionId, ragResults),
      confidence: calculateConfidence(ragResults),
      synthesisMethod: 'fallback',
      error: error instanceof Error ? error.message : 'AI synthesis failed',
    };
  }
}

// ========================================
// Helper Functions
// ========================================

/**
 * Format RAG results for the prompt
 */
function formatRagResultsForPrompt(results: LeadRAGResult[]): string {
  return results
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 10) // Limit to top 10
    .map(
      (r, i) =>
        `[${i + 1}] Relevanz: ${Math.round(r.similarity * 100)}% | Agent: ${r.agentName}
Inhalt: ${r.content.substring(0, 500)}${r.content.length > 500 ? '...' : ''}`
    )
    .join('\n\n---\n\n');
}

/**
 * Calculate confidence from RAG results
 */
function calculateConfidence(results: LeadRAGResult[]): number {
  if (results.length === 0) return 0;

  // Average similarity of top 5 results
  const topResults = results.sort((a, b) => b.similarity - a.similarity).slice(0, 5);
  const avgSimilarity = topResults.reduce((sum, r) => sum + r.similarity, 0) / topResults.length;

  // Scale to 0-100
  return Math.round(avgSimilarity * 100);
}

/**
 * Generate empty state tree
 */
function generateEmptyStateTree(sectionId: string): JsonRenderTree {
  return {
    root: 'empty-state',
    elements: {
      'empty-state': {
        key: 'empty-state',
        type: 'ResultCard',
        props: {
          title: 'Keine Daten verfügbar',
          description: `Für die Sektion "${sectionId}" wurden keine relevanten Informationen gefunden.`,
          variant: 'default',
        },
        children: [],
      },
    },
  };
}

/**
 * Generate fallback tree from RAG results (deterministic)
 */
function generateFallbackTree(sectionId: string, results: LeadRAGResult[]): JsonRenderTree {
  const elements: JsonRenderTree['elements'] = {};
  const cardChildren: string[] = [];

  // Group by agent
  const byAgent = results.reduce(
    (acc, r) => {
      const agent = r.agentName || 'unknown';
      if (!acc[agent]) acc[agent] = [];
      acc[agent].push(r);
      return acc;
    },
    {} as Record<string, LeadRAGResult[]>
  );

  // Create a card per agent
  Object.entries(byAgent).forEach(([agent, agentResults], idx) => {
    const cardKey = `agent-card-${idx}`;
    const contentKey = `content-${idx}`;

    cardChildren.push(cardKey);

    // Extract bullet points from content
    const bullets = agentResults
      .slice(0, 3)
      .map(r => r.content.substring(0, 200))
      .filter(c => c.length > 20);

    elements[cardKey] = {
      key: cardKey,
      type: 'ResultCard',
      props: {
        title: formatAgentName(agent),
        variant: idx === 0 ? 'highlight' : 'default',
      },
      children: [contentKey],
    };

    elements[contentKey] = {
      key: contentKey,
      type: 'BulletList',
      props: {
        items: bullets.length > 0 ? bullets : ['Keine Details verfügbar'],
      },
    };
  });

  // Main container
  elements['main-container'] = {
    key: 'main-container',
    type: 'Grid',
    props: { columns: 1, gap: 'md' },
    children: ['header', ...cardChildren],
  };

  elements['header'] = {
    key: 'header',
    type: 'Section',
    props: {
      title: formatSectionTitle(sectionId),
      description: 'Automatisch generierte Zusammenfassung',
      badge: 'Fallback',
      badgeVariant: 'secondary',
    },
  };

  return {
    root: 'main-container',
    elements,
  };
}

/**
 * Format agent name for display
 */
function formatAgentName(agent: string): string {
  const names: Record<string, string> = {
    quick_scan: 'Quick Scan',
    tech_analysis: 'Tech Analyse',
    website_crawler: 'Website Crawler',
    accessibility_audit: 'Accessibility Audit',
    seo_audit: 'SEO Audit',
    legal_compliance: 'Legal Compliance',
    content_analyzer: 'Content Analyse',
  };

  return names[agent] || agent.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

/**
 * Format section ID for display
 */
function formatSectionTitle(sectionId: string): string {
  const titles: Record<string, string> = {
    technology: 'Aktuelle Technologie',
    'website-analysis': 'Website Analyse',
    'cms-architecture': 'CMS & Architektur',
    requirements: 'Anforderungen',
    competitors: 'Wettbewerber',
    timeline: 'Zeitplan',
    budget: 'Budget',
    stakeholders: 'Stakeholder',
    risks: 'Risiken & Mitigation',
  };

  return titles[sectionId] || sectionId.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}
