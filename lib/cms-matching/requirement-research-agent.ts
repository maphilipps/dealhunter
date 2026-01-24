/**
 * Requirement Research Agent
 *
 * Ein einzelner Agent pro Anforderungsfeld.
 * Recherchiert ein spezifisches Requirement für ein CMS und speichert das Ergebnis.
 *
 * Wird parallel für alle Requirements x CMS Kombinationen ausgeführt.
 */

import { eq } from 'drizzle-orm';

import type { RequirementMatch } from './schema';

import { db } from '@/lib/db';
import { technologies } from '@/lib/db/schema';
// Intelligent tools available for future enhancements
import { searchAndContents } from '@/lib/search/web-search';

/**
 * Research Result für ein einzelnes Requirement
 */
export interface RequirementResearchResult {
  requirement: string;
  cmsId: string;
  cmsName: string;
  score: number;
  confidence: number;
  notes: string;
  supported: boolean;
  evidence: string[];
  sources: string[];
  webSearchUsed: boolean;
  researchedAt: string;
  researchDurationMs: number;
}

/**
 * Input für den Requirement Research Agent
 */
export interface RequirementResearchInput {
  requirement: string;
  category: RequirementMatch['category'];
  priority: RequirementMatch['priority'];
  cmsId: string;
  cmsName: string;
  saveToDb?: boolean;
}

/**
 * Event Emitter für Streaming
 */
export type ResearchEventEmitter = (event: {
  type: 'RESEARCH_START' | 'RESEARCH_PROGRESS' | 'RESEARCH_COMPLETE' | 'RESEARCH_ERROR';
  data: {
    requirement: string;
    cmsName: string;
    message: string;
    progress?: number;
    result?: RequirementResearchResult;
  };
}) => void;

/**
 * CMS-spezifische Suchqueries generieren
 */
function generateResearchQueries(cmsName: string, requirement: string): string[] {
  const normalizedReq = requirement.toLowerCase();
  const queries: string[] = [];

  // Offizielle Dokumentations-Seiten
  const officialDocs: Record<string, string> = {
    drupal: 'site:drupal.org',
    wordpress: 'site:wordpress.org OR site:developer.wordpress.com',
    contentful: 'site:contentful.com',
    strapi: 'site:strapi.io',
    sanity: 'site:sanity.io',
    typo3: 'site:typo3.org',
    sitecore: 'site:doc.sitecore.com',
    adobe: 'site:experienceleague.adobe.com',
  };

  const docSite = officialDocs[cmsName.toLowerCase()] || '';

  // Feature-spezifische Queries
  const featureQueries: Record<string, string[]> = {
    mehrsprach: ['multilingual', 'internationalization', 'i18n', 'translation'],
    'e-commerce': ['ecommerce', 'commerce', 'shop', 'payment'],
    suche: ['search', 'elasticsearch', 'solr', 'algolia'],
    api: ['rest api', 'graphql', 'api integration'],
    ssr: ['server-side rendering', 'ssr', 'pre-rendering'],
    wcag: ['wcag', 'accessibility', 'a11y', 'aria'],
    dsgvo: ['gdpr', 'privacy', 'data protection', 'consent'],
    workflow: ['editorial workflow', 'content approval', 'moderation'],
    cache: ['caching', 'performance', 'varnish', 'redis'],
    login: ['user authentication', 'login', 'sso', 'oauth'],
    formulare: ['forms', 'webform', 'contact form'],
    blog: ['blog', 'news', 'articles', 'content management'],
  };

  // Finde passende Feature-Keywords
  let keywords: string[] = [];
  for (const [key, values] of Object.entries(featureQueries)) {
    if (normalizedReq.includes(key)) {
      keywords = values;
      break;
    }
  }

  // Basis-Query mit CMS + Requirement
  queries.push(`${cmsName} ${requirement} feature support`);

  // Feature-spezifische Queries
  if (keywords.length > 0) {
    queries.push(`${cmsName} ${keywords[0]} documentation`);
    if (keywords[1]) {
      queries.push(`${cmsName} ${keywords[1]} module plugin`);
    }
  }

  // Offizielle Docs Query
  if (docSite) {
    queries.push(`${requirement} ${docSite}`);
  }

  // Community/Marketplace Query
  queries.push(`${cmsName} ${requirement.split(' ')[0]} module extension marketplace`);

  return queries.slice(0, 3); // Max 3 Queries
}

/**
 * Analysiert Suchergebnisse auf Feature-Unterstützung
 */
