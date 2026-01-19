import OpenAI from 'openai';
import { companyIntelligenceSchema, type CompanyIntelligence } from '../schema';
import { searchAndContents } from '@/lib/search/web-search';

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
  const nameMatch = html.match(/(?:Firma|Company|Firmenname):\s*([^\n<]+)/i) ||
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
  const ceoMatch = html.match(/(?:Geschäftsführer|CEO|Vorstand|Managing Director)[:\s]+([^<\n,]+)/i);
  if (ceoMatch) {
    result.ceo = ceoMatch[1].trim();
  }

  return Object.keys(result).length > 0 ? result : null;
}

/**
 * Search for company news using DuckDuckGo (free, no API key)
 */
async function searchCompanyNews(companyName: string): Promise<Array<{
  title: string;
  source: string;
  date?: string;
  url?: string;
}>> {
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

    return results.results
      .map((r: any) => `Source: ${r.url}\n${r.text}`)
      .join('\n\n');
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

  // Step 2: Search for company info and news (DuckDuckGo - always available)
  let searchResults = '';
  let newsResults: Awaited<ReturnType<typeof searchCompanyNews>> = [];

  [searchResults, newsResults] = await Promise.all([
    searchCompanyInfo(companyName, websiteUrl),
    searchCompanyNews(companyName),
  ]);

  if (searchResults) {
    sources.push('Web Search');
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
${searchResults || 'Keine zusätzlichen Recherche-Ergebnisse'}

**Aktuelle News:**
${newsResults.length > 0 ? JSON.stringify(newsResults, null, 2) : 'Keine aktuellen News gefunden'}

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
  "dataQuality": {
    "confidence": 70,
    "sources": ${JSON.stringify(sources)},
    "lastUpdated": "${new Date().toISOString()}"
  }
}

Fülle nur Felder aus, die du aus den Daten belegen kannst. Setze andere auf null.`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'claude-haiku-4.5',
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
        recentNews: newsResults.map((n) => ({
          ...n,
          sentiment: 'neutral' as const,
        })),
      };
    }

    return companyIntelligenceSchema.parse(rawResult);
  } catch (error) {
    console.error('AI company analysis failed:', error);

    // Return minimal data
    return {
      basicInfo: {
        name: imprintData?.companyName || companyName,
        legalForm: imprintData?.legalForm,
        registrationNumber: imprintData?.registrationNumber,
        website: websiteUrl,
      },
      leadership: imprintData?.ceo ? { ceo: imprintData.ceo } : undefined,
      newsAndReputation: newsResults.length > 0 ? {
        recentNews: newsResults.map((n) => ({
          ...n,
          sentiment: 'neutral' as const,
        })),
      } : undefined,
      dataQuality: {
        confidence: 30,
        sources,
        lastUpdated: new Date().toISOString(),
      },
    };
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
