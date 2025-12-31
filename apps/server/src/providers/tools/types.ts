export interface ToolExecutionContext {
  cwd: string;
  abortController?: AbortController;
}

export interface ToolExecutionResult {
  content: string;
  isError?: boolean;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  execute: (
    input: unknown,
    context: ToolExecutionContext
  ) => Promise<ToolExecutionResult>;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: string;
}

export interface ToolExecutionOutput {
  id: string;
  name: string;
  content: string;
  isError: boolean;
}
