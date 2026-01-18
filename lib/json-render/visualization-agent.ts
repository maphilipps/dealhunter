import OpenAI from 'openai';
import { QUICK_SCAN_VISUALIZATION_SYSTEM_PROMPT } from './quick-scan-catalog';
import type { QuickScanResult } from '@/lib/quick-scan/agent';

// Initialize OpenAI client with adesso AI Hub
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL || 'https://adesso-ai-hub.3asabc.de/v1',
});

interface JsonRenderTree {
  root: string | null;
  elements: Record<string, {
    key: string;
    type: string;
    props: Record<string, unknown>;
    children?: string[];
  }>;
}

/**
 * Parse JSONL patches into a tree structure
 */
function parseJsonlPatches(jsonl: string): JsonRenderTree {
  const tree: JsonRenderTree = {
    root: null,
    elements: {},
  };

  const lines = jsonl.split('\n').filter((line) => line.trim());

  for (const line of lines) {
    try {
      const patch = JSON.parse(line);

      if (patch.op === 'set' && patch.path === '/root') {
        tree.root = patch.value;
      } else if (patch.op === 'add' && patch.path.startsWith('/elements/')) {
        const key = patch.path.replace('/elements/', '');
        tree.elements[key] = patch.value;
      }
    } catch (e) {
      // Skip invalid JSON lines
      console.warn('Failed to parse JSONL line:', line);
    }
  }

  return tree;
}

/**
 * Quick Scan Visualization Expert Agent
 * Converts Quick Scan results into a json-render tree for dynamic display
 */
export async function generateQuickScanVisualization(
  results: QuickScanResult
): Promise<JsonRenderTree> {
  const userPrompt = `Generate a visualization for these Quick Scan results:

BUSINESS LINE RECOMMENDATION:
- Primary: ${results.blRecommendation.primaryBusinessLine}
- Confidence: ${results.blRecommendation.confidence}%
- Reasoning: ${results.blRecommendation.reasoning}
${results.blRecommendation.alternativeBusinessLines?.length ? `- Alternatives: ${JSON.stringify(results.blRecommendation.alternativeBusinessLines)}` : ''}
${results.blRecommendation.requiredSkills?.length ? `- Required Skills: ${results.blRecommendation.requiredSkills.join(', ')}` : ''}

TECH STACK:
- CMS: ${results.techStack.cms || 'Not detected'} ${results.techStack.cmsVersion ? `v${results.techStack.cmsVersion}` : ''} (${results.techStack.cmsConfidence || 0}% confidence)
- Framework: ${results.techStack.framework || 'Not detected'}
- Backend: ${results.techStack.backend?.join(', ') || 'Not detected'}
- Hosting: ${results.techStack.hosting || 'Not detected'}
- Libraries: ${results.techStack.libraries?.slice(0, 5).join(', ') || 'None detected'}

CONTENT VOLUME:
- Estimated Pages: ${results.contentVolume.estimatedPageCount || 'Unknown'}
- Complexity: ${results.contentVolume.complexity || 'Unknown'}
- Languages: ${results.contentVolume.languages?.join(', ') || 'Unknown'}

FEATURES DETECTED:
- E-commerce: ${results.features.ecommerce ? 'Yes' : 'No'}
- User Accounts: ${results.features.userAccounts ? 'Yes' : 'No'}
- Search: ${results.features.search ? 'Yes' : 'No'}
- Multi-Language: ${results.features.multiLanguage ? 'Yes' : 'No'}
- Blog: ${results.features.blog ? 'Yes' : 'No'}
- Forms: ${results.features.forms ? 'Yes' : 'No'}
- API: ${results.features.api ? 'Yes' : 'No'}

Create a well-organized visualization with the business line recommendation prominently displayed, followed by tech stack, content stats, and features.`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'claude-haiku-4.5',
      messages: [
        { role: 'system', content: QUICK_SCAN_VISUALIZATION_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 4000,
    });

    const responseText = completion.choices[0]?.message?.content || '';

    // Parse JSONL response into tree
    const tree = parseJsonlPatches(responseText);

    // Validate tree has required structure
    if (!tree.root || Object.keys(tree.elements).length === 0) {
      throw new Error('Invalid visualization tree generated');
    }

    return tree;
  } catch (error) {
    console.error('Visualization agent error:', error);

    // Fallback: Generate a simple static visualization
    return generateFallbackVisualization(results);
  }
}

/**
 * Fallback visualization when AI generation fails
 */
