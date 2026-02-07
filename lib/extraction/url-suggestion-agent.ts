import { generateText } from 'ai';
import { z } from 'zod';

import { createIntelligentTools } from '../agent-tools/intelligent-tools';
import { modelNames } from '../ai/config';
import { getProviderForSlot } from '../ai/providers';

/**
 * Schema for URL suggestions
 */
// Valid URL suggestion types
const validUrlTypes = [
  'primary',
  'product',
  'regional',
  'related',
  'corporate',
  'main',
  'other',
] as const;

export const urlSuggestionSchema = z.object({
  suggestions: z.array(
    z.object({
      url: z.string().describe('Suggested website URL'),
      type: z.enum(validUrlTypes).describe('Type of website'),
      description: z.string().describe('Why this URL is relevant'),
      confidence: z.number().min(0).max(100).describe('Confidence in this suggestion'),
    })
  ),
  reasoning: z.string().describe('Overall reasoning for suggestions'),
});

// Map unknown types to valid types
function normalizeUrlType(type: string): (typeof validUrlTypes)[number] {
  const normalized = type?.toLowerCase()?.trim() || 'other';
  if (validUrlTypes.includes(normalized as (typeof validUrlTypes)[number])) {
    return normalized as (typeof validUrlTypes)[number];
  }
  // Map common variants
  if (['website', 'homepage', 'official', 'company'].includes(normalized)) return 'primary';
  if (['shop', 'store', 'ecommerce'].includes(normalized)) return 'product';
  if (['local', 'country', 'region'].includes(normalized)) return 'regional';
  if (['partner', 'subsidiary', 'affiliate'].includes(normalized)) return 'related';
  return 'other';
}

export type UrlSuggestion = z.infer<typeof urlSuggestionSchema>;

export interface UrlSuggestionInput {
  customerName: string;
  industry?: string;
  projectDescription?: string;
  technologies?: string[];
  useWebSearch?: boolean; // Web Search für echte URL-Suche nutzen
}

/**
 * AI Agent for suggesting website URLs when none are found in the document
 * UPGRADED: Uses EXA Web Search to find actual URLs, then validates with AI
 */
