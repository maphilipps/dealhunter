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
import './tools/staffing';
import './tools/quickscan';
import './tools/analysis';
import './tools/pitchdeck';
import './tools/audit';
import './tools/workflow';
import './tools/notification';
import './tools/extraction';
import './tools/pitch-run';
import './tools/team-assignment';
import './scan-tools';

// QuickScan 2.0 Agent Tools
import './quick-scan-tools';
export { QUICKSCAN_TOOLS, type QuickScanToolName } from './quick-scan-tools';

// Intelligent Agent Framework
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

export {
  evaluateResults,
  quickEvaluate,
  evaluateQuickScanResults,
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

export {
  optimizeResults,
  optimizeArea,
  optimizeQuickScanResults,
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
