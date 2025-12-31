import { BaseProvider } from './base-provider.js';
import type {
  ExecuteOptions,
  ProviderMessage,
  InstallationStatus,
  ModelDefinition,
} from './types.js';
import {
  extractTextFromContent,
  normalizeContentBlocks,
} from '@automaker/utils';
import { getToolDefinitions } from './tools/tool-registry.js';
import { executeToolCalls } from './tools/tool-executor.js';
import type { ToolCall } from './tools/types.js';

type OpenAIContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

type OpenAIToolCall = {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
};

type OpenAIMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content?: string | OpenAIContentPart[] | null;
  tool_calls?: OpenAIToolCall[];
  tool_call_id?: string;
};

type OpenAIToolDefinition = {
  type: 'function';
  function: {
    name: string;
    description?: string;
    parameters: Record<string, unknown>;
  };
};

type OpenAIStreamChunk = {
  choices?: Array<{
    delta?: {
      content?: string;
      tool_calls?: Array<{
        index: number;
        id?: string;
        type?: string;
        function?: { name?: string; arguments?: string };
      }>;
    };
    finish_reason?: string | null;
  }>;
};

interface ToolCallAccumulator {
  id: string;
  name: string;
  arguments: string;
}

export class OpenAIProvider extends BaseProvider {
  getName(): string {
    return 'openai';
  }

  protected getApiKey(): string | undefined {
    return this.config.apiKey || process.env.OPENAI_API_KEY;
  }

  protected getBaseUrl(): string {
    return (
      this.config.baseUrl ||
      process.env.OPENAI_BASE_URL ||
      'https://api.openai.com/v1'
    );
  }

  protected getHeaders(): Record<string, string> {
    return this.config.headers ?? {};
  }

  protected getRequestTimeoutMs(): number {
    return this.config.timeoutMs ?? 60000;
  }

  async *executeQuery(options: ExecuteOptions): AsyncGenerator<ProviderMessage> {
    const {
      prompt,
      model,
      cwd,
      systemPrompt,
      maxTurns = 20,
      allowedTools,
      abortController,
      conversationHistory,
    } = options;

    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new Error('OpenAI API key not configured.');
    }

    const messages: OpenAIMessage[] = [];
    const systemText =
      typeof systemPrompt === 'string'
        ? systemPrompt
        : systemPrompt?.append || '';
    if (systemText) {
      messages.push({ role: 'system', content: systemText });
    }

    if (conversationHistory && conversationHistory.length > 0) {
      for (const entry of conversationHistory) {
        messages.push({
          role: entry.role,
          content: extractTextFromContent(entry.content),
        });
      }
    }

    const userContent = this.buildUserContent(prompt);
    messages.push({ role: 'user', content: userContent });

