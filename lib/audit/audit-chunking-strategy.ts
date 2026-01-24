/**
 * Audit Chunking Strategy
 *
 * Defines chunking logic per audit file type.
 * JSON files are split by logical sections.
 * Markdown files are split by paragraphs with ~600 token target.
 */

import type { ParsedAuditFile } from './audit-file-parser';

import { estimateTokens } from '@/lib/rag/raw-chunk-service';

export interface AuditChunk {
  chunkType: string;
  chunkIndex: number;
  content: string;
  tokenCount: number;
  metadata: {
    sourceFile: string;
    sourceType: 'json' | 'markdown' | 'text';
    section: string;
    category: string;
    projectName: string;
  };
}

// Target chunk size in tokens
const TARGET_CHUNK_SIZE = 600;
const MIN_CHUNK_SIZE = 100;
const MAX_CHUNK_SIZE = 1200;

/**
 * Map category to chunk type
 */
function categoryToChunkType(category: string, isNarrative: boolean): string {
  const base = `audit_${category}`;
  return isNarrative ? `${base}_narrative` : base;
}

/**
 * Chunk a JSON file by logical sections
 */
function chunkJsonFile(file: ParsedAuditFile): AuditChunk[] {
  if (!file.parsed) return [];

  const chunks: AuditChunk[] = [];
  const data = file.parsed;
  let chunkIndex = 0;

  const createChunk = (section: string, content: unknown): void => {
    const text = typeof content === 'string' ? content : JSON.stringify(content, null, 2);

    const tokenCount = estimateTokens(text);

    // Skip very small chunks
    if (tokenCount < MIN_CHUNK_SIZE) return;

    // If too large, we'll still include it but log a warning
    if (tokenCount > MAX_CHUNK_SIZE) {
      console.warn(`[Chunking] Large chunk (${tokenCount} tokens) in ${file.filename}:${section}`);
    }

    chunks.push({
      chunkType: categoryToChunkType(file.metadata.category, false),
      chunkIndex: chunkIndex++,
      content: `=== ${section} ===\n${text}`,
      tokenCount,
      metadata: {
        sourceFile: file.filename,
        sourceType: file.sourceType,
        section,
        category: file.metadata.category,
        projectName: file.metadata.projectName || 'unknown',
      },
    });
  };

  // Strategy depends on the file structure
  const { category } = file.metadata;

  // drupal_architecture.json - split by content_types[], paragraphs[], taxonomies[]
  if (category === 'architecture') {
    if (data.project_overview) {
      createChunk('Project Overview', data.project_overview);
    }
    if (Array.isArray(data.content_types)) {
      // Group content types into chunks of ~3-4
      for (let i = 0; i < data.content_types.length; i += 3) {
        const batch = data.content_types.slice(i, i + 3);
        createChunk(`Content Types ${i + 1}-${i + batch.length}`, batch);
      }
    }
    if (Array.isArray(data.paragraphs)) {
      for (let i = 0; i < data.paragraphs.length; i += 4) {
        const batch = data.paragraphs.slice(i, i + 4);
        createChunk(`Paragraphs ${i + 1}-${i + batch.length}`, batch);
      }
    }
    if (Array.isArray(data.taxonomies)) {
      createChunk('Taxonomies', data.taxonomies);
    }
    if (data.views) {
      createChunk('Views', data.views);
    }
    if (data.menus) {
      createChunk('Menus', data.menus);
    }
    if (data.blocks) {
      createChunk('Blocks', data.blocks);
    }
    if (data.roles_permissions) {
      createChunk('Roles & Permissions', data.roles_permissions);
    }
    if (data.workflows) {
      createChunk('Workflows', data.workflows);
    }
    if (data.modules_required) {
      createChunk('Required Modules', data.modules_required);
    }
  }
  // cost_estimation.json - split by phases[], year costs, tco
  else if (category === 'cost_estimation') {
    if (data.project_summary) {
      createChunk('Project Summary', data.project_summary);
    }
    if (data.hourly_rates) {
      createChunk('Hourly Rates', data.hourly_rates);
    }

    const devCosts = data.development_costs as Record<string, unknown> | undefined;
    if (devCosts?.phases && Array.isArray(devCosts.phases)) {
      for (const phase of devCosts.phases) {
        const p = phase as Record<string, unknown>;
        createChunk(`Phase ${String(p.phase)}: ${String(p.name)}`, phase);
      }
      if (devCosts.totals) {
        createChunk('Development Totals', devCosts.totals);
      }
    }

    if (data.operational_costs) {
      createChunk('Operational Costs (5-Year)', data.operational_costs);
    }
    if (data.total_project_cost) {
      createChunk('Total Project Cost', data.total_project_cost);
    }
    if (data.payment_schedule) {
      createChunk('Payment Schedule', data.payment_schedule);
    }
    if (data.risk_contingency) {
      createChunk('Risk & Contingency', data.risk_contingency);
    }
  }
  // cms_comparison.json - split by systems_compared keys
  else if (category === 'cms_comparison') {
    for (const [key, value] of Object.entries(data)) {
      if (typeof value === 'object' && value !== null) {
        createChunk(key.replace(/_/g, ' '), value);
      }
    }
  }
  // migration_strategy.json - split by numbered sections
  else if (category === 'migration') {
    for (const [key, value] of Object.entries(data)) {
      // Split by main sections
      if (typeof value === 'object' && value !== null) {
        createChunk(key.replace(/_/g, ' '), value);
      }
    }
  }
  // performance_analysis.json - split by categories
  else if (category === 'performance') {
    if (data.core_web_vitals) {
      createChunk('Core Web Vitals', data.core_web_vitals);
    }
    if (data.network_analysis) {
      createChunk('Network Analysis', data.network_analysis);
    }
    if (data.asset_analysis) {
      createChunk('Asset Analysis', data.asset_analysis);
    }
    if (data.recommendations) {
      createChunk('Performance Recommendations', data.recommendations);
    }
    // Fallback for other keys
    for (const [key, value] of Object.entries(data)) {
      if (
        !['core_web_vitals', 'network_analysis', 'asset_analysis', 'recommendations'].includes(key)
      ) {
        if (typeof value === 'object' && value !== null) {
          createChunk(key.replace(/_/g, ' '), value);
        }
      }
    }
  }
  // accessibility_analysis.json - split by test categories
  else if (category === 'accessibility') {
    for (const [key, value] of Object.entries(data)) {
      if (typeof value === 'object' && value !== null) {
        createChunk(key.replace(/_/g, ' '), value);
      }
    }
  }
  // infrastructure (azure_architecture.json) - split by components
  else if (category === 'infrastructure') {
    if (data.overview) {
      createChunk('Infrastructure Overview', data.overview);
    }
    if (data.components) {
      createChunk('Azure Components', data.components);
    }
    if (data.networking) {
      createChunk('Networking', data.networking);
    }
    if (data.security) {
      createChunk('Security', data.security);
    }
    if (data.monitoring) {
      createChunk('Monitoring', data.monitoring);
    }
    if (data.costs) {
      createChunk('Infrastructure Costs', data.costs);
    }
    // Fallback
    for (const [key, value] of Object.entries(data)) {
      if (
        !['overview', 'components', 'networking', 'security', 'monitoring', 'costs'].includes(key)
      ) {
        if (typeof value === 'object' && value !== null) {
          createChunk(key.replace(/_/g, ' '), value);
        }
      }
    }
  }
  // Generic fallback - split top-level keys
  else {
    for (const [key, value] of Object.entries(data)) {
      if (typeof value === 'object' && value !== null) {
        createChunk(key.replace(/_/g, ' '), value);
      } else if (typeof value === 'string' && value.length > 50) {
        createChunk(key.replace(/_/g, ' '), value);
      }
    }
  }

  return chunks;
}