export async function suggestWebsiteUrls(input: UrlSuggestionInput): Promise<UrlSuggestion> {
  try {
    // === PHASE 1: Web Search for actual URLs ===
    let webSearchResults: Array<{ url: string; title: string; snippet: string }> = [];

    // Default to using web search unless explicitly disabled
    const shouldUseWebSearch = input.useWebSearch !== false;

    if (shouldUseWebSearch) {
      const intelligentTools = createIntelligentTools({ agentName: 'URL Researcher' });

      try {
        // Search for company website
        const searchQuery = input.industry
          ? `"${input.customerName}" ${input.industry} official website`
          : `"${input.customerName}" official website homepage`;

        console.warn(`[URL Suggestion] Searching: "${searchQuery}"`);
        const searchResults = await intelligentTools.webSearch(searchQuery, 5);

        if (searchResults && searchResults.length > 0) {
          webSearchResults = searchResults
            .filter(r => r.url && r.title)
            .map(r => ({
              url: r.url,
              title: r.title || 'Untitled',
              snippet: r.snippet || '',
            }));
          console.warn(`[URL Suggestion] Found ${webSearchResults.length} URLs via Web Search`);
        } else {
          console.warn('[URL Suggestion] Web Search returned no results');
        }
      } catch (error) {
        console.error('[URL Suggestion] Web Search failed:', error);
        // Continue with AI-only suggestions
      }
    }

    // === PHASE 2: AI Validation & Ranking ===
    // Build context string from all available information
    const contextParts: string[] = [];
    contextParts.push(`Company/Organization: ${input.customerName}`);
    if (input.industry) contextParts.push(`Industry: ${input.industry}`);
    if (input.projectDescription) {
      const shortDesc = input.projectDescription.substring(0, 500);
      contextParts.push(`Project Context: ${shortDesc}`);
    }
    if (input.technologies && input.technologies.length > 0) {
      contextParts.push(`Technologies mentioned: ${input.technologies.join(', ')}`);
    }

    // Add web search results to context
    let webSearchContext = '';
    if (webSearchResults.length > 0) {
      webSearchContext = `\n\nWEB SEARCH RESULTS (found via EXA):\n${webSearchResults
        .slice(0, 5)
        .map(
          (r, i) =>
            `${i + 1}. ${r.url}\n   Title: ${r.title}\n   Snippet: ${r.snippet.substring(0, 150)}`
        )
        .join('\n\n')}`;
    }

    const { text } = await generateText({
      model: (await getProviderForSlot('research'))(modelNames.research),
      system: `You are an expert business researcher specializing in company identification and web presence analysis.

Your task is to suggest the most likely website URLs for a company or organization based on the provided information.

CRITICAL RULES:
1. You MUST respond with ONLY a valid JSON object - no markdown, no explanations, no code blocks
2. Start directly with { and end with }
3. Suggest 1-3 URLs maximum, ranked by confidence
4. Always include the full URL with https://

URL RESEARCH STRATEGIES:
- For German companies: try .de, .com, .eu domains
- For international companies: try .com, regional TLDs
- For government/public sector: try .gov, .org, regional government domains
- For sports leagues/teams: try official league domains
- For universities: try .edu or country-specific education domains
- Consider common patterns: www.[company-name].[tld]
- Remove spaces and special characters from company names
- Consider abbreviations and acronyms`,
      prompt: `Find website URLs for this organization:

${contextParts.join('\n')}${webSearchContext}

${
  webSearchResults.length > 0
    ? `IMPORTANT: Web search found ${webSearchResults.length} URLs. Analyze these and select the most relevant ones. Prioritize URLs from web search over guessing.`
    : 'No web search results available - suggest URLs based on company name and common patterns.'
}

Based on the company name, industry, and context (and web search results if available), suggest the most likely official website URLs.

Consider:
- The company's likely main corporate website
- Any product-specific sites if relevant
- Regional or localized sites
- Related or parent company sites

RESPOND WITH THIS EXACT JSON STRUCTURE ONLY:
{
  "suggestions": [
    {"url": "https://www.example.com", "type": "primary", "description": "Main corporate website", "confidence": 95}
  ],
  "reasoning": "Based on company name and industry analysis..."
}`,
      temperature: 0.3,
      maxOutputTokens: 1500,
    });

    const responseText = text || '{}';

    // Clean and parse response - extract JSON from potential surrounding text
    let cleanedResponse = responseText
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    // Try to extract JSON object if response has extra text
    const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      cleanedResponse = jsonMatch[0];
    }

    let rawResult;
    try {
      rawResult = JSON.parse(cleanedResponse);
    } catch (parseError) {
      console.error('Failed to parse URL suggestion response:', cleanedResponse.substring(0, 200));
      // Return empty suggestions if parsing fails
      return {
        suggestions: [],
        reasoning: 'AI-Antwort konnte nicht verarbeitet werden',
      };
    }

    // Extract suggestions array safely
    const rawSuggestions = Array.isArray(rawResult.suggestions) ? rawResult.suggestions : [];
    const rawReasoning =
      typeof rawResult.reasoning === 'string' ? rawResult.reasoning : 'No suggestions available';

    // Normalize suggestion types before validation
    const normalizedSuggestions = rawSuggestions.map(
      (s: { url: string; type: string; description: string; confidence: number }) => ({
        ...s,
        type: normalizeUrlType(s.type),
      })
    );

    return urlSuggestionSchema.parse({
      suggestions: normalizedSuggestions,
      reasoning: rawReasoning,
    });
  } catch (error) {
    console.error('URL suggestion error:', error);
    return {
      suggestions: [],
      reasoning: 'URL-Vorschläge konnten nicht generiert werden',
    };
  }
}
