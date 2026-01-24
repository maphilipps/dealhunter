export interface AgentFile {
  filename: string; // Relative to audit_data/
  content: string | object; // MD text or JSON object
  format: 'json' | 'markdown';
}

export interface NavigationSubpage {
  id: string;
  label: string;
  route: string; // e.g., '/performance/vitals' (relative to docs root)
  content?: unknown; // Optional context for the page generator
}

export interface AgentNavigation {
  label: string; // Top-level section label (e.g., "Performance")
  subpages: NavigationSubpage[];
}

export interface ExpertAgentOutput {
  // Core content for file generation
  content: unknown; // Agent-specific structured data

  // Visualization support (json-render)
  visualization?: {
    component: string; // Component type (ResultCard, Grid, Metric, etc.)
    props: Record<string, unknown>; // Component props
    children?: string[]; // Child element keys
    elements?: Record<string, unknown>; // Definition of child elements
  };

  // File generation support
  files?: AgentFile[]; // Files to write to audit_data/

  // Navigation generation
  navigation?: AgentNavigation;

  // Metadata
  confidence: number;
  sources?: string[];
}

export interface AuditScanResult {
  auditPath: string;
  files: AgentFile[];
  subpages: NavigationSubpage[];
  visualizationTree: unknown; // Full json-render tree
}
