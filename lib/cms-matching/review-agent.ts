/**
 * Feature Research Review Agent
 *
 * Überprüft und verbessert die automatisch recherchierten Feature-Ergebnisse.
 * Nutzt AI um Plausibilität zu prüfen, Widersprüche zu erkennen und
 * bei Bedarf gezielte Nachrecherche durchzuführen.
 */

import { z } from 'zod';

import { generateStructuredOutput } from '@/lib/ai/config';
import { searchAndContents } from '@/lib/search/web-search';

// Schema für ein einzelnes Feature-Review
const featureReviewSchema = z.object({
  featureName: z.string(),
  originalScore: z.number(),
  reviewedScore: z.number(),
  originalSupportType: z.string().optional(),
  reviewedSupportType: z.enum([
    'native',
    'module',
    'contrib',
    'extension',
    'third-party',
    'custom',
    'unknown',
  ]),
  reviewedModuleName: z.string().optional(),
  confidence: z.number().min(0).max(100),
  issues: z.array(z.string()).describe('Gefundene Probleme mit dem Original-Ergebnis'),
  corrections: z.array(z.string()).describe('Durchgeführte Korrekturen'),
  reasoning: z.string().describe('Begründung für die Bewertung'),
  needsManualReview: z.boolean().describe('True wenn manuelle Überprüfung empfohlen'),
  sources: z.array(z.string()).describe('Verwendete Quellen für die Überprüfung'),
});

// Schema für das Gesamt-Review
const reviewResultSchema = z.object({
  technologyName: z.string(),
  reviewedAt: z.string(),
  totalFeatures: z.number(),
  featuresReviewed: z.number(),
  featuresImproved: z.number(),
  featuresFlagged: z.number(),
  overallConfidence: z.number(),
  summary: z.string(),
  features: z.array(featureReviewSchema),
});

export type FeatureReview = z.infer<typeof featureReviewSchema>;
export type ReviewResult = z.infer<typeof reviewResultSchema>;

export interface FeatureData {
  score: number;
  confidence: number;
  notes: string;
  supported?: boolean;
  researchedAt?: string;
  supportType?: string;
  moduleName?: string;
  sourceUrls?: string[];
  reasoning?: string;
  // Fields added during review
  reviewedAt?: string;
  reviewIssues?: string[];
  reviewCorrections?: string[];
}

interface ReviewInput {
  technologyName: string;
  technologyId: string;
  features: Record<string, FeatureData>;
}

/**
 * Bekannte korrekte Modul-Mappings für Validierung
 */
const CORRECT_MODULES: Record<string, Record<string, string>> = {
  drupal: {
    formulare: 'webform',
    forms: 'webform',
    formular: 'webform',
    mehrsprachigkeit: 'content_translation',
    multilingual: 'content_translation',
    'e-commerce': 'commerce',
    shop: 'commerce',
    suche: 'search_api',
    search: 'search_api',
    video: 'media',
    media: 'media',
    workflow: 'workflows',
    seo: 'metatag',
    graphql: 'graphql',
    paragraphs: 'paragraphs',
  },
  wordpress: {
    formulare: 'contact-form-7',
    forms: 'contact-form-7',
    'e-commerce': 'woocommerce',
    shop: 'woocommerce',
    seo: 'yoast-seo',
    mehrsprachigkeit: 'wpml',
  },
};

/**
 * Führt eine gezielte Nachrecherche für ein Feature durch
 */
async function targetedResearch(
  cmsName: string,
  featureName: string,
  currentModuleName?: string
): Promise<{ content: string; urls: string[] }> {
  const queries = [
    `${cmsName} ${featureName} official module documentation`,
    `${cmsName} ${featureName} best practice recommended module`,
  ];

  let allContent = '';
  const urls: string[] = [];

  for (const query of queries) {
    try {
      const results = await searchAndContents(query, { numResults: 2 });
      for (const r of results.results) {
        allContent += `${r.title || ''} ${r.text || ''} `;
        if (r.url && !urls.includes(r.url)) {
          urls.push(r.url);
        }
      }
    } catch (error) {
      console.warn(`[Review Agent] Search failed for: ${query}`, error);
    }
  }

  return { content: allContent, urls };
}

/**
 * Review-Agent: Überprüft recherchierte Features auf Plausibilität
 */
