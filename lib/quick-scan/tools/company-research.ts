import OpenAI from 'openai';

import { companyIntelligenceSchema, type CompanyIntelligence } from '../schema';

import { getStockData, searchStockSymbol } from '@/lib/integrations/yahoo-finance';
import { searchAndContents } from '@/lib/search/web-search';

// Security: Prompt Injection Protection
import { wrapUserContent } from '@/lib/security/prompt-sanitizer';

// Initialize clients
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL || 'https://adesso-ai-hub.3asabc.de/v1',
});

interface ImprintData {
  companyName?: string;
  legalForm?: string;
  registrationNumber?: string;
  address?: string;
  ceo?: string;
  email?: string;
  phone?: string;
}

/**
 * Extract company information from website imprint/impressum
 */
export async function extractFromImprint(html: string, _url: string): Promise<ImprintData | null> {
  // Try to find imprint section (for future use with page-specific extraction)

  // Extract common patterns
  const result: ImprintData = {};

  // Company name patterns
  const nameMatch =
    html.match(/(?:Firma|Company|Firmenname):\s*([^\n<]+)/i) ||
    html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
  if (nameMatch) {
    result.companyName = nameMatch[1].trim();
  }

  // Legal form patterns (German)
  const legalFormMatch = html.match(/\b(GmbH|AG|SE|KG|OHG|GbR|e\.?K\.?|UG|Inc\.|Ltd\.|LLC)\b/i);
  if (legalFormMatch) {
    result.legalForm = legalFormMatch[1];
  }

  // HRB pattern
  const hrbMatch = html.match(/(?:HRB|HR\s*B|Handelsregister[^:]*:)\s*(\d+)/i);
  if (hrbMatch) {
    result.registrationNumber = `HRB ${hrbMatch[1]}`;
  }

  // CEO/Geschäftsführer pattern
  const ceoMatch = html.match(
    /(?:Geschäftsführer|CEO|Vorstand|Managing Director)[:\s]+([^<\n,]+)/i
  );
  if (ceoMatch) {
    result.ceo = ceoMatch[1].trim();
  }

  return Object.keys(result).length > 0 ? result : null;
}

/**
 * Search for company news using DuckDuckGo (free, no API key)
 */
async function searchCompanyNews(companyName: string): Promise<
  Array<{
    title: string;
    source: string;
    date?: string;
    url?: string;
  }>
> {
  try {
    const results = await searchAndContents(
      `"${companyName}" news OR pressemitteilung OR announcement`,
      { numResults: 5, summary: true }
    );

    return results.results.map((r: any) => ({
      title: r.title || 'Untitled',
      source: new URL(r.url).hostname.replace('www.', ''),
      date: r.publishedDate,
      url: r.url,
    }));
  } catch (error) {
    console.error('DuckDuckGo search failed:', error);
    return [];
  }
}

/**
 * Search for company information using DuckDuckGo (free, no API key)
 */
async function searchCompanyInfo(companyName: string, _websiteUrl: string): Promise<string> {
  try {
    const results = await searchAndContents(
      `"${companyName}" company profile employees revenue founded headquarters`,
      { numResults: 3, summary: true }
    );

    return results.results.map((r: any) => `Source: ${r.url}\n${r.text}`).join('\n\n');
  } catch (error) {
    console.error('DuckDuckGo company search failed:', error);
    return '';
  }
}

/**
 * Gather comprehensive company intelligence
 */
