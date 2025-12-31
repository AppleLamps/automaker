import type { SettingsService } from '../services/settings-service.js';
import type { ProviderConfig } from './types.js';

export type ProviderConfigMap = {
  claude?: ProviderConfig;
  openai?: ProviderConfig;
  openrouter?: ProviderConfig;
};

const normalizeKey = (value?: string): string | undefined => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

export async function getProviderConfigMap(
  settingsService?: SettingsService | null
): Promise<ProviderConfigMap> {
  if (!settingsService) return {};

  const [credentials, globalSettings] = await Promise.all([
    settingsService.getCredentials(),
    settingsService.getGlobalSettings(),
  ]);

  const providerSettings = globalSettings.providerSettings ?? {};

  return {
    claude: {
      apiKey: normalizeKey(credentials.apiKeys.anthropic),
    },
    openai: {
      apiKey: normalizeKey(credentials.apiKeys.openai),
      baseUrl: providerSettings.openai?.baseUrl,
      headers: providerSettings.openai?.headers,
      timeoutMs: providerSettings.openai?.timeoutMs,
    },
    openrouter: {
      apiKey: normalizeKey(credentials.apiKeys.openrouter),
      baseUrl: providerSettings.openrouter?.baseUrl,
      headers: providerSettings.openrouter?.headers,
      timeoutMs: providerSettings.openrouter?.timeoutMs,
    },
  };
}
