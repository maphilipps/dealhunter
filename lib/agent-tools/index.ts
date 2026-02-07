export { registry, listToolsForAgent, getToolsByCategory } from './registry';
export type { ToolDefinition, ToolContext, ToolResult, ToolRegistry } from './types';
export { TOOL_CATEGORIES } from './types';

// Register all tools by importing their modules
import './tools/pre-qualification';
import './tools/qualification';
import './tools/account';
import './tools/reference';
import './tools/competency';
import './tools/competitor';
import './tools/employee';
import './tools/technology';
import './tools/business-unit';
import './tools/user';
import './tools/document';
import './tools/staffing';
import './tools/feature';
import './tools/cms-evaluation';
import './tools/export';
import './tools/qualification-scan-crud';
import './tools/qualification-scan'; // @deprecated aliases for qualification-scan tools
import './tools/analysis';
import './tools/pitchdeck';
import './tools/audit';
import './tools/audit-trail';
import './tools/workflow';
import './tools/notification';
import './tools/extraction';
import './tools/progress';
import './tools/pitch-scan-run';
import './tools/pitch-run'; // @deprecated aliases for pitch-scan-run tools
import './tools/team-assignment';
import './scan-tools';

// Qualification Scan Agent Tools (formerly QualificationScan 2.0 / Qualification Scan)
import './qualification-scan-tools';
export {
  QUALIFICATION_SCAN_TOOLS,
  QUICKSCAN_TOOLS,
  LEAD_SCAN_TOOLS,
  type QualificationScanToolName,
  type QuickScanToolName,
  type LeadScanToolName,
} from './qualification-scan-tools';

// Intelligent Agent Framework — Raw Primitives (preferred)
export {
  createRawTools,
  webSearch,
  fetchUrl,
  githubRepo,
  crawlPage,
  crawlSite,
  quickNavScan,
  screenshot,
  fetchSitemap,
  getSearchProvider,
} from './intelligent-tools';

// Intelligent Agent Framework — Deprecated (use raw primitives above)
export {
  createIntelligentTools,
  webSearchAITool,
  githubAITool,
  crawlSiteAITool,
  intelligentAITools,
  KNOWN_GITHUB_REPOS,
  type IntelligentTools,
  type IntelligentToolsContext,
  type SearchResult,
  type GitHubInfo,
  type PageContent,
  type SiteCrawlResult,
} from './intelligent-tools';

// Evaluator Primitives (preferred)
export {
  validateFields,
  countConfidencesMet,
  calculateCompleteness,
  type FieldValidation,
  type ConfidenceCount,
  type CompletenessResult,
} from './evaluator';

// Evaluator (deprecated wrappers — use primitives above)
export {
  evaluateResults,
  quickEvaluate,
  evaluateQualificationScanResults,
  evaluateCMSMatchingResults,
  evaluateBITResults,
  QUICKSCAN_EVALUATION_SCHEMA,
  CMS_MATCHING_EVALUATION_SCHEMA,
  BIT_EVALUATION_SCHEMA,
  type EvaluationResult,
  type EvaluationIssue,
  type EvaluationSchema,
  type EvaluatorContext,
} from './evaluator';

// Optimizer Primitives (preferred)
export {
  matchCMSPatterns,
  extractEmployeeCount,
  extractIndustry,
  detectFeatures,
  parseConfidenceField,
  flattenSearchResults,
  type CMSMatch,
  type EmployeeExtraction,
  type FeatureDetection,
} from './optimizer';

// Optimizer (deprecated wrappers — use primitives above + IntelligentTools directly)
export {
  optimizeResults,
  optimizeArea,
  optimizeQualificationScanResults,
  optimizeCMSMatchingResults,
  evaluateAndOptimize,
  type OptimizerContext,
  type OptimizationResult,
} from './optimizer';

// Agent-Native RAG Write Tools (Agent writes directly to knowledge base)
export {
  createRagWriteTool,
  createBatchRagWriteTool,
  type RagWriteToolContext,
} from './tools/rag-write-tool';

export {
  createVisualizationWriteTool,
  VisualizationHelpers,
  type VisualizationWriteToolContext,
} from './tools/visualization-write-tool';

// RAG Read Tool (Agent queries knowledge base)
export { createRagTool } from './tools/rag-tool';
