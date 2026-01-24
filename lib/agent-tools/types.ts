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
    | 'rfp'
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
    | 'quickscan'
    | 'quick_scan'
    | 'research'
    | 'staffing'
    | 'analysis'
    | 'pitchdeck'
    | 'audit'
    | 'workflow'
    | 'decision';
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
  rfp: 'RFP/Bid Management',
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
  quickscan: 'QuickScan Website Analysis',
  quick_scan: 'QuickScan Website Analysis',
  research: 'Company & Contact Research',
  staffing: 'Team Staffing & Skill Matching',
  analysis: 'Analysis & Estimation',
  pitchdeck: 'Pitchdeck Management',
  audit: 'Website Audits',
  workflow: 'Workflow & Job Management',
  decision: 'Decision Aggregation',
} as const;
