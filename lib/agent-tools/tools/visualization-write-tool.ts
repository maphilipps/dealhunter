/**
 * Visualization Write Tool for AI SDK (Agent-Native RAG)
 *
 * Allows agents to store UI-ready visualizations (JsonRenderTree)
 * directly in the knowledge base for frontend consumption.
 *
 * This enables agent-native architecture where agents produce
 * both RAG chunks AND visual output in a single pass.
 */

import { tool } from 'ai';
import { z } from 'zod';

import { db } from '@/lib/db';
import { dealEmbeddings } from '@/lib/db/schema';

export interface VisualizationWriteToolContext {
  pitchId?: string;
  preQualificationId?: string;
  agentName: string;
}

// JsonRenderTree Schema - validates UI structure
const jsonRenderElementSchema = z.object({
  key: z.string(),
  type: z.string(),
  props: z.object({}).passthrough(),
  children: z.array(z.string()).optional(),
});

const jsonRenderTreeSchema = z.object({
  root: z.string().nullable(),
  elements: z.record(z.string(), jsonRenderElementSchema),
});

// Full visualization input schema
const visualizationSchema = z.object({
  sectionId: z.string(),
  visualization: jsonRenderTreeSchema,
  confidence: z.number().min(0).max(100),
});

type VisualizationInput = z.infer<typeof visualizationSchema>;
type JsonRenderElement = z.infer<typeof jsonRenderElementSchema>;
type JsonRenderTree = z.infer<typeof jsonRenderTreeSchema>;

/**
 * Create a visualization write tool scoped to a specific deal
 *
 * Usage in agent:
 * ```typescript
 * const result = await streamText({
 *   model: 'claude-sonnet-4.5',
 *   tools: {
 *     store_visualization: createVisualizationWriteTool({
 *       preQualificationId: 'xyz',
 *       agentName: 'qualification_scan'
 *     }),
 *   },
 *   prompt: 'Analyze and visualize the tech stack...'
 * });
 * ```
 */
