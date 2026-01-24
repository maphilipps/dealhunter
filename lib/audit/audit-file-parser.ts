/**
 * Audit File Parser
 *
 * Reads and parses audit files from an audit directory.
 * Supports JSON and Markdown files with metadata extraction.
 */

import { readdir, readFile } from 'fs/promises';
import { join, extname, basename } from 'path';

export interface ParsedAuditFile {
  filename: string;
  filePath: string;
  sourceType: 'json' | 'markdown' | 'text';
  content: string;
  parsed: Record<string, unknown> | null; // Parsed JSON or null for text/md
  metadata: {
    projectName: string | null;
    category: string;
    fileSize: number;
  };
}

export interface AuditDirectory {
  basePath: string;
  projectName: string;
  files: ParsedAuditFile[];
}

/**
 * Maps filename patterns to audit categories
 */
function getCategory(filename: string): string {
  const lower = filename.toLowerCase();

  if (lower.includes('architecture') && lower.includes('drupal')) return 'architecture';
  if (lower.includes('architecture') && lower.includes('azure')) return 'infrastructure';
  if (lower.includes('cms_comparison') || lower.includes('comparison')) return 'cms_comparison';
  if (lower.includes('cost') || lower.includes('estimation')) return 'cost_estimation';
  if (lower.includes('migration')) return 'migration';
  if (lower.includes('performance')) return 'performance';
  if (lower.includes('accessibility')) return 'accessibility';
  if (lower.includes('readme')) return 'overview';

  return 'general';
}

/**
 * Extract project name from audit data
 */
function extractProjectName(files: ParsedAuditFile[]): string | null {
  // Try to find project name in JSON files
  for (const file of files) {
    if (file.parsed) {
      // Check common locations for project name
      const data = file.parsed;

      // project_summary.project_name (cost_estimation.json)
      const summary = data.project_summary as Record<string, unknown> | undefined;
      if (typeof summary?.project_name === 'string') return summary.project_name;

      // project_overview.name (drupal_architecture.json)
      const overview = data.project_overview as Record<string, unknown> | undefined;
      if (typeof overview?.name === 'string') return overview.name;

      // Direct project_name
      if (typeof data.project_name === 'string') return data.project_name;
    }
  }

  return null;
}

/**
 * Parse a single audit file
 */
async function parseAuditFile(filePath: string): Promise<ParsedAuditFile> {
  const content = await readFile(filePath, 'utf-8');
  const filename = basename(filePath);
  const ext = extname(filename).toLowerCase();

  let sourceType: 'json' | 'markdown' | 'text';
  let parsed: Record<string, unknown> | null = null;

  if (ext === '.json') {
    sourceType = 'json';
    try {
      parsed = JSON.parse(content);
    } catch {
      console.warn(`[Audit Parser] Failed to parse JSON: ${filename}`);
    }
  } else if (ext === '.md') {
    sourceType = 'markdown';
  } else {
    sourceType = 'text';
  }

  return {
    filename,
    filePath,
    sourceType,
    content,
    parsed,
    metadata: {
      projectName: null, // Will be set later at directory level
      category: getCategory(filename),
      fileSize: content.length,
    },
  };
}

// Directories to exclude from scanning
const EXCLUDED_DIRS = ['.venv', '.claude', 'node_modules', '.git', '__pycache__', 'dist', 'build'];

/**
 * Recursively scan a directory for supported files
 */
async function scanDirectory(dirPath: string, supportedExtensions: string[]): Promise<string[]> {
  const results: string[] = [];

  try {
    const entries = await readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dirPath, entry.name);

      if (entry.isDirectory()) {
        // Skip excluded directories
        if (!EXCLUDED_DIRS.includes(entry.name)) {
          const subFiles = await scanDirectory(fullPath, supportedExtensions);
          results.push(...subFiles);
        }
      } else if (entry.isFile()) {
        const ext = extname(entry.name).toLowerCase();
        if (supportedExtensions.includes(ext)) {
          results.push(fullPath);
        }
      }
    }
  } catch {
    // Directory doesn't exist or can't be read
  }

  return results;
}

/**
 * Parse all audit files from an audit directory
 *
 * @param auditPath - Path to the audit directory (e.g., audits/audit_lucarnofestival.ch)
 * @returns Parsed audit directory with all files
 */
export async function parseAuditDirectory(auditPath: string): Promise<AuditDirectory> {
  const supportedExtensions = ['.json', '.md', '.txt'];

  // Scan entire audit directory recursively (excluding .venv, node_modules, etc.)
  const allFilePaths = await scanDirectory(auditPath, supportedExtensions);

  // Parse all files
  const files: ParsedAuditFile[] = [];

  for (const filePath of allFilePaths) {
    const parsed = await parseAuditFile(filePath);
    files.push(parsed);
  }

  // Extract project name from parsed data
  const projectName = extractProjectName(files) || basename(auditPath).replace('audit_', '');

  // Update metadata with project name
  for (const file of files) {
    file.metadata.projectName = projectName;
  }

  return {
    basePath: auditPath,
    projectName,
    files,
  };
}

/**
 * Get file statistics for an audit directory
 */
export function getAuditStats(audit: AuditDirectory): {
  totalFiles: number;
  jsonFiles: number;
  markdownFiles: number;
  textFiles: number;
  totalSize: number;
  categories: string[];
} {
  const jsonFiles = audit.files.filter(f => f.sourceType === 'json').length;
  const markdownFiles = audit.files.filter(f => f.sourceType === 'markdown').length;
  const textFiles = audit.files.filter(f => f.sourceType === 'text').length;
  const totalSize = audit.files.reduce((sum, f) => sum + f.metadata.fileSize, 0);
  const categories = [...new Set(audit.files.map(f => f.metadata.category))];

  return {
    totalFiles: audit.files.length,
    jsonFiles,
    markdownFiles,
    textFiles,
    totalSize,
    categories,
  };
}
