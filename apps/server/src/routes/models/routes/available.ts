/**
 * GET /available endpoint - Get available models
 */

import type { Request, Response } from 'express';
import { ProviderFactory } from '../../../providers/provider-factory.js';
import { getProviderConfigMap } from '../../../providers/provider-config.js';
import type { SettingsService } from '../../../services/settings-service.js';
import { getErrorMessage, logError } from '../common.js';

export function createAvailableHandler(settingsService?: SettingsService) {
  return async (_req: Request, res: Response): Promise<void> => {
    try {
      const providerConfigs = await getProviderConfigMap(settingsService);
      const models = ProviderFactory.getAllAvailableModels(providerConfigs);

      res.json({ success: true, models });
    } catch (error) {
      logError(error, 'Get available models failed');
      res.status(500).json({ success: false, error: getErrorMessage(error) });
    }
  };
}