    const toolDefinitions = getToolDefinitions(allowedTools);
    const tools: OpenAIToolDefinition[] = toolDefinitions.map((tool) => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      },
    }));

    let activeMessages = messages;

    let iterations = 0;
    while (iterations < maxTurns) {
      iterations += 1;
      const toolCallAccumulators = new Map<number, ToolCallAccumulator>();
      let finishReason: string | null = null;
      let assistantText = '';

      const stream = await this.createChatCompletionStream({
        model,
        messages: activeMessages,
        tools: tools.length > 0 ? tools : undefined,
        abortController,
      });

      for await (const chunk of stream) {
        const choice = chunk.choices?.[0];
        if (!choice?.delta) continue;

        if (choice.delta.content) {
          const deltaText = choice.delta.content;
          assistantText += deltaText;
          yield {
            type: 'assistant',
            message: {
              role: 'assistant',
              content: [{ type: 'text', text: deltaText }],
            },
          };
        }

        if (choice.delta.tool_calls) {
          for (const toolCallDelta of choice.delta.tool_calls) {
            const index = toolCallDelta.index ?? 0;
            const existing = toolCallAccumulators.get(index) || {
              id: '',
              name: '',
              arguments: '',
            };
            if (toolCallDelta.id) {
              existing.id = toolCallDelta.id;
            }
            if (toolCallDelta.function?.name) {
              existing.name = toolCallDelta.function.name;
            }
            if (toolCallDelta.function?.arguments) {
              existing.arguments += toolCallDelta.function.arguments;
            }
            toolCallAccumulators.set(index, existing);
          }
        }

        if (choice.finish_reason) {
          finishReason = choice.finish_reason;
        }
      }

      const toolCalls = Array.from(toolCallAccumulators.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([, call]) => call)
        .filter((call) => call.id && call.name);

      if (toolCalls.length === 0) {
        if (finishReason && finishReason !== 'stop') {
          console.warn(
            `[OpenAIProvider] Stream finished with reason: ${finishReason}`
          );
        }
        yield {
          type: 'result',
          subtype: 'success',
          result: assistantText,
        };
        return;
      }

      const toolUseBlocks = toolCalls.map((call) => ({
        type: 'tool_use' as const,
        name: call.name,
        input: this.safeParseToolArguments(call.arguments),
        tool_use_id: call.id,
      }));

      yield {
        type: 'assistant',
        message: {
          role: 'assistant',
          content: toolUseBlocks,
        },
      };

      activeMessages = [
        ...activeMessages,
        {
          role: 'assistant',
          content: assistantText || null,
          tool_calls: toolCalls.map((call) => ({
            id: call.id,
            type: 'function' as const,
            function: {
              name: call.name,
              arguments: call.arguments,
            },
          })),
        },
      ];

      const toolCallInputs: ToolCall[] = toolCalls.map((call) => ({
        id: call.id,
        name: call.name,
        arguments: call.arguments,
      }));

      const toolResults = await executeToolCalls(
        toolCallInputs,
        {
          cwd,
          abortController,
        },
        allowedTools
      );

      for (const result of toolResults) {
        activeMessages.push({
          role: 'tool',
          tool_call_id: result.id,
          content: result.content,
        });
        yield {
          type: 'assistant',
          message: {
            role: 'assistant',
            content: [
              {
                type: 'tool_result',
                tool_use_id: result.id,
                content: result.content,
              },
            ],
          },
        };
      }
    }

    throw new Error('OpenAI tool loop exceeded maxTurns.');
  }

  async detectInstallation(): Promise<InstallationStatus> {
    const hasApiKey = Boolean(this.getApiKey());
    return {
      installed: true,
      method: 'sdk',
      hasApiKey,
      authenticated: hasApiKey,
    };
  }

  getAvailableModels(): ModelDefinition[] {
    return [
      {
        id: 'gpt-5.2',
        name: 'GPT-5.2',
        modelString: 'gpt-5.2',
        provider: 'openai',
        description: 'Latest OpenAI flagship model.',
        contextWindow: 256000,
        maxOutputTokens: 32000,
        supportsVision: true,
        supportsTools: true,
        tier: 'premium',
      },
      {
        id: 'gpt-5.2-codex',
        name: 'GPT-5.2 Codex',
        modelString: 'gpt-5.2-codex',
        provider: 'openai',
        description: 'GPT-5.2 tuned for coding tasks.',
        contextWindow: 256000,
        maxOutputTokens: 32000,
        supportsVision: true,
        supportsTools: true,
        tier: 'premium',
      },
      {
        id: 'gpt-5.1-codex',
        name: 'GPT-5.1 Codex',
        modelString: 'gpt-5.1-codex',
        provider: 'openai',
        description: 'Balanced codex model.',
        contextWindow: 256000,
        maxOutputTokens: 32000,
        supportsVision: true,
        supportsTools: true,
        tier: 'standard',
      },
      {
        id: 'gpt-5.1-codex-mini',
        name: 'GPT-5.1 Codex Mini',
        modelString: 'gpt-5.1-codex-mini',
        provider: 'openai',
        description: 'Lightweight codex model.',
        contextWindow: 256000,
        maxOutputTokens: 16000,
        supportsVision: false,
        supportsTools: true,
        tier: 'basic',
      },
      {
        id: 'gpt-4o',
        name: 'GPT-4o',
        modelString: 'gpt-4o',
        provider: 'openai',
        description: 'Fast multimodal model.',
        contextWindow: 128000,
        maxOutputTokens: 16000,
        supportsVision: true,
        supportsTools: true,
        tier: 'standard',
      },
      {
        id: 'gpt-4o-mini',
        name: 'GPT-4o Mini',
        modelString: 'gpt-4o-mini',
        provider: 'openai',
        description: 'Cost-efficient multimodal model.',
        contextWindow: 128000,
        maxOutputTokens: 16000,
        supportsVision: true,
        supportsTools: true,
        tier: 'basic',
      },
      {
        id: 'o1',
        name: 'o1',
        modelString: 'o1',
        provider: 'openai',
        description: 'Reasoning-focused model.',
        contextWindow: 200000,
        maxOutputTokens: 16000,
        supportsVision: false,
        supportsTools: true,
        tier: 'premium',
      },
      {
        id: 'o1-mini',
        name: 'o1 Mini',
        modelString: 'o1-mini',
        provider: 'openai',
        description: 'Lightweight reasoning model.',
        contextWindow: 200000,
        maxOutputTokens: 16000,
        supportsVision: false,
        supportsTools: true,
        tier: 'standard',
      },
    ];
  }

  supportsFeature(feature: string): boolean {
    const supported = ['tools', 'text', 'vision'];
    return supported.includes(feature);
  }

  private buildUserContent(
    prompt: ExecuteOptions['prompt']
  ): string | OpenAIContentPart[] {
    if (typeof prompt === 'string') {
      return prompt;
    }

    const blocks = normalizeContentBlocks(prompt);
    const parts: OpenAIContentPart[] = [];

    for (const block of blocks) {
      if (block.type === 'text' && block.text) {
        parts.push({ type: 'text', text: block.text });
      }
      if (block.type === 'image' && block.source && typeof block.source === 'object') {
        const source = block.source as {
          type?: string;
          media_type?: string;
          data?: string;
        };
        if (source.type === 'base64' && source.media_type && source.data) {
          parts.push({
            type: 'image_url',
            image_url: {
              url: `data:${source.media_type};base64,${source.data}`,
            },
          });
        }
      }
    }

    return parts.length > 0 ? parts : '';
  }

  private safeParseToolArguments(raw: string): unknown {
    if (!raw) return {};
    try {
      return JSON.parse(raw);
    } catch {
      return { raw };
    }
  }

  private async createChatCompletionStream({
    model,
    messages,
    tools,
    abortController,
  }: {
    model: string;
    messages: OpenAIMessage[];
    tools?: OpenAIToolDefinition[];
    abortController?: AbortController;
  }): Promise<AsyncGenerator<OpenAIStreamChunk>> {
    const response = await this.postChatCompletions({
      model,
      messages,
      tools,
      abortController,
    });

    if (!response.body) {
      throw new Error('OpenAI response body was empty.');
    }

    return this.streamResponseChunks(response.body);
  }

  private async postChatCompletions({
    model,
    messages,
    tools,
    abortController,
  }: {
    model: string;
    messages: OpenAIMessage[];
    tools?: OpenAIToolDefinition[];
    abortController?: AbortController;
  }): Promise<Response> {
    const baseUrl = this.getBaseUrl().replace(/\/$/, '');
    const url = `${baseUrl}/chat/completions`;
    const timeoutMs = this.getRequestTimeoutMs();
    const headers = {
      Authorization: `Bearer ${this.getApiKey()}`,
      'Content-Type': 'application/json',
      ...this.getHeaders(),
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const abortHandler = () => controller.abort();
    if (abortController) {
      abortController.signal.addEventListener('abort', abortHandler, {
        once: true,
      });
    }

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model,
          messages,
          tools,
          stream: true,
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
      if (abortController) {
        abortController.signal.removeEventListener('abort', abortHandler);
      }
    }

    if (!response.ok) {
      let errorMessage = `${response.status} ${response.statusText}`;
      try {
        const text = await response.text();
        if (text) {
          errorMessage += ` - ${text}`;
        }
      } catch {
        // ignore parsing error
      }
      throw new Error(`OpenAI request failed: ${errorMessage}`);
    }

    return response;
  }

  private async *streamResponseChunks(
    body: ReadableStream<Uint8Array>
  ): AsyncGenerator<OpenAIStreamChunk> {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let lineBreakIndex = buffer.indexOf('\n');
      while (lineBreakIndex >= 0) {
        const line = buffer.slice(0, lineBreakIndex).trim();
        buffer = buffer.slice(lineBreakIndex + 1);
        lineBreakIndex = buffer.indexOf('\n');

        if (!line || !line.startsWith('data:')) {
          continue;
        }

        const payload = line.replace(/^data:\s*/, '');
        if (payload === '[DONE]') {
          return;
        }

        try {
          const parsed = JSON.parse(payload) as OpenAIStreamChunk;
          yield parsed;
        } catch {
          continue;
        }
      }
    }
  }
}
