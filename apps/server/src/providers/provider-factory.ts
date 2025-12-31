/**
 * Provider Factory - Routes model IDs to the appropriate provider
 *
 * This factory implements model-based routing to automatically select
 * the correct provider based on the model string. This makes adding
 * new providers (Cursor, OpenCode, etc.) trivial - just add one line.
 */

import { BaseProvider } from './base-provider.js';
import { ClaudeProvider } from './claude-provider.js';
import { OpenAIProvider } from './openai-provider.js';
import { OpenRouterProvider } from './openrouter-provider.js';
import type { ProviderConfigMap } from './provider-config.js';
import type { InstallationStatus } from './types.js';

export class ProviderFactory {
  /**
   * Get the appropriate provider for a given model ID
   *
   * @param modelId Model identifier (e.g., "claude-opus-4-5-20251101", "gpt-5.2", "cursor-fast")
   * @returns Provider instance for the model
   */
  static getProviderForModel(
    modelId: string,
    configs: ProviderConfigMap = {}
  ): BaseProvider {
    const lowerModel = modelId.toLowerCase();

    // Claude models (claude-*, opus, sonnet, haiku)
    if (lowerModel.startsWith('claude-') || ['haiku', 'sonnet', 'opus'].includes(lowerModel)) {
      return new ClaudeProvider(configs.claude);
    }

    // OpenRouter models (openrouter/*)
    if (lowerModel.startsWith('openrouter/')) {
      return new OpenRouterProvider(configs.openrouter);
    }

    // OpenAI models (gpt-*, o1*, o3*, etc.)
    if (lowerModel.startsWith('gpt-') || lowerModel.startsWith('o')) {
      return new OpenAIProvider(configs.openai);
    }

    // Default to Claude for unknown models
    console.warn(`[ProviderFactory] Unknown model prefix for "${modelId}", defaulting to Claude`);
    return new ClaudeProvider(configs.claude);
  }

  /**
   * Get all available providers
   */
  static getAllProviders(configs: ProviderConfigMap = {}): BaseProvider[] {
    return [
      new ClaudeProvider(configs.claude),
      new OpenAIProvider(configs.openai),
      new OpenRouterProvider(configs.openrouter),
    ];
  }

  /**
   * Check installation status for all providers
   *
   * @returns Map of provider name to installation status
   */
  static async checkAllProviders(
    configs: ProviderConfigMap = {}
  ): Promise<Record<string, InstallationStatus>> {
    const providers = this.getAllProviders(configs);
    const statuses: Record<string, InstallationStatus> = {};

    for (const provider of providers) {
      const name = provider.getName();
      const status = await provider.detectInstallation();
      statuses[name] = status;
    }

    return statuses;
  }

  /**
   * Get provider by name (for direct access if needed)
   *
   * @param name Provider name (e.g., "claude", "cursor")
   * @returns Provider instance or null if not found
   */
  static getProviderByName(
    name: string,
    configs: ProviderConfigMap = {}
  ): BaseProvider | null {
    const lowerName = name.toLowerCase();

    switch (lowerName) {
      case 'claude':
      case 'anthropic':
        return new ClaudeProvider(configs.claude);

      case 'openai':
        return new OpenAIProvider(configs.openai);

      case 'openrouter':
        return new OpenRouterProvider(configs.openrouter);

      // Future providers:
      // case "cursor":
      //   return new CursorProvider();
      // case "opencode":
      //   return new OpenCodeProvider();

      default:
        return null;
    }
  }

  /**
   * Get all available models from all providers
   */
  static getAllAvailableModels(configs: ProviderConfigMap = {}) {
    const providers = this.getAllProviders(configs);
    const allModels = [];

    for (const provider of providers) {
      const models = provider.getAvailableModels();
      allModels.push(...models);
    }

    return allModels;
  }
}