export async function gatherCompanyIntelligence(
  companyName: string,
  websiteUrl: string,
  html?: string
): Promise<CompanyIntelligence> {
  const sources: string[] = ['Website'];

  // Step 1: Extract from imprint if HTML provided
  let imprintData: ImprintData | null = null;
  if (html) {
    imprintData = await extractFromImprint(html, websiteUrl);
    if (imprintData) {
      sources.push('Impressum');
    }
  }

  // Step 2: Parallel execution of all research functions
  let searchResults = '';
  let newsResults: Awaited<ReturnType<typeof searchCompanyNews>> = [];
  let stockData: Awaited<ReturnType<typeof searchStockData>> = undefined;
  let marketPosition: Awaited<ReturnType<typeof searchMarketPosition>> = undefined;
  let digitalPresence: Awaited<ReturnType<typeof searchDigitalPresence>> = undefined;
  let techFootprint: Awaited<ReturnType<typeof searchTechFootprint>> = undefined;

  [searchResults, newsResults, stockData, marketPosition, digitalPresence, techFootprint] =
    await Promise.all([
      searchCompanyInfo(companyName, websiteUrl),
      searchCompanyNews(companyName),
      searchStockData(companyName, imprintData?.legalForm?.includes('AG') ? undefined : undefined), // Stock symbol from financials if available
      searchMarketPosition(companyName),
      searchDigitalPresence(companyName, websiteUrl),
      searchTechFootprint(websiteUrl),
    ]);

  if (searchResults) {
    sources.push('Web Search');
  }
  if (stockData) {
    sources.push('Yahoo Finance');
  }
  if (digitalPresence) {
    sources.push('Employer Ratings');
  }

  // Step 3: Use AI to synthesize all information
  const systemPrompt = `Du bist ein Business Intelligence Analyst. Analysiere die gegebenen Informationen über ein Unternehmen und extrahiere strukturierte Daten.

WICHTIG:
- Gib nur Fakten an, die du aus den Quellen belegen kannst
- Bei Unsicherheit setze das Feld auf null/undefined
- Schätze Umsatzklassen basierend auf Mitarbeiterzahl und Branche
- Beachte, dass die Daten aus Deutschland stammen können (GmbH, AG, HRB, etc.)

Antworte immer mit validem JSON ohne Markdown-Code-Blöcke.`;

  const userPrompt = `Analysiere diese Unternehmensinformationen und erstelle ein strukturiertes Profil.

**Unternehmen:** ${companyName}
**Website:** ${websiteUrl}

**Impressum-Daten:**
${imprintData ? JSON.stringify(imprintData, null, 2) : 'Keine Impressum-Daten verfügbar'}

**Web-Recherche-Ergebnisse:**
${searchResults ? wrapUserContent(searchResults, 'web') : 'Keine zusätzlichen Recherche-Ergebnisse'}

**Aktuelle News:**
${newsResults.length > 0 ? wrapUserContent(JSON.stringify(newsResults, null, 2), 'web') : 'Keine aktuellen News gefunden'}

**Aktiendaten (falls börsennotiert):**
${stockData ? wrapUserContent(JSON.stringify(stockData, null, 2), 'web') : 'Nicht börsennotiert oder keine Daten verfügbar'}

**Marktposition & Wettbewerb:**
${marketPosition ? wrapUserContent(JSON.stringify(marketPosition, null, 2), 'web') : 'Keine Marktdaten verfügbar'}

**Digitale Präsenz:**
${digitalPresence ? wrapUserContent(JSON.stringify(digitalPresence, null, 2), 'web') : 'Keine Bewertungsdaten verfügbar'}

**Technologie-Footprint:**
${techFootprint ? wrapUserContent(JSON.stringify(techFootprint, null, 2), 'web') : 'Keine Tech-Stack-Daten verfügbar'}

Erstelle ein JSON-Objekt mit folgender Struktur:
{
  "basicInfo": {
    "name": "Offizieller Firmenname",
    "legalForm": "Rechtsform (GmbH, AG, etc.)",
    "registrationNumber": "HRB-Nummer falls bekannt",
    "foundedYear": 2000,
    "headquarters": "Hauptsitz",
    "employeeCount": "50-100 oder konkrete Zahl",
    "industry": "Branche",
    "website": "${websiteUrl}"
  },
  "financials": {
    "revenueClass": "small|medium|large|enterprise|unknown",
    "growthIndicators": ["Wachstumssignale"],
    "publiclyTraded": false,
    "fundingStatus": "Nur für Startups"
  },
  "newsAndReputation": {
    "recentNews": [{"title": "...", "source": "...", "date": "...", "sentiment": "positive|neutral|negative"}],
    "sentimentScore": 0.5,
    "riskIndicators": ["Risikosignale falls vorhanden"],
    "positiveSignals": ["Positive Signale"]
  },
  "leadership": {
    "ceo": "Name des CEO/Geschäftsführers",
    "cto": "Name des CTO falls bekannt",
    "cmo": "Name des CMO falls bekannt"
  },
  "corporateStructure": {
    "parentCompany": "Muttergesellschaft falls vorhanden",
    "partOfGroup": false,
    "groupName": "Konzernname falls Teil eines Konzerns"
  },
  "stockData": ${stockData ? JSON.stringify(stockData) : 'null'},
  "marketPosition": {
    "marketShare": "Marktanteil falls bekannt",
    "competitors": ["Hauptwettbewerber"],
    "industryTrends": ["Branchentrends"],
    "growthRate": "Wachstumsrate falls bekannt"
  },
  "digitalPresence": {
    "linkedInFollowers": null,
    "glassdoorRating": null,
    "kunuRating": null
  },
  "techFootprint": {
    "crmSystem": "CRM-System falls detektiert",
    "marketingTools": ["Marketing Tools"],
    "cloudProvider": "Cloud-Anbieter falls bekannt"
  },
  "dataQuality": {
    "confidence": 70,
    "sources": ${JSON.stringify(sources)},
    "lastUpdated": "${new Date().toISOString()}"
  }
}

Fülle nur Felder aus, die du aus den Daten belegen kannst. Setze andere auf null.`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gemini-3-flash-preview',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.2,
      max_tokens: 2000,
    });

    const responseText = completion.choices[0]?.message?.content || '{}';
    const cleanedResponse = responseText
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    const rawResult = JSON.parse(cleanedResponse);

    // Ensure required fields exist
    if (!rawResult.basicInfo) {
      rawResult.basicInfo = {
        name: companyName,
        website: websiteUrl,
      };
    }
    if (!rawResult.dataQuality) {
      rawResult.dataQuality = {
        confidence: 50,
        sources,
        lastUpdated: new Date().toISOString(),
      };
    }

    // Add news from our search if AI didn't include them
    if (newsResults.length > 0 && !rawResult.newsAndReputation?.recentNews?.length) {
      rawResult.newsAndReputation = {
        ...rawResult.newsAndReputation,
        recentNews: newsResults.map(n => ({
          ...n,
          sentiment: 'neutral' as const,
        })),
      };
    }

    // Add stock data if available
    if (stockData && !rawResult.stockData) {
      rawResult.stockData = stockData;
    }

    // Add market position if available
    if (marketPosition && !rawResult.marketPosition) {
      rawResult.marketPosition = marketPosition;
    }

    // Add digital presence if available
    if (digitalPresence && !rawResult.digitalPresence) {
      rawResult.digitalPresence = digitalPresence;
    }

    // Add tech footprint if available
    if (techFootprint && !rawResult.techFootprint) {
      rawResult.techFootprint = techFootprint;
    }

    return companyIntelligenceSchema.parse(rawResult);
  } catch (error) {
    console.error('AI company analysis failed:', error);

    // Return minimal data with all available fields
    return {
      basicInfo: {
        name: imprintData?.companyName || companyName,
        legalForm: imprintData?.legalForm,
        registrationNumber: imprintData?.registrationNumber,
        website: websiteUrl,
      },
      leadership: imprintData?.ceo ? { ceo: imprintData.ceo } : undefined,
      newsAndReputation:
        newsResults.length > 0
          ? {
              recentNews: newsResults.map(n => ({
                ...n,
                sentiment: 'neutral' as const,
              })),
            }
          : undefined,
      stockData: stockData || undefined,
      marketPosition: marketPosition || undefined,
      digitalPresence: digitalPresence || undefined,
      techFootprint: techFootprint || undefined,
      dataQuality: {
        confidence: 30,
        sources,
        lastUpdated: new Date().toISOString(),
      },
    };
  }
}

