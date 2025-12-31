import type { AgentModel, ModelProvider } from '@/store/app-store';

// Helper to determine provider from model
export function getProviderFromModel(model: AgentModel): ModelProvider {
  const normalized = model.toLowerCase();
  if (normalized.startsWith('openrouter/')) return 'openrouter';
  if (normalized.startsWith('gpt-') || /^o\d/.test(normalized)) return 'openai';
  return 'claude';
}
