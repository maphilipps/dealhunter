import { chromium, type Browser } from 'playwright';
import { generateStructuredOutput } from '@/lib/ai/config';
import { z } from 'zod';
import type { ContentTypeDistribution } from '../schema';

/**
 * Content Classifier Tool
 * AI-powered classification of page types for CMS migration planning
 */

const pageTypeEnum = z.enum([
  'homepage', 'product', 'service', 'blog', 'news', 'event',
  'job', 'person', 'contact', 'about', 'landing', 'category',
  'search', 'legal', 'faq', 'download', 'form', 'custom'
]);

const pageClassificationSchema = z.object({
  type: pageTypeEnum,
  confidence: z.number().min(0).max(100),
  reasoning: z.string(),
  suggestedContentType: z.string().optional(),
  customFields: z.array(z.string()).optional(),
});

type PageClassification = z.infer<typeof pageClassificationSchema>;

interface ClassificationOptions {
  sampleSize?: number;
  timeout?: number;
}

/**
 * Sample URLs from a list for classification
 */
function sampleUrls(urls: string[], sampleSize: number): string[] {
  if (urls.length <= sampleSize) {
    return urls;
  }

  // Ensure diverse sampling by path patterns
  const pathGroups = new Map<string, string[]>();

  urls.forEach(url => {
    try {
      const urlObj = new URL(url);
      const firstSegment = urlObj.pathname.split('/').filter(Boolean)[0] || 'root';
      if (!pathGroups.has(firstSegment)) {
        pathGroups.set(firstSegment, []);
      }
      pathGroups.get(firstSegment)!.push(url);
    } catch {
      // Skip invalid URLs
    }
  });

  const sampled: string[] = [];
  const groups = Array.from(pathGroups.values());

  // Round-robin sampling from each group
  let groupIndex = 0;
  while (sampled.length < sampleSize && groups.some(g => g.length > 0)) {
    const group = groups[groupIndex % groups.length];
    if (group.length > 0) {
      // Random pick from group
      const idx = Math.floor(Math.random() * group.length);
      sampled.push(group.splice(idx, 1)[0]);
    }
    groupIndex++;
  }

  return sampled;
}

/**
 * Fetch page content for classification
 */
async function fetchPageContent(
  browser: Browser,
  url: string,
  timeout: number
): Promise<{ html: string; title: string; url: string } | null> {
  const page = await browser.newPage();

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout });

    const content = await page.evaluate(() => {
      // Get main content area if possible
      const mainContent = document.querySelector('main') ||
                          document.querySelector('[role="main"]') ||
                          document.querySelector('article') ||
                          document.body;

      return {
        html: mainContent.innerHTML.slice(0, 10000), // Limit content size
        title: document.title,
        url: window.location.href,
      };
    });

    await page.close();
    return content;
  } catch (error) {
    await page.close();
    console.error(`Failed to fetch ${url}:`, error);
    return null;
  }
}

/**
 * Classify a single page using AI
 */
async function classifyPage(
  content: { html: string; title: string; url: string }
): Promise<PageClassification> {
  const systemPrompt = `Du bist ein CMS-Experte, der Webseiten-Typen für CMS-Migrationen klassifiziert.

Klassifiziere die Seite in eine der folgenden Kategorien:
- homepage: Startseite
- product: Produktseite (E-Commerce oder Produkt-Detailseite)
- service: Dienstleistungsseite
- blog: Blog-Artikel
- news: Nachrichten/Pressemitteilungen
- event: Veranstaltungsseite
- job: Stellenanzeige
- person: Personen-/Team-Profil
- contact: Kontaktseite
- about: Über uns / Unternehmensinformation
- landing: Landing Page (Marketing)
- category: Kategorieseite/Übersichtsseite
- search: Suchseite/-ergebnisse
- legal: Rechtliche Seite (Impressum, Datenschutz, AGB)
- faq: FAQ-Seite
- download: Download-Bereich
- form: Formularseite (Anfrage, Bewerbung, etc.)
- custom: Benutzerdefiniert (nicht standardisierbar)

Antworte mit JSON.`;

  const userPrompt = `Klassifiziere diese Webseite:

URL: ${content.url}
Titel: ${content.title}

HTML-Inhalt (gekürzt):
${content.html.slice(0, 5000)}

Antworte mit:
- type: Der Seitentyp
- confidence: Wie sicher bist du (0-100)
- reasoning: Kurze Begründung
- suggestedContentType: Vorgeschlagener CMS Content-Type Name
- customFields: Benötigte benutzerdefinierte Felder (Array)`;

  try {
    return generateStructuredOutput({
      schema: pageClassificationSchema,
      system: systemPrompt,
      prompt: userPrompt,
    });
  } catch (error) {
    console.error('Classification failed:', error);
    return {
      type: 'custom' as const,
      confidence: 0,
      reasoning: 'Classification failed',
    };
  }
}

/**
 * Classify content types from a list of URLs
 */
