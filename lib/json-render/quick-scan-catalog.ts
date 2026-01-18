import { z } from 'zod';

/**
 * Quick Scan Component Catalog for json-render
 * Defines components AI can use to visualize Quick Scan results
 */

// Component schemas
export const quickScanCatalogSchema = {
  ResultCard: z.object({
    title: z.string(),
    description: z.string().optional(),
    variant: z.enum(['default', 'highlight', 'warning', 'success']).optional(),
    icon: z.enum(['tech', 'content', 'features', 'recommendation']).optional(),
  }),

  Metric: z.object({
    label: z.string(),
    value: z.string(),
    subValue: z.string().optional(),
    trend: z.enum(['up', 'down', 'neutral']).optional(),
  }),

  TechBadge: z.object({
    name: z.string(),
    version: z.string().optional(),
    confidence: z.number().optional(),
    category: z.enum(['cms', 'framework', 'backend', 'hosting', 'library', 'tool']).optional(),
  }),

  FeatureList: z.object({
    title: z.string().optional(),
    features: z.array(z.object({
      name: z.string(),
      detected: z.boolean(),
      details: z.string().optional(),
    })),
  }),

  Recommendation: z.object({
    businessLine: z.string(),
    confidence: z.number(),
    reasoning: z.string(),
  }),

  AlternativesList: z.object({
    title: z.string().optional(),
    alternatives: z.array(z.object({
      name: z.string(),
      confidence: z.number(),
      reason: z.string(),
    })),
  }),

  SkillsList: z.object({
    title: z.string().optional(),
    skills: z.array(z.string()),
  }),

  ContentStats: z.object({
    pageCount: z.number().optional(),
    complexity: z.enum(['low', 'medium', 'high']).optional(),
    languages: z.array(z.string()).optional(),
    contentTypes: z.array(z.object({
      type: z.string(),
      count: z.number(),
    })).optional(),
  }),

  Grid: z.object({
    columns: z.number().optional(),
    gap: z.enum(['sm', 'md', 'lg']).optional(),
  }),
};

// Component descriptions for AI
export const quickScanComponentDescriptions = {
  ResultCard: 'Container card for grouping related information with optional icon and styling',
  Metric: 'Single metric display with label, value, and optional trend indicator',
  TechBadge: 'Badge showing a detected technology with version and confidence',
  FeatureList: 'Checklist showing detected vs not detected features',
  Recommendation: 'Primary business line recommendation with confidence and reasoning',
  AlternativesList: 'List of alternative business line recommendations',
  SkillsList: 'List of required skills/competencies',
  ContentStats: 'Content volume statistics including page count, complexity, languages',
  Grid: 'Layout container for arranging children in columns',
};

// System prompt for AI
export const QUICK_SCAN_VISUALIZATION_SYSTEM_PROMPT = `You are a visualization expert that creates UI layouts for Quick Scan results.
You output JSONL patches to build a UI tree from predefined components.

AVAILABLE COMPONENTS:
${Object.keys(quickScanComponentDescriptions).join(', ')}

COMPONENT DETAILS:
- ResultCard: { title: string, description?: string, variant?: "default"|"highlight"|"warning"|"success", icon?: "tech"|"content"|"features"|"recommendation" } - Container card
- Metric: { label: string, value: string, subValue?: string, trend?: "up"|"down"|"neutral" } - Single metric
- TechBadge: { name: string, version?: string, confidence?: number, category?: "cms"|"framework"|"backend"|"hosting"|"library"|"tool" } - Technology badge
- FeatureList: { title?: string, features: [{name: string, detected: boolean, details?: string}] } - Feature checklist
- Recommendation: { businessLine: string, confidence: number, reasoning: string } - BL recommendation
- AlternativesList: { title?: string, alternatives: [{name: string, confidence: number, reason: string}] } - Alternative BLs
- SkillsList: { title?: string, skills: [string] } - Required skills list
- ContentStats: { pageCount?: number, complexity?: "low"|"medium"|"high", languages?: [string], contentTypes?: [{type: string, count: number}] } - Content stats
- Grid: { columns?: number, gap?: "sm"|"md"|"lg" } - Layout grid (has children)

OUTPUT FORMAT:
Output JSONL where each line is a patch operation:
{"op":"set","path":"/root","value":"main-card"}
{"op":"add","path":"/elements/main-card","value":{"key":"main-card","type":"ResultCard","props":{...},"children":["child-key"]}}

RULES:
1. First set /root to the root element's key
2. Add each element with a unique key using /elements/{key}
3. Parent elements list child keys in their "children" array
4. ResultCard and Grid can have children, other components cannot
5. Organize results logically: recommendation first, then tech stack, content, features
6. Use meaningful keys (e.g., "recommendation-card", "tech-stack-grid")

BEST PRACTICES:
- Start with the most important information (BL Recommendation)
- Group related info in cards
- Use Grid for side-by-side layouts
- Keep it scannable - use metrics for key numbers
- Use highlight variant for the primary recommendation`;

export type QuickScanCatalogComponents = keyof typeof quickScanCatalogSchema;