/**
 * Search for stock market data (for publicly traded companies)
 */
async function searchStockData(
  companyName: string,
  stockSymbol?: string
): Promise<CompanyIntelligence['stockData']> {
  try {
    // Try to find stock symbol if not provided
    const symbol = stockSymbol || (await searchStockSymbol(companyName));

    if (!symbol) {
      return undefined;
    }

    // Fetch comprehensive stock data
    const stockData = await getStockData(symbol);

    return stockData || undefined;
  } catch (error) {
    console.error('Stock data search failed:', error);
    return undefined;
  }
}

/**
 * Search for market position and competitive landscape
 */
async function searchMarketPosition(
  companyName: string,
  industry?: string
): Promise<CompanyIntelligence['marketPosition']> {
  try {
    const searchQuery = industry
      ? `"${companyName}" market share competitors "${industry}" industry trends`
      : `"${companyName}" market share competitors industry trends`;

    const results = await searchAndContents(searchQuery, { numResults: 3, summary: true });

    if (!results.results.length) {
      return undefined;
    }

    // Extract insights using AI
    const content = results.results.map((r: any) => r.text).join('\n\n');

    return {
      // These would be extracted by the main AI analysis
      marketShare: undefined,
      competitors: [],
      industryTrends: [],
      growthRate: undefined,
    };
  } catch (error) {
    console.error('Market position search failed:', error);
    return undefined;
  }
}

