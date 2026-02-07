/**
 * AI SDK Bridge — Converts registry tools into AI SDK tool() instances.
 *
 * Replaces the meta-tool "runTool" pattern (z.object({}).passthrough())
 * with direct tool registration where each tool has its own Zod schema.
 * This gives the LLM proper type information for each tool's parameters.
 */

import { tool, type ToolSet } from 'ai';

import { registry } from './registry';
import type { ToolContext } from './types';

export interface WrapOptions {
  /** Called before each tool execution (e.g. for logging) */
  onExecute?: (toolName: string, input: unknown) => void;
  /** Called after each tool execution with result */
  onResult?: (toolName: string, result: unknown, durationMs: number) => void;
}

/**
 * Execute a registry tool with lifecycle hooks (onExecute/onResult).
 * Shared by wrapRegistryTool and callers that need custom guards.
 */
export async function executeRegistryTool(
  toolName: string,
  input: unknown,
  context: ToolContext,
  options?: WrapOptions
): Promise<unknown> {
  options?.onExecute?.(toolName, input);
  const start = Date.now();
  const result = await registry.execute(toolName, input, context);
  options?.onResult?.(toolName, result, Date.now() - start);
  return result;
}

/**
 * Wrap a single registry tool into an AI SDK tool() with its original Zod schema.
 *
 * Throws if the tool is not found in the registry.
 */
export function wrapRegistryTool(toolName: string, context: ToolContext, options?: WrapOptions) {
  const definition = registry.get(toolName);
  if (!definition) {
    throw new Error(`wrapRegistryTool: tool "${toolName}" not found in registry`);
  }

  return tool({
    description: definition.description,
    inputSchema: definition.inputSchema,
    execute: (input: unknown) => executeRegistryTool(toolName, input, context, options),
  });
}

/**
 * Wrap multiple registry tools at once into a ToolSet.
 *
 * Tool names containing dots stay as-is — AI SDK supports dots in keys.
 *
 * Tools that don't exist in the registry are silently skipped
 * (useful when some tools are conditionally registered).
 */
export function wrapRegistryTools(
  toolNames: string[],
  context: ToolContext,
  options?: WrapOptions
): ToolSet {
  const tools: ToolSet = {};

  for (const name of toolNames) {
    if (!registry.get(name)) {
      console.warn(`wrapRegistryTools: skipping unknown tool "${name}"`);
      continue;
    }
    tools[name] = wrapRegistryTool(name, context, options);
  }

  return tools;
}