function generateFallbackVisualization(results: QuickScanResult): JsonRenderTree {
  return {
    root: 'main-container',
    elements: {
      'main-container': {
        key: 'main-container',
        type: 'Grid',
        props: { columns: 1, gap: 'md' },
        children: ['recommendation-card', 'tech-card', 'content-card', 'features-card'],
      },
      'recommendation-card': {
        key: 'recommendation-card',
        type: 'ResultCard',
        props: {
          title: 'Empfohlene Business Line',
          variant: 'highlight',
          icon: 'recommendation',
        },
        children: ['recommendation'],
      },
      recommendation: {
        key: 'recommendation',
        type: 'Recommendation',
        props: {
          businessUnit: results.blRecommendation.primaryBusinessLine,
          confidence: results.blRecommendation.confidence,
          reasoning: results.blRecommendation.reasoning,
        },
      },
      'tech-card': {
        key: 'tech-card',
        type: 'ResultCard',
        props: {
          title: 'Tech Stack',
          icon: 'tech',
        },
        children: results.techStack.cms ? ['cms-badge'] : [],
      },
      ...(results.techStack.cms
        ? {
            'cms-badge': {
              key: 'cms-badge',
              type: 'TechBadge',
              props: {
                name: results.techStack.cms,
                version: results.techStack.cmsVersion,
                confidence: results.techStack.cmsConfidence,
                category: 'cms',
              },
            },
          }
        : {}),
      'content-card': {
        key: 'content-card',
        type: 'ResultCard',
        props: {
          title: 'Content & Volumen',
          icon: 'content',
        },
        children: ['content-stats'],
      },
      'content-stats': {
        key: 'content-stats',
        type: 'ContentStats',
        props: {
          pageCount: results.contentVolume.estimatedPageCount,
          complexity: results.contentVolume.complexity,
          languages: results.contentVolume.languages,
        },
      },
      'features-card': {
        key: 'features-card',
        type: 'ResultCard',
        props: {
          title: 'Erkannte Features',
          icon: 'features',
        },
        children: ['feature-list'],
      },
      'feature-list': {
        key: 'feature-list',
        type: 'FeatureList',
        props: {
          features: [
            { name: 'E-Commerce', detected: results.features.ecommerce },
            { name: 'User Accounts', detected: results.features.userAccounts },
            { name: 'Search', detected: results.features.search },
            { name: 'Multi-Language', detected: results.features.multiLanguage },
            { name: 'Blog/News', detected: results.features.blog },
            { name: 'Forms', detected: results.features.forms },
            { name: 'API Integration', detected: results.features.api },
          ],
        },
      },
    },
  };
}

/**
 * Stream visualization generation (for real-time updates)
 */
export async function* streamQuickScanVisualization(
  results: QuickScanResult
): AsyncGenerator<{ type: 'patch'; data: unknown } | { type: 'complete'; tree: JsonRenderTree }> {
  const userPrompt = `Generate a visualization for these Quick Scan results:

BUSINESS LINE RECOMMENDATION:
- Primary: ${results.blRecommendation.primaryBusinessLine}
- Confidence: ${results.blRecommendation.confidence}%
- Reasoning: ${results.blRecommendation.reasoning}

TECH STACK:
- CMS: ${results.techStack.cms || 'Not detected'} (${results.techStack.cmsConfidence || 0}% confidence)
- Framework: ${results.techStack.framework || 'Not detected'}

CONTENT VOLUME:
- Estimated Pages: ${results.contentVolume.estimatedPageCount || 'Unknown'}
- Complexity: ${results.contentVolume.complexity || 'Unknown'}

Create a well-organized visualization.`;

  const stream = await openai.chat.completions.create({
    model: 'claude-haiku-4.5',
    messages: [
      { role: 'system', content: QUICK_SCAN_VISUALIZATION_SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.3,
    max_tokens: 4000,
    stream: true,
  });

  const tree: JsonRenderTree = {
    root: null,
    elements: {},
  };

  let buffer = '';

  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content || '';
    buffer += content;

    // Try to parse complete lines
    const lines = buffer.split('\n');
    buffer = lines.pop() || ''; // Keep incomplete line in buffer

    for (const line of lines) {
      if (!line.trim()) continue;

      try {
        const patch = JSON.parse(line);

        if (patch.op === 'set' && patch.path === '/root') {
          tree.root = patch.value;
        } else if (patch.op === 'add' && patch.path.startsWith('/elements/')) {
          const key = patch.path.replace('/elements/', '');
          tree.elements[key] = patch.value;
        }

        yield { type: 'patch', data: patch };
      } catch {
        // Skip invalid lines
      }
    }
  }

  // Process any remaining buffer
  if (buffer.trim()) {
    try {
      const patch = JSON.parse(buffer);
      if (patch.op === 'set' && patch.path === '/root') {
        tree.root = patch.value;
      } else if (patch.op === 'add' && patch.path.startsWith('/elements/')) {
        const key = patch.path.replace('/elements/', '');
        tree.elements[key] = patch.value;
      }
      yield { type: 'patch', data: patch };
    } catch {
      // Ignore
    }
  }

  yield { type: 'complete', tree };
}
