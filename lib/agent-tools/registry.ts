import type { ToolDefinition, ToolRegistry, ToolContext, ToolResult } from './types';

const toolsMap = new Map<string, ToolDefinition>();

export const registry: ToolRegistry = {
  tools: toolsMap,

  register<TInput, TOutput>(tool: ToolDefinition<TInput, TOutput>) {
    toolsMap.set(tool.name, tool as ToolDefinition);
  },

  get(name: string) {
    return toolsMap.get(name);
  },

  list(category?: string) {
    const tools = Array.from(toolsMap.values());
    if (!category) return tools;
    return tools.filter(t => t.category === category);
  },

  async execute<T>(name: string, input: unknown, context: ToolContext): Promise<ToolResult<T>> {
    const tool = toolsMap.get(name);
    if (!tool) {
      return { success: false, error: `Tool "${name}" not found` };
    }

    const parsed = tool.inputSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: `Invalid input: ${parsed.error.message}` };
    }

    return tool.execute(parsed.data, context) as Promise<ToolResult<T>>;
  },
};

export function listToolsForAgent(): Array<{
  name: string;
  description: string;
  category: string;
}> {
  return Array.from(toolsMap.values()).map(t => ({
    name: t.name,
    description: t.description,
    category: t.category,
  }));
}

export function getToolsByCategory(): Record<string, Array<{ name: string; description: string }>> {
  const result: Record<string, Array<{ name: string; description: string }>> = {};

  for (const tool of toolsMap.values()) {
    if (!result[tool.category]) {
      result[tool.category] = [];
    }
    result[tool.category].push({
      name: tool.name,
      description: tool.description,
    });
  }

  return result;
}
