import OpenAI from 'openai';
import {
  technologyResearchResultSchema,
  type TechnologyResearchResult,
} from './schema';
import {
  createIntelligentTools,
  KNOWN_GITHUB_REPOS,
} from '@/lib/agent-tools/intelligent-tools';

// Initialize OpenAI client with adesso AI Hub
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL || 'https://adesso-ai-hub.3asabc.de/v1',
});

export interface TechnologyResearchInput {
  name: string;
  existingData?: {
    logoUrl?: string | null;
    websiteUrl?: string | null;
    description?: string | null;
    category?: string | null;
    license?: string | null;
    latestVersion?: string | null;
    githubUrl?: string | null;
    githubStars?: number | null;
    lastRelease?: string | null;
    communitySize?: string | null;
    pros?: string | null;
    cons?: string | null;
    usps?: string | null;
    targetAudiences?: string | null;
    useCases?: string | null;
    adessoExpertise?: string | null;
    lastResearchedAt?: Date | null;
  };
  useWebSearch?: boolean; // Web Search + GitHub API für echte Daten nutzen
}

export interface TechnologyResearchOutput {
  result: TechnologyResearchResult;
  activityLog: Array<{
    timestamp: string;
    action: string;
    details?: string;
  }>;
}

/**
 * Technology Research Agent
 * Researches technology metadata and generates marketing content
 * Uses native OpenAI SDK with adesso AI Hub (gemini-3-pro-preview)
 */
