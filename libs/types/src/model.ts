/**
 * Model alias mapping for Claude models
 */
export const CLAUDE_MODEL_MAP: Record<string, string> = {
  haiku: 'claude-haiku-4-5-20251001',
  sonnet: 'claude-sonnet-4-5-20250929',
  opus: 'claude-opus-4-5-20251101',
} as const;

/**
 * Default models per provider
 */
export const DEFAULT_MODELS = {
  claude: 'claude-opus-4-5-20251101',
  openai: 'gpt-4o',
  openrouter: 'openrouter/auto',
} as const;

export type ModelAlias = keyof typeof CLAUDE_MODEL_MAP;

/**
 * AgentModel - Alias for ModelAlias for backward compatibility
 * Represents available Claude models: "opus" | "sonnet" | "haiku"
 */
/**
 * AgentModel - Model alias or full model string
 *
 * Includes Claude aliases ("opus", "sonnet", "haiku") and full provider model
 * strings (e.g., "claude-opus-4-5-20251101", "gpt-4o", "openrouter/auto").
 */
export type AgentModel = string;