export async function classifyContentTypes(
  urls: string[],
  options: ClassificationOptions = {}
): Promise<ContentTypeDistribution> {
  const { sampleSize = 15, timeout = 15000 } = options;

  let browser: Browser | null = null;

  try {
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    // Sample URLs
    const sampledUrls = sampleUrls(urls, sampleSize);

    // Fetch and classify pages
    const classifications: { url: string; classification: PageClassification }[] = [];

    for (const url of sampledUrls) {
      const content = await fetchPageContent(browser, url, timeout);
      if (content) {
        const classification = await classifyPage(content);
        classifications.push({ url, classification });
      }
    }

    await browser.close();

    // Aggregate results
    const typeCounts = new Map<string, { count: number; examples: string[] }>();

    for (const { url, classification } of classifications) {
      const type = classification.type;
      if (!typeCounts.has(type)) {
        typeCounts.set(type, { count: 0, examples: [] });
      }
      const entry = typeCounts.get(type)!;
      entry.count++;
      if (entry.examples.length < 3) {
        entry.examples.push(url);
      }
    }

    const totalClassified = classifications.length;
    const distribution = Array.from(typeCounts.entries()).map(([type, data]) => ({
      type: type as ContentTypeDistribution['distribution'][0]['type'],
      count: data.count,
      percentage: Math.round((data.count / totalClassified) * 100),
      examples: data.examples,
    })).sort((a, b) => b.count - a.count);

    // Calculate complexity
    const uniqueTypes = distribution.length;
    const complexity: ContentTypeDistribution['complexity'] =
      uniqueTypes <= 3 ? 'simple' :
      uniqueTypes <= 6 ? 'moderate' :
      uniqueTypes <= 10 ? 'complex' : 'very_complex';

    // Estimate custom fields needed
    const customFieldsNeeded = Math.round(uniqueTypes * 2.5);

    // Generate recommendations
    const recommendations: string[] = [];
    if (uniqueTypes > 8) {
      recommendations.push('Hohe Anzahl an Content-Typen - Content-Audit vor Migration empfohlen');
    }
    if (distribution.some(d => d.type === 'custom' && d.percentage > 20)) {
      recommendations.push('Viele benutzerdefinierte Seiten - detaillierte Analyse erforderlich');
    }
    if (distribution.some(d => d.type === 'blog') && distribution.some(d => d.type === 'news')) {
      recommendations.push('Blog und News vorhanden - Konsolidierung zu einem Content-Typ prüfen');
    }

    return {
      pagesAnalyzed: totalClassified,
      distribution,
      complexity,
      estimatedContentTypes: uniqueTypes,
      customFieldsNeeded,
      recommendations,
    };
  } catch (error) {
    if (browser) {
      await browser.close();
    }
    throw error;
  }
}

/**
 * Quick content type estimation from URL patterns (no AI)
 */
export function estimateContentTypesFromUrls(urls: string[]): {
  estimated: Record<string, number>;
  complexity: 'simple' | 'moderate' | 'complex' | 'very_complex';
} {
  const typePatterns: Record<string, RegExp[]> = {
    blog: [/blog/i, /artikel/i, /article/i, /beitrag/i, /post/i],
    news: [/news/i, /aktuelles/i, /presse/i, /press/i, /mitteilung/i],
    product: [/product/i, /produkt/i, /shop/i, /artikel/i],
    service: [/service/i, /leistung/i, /angebot/i],
    event: [/event/i, /veranstaltung/i, /termin/i, /seminar/i, /workshop/i],
    job: [/job/i, /karriere/i, /career/i, /stelle/i, /bewerbung/i],
    person: [/team/i, /mitarbeiter/i, /employee/i, /person/i, /author/i],
    contact: [/kontakt/i, /contact/i, /anfahrt/i],
    about: [/ueber-uns/i, /about/i, /unternehmen/i, /company/i, /wir/i],
    legal: [/impressum/i, /datenschutz/i, /privacy/i, /agb/i, /terms/i],
    faq: [/faq/i, /fragen/i, /hilfe/i, /help/i],
    category: [/kategorie/i, /category/i, /rubrik/i, /bereich/i],
  };

  const counts: Record<string, number> = {};

  for (const url of urls) {
    let matched = false;
    for (const [type, patterns] of Object.entries(typePatterns)) {
      if (patterns.some(p => p.test(url))) {
        counts[type] = (counts[type] || 0) + 1;
        matched = true;
        break;
      }
    }
    if (!matched) {
      counts['other'] = (counts['other'] || 0) + 1;
    }
  }

  const uniqueTypes = Object.keys(counts).length;
  const complexity: 'simple' | 'moderate' | 'complex' | 'very_complex' =
    uniqueTypes <= 3 ? 'simple' :
    uniqueTypes <= 6 ? 'moderate' :
    uniqueTypes <= 10 ? 'complex' : 'very_complex';

  return { estimated: counts, complexity };
}
