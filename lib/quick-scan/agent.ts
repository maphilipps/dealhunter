import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import {
  techStackSchema,
  contentVolumeSchema,
  featuresSchema,
  blRecommendationSchema,
  type TechStack,
  type ContentVolume,
  type Features,
  type BLRecommendation,
} from './schema';

export interface QuickScanInput {
  websiteUrl: string;
  extractedRequirements?: any; // From extraction phase
}

export interface QuickScanResult {
  techStack: TechStack;
  contentVolume: ContentVolume;
  features: Features;
  blRecommendation: BLRecommendation;
  activityLog: Array<{
    timestamp: string;
    action: string;
    details?: string;
  }>;
}

/**
 * Quick Scan Agent - Analyzes customer website for tech stack and content
 * Returns business line recommendation within 5 minutes
 */
export async function runQuickScan(input: QuickScanInput): Promise<QuickScanResult> {
  const activityLog: QuickScanResult['activityLog'] = [];

  const logActivity = (action: string, details?: string) => {
    activityLog.push({
      timestamp: new Date().toISOString(),
      action,
      details,
    });
  };

  try {
    logActivity('Starting Quick Scan', `URL: ${input.websiteUrl}`);

    // Step 1: Fetch website HTML
    logActivity('Fetching website content');
    const htmlContent = await fetchWebsiteContent(input.websiteUrl);

    if (!htmlContent) {
      throw new Error('Failed to fetch website content');
    }

    // Step 2: Detect Tech Stack
    logActivity('Analyzing tech stack');
    const techStack = await detectTechStack(htmlContent, input.websiteUrl);

    // Step 3: Analyze Content Volume
    logActivity('Analyzing content volume');
    const contentVolume = await analyzeContentVolume(htmlContent);

    // Step 4: Detect Features
    logActivity('Detecting features and integrations');
    const features = await detectFeatures(htmlContent);

    // Step 5: Generate BL Recommendation
    logActivity('Generating business line recommendation');
    const blRecommendation = await recommendBusinessLine({
      techStack,
      contentVolume,
      features,
      extractedRequirements: input.extractedRequirements,
    });

    logActivity('Quick Scan completed successfully');

    return {
      techStack,
      contentVolume,
      features,
      blRecommendation,
      activityLog,
    };
  } catch (error) {
    logActivity('Quick Scan failed', error instanceof Error ? error.message : 'Unknown error');
    throw error;
  }
}

/**
 * Fetch website content (HTML)
 */
async function fetchWebsiteContent(url: string): Promise<string | null> {
  try {
    // Ensure URL has protocol
    const fullUrl = url.startsWith('http') ? url : `https://${url}`;

    const response = await fetch(fullUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; DealhunterBot/1.0)',
      },
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });

    if (!response.ok) {
      return null;
    }

    return await response.text();
  } catch (error) {
    console.error('Fetch error:', error);
    return null;
  }
}

/**
 * Detect tech stack from HTML using AI
 */
async function detectTechStack(html: string, url: string): Promise<TechStack> {
  // Extract key indicators from HTML
  const htmlSnippet = extractTechIndicators(html);

  const result = await generateObject({
    model: openai('gpt-4o-mini'),
    schema: techStackSchema,
    prompt: `Analyze this website HTML and detect the technology stack.

URL: ${url}

HTML Indicators:
${htmlSnippet}

Detect:
- CMS (WordPress, Drupal, Typo3, Joomla, custom)
- Frontend framework (React, Vue, Angular, jQuery, etc.)
- Backend technologies
- Hosting provider (from headers or clues)
- JavaScript libraries
- Analytics and marketing tools

Provide confidence scores for your detections.`,
    temperature: 0.3,
  });

  return result.object;
}

/**
 * Analyze content volume from HTML
 */
