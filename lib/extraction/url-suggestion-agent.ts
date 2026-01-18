import OpenAI from 'openai';
import { z } from 'zod';

// Initialize OpenAI client with adesso AI Hub
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL || 'https://adesso-ai-hub.3asabc.de/v1',
});

/**
 * Schema for URL suggestions
 */
export const urlSuggestionSchema = z.object({
  suggestions: z.array(z.object({
    url: z.string().describe('Suggested website URL'),
    type: z.enum(['primary', 'product', 'regional', 'related']).describe('Type of website'),
    description: z.string().describe('Why this URL is relevant'),
    confidence: z.number().min(0).max(100).describe('Confidence in this suggestion'),
  })),
  reasoning: z.string().describe('Overall reasoning for suggestions'),
});

export type UrlSuggestion = z.infer<typeof urlSuggestionSchema>;

export interface UrlSuggestionInput {
  customerName: string;
  industry?: string;
  projectDescription?: string;
  technologies?: string[];
}

/**
 * AI Agent for suggesting website URLs when none are found in the document
 * Uses web knowledge and common patterns to suggest likely URLs
 */
export async function suggestWebsiteUrls(
  input: UrlSuggestionInput
): Promise<UrlSuggestion> {
  try {
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

    const completion = await openai.chat.completions.create({
      model: 'claude-haiku-4.5',
      messages: [
        {
          role: 'system',
          content: `You are an expert business researcher specializing in company identification and web presence analysis.

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
        },
        {
          role: 'user',
          content: `Find website URLs for this organization:

${contextParts.join('\n')}

Based on the company name, industry, and context, suggest the most likely official website URLs.

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
        },
      ],
      temperature: 0.3,
      max_tokens: 1500,
    });

    const responseText = completion.choices[0]?.message?.content || '{}';

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

    // Convert null values to undefined
    const cleanedResult = Object.fromEntries(
      Object.entries(rawResult).filter(([_, v]) => v !== null)
    );

    return urlSuggestionSchema.parse({
      suggestions: cleanedResult.suggestions || [],
      reasoning: cleanedResult.reasoning || 'No suggestions available',
    });
  } catch (error) {
    console.error('URL suggestion error:', error);
    return {
      suggestions: [],
      reasoning: 'URL-Vorschläge konnten nicht generiert werden',
    };
  }
}
