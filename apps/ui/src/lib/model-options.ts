import type { ModelDefinition } from '@automaker/types';

export type ModelOption = {
  id: string;
  label: string;
  description: string;
  badge?: string;
  provider: string;
  supportsThinking: boolean;
};

const FALLBACK_MODELS: ModelOption[] = [
  {
    id: 'haiku',
    label: 'Claude Haiku',
    description: 'Fast and efficient for simple tasks.',
    badge: 'Speed',
    provider: 'claude',
    supportsThinking: true,
  },
  {
    id: 'sonnet',
    label: 'Claude Sonnet',
    description: 'Balanced performance with strong reasoning.',
    badge: 'Balanced',
    provider: 'claude',
    supportsThinking: true,
  },
  {
    id: 'opus',
    label: 'Claude Opus',
    description: 'Most capable model for complex work.',
    badge: 'Premium',
    provider: 'claude',
    supportsThinking: true,
  },
];

const TIER_BADGES: Record<string, string> = {
  basic: 'Basic',
  standard: 'Standard',
  premium: 'Premium',
};

const PROVIDER_ORDER = ['claude', 'openai', 'openrouter'];

const getClaudeAlias = (modelId: string): string | undefined => {
  const lower = modelId.toLowerCase();
  if (lower.includes('haiku')) return 'haiku';
  if (lower.includes('sonnet')) return 'sonnet';
  if (lower.includes('opus')) return 'opus';
  return undefined;
};

const mapModel = (model: ModelDefinition): ModelOption => {
  const modelId = model.modelString || model.id;
  const alias = model.provider === 'claude' ? getClaudeAlias(modelId) : undefined;
  return {
    id: alias ?? modelId,
    label: model.name || modelId,
    description: model.description || '',
    badge: model.tier ? TIER_BADGES[model.tier] : undefined,
    provider: model.provider,
    supportsThinking: model.provider === 'claude',
  };
};

const sortModels = (a: ModelOption, b: ModelOption): number => {
  const rank = (provider: string) => {
    const index = PROVIDER_ORDER.indexOf(provider);
    return index === -1 ? PROVIDER_ORDER.length : index;
  };
  const providerRank = rank(a.provider) - rank(b.provider);
  if (providerRank !== 0) return providerRank;
  return a.label.localeCompare(b.label);
};

export function getModelOptions(models?: ModelDefinition[]): ModelOption[] {
  if (!models || models.length === 0) {
    return FALLBACK_MODELS;
  }
  return models.map(mapModel).sort(sortModels);
}