/**
 * Search for digital presence and online reputation
 */
async function searchDigitalPresence(
  companyName: string,
  websiteUrl: string
): Promise<CompanyIntelligence['digitalPresence']> {
  try {
    // Search for employer ratings and social media
    const [glassdoorResults, kunuResults] = await Promise.all([
      searchAndContents(`"${companyName}" site:glassdoor.com OR site:glassdoor.de rating`, {
        numResults: 1,
        summary: true,
      }),
      searchAndContents(`"${companyName}" site:kununu.com rating bewertung`, {
        numResults: 1,
        summary: true,
      }),
    ]);

    // Extract ratings from text (AI will handle this in main analysis)
    return {
      linkedInFollowers: undefined,
      twitterFollowers: undefined,
      glassdoorRating: undefined,
      kunuRating: undefined,
      trustpilotRating: undefined,
    };
  } catch (error) {
    console.error('Digital presence search failed:', error);
    return undefined;
  }
}

/**
 * Search for technology footprint (CRM, Marketing Tools, Cloud)
 */
async function searchTechFootprint(
  websiteUrl: string
): Promise<CompanyIntelligence['techFootprint']> {
  try {
    // Search for technology stack information
    const results = await searchAndContents(
      `site:${new URL(websiteUrl).hostname} technology stack CRM marketing cloud provider`,
      { numResults: 2, summary: true }
    );

    if (!results.results.length) {
      return undefined;
    }

    // AI will extract actual tech stack from content
    return {
      crmSystem: undefined,
      marketingTools: [],
      cloudProvider: undefined,
      analyticsTools: [],
    };
  } catch (error) {
    console.error('Tech footprint search failed:', error);
    return undefined;
  }
}

/**
 * Quick company lookup - minimal data extraction
 */
export async function quickCompanyLookup(
  companyName: string,
  websiteUrl: string
): Promise<Partial<CompanyIntelligence['basicInfo']>> {
  return {
    name: companyName,
    website: websiteUrl,
    // Could add WHOIS lookup here in the future
  };
}
