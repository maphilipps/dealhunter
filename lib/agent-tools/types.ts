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
    | 'extraction'
    | 'pitch-run';
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
  get: (name: string) => ToolDefinition | undefined;
  list: (category?: string) => ToolDefinition[];
  execute: <T>(name: string, input: unknown, context: ToolContext) => Promise<ToolResult<T>>;
}

/**
 * Tool categories for capability discovery
 */
export const TOOL_CATEGORIES = {
  'pre-qualification': 'Pre-Qualification/Bid Management',
  account: 'Account Management',
  reference: 'Reference Management',
  competency: 'Competency Management',
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
  audit: 'Website Audits',
  workflow: 'Workflow & Job Management',
  decision: 'Decision Aggregation',
  scan: 'Scan Primitives',
  quickscan: 'Quick Scan Tools',
  extraction: 'Document Extraction',
  'pitch-run': 'Pitch Run & Audit Management',
} as const;