function analyzeResearchResults(
  contents: Array<{ title: string; text: string; url: string }>,
  cmsName: string,
  requirement: string
): {
  score: number;
  confidence: number;
  supported: boolean;
  evidence: string[];
  notes: string;
} {
  const allContent = contents
    .map(c => `${c.title} ${c.text}`)
    .join(' ')
    .toLowerCase();

  // Positive Signale
  const positivePatterns = [
    { pattern: /built-in|native|out[- ]of[- ]the[- ]box/gi, weight: 3, label: 'Native Support' },
    { pattern: /fully support|comprehensive/gi, weight: 3, label: 'Full Support' },
    { pattern: /module|plugin|extension|add-?on/gi, weight: 2, label: 'Module Available' },
    { pattern: /documentation|guide|how[- ]to/gi, weight: 1, label: 'Documented' },
    { pattern: /enterprise|production|stable/gi, weight: 2, label: 'Production Ready' },
    { pattern: /easy|simple|straightforward/gi, weight: 1, label: 'Easy Setup' },
  ];

  // Negative Signale
  const negativePatterns = [
    { pattern: /not support|doesn'?t support|no support/gi, weight: 3, label: 'Not Supported' },
    { pattern: /deprecated|outdated|legacy|obsolete/gi, weight: 3, label: 'Deprecated' },
    { pattern: /workaround|hack|manual/gi, weight: 2, label: 'Workaround Needed' },
    { pattern: /limited|partial|basic only/gi, weight: 2, label: 'Limited Support' },
    { pattern: /third[- ]party|external service/gi, weight: 1, label: 'External Dependency' },
    { pattern: /complex|difficult|challenging/gi, weight: 1, label: 'Complex Setup' },
  ];

  let positiveScore = 0;
  let negativeScore = 0;
  const evidence: string[] = [];

  // Positive Matches
  for (const { pattern, weight, label } of positivePatterns) {
    const matches = allContent.match(pattern);
    if (matches && matches.length > 0) {
      positiveScore += weight * Math.min(matches.length, 3);
      evidence.push(`✓ ${label}`);
    }
  }

  // Negative Matches
  for (const { pattern, weight, label } of negativePatterns) {
    const matches = allContent.match(pattern);
    if (matches && matches.length > 0) {
      negativeScore += weight * Math.min(matches.length, 3);
      evidence.push(`✗ ${label}`);
    }
  }

  // Score berechnen
  const totalSignals = positiveScore + negativeScore;
  let score: number;
  let confidence: number;
  let supported: boolean;
  let notes: string;

  if (totalSignals === 0) {
    score = 50;
    confidence = 20;
    supported = false;
    notes = `Keine klaren Informationen zu "${requirement}" in ${cmsName} gefunden`;
  } else if (positiveScore > negativeScore * 1.5) {
    score = Math.min(95, 60 + positiveScore * 3);
    confidence = Math.min(90, 40 + totalSignals * 4);
    supported = true;
    notes = `${cmsName} unterstützt "${requirement}" gut`;
  } else if (negativeScore > positiveScore * 1.5) {
    score = Math.max(10, 40 - negativeScore * 3);
    confidence = Math.min(90, 40 + totalSignals * 4);
    supported = false;
    notes = `${cmsName} hat eingeschränkte Unterstützung für "${requirement}"`;
  } else {
    score = 50 + (positiveScore - negativeScore) * 3;
    confidence = Math.min(75, 35 + totalSignals * 3);
    supported = positiveScore >= negativeScore;
    notes = `${cmsName} bietet teilweise Unterstützung für "${requirement}"`;
  }

  return {
    score: Math.round(Math.max(0, Math.min(100, score))),
    confidence: Math.round(Math.max(0, Math.min(100, confidence))),
    supported,
    evidence: evidence.slice(0, 5),
    notes,
  };
}

/**
 * Requirement Research Agent
 *
 * Recherchiert ein einzelnes Requirement für ein spezifisches CMS.
 * Kann parallel für alle Requirement x CMS Kombinationen ausgeführt werden.
 */
export async function runRequirementResearchAgent(
  input: RequirementResearchInput,
  emit?: ResearchEventEmitter
): Promise<RequirementResearchResult> {
  const startTime = Date.now();
  const now = new Date().toISOString();

  emit?.({
    type: 'RESEARCH_START',
    data: {
      requirement: input.requirement,
      cmsName: input.cmsName,
      message: `Recherchiere "${input.requirement}" für ${input.cmsName}...`,
    },
  });

  try {
    // 1. Generate Search Queries
    const queries = generateResearchQueries(input.cmsName, input.requirement);

    emit?.({
      type: 'RESEARCH_PROGRESS',
      data: {
        requirement: input.requirement,
        cmsName: input.cmsName,
        message: `Web Search: ${queries.length} Queries...`,
        progress: 25,
      },
    });

    // 2. Execute Web Search
    const allResults: Array<{ title: string; text: string; url: string }> = [];
    const sources: string[] = [];

    for (const query of queries) {
      try {
        const searchResults = await searchAndContents(query, {
          numResults: 3,
          summary: true,
        });

        for (const result of searchResults.results) {
          allResults.push({
            title: result.title || '',
            text: result.text || '',
            url: result.url || '',
          });
          if (result.url) sources.push(result.url);
        }
      } catch (error) {
        console.warn(`[Requirement Agent] Query failed: "${query}"`, error);
      }
    }

    emit?.({
      type: 'RESEARCH_PROGRESS',
      data: {
        requirement: input.requirement,
        cmsName: input.cmsName,
        message: `${allResults.length} Ergebnisse gefunden, analysiere...`,
        progress: 60,
      },
    });

    // 3. Analyze Results
    let analysis: ReturnType<typeof analyzeResearchResults>;

    if (allResults.length === 0) {
      analysis = {
        score: 50,
        confidence: 15,
        supported: false,
        evidence: [],
        notes: `Keine Web-Ergebnisse für "${input.requirement}" in ${input.cmsName}`,
      };
    } else {
      analysis = analyzeResearchResults(allResults, input.cmsName, input.requirement);
    }

    // 4. Build Result
    const result: RequirementResearchResult = {
      requirement: input.requirement,
      cmsId: input.cmsId,
      cmsName: input.cmsName,
      score: analysis.score,
      confidence: analysis.confidence,
      notes: analysis.notes,
      supported: analysis.supported,
      evidence: analysis.evidence,
      sources: [...new Set(sources)].slice(0, 5),
      webSearchUsed: true,
      researchedAt: now,
      researchDurationMs: Date.now() - startTime,
    };

    emit?.({
      type: 'RESEARCH_PROGRESS',
      data: {
        requirement: input.requirement,
        cmsName: input.cmsName,
        message: `Score: ${result.score}/100, Confidence: ${result.confidence}%`,
        progress: 80,
      },
    });

    // 5. Save to Technology DB (optional)
    if (input.saveToDb) {
      await saveRequirementResearchToTechnology(input.cmsId, input.requirement, result);
    }

    emit?.({
      type: 'RESEARCH_COMPLETE',
      data: {
        requirement: input.requirement,
        cmsName: input.cmsName,
        message: `Abgeschlossen: ${result.supported ? 'Unterstützt' : 'Eingeschränkt'} (${result.score}/100)`,
        progress: 100,
        result,
      },
    });

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    emit?.({
      type: 'RESEARCH_ERROR',
      data: {
        requirement: input.requirement,
        cmsName: input.cmsName,
        message: `Fehler: ${errorMessage}`,
      },
    });

    // Return fallback result
    return {
      requirement: input.requirement,
      cmsId: input.cmsId,
      cmsName: input.cmsName,
      score: 50,
      confidence: 10,
      notes: `Research fehlgeschlagen: ${errorMessage}`,
      supported: false,
      evidence: [],
      sources: [],
      webSearchUsed: false,
      researchedAt: now,
      researchDurationMs: Date.now() - startTime,
    };
  }
}

/**
 * Speichert das Research-Ergebnis in der Technology-Datenbank
 */
async function saveRequirementResearchToTechnology(
  technologyId: string,
  requirement: string,
  research: RequirementResearchResult
): Promise<void> {
  try {
    // Load current features
    const tech = await db
      .select({ features: technologies.features })
      .from(technologies)
      .where(eq(technologies.id, technologyId))
      .limit(1);

    if (!tech.length) {
      console.warn(`[Requirement Agent] Technology ${technologyId} not found`);
      return;
    }

    // Parse or initialize features
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const currentFeatures: Record<string, RequirementResearchResult> = tech[0].features
      ? JSON.parse(tech[0].features)
      : {};

    // Add new feature research
    currentFeatures[requirement] = research;

    // Save to DB
    await db
      .update(technologies)
      .set({
        features: JSON.stringify(currentFeatures),
        lastResearchedAt: new Date(),
        researchStatus: 'completed',
      })
      .where(eq(technologies.id, technologyId));

    console.log(`[Requirement Agent] Saved "${requirement}" for ${research.cmsName}`);
  } catch (error) {
    console.error('[Requirement Agent] Error saving to DB:', error);
  }
}

/**
 * Lädt gecachte Research-Ergebnisse aus der Technology-DB
 */
export async function getCachedRequirementResearch(
  technologyId: string,
  requirement: string
): Promise<RequirementResearchResult | null> {
  try {
    const tech = await db
      .select({ features: technologies.features })
      .from(technologies)
      .where(eq(technologies.id, technologyId))
      .limit(1);

    if (!tech.length || !tech[0].features) return null;

    const features: Record<string, RequirementResearchResult> = JSON.parse(tech[0].features);
    return features[requirement] || null;
  } catch {
    return null;
  }
}