/**
 * Chunk a Markdown file by paragraphs
 */
function chunkMarkdownFile(file: ParsedAuditFile): AuditChunk[] {
  const chunks: AuditChunk[] = [];
  let chunkIndex = 0;

  // Split by double newlines (paragraphs) or headers
  const sections = file.content.split(/(?=^#{1,3}\s)/m);

  let currentChunk = '';
  let currentSection = 'Introduction';

  const flushChunk = (section: string): void => {
    if (currentChunk.trim().length === 0) return;

    const tokenCount = estimateTokens(currentChunk);
    if (tokenCount < MIN_CHUNK_SIZE) return;

    chunks.push({
      chunkType: categoryToChunkType(file.metadata.category, true),
      chunkIndex: chunkIndex++,
      content: currentChunk.trim(),
      tokenCount,
      metadata: {
        sourceFile: file.filename,
        sourceType: file.sourceType,
        section,
        category: file.metadata.category,
        projectName: file.metadata.projectName || 'unknown',
      },
    });
  };

  for (const section of sections) {
    // Extract section header if present
    const headerMatch = section.match(/^(#{1,3})\s+(.+?)$/m);
    if (headerMatch) {
      currentSection = headerMatch[2].trim();
    }

    // Split section into paragraphs
    const paragraphs = section.split(/\n\s*\n/).filter(p => p.trim().length > 0);

    for (const paragraph of paragraphs) {
      const potentialChunk = currentChunk + (currentChunk ? '\n\n' : '') + paragraph;
      const potentialTokens = estimateTokens(potentialChunk);

      if (potentialTokens > TARGET_CHUNK_SIZE && currentChunk.length > 0) {
        // Flush current chunk
        flushChunk(currentSection);
        currentChunk = paragraph;
      } else {
        currentChunk = potentialChunk;
      }
    }
  }

  // Flush final chunk
  flushChunk(currentSection);

  return chunks;
}

/**
 * Chunk a text file (similar to markdown)
 */
function chunkTextFile(file: ParsedAuditFile): AuditChunk[] {
  // Treat text files like markdown for chunking
  return chunkMarkdownFile(file);
}

/**
 * Chunk a single audit file based on its type
 */
export function chunkAuditFile(file: ParsedAuditFile): AuditChunk[] {
  switch (file.sourceType) {
    case 'json':
      return chunkJsonFile(file);
    case 'markdown':
      return chunkMarkdownFile(file);
    case 'text':
      return chunkTextFile(file);
    default:
      return [];
  }
}

/**
 * Chunk all files in an audit directory
 */
export function chunkAuditFiles(files: ParsedAuditFile[]): AuditChunk[] {
  const allChunks: AuditChunk[] = [];

  for (const file of files) {
    const fileChunks = chunkAuditFile(file);
    allChunks.push(...fileChunks);
  }

  return allChunks;
}

/**
 * Get chunking statistics
 */
export function getChunkingStats(chunks: AuditChunk[]): {
  totalChunks: number;
  totalTokens: number;
  avgTokensPerChunk: number;
  chunksByType: Record<string, number>;
  chunksByCategory: Record<string, number>;
} {
  const totalTokens = chunks.reduce((sum, c) => sum + c.tokenCount, 0);

  const chunksByType: Record<string, number> = {};
  const chunksByCategory: Record<string, number> = {};

  for (const chunk of chunks) {
    chunksByType[chunk.chunkType] = (chunksByType[chunk.chunkType] || 0) + 1;
    chunksByCategory[chunk.metadata.category] =
      (chunksByCategory[chunk.metadata.category] || 0) + 1;
  }

  return {
    totalChunks: chunks.length,
    totalTokens,
    avgTokensPerChunk: chunks.length > 0 ? Math.round(totalTokens / chunks.length) : 0,
    chunksByType,
    chunksByCategory,
  };
}
