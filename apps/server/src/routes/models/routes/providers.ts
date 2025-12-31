/**
 * GET /providers endpoint - Check provider status
 */

import type { Request, Response } from 'express';
import { ProviderFactory } from '../../../providers/provider-factory.js';
import { getProviderConfigMap } from '../../../providers/provider-config.js';
import type { SettingsService } from '../../../services/settings-service.js';
import { getErrorMessage, logError } from '../common.js';

export function createProvidersHandler(settingsService?: SettingsService) {
  return async (_req: Request, res: Response): Promise<void> => {
    try {
      // Get installation status from all providers
      const providerConfigs = await getProviderConfigMap(settingsService);
      const statuses = await ProviderFactory.checkAllProviders(providerConfigs);

      const providers: Record<string, any> = {
        anthropic: {
          available: statuses.claude?.installed || false,
          hasApiKey:
            !!providerConfigs.claude?.apiKey || !!process.env.ANTHROPIC_API_KEY,
        },
        openai: {
          available: statuses.openai?.installed || false,
          hasApiKey:
            !!providerConfigs.openai?.apiKey || !!process.env.OPENAI_API_KEY,
        },
        openrouter: {
          available: statuses.openrouter?.installed || false,
          hasApiKey:
            !!providerConfigs.openrouter?.apiKey ||
            !!process.env.OPENROUTER_API_KEY,
        },
      };

      res.json({ success: true, providers });
    } catch (error) {
      logError(error, 'Get providers failed');
      res.status(500).json({ success: false, error: getErrorMessage(error) });
    }
  };
}