async function analyzeContentVolume(html: string): Promise<ContentVolume> {
  const htmlSnippet = html.substring(0, 10000); // First 10k chars

  const result = await generateObject({
    model: openai('gpt-4o-mini'),
    schema: contentVolumeSchema,
    prompt: `Analyze this website HTML and estimate content volume.

HTML Sample:
${htmlSnippet}

Estimate:
- Total page count (based on navigation, sitemaps, etc.)
- Content types (blog posts, products, services, etc.)
- Media assets (images, videos, documents)
- Languages
- Overall complexity (low/medium/high)

Make reasonable estimates based on the HTML structure.`,
    temperature: 0.3,
  });

  return result.object;
}

/**
 * Detect features from HTML
 */
async function detectFeatures(html: string): Promise<Features> {
  const htmlSnippet = html.substring(0, 10000);

  const result = await generateObject({
    model: openai('gpt-4o-mini'),
    schema: featuresSchema,
    prompt: `Analyze this website HTML and detect key features.

HTML Sample:
${htmlSnippet}

Detect:
- E-commerce functionality (shopping cart, payment, etc.)
- User account system (login, registration)
- Search functionality
- Multi-language support
- Blog/news section
- Contact forms or other forms
- API endpoints
- Mobile app integration
- Other notable custom features

Return boolean values and list custom features.`,
    temperature: 0.3,
  });

  return result.object;
}

/**
 * Recommend business line based on analysis
 */
async function recommendBusinessLine(context: {
  techStack: TechStack;
  contentVolume: ContentVolume;
  features: Features;
  extractedRequirements?: any;
}): Promise<BLRecommendation> {
  const result = await generateObject({
    model: openai('gpt-4o-mini'),
    schema: blRecommendationSchema,
    prompt: `You are a business development expert at adesso SE, a leading IT consulting company.

Based on the website analysis, recommend the best business line for this project.

Tech Stack:
${JSON.stringify(context.techStack, null, 2)}

Content Volume:
${JSON.stringify(context.contentVolume, null, 2)}

Features:
${JSON.stringify(context.features, null, 2)}

${context.extractedRequirements ? `
Extracted Requirements:
${JSON.stringify(context.extractedRequirements, null, 2)}
` : ''}

Available Business Lines at adesso:
- Banking & Insurance (Drupal CMS, complex financial systems)
- Automotive (Industry 4.0, IoT, connected vehicles)
- Energy & Utilities (Smart grids, energy management)
- Retail & E-Commerce (Online shops, omnichannel)
- Healthcare (Patient portals, medical systems)
- Public Sector (Government portals, citizen services)
- Manufacturing (ERP, production systems)
- Technology & Innovation (Custom development, cloud migration)

Recommend the PRIMARY business line with confidence (0-100).
Provide clear reasoning based on the tech stack and features.
List alternative business lines if applicable.
Identify required skills for this project.`,
    temperature: 0.3,
  });

  return result.object;
}

/**
 * Extract tech indicators from HTML
 */
function extractTechIndicators(html: string): string {
  const indicators: string[] = [];

  // Extract meta tags
  const metaRegex = /<meta[^>]+>/gi;
  const metas = html.match(metaRegex) || [];
  indicators.push('Meta Tags:', ...metas.slice(0, 10));

  // Extract script tags
  const scriptRegex = /<script[^>]*src="([^"]+)"/gi;
  const scripts = Array.from(html.matchAll(scriptRegex)).map(m => m[1]);
  indicators.push('\nScript Sources:', ...scripts.slice(0, 20));

  // Extract link tags (stylesheets)
  const linkRegex = /<link[^>]*href="([^"]+)"/gi;
  const links = Array.from(html.matchAll(linkRegex)).map(m => m[1]);
  indicators.push('\nStylesheet Links:', ...links.slice(0, 10));

  // Look for common CMS indicators
  const cmsIndicators = [
    'wp-content',
    'wp-includes',
    'drupal',
    'typo3',
    'joomla',
    'sites/default',
  ];

  indicators.push('\nCMS Indicators Found:');
  cmsIndicators.forEach(indicator => {
    if (html.toLowerCase().includes(indicator)) {
      indicators.push(`- ${indicator}`);
    }
  });

  return indicators.join('\n').substring(0, 5000); // Limit size
}