export async function reviewFeatureResearch(input: ReviewInput): Promise<ReviewResult> {
  const { technologyName, features } = input;
  const lowerCms = technologyName.toLowerCase();
  const correctModules = CORRECT_MODULES[lowerCms] || {};

  const reviewedFeatures: FeatureReview[] = [];
  let featuresImproved = 0;
  let featuresFlagged = 0;

  for (const [featureName, data] of Object.entries(features)) {
    const lowerFeature = featureName.toLowerCase();
    const issues: string[] = [];
    const corrections: string[] = [];
    const sources: string[] = [...(data.sourceUrls || [])];

    const reviewedScore = data.score;
    let reviewedSupportType = (data.supportType ||
      'unknown') as FeatureReview['reviewedSupportType'];
    let reviewedModuleName = data.moduleName;
    let needsManualReview = false;

    // 1. Prüfe auf bekannte falsche Modul-Zuordnungen
    const expectedModule = correctModules[lowerFeature];
    if (expectedModule && data.moduleName && data.moduleName !== expectedModule) {
      issues.push(`Falsches Modul erkannt: "${data.moduleName}" statt "${expectedModule}"`);
      corrections.push(`Modul korrigiert zu "${expectedModule}"`);
      reviewedModuleName = expectedModule;
      featuresImproved++;
    }

    // 2. Prüfe auf verdächtig kurze oder generische Modul-Namen
    if (
      data.moduleName &&
      (data.moduleName.length <= 2 || ['no', 'de', 'en', 'the', 'and'].includes(data.moduleName))
    ) {
      issues.push(`Verdächtiger Modul-Name: "${data.moduleName}" (zu kurz/generisch)`);

      // Nachrecherche durchführen
      const research = await targetedResearch(technologyName, featureName, data.moduleName);
      if (research.content) {
        sources.push(...research.urls);

        // Versuche korrektes Modul aus Nachrecherche zu extrahieren
        if (expectedModule) {
          reviewedModuleName = expectedModule;
          corrections.push(`Modul durch Nachrecherche korrigiert zu "${expectedModule}"`);
        } else {
          reviewedModuleName = undefined;
          reviewedSupportType = 'unknown';
          corrections.push('Modul-Name entfernt (nicht verifizierbar)');
          needsManualReview = true;
        }
        featuresImproved++;
      }
    }

    // 3. Prüfe auf niedrige Confidence
    if (data.confidence < 40) {
      issues.push(`Niedrige Confidence: ${data.confidence}%`);
      needsManualReview = true;
      featuresFlagged++;
    }

    // 4. Prüfe auf widersprüchliche Signale
    if (data.score === 50 && data.supportType !== 'unknown') {
      issues.push('Widerspruch: Neutraler Score (50%) aber Support-Typ erkannt');
      needsManualReview = true;
    }

    // 5. Prüfe auf fehlende Quellen bei hohem Score
    if (data.score >= 80 && (!data.sourceUrls || data.sourceUrls.length === 0)) {
      issues.push('Hoher Score ohne Quellenangaben');
      needsManualReview = true;
      featuresFlagged++;
    }

    // Berechne neue Confidence basierend auf Review
    let reviewedConfidence = data.confidence;
    if (issues.length > 0) {
      reviewedConfidence = Math.max(20, data.confidence - issues.length * 10);
    }
    if (corrections.length > 0) {
      reviewedConfidence = Math.min(90, reviewedConfidence + corrections.length * 5);
    }

    reviewedFeatures.push({
      featureName,
      originalScore: data.score,
      reviewedScore,
      originalSupportType: data.supportType,
      reviewedSupportType,
      reviewedModuleName,
      confidence: reviewedConfidence,
      issues,
      corrections,
      reasoning:
        issues.length > 0
          ? `${issues.length} Problem(e) gefunden, ${corrections.length} Korrektur(en) durchgeführt`
          : 'Keine Probleme gefunden',
      needsManualReview,
      sources,
    });
  }

  // Gesamt-Confidence berechnen
  const overallConfidence =
    reviewedFeatures.length > 0
      ? Math.round(
          reviewedFeatures.reduce((sum, f) => sum + f.confidence, 0) / reviewedFeatures.length
        )
      : 0;

  return {
    technologyName,
    reviewedAt: new Date().toISOString(),
    totalFeatures: Object.keys(features).length,
    featuresReviewed: reviewedFeatures.length,
    featuresImproved,
    featuresFlagged,
    overallConfidence,
    summary: `${featuresImproved} von ${reviewedFeatures.length} Features verbessert, ${featuresFlagged} zur manuellen Überprüfung markiert`,
    features: reviewedFeatures,
  };
}

/**
 * AI-gestützter Deep Review für einzelnes Feature
 * Nutzt LLM für komplexere Analyse
 */
export async function deepReviewFeature(
  technologyName: string,
  featureName: string,
  currentData: FeatureData
): Promise<FeatureReview> {
  // Erst Web-Recherche für aktuelle Infos
  const research = await targetedResearch(technologyName, featureName);

  const prompt = `Du bist ein CMS-Experte. Überprüfe die folgende Feature-Recherche für ${technologyName}:

Feature: ${featureName}
Aktueller Score: ${currentData.score}%
Aktueller Support-Typ: ${currentData.supportType || 'unknown'}
Aktuelles Modul: ${currentData.moduleName || 'keins'}
Aktuelle Notizen: ${currentData.notes || 'keine'}
Aktuelle Begründung: ${currentData.reasoning || 'keine'}

Zusätzliche Recherche-Ergebnisse:
${research.content.slice(0, 2000)}

Aufgaben:
1. Prüfe ob das erkannte Modul korrekt ist
2. Prüfe ob der Score plausibel ist
3. Identifiziere Probleme mit der aktuellen Bewertung
4. Gib eine korrigierte Bewertung ab

Wichtig für ${technologyName}:
- Bei Drupal: Unterscheide Core-Module (native) von Contrib-Modulen
- Bekannte Drupal-Module: webform (Formulare), commerce (Shop), search_api (Suche), media (Medien)
- Bei WordPress: Unterscheide Core von Plugins
- Bekannte WordPress-Plugins: WooCommerce, Contact Form 7, Yoast SEO, WPML`;

  try {
    const result = await generateStructuredOutput({
      schema: featureReviewSchema,
      system: 'Du bist ein CMS-Experte der Feature-Recherchen überprüft und korrigiert.',
      prompt: prompt,
    });

    return {
      ...result,
      sources: research.urls,
    };
  } catch (error) {
    console.error('[Review Agent] Deep review failed:', error);

    // Fallback: Einfaches Review ohne AI
    return {
      featureName,
      originalScore: currentData.score,
      reviewedScore: currentData.score,
      originalSupportType: currentData.supportType,
      reviewedSupportType: (currentData.supportType ||
        'unknown') as FeatureReview['reviewedSupportType'],
      reviewedModuleName: currentData.moduleName,
      confidence: currentData.confidence,
      issues: ['AI-Review fehlgeschlagen'],
      corrections: [],
      reasoning: 'Automatisches Review nicht möglich',
      needsManualReview: true,
      sources: research.urls,
    };
  }
}
