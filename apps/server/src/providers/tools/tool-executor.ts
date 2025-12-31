import { getToolDefinitions } from './tool-registry.js';
import type {
  ToolCall,
  ToolExecutionContext,
  ToolExecutionOutput,
} from './types.js';

export async function executeToolCalls(
  calls: ToolCall[],
  context: ToolExecutionContext,
  allowedTools?: string[]
): Promise<ToolExecutionOutput[]> {
  const registry = new Map(
    getToolDefinitions(allowedTools).map((tool) => [tool.name, tool])
  );
  const results: ToolExecutionOutput[] = [];

  for (const call of calls) {
    const tool = registry.get(call.name);
    if (!tool) {
      results.push({
        id: call.id,
        name: call.name,
        content: `Tool "${call.name}" is not available.`,
        isError: true,
      });
      continue;
    }

    let parsedArgs: unknown;
    try {
      parsedArgs = call.arguments ? JSON.parse(call.arguments) : {};
    } catch (error) {
      results.push({
        id: call.id,
        name: call.name,
        content: `Failed to parse tool arguments: ${(error as Error).message}`,
        isError: true,
      });
      continue;
    }

    try {
      const result = await tool.execute(parsedArgs, context);
      results.push({
        id: call.id,
        name: call.name,
        content: result.content,
        isError: Boolean(result.isError),
      });
    } catch (error) {
      results.push({
        id: call.id,
        name: call.name,
        content: `Tool "${call.name}" failed: ${(error as Error).message}`,
        isError: true,
      });
    }
  }

  return results;
}
