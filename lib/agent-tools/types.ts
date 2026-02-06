/**
 * Agent Tools Type Definitions
 *
 * These types define the contract for agent-callable tools.
 * Each tool is a primitive operation that agents can invoke.
 */

import { z } from 'zod';

/**
 * Base result type for all agent tools
 */
export interface ToolResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Tool definition for the registry
 */
export interface ToolDefinition<TInput = unknown, TOutput = unknown> {
  name: string;
  description: string;
  category:
    | 'pre-qualification'
    | 'lead'
    | 'account'
    | 'reference'
    | 'competency'
    | 'competitor'
    | 'employee'
    | 'technology'
    | 'business-unit'
    | 'user'
    | 'validation'
    | 'team'
    | 'routing'
    | 'notification'
    | 'document'
    | 'research'
    | 'staffing'
    | 'analysis'
    | 'pitchdeck'
    | 'audit'
    | 'workflow'
    | 'decision'
    | 'scan'
    | 'quickscan'
    | 'lead-scan'
    | 'qualification-scan'
    | 'extraction'
    | 'pitch-run'
    | 'pitch-scan'
    | 'team-assignment'
    | 'audit-trail'
    | 'progress';
  inputSchema: z.ZodSchema<TInput>;
  execute: (input: TInput, context: ToolContext) => Promise<ToolResult<TOutput>>;
}

/**
 * Context passed to each tool execution
 */
export interface ToolContext {
  userId: string;
  userRole: 'bd' | 'bl' | 'admin';
  userEmail: string;
  userName: string;
  businessUnitId?: string;
}

/**
 * Tool registry for discovering available tools
 */
export interface ToolRegistry {
  tools: Map<string, ToolDefinition>;
  register: <TInput, TOutput>(tool: ToolDefinition<TInput, TOutput>) => void;
  alias: (newName: string, existingName: string) => void;
  get: (name: string) => ToolDefinition | undefined;
  list: (category?: string) => ToolDefinition[];
  execute: <T>(name: string, input: unknown, context: ToolContext) => Promise<ToolResult<T>>;
}

/**
 * Tool categories for capability discovery
 */
export const TOOL_CATEGORIES = {
  'pre-qualification': 'Qualification/Bid Management',
  account: 'Account Management',
  reference: 'Reference Management',
  competency: 'Competency Management',
  competitor: 'Competitor Intelligence Management',
  employee: 'Employee Management',
  technology: 'Technology Management',
  'business-unit': 'Business Unit Management',
  user: 'User Management',
  validation: 'Validation Workflow',
  team: 'Team Assignment',
  routing: 'BL Routing',
  notification: 'Notifications',
  document: 'Document Management',
  research: 'Company & Contact Research',
  staffing: 'Team Staffing & Skill Matching',
  analysis: 'Analysis & Estimation',
  pitchdeck: 'Pitchdeck Management',
  audit: '@deprecated Website Audits (use pitch-scan)',
  workflow: 'Workflow & Job Management',
  decision: 'Decision Aggregation',
  scan: '@deprecated Scan Primitives (use qualification-scan)',
  quickscan: '@deprecated Quick Scan Tools (use qualification-scan)',
  'lead-scan': '@deprecated Qualification Scan Tools (use qualification-scan)',
  'qualification-scan': 'Qualification Scan Tools',
  extraction: 'Document Extraction',
  'pitch-run': '@deprecated Pitch Run & Audit Management (use pitch-scan)',
  'pitch-scan': 'Pitch Scan & Audit Management',
  'team-assignment': 'Team Assignment Management',
  'audit-trail': 'Audit Trail & History',
  progress: 'Scan & Workflow Progress',
} as const;
