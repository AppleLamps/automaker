import { OpenAIProvider } from './openai-provider.js';
import type { InstallationStatus, ModelDefinition } from './types.js';

export class OpenRouterProvider extends OpenAIProvider {
  getName(): string {
    return 'openrouter';
  }

  protected getApiKey(): string | undefined {
    return this.config.apiKey || process.env.OPENROUTER_API_KEY;
  }

  protected getBaseUrl(): string {
    return (
      this.config.baseUrl ||
      process.env.OPENROUTER_BASE_URL ||
      'https://openrouter.ai/api/v1'
    );
  }

  protected getHeaders(): Record<string, string> {
    const headers = { ...(this.config.headers ?? {}) };
    const referer = process.env.OPENROUTER_REFERER;
    const title = process.env.OPENROUTER_TITLE;
    if (referer && !headers['HTTP-Referer']) {
      headers['HTTP-Referer'] = referer;
    }
    if (title && !headers['X-Title']) {
      headers['X-Title'] = title;
    }
    return headers;
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
        id: 'openrouter/auto',
        name: 'OpenRouter Auto',
        modelString: 'openrouter/auto',
        provider: 'openrouter',
        description: 'OpenRouter auto-routing across providers.',
        supportsVision: true,
        supportsTools: true,
        tier: 'standard',
        default: true,
      },
      {
        id: 'openrouter/openai/gpt-4o',
        name: 'OpenRouter GPT-4o',
        modelString: 'openrouter/openai/gpt-4o',
        provider: 'openrouter',
        description: 'OpenRouter route to GPT-4o.',
        supportsVision: true,
        supportsTools: true,
        tier: 'standard',
      },
    ];
  }
}