export function createVisualizationWriteTool(context: VisualizationWriteToolContext) {
  if (!context.pitchId && !context.preQualificationId) {
    throw new Error('Either pitchId or preQualificationId must be provided');
  }

  return tool({
    description: `Store UI-ready visualization for frontend display.

Use this AFTER storing findings to create the visual representation.
The visualization uses JsonRenderTree format with components like:

LAYOUT COMPONENTS:
- Grid: { columns: 2-4, gap: 'sm'|'md'|'lg' } - responsive grid layout
- ResultCard: { title, icon, variant: 'default'|'highlight'|'success'|'warning' } - section card
- Section: { title, collapsible } - collapsible section

METRIC COMPONENTS:
- Metric: { label, value, subValue?, trend?: 'up'|'down'|'neutral' } - single KPI
- ScoreCard: { label, score, maxScore, variant, showProgress } - score with progress bar
- ConfidenceScore: { label, confidence, details } - confidence indicator

CONTENT COMPONENTS:
- TechStack: { title, technologies: [{ name, confidence, category }] } - tech badges
- TechBadge: { name, version?, confidence, category } - single tech badge
- FeatureList: { features: [{ name, detected, details? }] } - feature checklist
- BulletList: { items: string[] } - simple bullet list
- KeyValue: { pairs: [{ key, value }] } - key-value pairs
- Paragraph: { text } - text paragraph

SPECIALIZED COMPONENTS:
- Screenshots: { desktop, mobile, timestamp } - screenshot display
- DecisionMakersList: { decisionMakers, researchQuality } - contact list
- SiteTree: { totalPages, maxDepth, sections } - site structure
- ContentTypeDistribution: { distribution, recommendations } - content breakdown

Parameters:
- sectionId: Section identifier for frontend routing (e.g., "technology", "performance", "accessibility")
- visualization: The JsonRenderTree structure for UI rendering
- confidence: Overall confidence for this visualization (0-100)

Example:
{
  "root": "grid-1",
  "elements": {
    "grid-1": {
      "key": "grid-1",
      "type": "Grid",
      "props": { "columns": 2, "gap": "md" },
      "children": ["metric-1", "metric-2"]
    },
    "metric-1": {
      "key": "metric-1",
      "type": "Metric",
      "props": { "label": "Pages", "value": "42" }
    },
    "metric-2": {
      "key": "metric-2",
      "type": "Metric",
      "props": { "label": "CMS", "value": "Drupal 9" }
    }
  }
}`,

    inputSchema: visualizationSchema,

    execute: async ({ sectionId, visualization, confidence }: VisualizationInput) => {
      // Validate tree structure
      if (visualization.root && !visualization.elements[visualization.root]) {
        return {
          success: false,
          error: `Root element "${visualization.root}" not found in elements`,
        };
      }

      // Validate all children references
      for (const [key, element] of Object.entries(visualization.elements)) {
        if (element.children) {
          for (const childKey of element.children) {
            if (!visualization.elements[childKey]) {
              return {
                success: false,
                error: `Element "${key}" references non-existent child "${childKey}"`,
              };
            }
          }
        }
      }

      // Store visualization as a special chunk type
      await db.insert(dealEmbeddings).values({
        pitchId: context.pitchId ?? null,
        preQualificationId: context.preQualificationId ?? null,
        agentName: context.agentName,
        chunkType: 'visualization',
        chunkIndex: 0, // Visualizations are unique per section, so always index 0
        chunkCategory: 'elaboration',
        content: JSON.stringify(visualization),
        confidence,
        embedding: null, // Visualizations don't need vector embeddings
        metadata: JSON.stringify({
          sectionId,
          isVisualization: true,
          elementCount: Object.keys(visualization.elements).length,
        }),
      });

      return {
        success: true,
        message: `Stored visualization for section "${sectionId}" with ${Object.keys(visualization.elements).length} elements`,
        sectionId,
      };
    },
  });
}

/**
 * Helper to create common visualization patterns
 */
export const VisualizationHelpers = {
  /**
   * Create a simple metrics grid
   */
  metricsGrid(
    metrics: Array<{ label: string; value: string | number; subValue?: string }>
  ): JsonRenderTree {
    const elements: Record<string, JsonRenderElement> = {};
    const metricKeys: string[] = [];

    metrics.forEach((metric, i) => {
      const key = `metric-${i}`;
      metricKeys.push(key);
      elements[key] = {
        key,
        type: 'Metric',
        props: {
          label: metric.label,
          value: String(metric.value),
          subValue: metric.subValue,
        },
      };
    });

    elements['grid'] = {
      key: 'grid',
      type: 'Grid',
      props: { columns: Math.min(metrics.length, 4), gap: 'md' },
      children: metricKeys,
    };

    return {
      root: 'grid',
      elements,
    };
  },

  /**
   * Create a card with title and content
   */
  card(
    title: string,
    content: JsonRenderTree,
    options?: { icon?: string; variant?: string }
  ): JsonRenderTree {
    const cardKey = 'card';
    const contentKey = 'content';

    const rootElement = content.root ? content.elements[content.root] : null;

    const newElements: Record<string, JsonRenderElement> = {
      [cardKey]: {
        key: cardKey,
        type: 'ResultCard',
        props: {
          title,
          icon: options?.icon,
          variant: options?.variant || 'default',
        },
        children: [contentKey],
      },
    };

    if (rootElement) {
      newElements[contentKey] = {
        key: contentKey,
        type: rootElement.type,
        props: rootElement.props,
        children: rootElement.children,
      };
    }

    // Add all other elements
    for (const [k, v] of Object.entries(content.elements)) {
      if (k !== content.root) {
        newElements[k] = v;
      }
    }

    return {
      root: cardKey,
      elements: newElements,
    };
  },
};