export async function runTechnologyResearch(
  input: TechnologyResearchInput
): Promise<TechnologyResearchOutput> {
  const activityLog: TechnologyResearchOutput['activityLog'] = [];

  const logActivity = (action: string, details?: string) => {
    activityLog.push({
      timestamp: new Date().toISOString(),
      action,
      details,
    });
  };

  try {
    logActivity('Starting Technology Research', `Technology: ${input.name}`);

    // Determine which fields need to be filled
    const emptyFields = getEmptyFields(input.existingData);
    logActivity('Analyzing existing data', `Empty fields: ${emptyFields.join(', ') || 'none'}`);

    // Check if data is stale (older than 30 days)
    const isStale = input.existingData?.lastResearchedAt
      ? Date.now() - new Date(input.existingData.lastResearchedAt).getTime() > 30 * 24 * 60 * 60 * 1000
      : true;

    if (emptyFields.length === 0 && !isStale) {
      logActivity('No update needed', 'All fields are filled and data is recent');
      return {
        result: {},
        activityLog,
      };
    }

    // === PHASE 1: Intelligent Research (GitHub API + Web Search) ===
    let githubInsights = '';
    let webSearchInsights = '';
    let githubData: {
      latestVersion?: string;
      githubStars?: number;
      lastRelease?: string;
      license?: string;
      description?: string;
      githubUrl?: string;
    } = {};

    if (input.useWebSearch !== false) {
      const intelligentTools = createIntelligentTools({ agentName: 'Tech Researcher' });

      try {
        // GitHub API: Prüfe bekannte Repos
        const techLower = input.name.toLowerCase();
        const knownRepoUrl = KNOWN_GITHUB_REPOS[techLower as keyof typeof KNOWN_GITHUB_REPOS];

        if (knownRepoUrl) {
          logActivity('GitHub Research', `Fetching data from ${knownRepoUrl}`);
          const repoInfo = await intelligentTools.githubRepo(knownRepoUrl);

          if (repoInfo && !repoInfo.error) {
            githubData = {
              latestVersion: repoInfo.latestVersion || undefined,
              githubStars: repoInfo.githubStars || undefined,
              lastRelease: repoInfo.lastRelease || undefined,
              license: repoInfo.license || undefined,
              description: repoInfo.description || undefined,
              githubUrl: knownRepoUrl,
            };

            githubInsights = `\n\n**GitHub Data (live):**
- Repository: ${knownRepoUrl}
- Latest Version: ${repoInfo.latestVersion || 'N/A'}
- GitHub Stars: ${repoInfo.githubStars?.toLocaleString() || 'N/A'}
- Last Release: ${repoInfo.lastRelease || 'N/A'}
- License: ${repoInfo.license || 'N/A'}`;

            logActivity('GitHub Research', `Found: v${repoInfo.latestVersion}, ${repoInfo.githubStars} stars`);
          }
        }

        // Web Search: Aktuelle Infos zur Technologie
        const searchResults = await intelligentTools.webSearch(
          `${input.name} technology latest version features 2024`,
          5
        );

        if (searchResults && searchResults.length > 0) {
          webSearchInsights = `\n\n**Web Search Results (EXA):**\n${searchResults
            .slice(0, 3)
            .map(r => `- ${r.title}: ${r.snippet}`)
            .join('\n')}`;

          logActivity('Web Search', `${searchResults.length} Ergebnisse gefunden`);
        }
      } catch (error) {
        logActivity('Research Warning', `Intelligent research failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // Build context for AI
    const existingContext = buildExistingContext(input.existingData);

    logActivity('Researching technology information', `Fields to fill: ${emptyFields.length > 0 ? emptyFields.join(', ') : 'refreshing stale data'}`);

    // === PHASE 2: AI Research for remaining fields ===
    const prompt = buildResearchPrompt(input.name, emptyFields, existingContext, isStale, githubInsights, webSearchInsights);

    const completion = await openai.chat.completions.create({
      model: 'claude-haiku-4.5',
      messages: [
        {
          role: 'system',
          content: 'You are a technology researcher. Always respond with valid JSON matching the requested schema. Do not include markdown code blocks or any other formatting - just the raw JSON object.',
        },
        {
          role: 'user',
          content: prompt + '\n\nRespond with a JSON object containing only these fields (omit fields you cannot find reliable data for): logoUrl, websiteUrl, description, category (one of: CMS, Framework, Library, Language, Database, Tool, Platform, Other), license, latestVersion, githubUrl, githubStars (number), lastRelease (YYYY-MM-DD), communitySize (one of: small, medium, large), pros (array of strings), cons (array of strings), usps (array of strings), targetAudiences (array of strings), useCases (array of strings), adessoExpertise (string).',
        },
      ],
      temperature: 0.3,
      max_tokens: 2000,
    });

    const responseText = completion.choices[0]?.message?.content || '{}';

    // Parse and validate response
    let parsedResult: TechnologyResearchResult;
    try {
      // Clean up response (remove markdown code blocks if present)
      const cleanedResponse = responseText
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();

      const rawResult = JSON.parse(cleanedResponse);

      // Validate with Zod schema (partial to allow missing fields)
      parsedResult = technologyResearchResultSchema.partial().parse(rawResult);
    } catch (parseError) {
      console.error('Failed to parse AI response:', responseText);
      logActivity('Parse error', 'Failed to parse AI response');
      parsedResult = {};
    }

    logActivity('Research completed', `Found data for ${Object.keys(parsedResult).length} fields`);

    // === PHASE 3: Merge GitHub data with AI results (GitHub data takes priority for technical facts) ===
    if (Object.keys(githubData).length > 0) {
      logActivity('Merging GitHub data', `Adding ${Object.keys(githubData).length} fields from GitHub API`);
      parsedResult = {
        ...parsedResult,
        // GitHub data overrides AI guesses for technical facts
        ...(githubData.latestVersion && { latestVersion: githubData.latestVersion }),
        ...(githubData.githubStars && { githubStars: githubData.githubStars }),
        ...(githubData.lastRelease && { lastRelease: githubData.lastRelease }),
        ...(githubData.license && { license: githubData.license }),
        ...(githubData.githubUrl && { githubUrl: githubData.githubUrl }),
        // Only use GitHub description if AI didn't provide one
        ...(!parsedResult.description && githubData.description && { description: githubData.description }),
      };
    }

    // Filter out fields that already have values (incremental update)
    const filteredResult = filterNewFields(parsedResult, input.existingData, isStale);

    logActivity('Technology Research completed successfully', `Updated fields: ${Object.keys(filteredResult).length}`);

    return {
      result: filteredResult,
      activityLog,
    };
  } catch (error) {
    logActivity('Research failed', error instanceof Error ? error.message : 'Unknown error');
    throw error;
  }
}

/**
 * Get list of empty fields that need to be filled
 */
function getEmptyFields(existingData?: TechnologyResearchInput['existingData']): string[] {
  if (!existingData) {
    return [
      'logoUrl', 'websiteUrl', 'description', 'category',
      'license', 'latestVersion', 'githubUrl', 'githubStars',
      'lastRelease', 'communitySize', 'pros', 'cons',
      'usps', 'targetAudiences', 'useCases', 'adessoExpertise',
    ];
  }

  const fields = [
    'logoUrl', 'websiteUrl', 'description', 'category',
    'license', 'latestVersion', 'githubUrl', 'githubStars',
    'lastRelease', 'communitySize', 'pros', 'cons',
    'usps', 'targetAudiences', 'useCases', 'adessoExpertise',
  ];

  return fields.filter(field => {
    const value = existingData[field as keyof typeof existingData];
    return value === null || value === undefined || value === '';
  });
}

/**
 * Build context string from existing data
 */
function buildExistingContext(existingData?: TechnologyResearchInput['existingData']): string {
  if (!existingData) return 'No existing data available.';

  const contextParts: string[] = [];

  if (existingData.websiteUrl) contextParts.push(`Official Website: ${existingData.websiteUrl}`);
  if (existingData.description) contextParts.push(`Description: ${existingData.description}`);
  if (existingData.category) contextParts.push(`Category: ${existingData.category}`);
  if (existingData.license) contextParts.push(`License: ${existingData.license}`);
  if (existingData.githubUrl) contextParts.push(`GitHub: ${existingData.githubUrl}`);

  return contextParts.length > 0
    ? `Existing data:\n${contextParts.join('\n')}`
    : 'No existing data available.';
}

/**
 * Build the research prompt
 */
function buildResearchPrompt(
  name: string,
  emptyFields: string[],
  existingContext: string,
  isStale: boolean,
  githubInsights: string = '',
  webSearchInsights: string = ''
): string {
  const fieldDescriptions: Record<string, string> = {
    logoUrl: 'Official logo URL (prefer SVG or PNG, official sources only)',
    websiteUrl: 'Official website URL',
    description: 'Short description (2-3 sentences) explaining what the technology does',
    category: 'Category: CMS, Framework, Library, Language, Database, Tool, Platform, or Other',
    license: 'License type (MIT, Apache 2.0, GPL, Proprietary, etc.)',
    latestVersion: 'Current stable version number',
    githubUrl: 'GitHub repository URL if open source',
    githubStars: 'Approximate GitHub stars count',
    lastRelease: 'Date of last release (YYYY-MM-DD format)',
    communitySize: 'Community size: small, medium, or large',
    pros: '3-5 key advantages of this technology',
    cons: '3-5 key disadvantages or limitations',
    usps: '3-5 unique selling points for sales conversations at adesso SE',
    targetAudiences: 'Target audiences for this technology (e.g., enterprise, startups, government)',
    useCases: 'Common use cases and scenarios',
    adessoExpertise: 'How adesso SE (a leading IT consulting company) could position expertise with this technology',
  };

  const fieldsToFill = emptyFields.length > 0
    ? emptyFields.map(f => `- ${f}: ${fieldDescriptions[f] || f}`).join('\n')
    : Object.entries(fieldDescriptions).map(([k, v]) => `- ${k}: ${v}`).join('\n');

  // Include live research data if available
  const researchData = [githubInsights, webSearchInsights].filter(Boolean).join('\n');
  const researchSection = researchData
    ? `\n**LIVE RESEARCH DATA (use this for accurate technical data):**${researchData}\n`
    : '';

  return `You are a technology researcher for adesso SE, a leading German IT consulting company.

Research the technology "${name}" and provide accurate, up-to-date information.

${existingContext}
${researchSection}
${isStale ? 'Note: Existing data may be outdated. Please verify and update as needed.' : ''}

Please provide information for these fields:
${fieldsToFill}

IMPORTANT GUIDELINES:
1. Only provide information you are confident about
2. ${researchData ? 'PRIORITIZE the live research data above for technical facts (version, stars, release date)' : 'For GitHub data, provide approximate current figures'}
3. For logo URLs, use official sources (official website, GitHub, Wikipedia)
4. For marketing content (USPs, pros/cons), write from adesso SE's perspective as an IT consulting company
5. Be specific and actionable in your recommendations
6. Use German cultural context where appropriate (adesso SE is based in Germany)

If you cannot find reliable information for a field, omit it from your response.`;
}

/**
 * Filter out fields that already have values (for incremental update)
 */
function filterNewFields(
  result: TechnologyResearchResult,
  existingData?: TechnologyResearchInput['existingData'],
  isStale?: boolean
): TechnologyResearchResult {
  if (!existingData || isStale) {
    return result;
  }

  const filtered: TechnologyResearchResult = {};

  // Only include fields that are currently empty
  if (!existingData.logoUrl && result.logoUrl) filtered.logoUrl = result.logoUrl;
  if (!existingData.websiteUrl && result.websiteUrl) filtered.websiteUrl = result.websiteUrl;
  if (!existingData.description && result.description) filtered.description = result.description;
  if (!existingData.category && result.category) filtered.category = result.category;
  if (!existingData.license && result.license) filtered.license = result.license;
  if (!existingData.latestVersion && result.latestVersion) filtered.latestVersion = result.latestVersion;
  if (!existingData.githubUrl && result.githubUrl) filtered.githubUrl = result.githubUrl;
  if (!existingData.githubStars && result.githubStars) filtered.githubStars = result.githubStars;
  if (!existingData.lastRelease && result.lastRelease) filtered.lastRelease = result.lastRelease;
  if (!existingData.communitySize && result.communitySize) filtered.communitySize = result.communitySize;
  if (!existingData.pros && result.pros) filtered.pros = result.pros;
  if (!existingData.cons && result.cons) filtered.cons = result.cons;
  if (!existingData.usps && result.usps) filtered.usps = result.usps;
  if (!existingData.targetAudiences && result.targetAudiences) filtered.targetAudiences = result.targetAudiences;
  if (!existingData.useCases && result.useCases) filtered.useCases = result.useCases;
  if (!existingData.adessoExpertise && result.adessoExpertise) filtered.adessoExpertise = result.adessoExpertise;

  return filtered;
}
