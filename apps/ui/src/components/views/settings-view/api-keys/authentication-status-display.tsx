import { Label } from '@/components/ui/label';
import { CheckCircle2, AlertCircle, Info, Terminal, Sparkles, Globe, Zap } from 'lucide-react';
import type { ClaudeAuthStatus } from '@/store/setup-store';
import type { AIProfile, ModelProvider } from '@automaker/types';
import { cn } from '@/lib/utils';

interface AuthenticationStatusDisplayProps {
  claudeAuthStatus: ClaudeAuthStatus | null;
  apiKeyStatus: {
    hasAnthropicKey: boolean;
    hasGoogleKey: boolean;
    hasOpenAIKey: boolean;
    hasOpenRouterKey: boolean;
  } | null;
  apiKeys: {
    anthropic: string;
    google: string;
    openai: string;
    openrouter: string;
  };
  activeProfile?: AIProfile | null;
  aiProfiles?: AIProfile[];
  onSetActiveProvider?: (provider: ModelProvider) => void;
}

export function AuthenticationStatusDisplay({
  claudeAuthStatus,
  apiKeyStatus,
  apiKeys,
  activeProfile,
  aiProfiles = [],
  onSetActiveProvider,
}: AuthenticationStatusDisplayProps) {
  // Determine which provider is active based on the default AI profile
  const activeProvider = activeProfile?.provider || 'claude';
  const isClaudeActive = activeProvider === 'claude';
  const isOpenAIActive = activeProvider === 'openai';
  const isOpenRouterActive = activeProvider === 'openrouter';

  // Check which providers have profiles available
  const hasClaudeProfile = aiProfiles.some((p) => p.provider === 'claude');
  const hasOpenAIProfile = aiProfiles.some((p) => p.provider === 'openai');
  const hasOpenRouterProfile = aiProfiles.some((p) => p.provider === 'openrouter');

  // Check which providers are configured (have API key)
  const isClaudeConfigured = claudeAuthStatus?.authenticated || apiKeyStatus?.hasAnthropicKey || !!apiKeys.anthropic;
  const isOpenAIConfigured = apiKeyStatus?.hasOpenAIKey || !!apiKeys.openai;
  const isOpenRouterConfigured = apiKeyStatus?.hasOpenRouterKey || !!apiKeys.openrouter;

  // Handle clicking on a provider card
  const handleProviderClick = (provider: ModelProvider) => {
    if (onSetActiveProvider) {
      onSetActiveProvider(provider);
    }
  };

  return (
    <div className="space-y-4 pt-4 border-t border-border">
      <div className="flex items-center gap-2 mb-3">
        <Info className="w-4 h-4 text-brand-500" />
        <Label className="text-foreground font-semibold">
          Current Authentication Configuration
        </Label>
        {activeProfile && (
          <span className="ml-auto text-xs text-muted-foreground">
            Active profile: <span className="text-foreground font-medium">{activeProfile.name}</span>
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Claude Authentication Status */}
        <button
          type="button"
          onClick={() => handleProviderClick('claude')}
          disabled={!isClaudeConfigured || !hasClaudeProfile || isClaudeActive}
          className={cn(
            'p-3 rounded-lg bg-card border text-left transition-all',
            isClaudeActive
              ? 'border-green-500/50 ring-1 ring-green-500/20'
              : 'border-border',
            isClaudeConfigured && hasClaudeProfile && !isClaudeActive
              ? 'hover:border-brand-500/50 hover:bg-accent/30 cursor-pointer'
              : 'cursor-default'
          )}
        >
          <div className="flex items-center gap-2 mb-1.5">
            <Terminal className="w-4 h-4 text-brand-500" />
            <span className="text-sm font-medium text-foreground">Claude (Anthropic)</span>
            {isClaudeActive ? (
              <span className="ml-auto flex items-center gap-1 text-[10px] font-medium text-green-500 bg-green-500/10 px-1.5 py-0.5 rounded">
                <Zap className="w-3 h-3" />
                Active
              </span>
            ) : isClaudeConfigured && hasClaudeProfile ? (
              <span className="ml-auto text-[10px] text-muted-foreground">Click to activate</span>
            ) : null}
          </div>
          <div className="space-y-1.5 text-xs min-h-12">
            {claudeAuthStatus?.authenticated ? (
              <>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3 h-3 text-green-500 shrink-0" />
                  <span className="text-green-400 font-medium">Authenticated</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Info className="w-3 h-3 shrink-0" />
                  <span>
                    {claudeAuthStatus.method === 'oauth_token'
                      ? 'Using stored OAuth token (subscription)'
                      : claudeAuthStatus.method === 'api_key_env'
                        ? 'Using ANTHROPIC_API_KEY'
                        : claudeAuthStatus.method === 'api_key'
                          ? 'Using stored API key'
                          : claudeAuthStatus.method === 'credentials_file'
                            ? 'Using credentials file'
                            : claudeAuthStatus.method === 'cli_authenticated'
                              ? 'Using Claude CLI authentication'
                              : `Using ${claudeAuthStatus.method || 'detected'} authentication`}
                  </span>
                </div>
              </>
            ) : apiKeyStatus?.hasAnthropicKey ? (
              <div className="flex items-center gap-2 text-blue-400">
                <Info className="w-3 h-3 shrink-0" />
                <span>Using environment variable (ANTHROPIC_API_KEY)</span>
              </div>
            ) : apiKeys.anthropic ? (
              <div className="flex items-center gap-2 text-blue-400">
                <Info className="w-3 h-3 shrink-0" />
                <span>Using manual API key from settings</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-yellow-500 py-0.5">
                <AlertCircle className="w-3 h-3 shrink-0" />
                <span className="text-xs">Not configured</span>
              </div>
            )}
          </div>
        </button>

        {/* OpenAI Authentication Status */}
        <button
          type="button"
          onClick={() => handleProviderClick('openai')}
          disabled={!isOpenAIConfigured || !hasOpenAIProfile || isOpenAIActive}
          className={cn(
            'p-3 rounded-lg bg-card border text-left transition-all',
            isOpenAIActive
              ? 'border-green-500/50 ring-1 ring-green-500/20'
              : 'border-border',
            isOpenAIConfigured && hasOpenAIProfile && !isOpenAIActive
              ? 'hover:border-brand-500/50 hover:bg-accent/30 cursor-pointer'
              : 'cursor-default'
          )}
        >
          <div className="flex items-center gap-2 mb-1.5">
            <Sparkles className="w-4 h-4 text-brand-500" />
            <span className="text-sm font-medium text-foreground">OpenAI</span>
            {isOpenAIActive ? (
              <span className="ml-auto flex items-center gap-1 text-[10px] font-medium text-green-500 bg-green-500/10 px-1.5 py-0.5 rounded">
                <Zap className="w-3 h-3" />
                Active
              </span>
            ) : isOpenAIConfigured && hasOpenAIProfile ? (
              <span className="ml-auto text-[10px] text-muted-foreground">Click to activate</span>
            ) : null}
          </div>
          <div className="space-y-1.5 text-xs min-h-12">
            {apiKeyStatus?.hasOpenAIKey ? (
              <div className="flex items-center gap-2 text-blue-400">
                <Info className="w-3 h-3 shrink-0" />
                <span>Using environment variable (OPENAI_API_KEY)</span>
              </div>
            ) : apiKeys.openai ? (
              <div className="flex items-center gap-2 text-blue-400">
                <Info className="w-3 h-3 shrink-0" />
                <span>Using manual API key from settings</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-yellow-500 py-0.5">
                <AlertCircle className="w-3 h-3 shrink-0" />
                <span className="text-xs">Not configured</span>
              </div>
            )}
          </div>
        </button>

        {/* OpenRouter Authentication Status */}
        <button
          type="button"
          onClick={() => handleProviderClick('openrouter')}
          disabled={!isOpenRouterConfigured || !hasOpenRouterProfile || isOpenRouterActive}
          className={cn(
            'p-3 rounded-lg bg-card border text-left transition-all',
            isOpenRouterActive
              ? 'border-green-500/50 ring-1 ring-green-500/20'
              : 'border-border',
            isOpenRouterConfigured && hasOpenRouterProfile && !isOpenRouterActive
              ? 'hover:border-brand-500/50 hover:bg-accent/30 cursor-pointer'
              : 'cursor-default'
          )}
        >
          <div className="flex items-center gap-2 mb-1.5">
            <Globe className="w-4 h-4 text-brand-500" />
            <span className="text-sm font-medium text-foreground">
              OpenRouter
            </span>
            {isOpenRouterActive ? (
              <span className="ml-auto flex items-center gap-1 text-[10px] font-medium text-green-500 bg-green-500/10 px-1.5 py-0.5 rounded">
                <Zap className="w-3 h-3" />
                Active
              </span>
            ) : isOpenRouterConfigured && hasOpenRouterProfile ? (
              <span className="ml-auto text-[10px] text-muted-foreground">Click to activate</span>
            ) : null}
          </div>
          <div className="space-y-1.5 text-xs min-h-12">
            {apiKeyStatus?.hasOpenRouterKey ? (
              <div className="flex items-center gap-2 text-blue-400">
                <Info className="w-3 h-3 shrink-0" />
                <span>Using environment variable (OPENROUTER_API_KEY)</span>
              </div>
            ) : apiKeys.openrouter ? (
              <div className="flex items-center gap-2 text-blue-400">
                <Info className="w-3 h-3 shrink-0" />
                <span>Using manual API key from settings</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-yellow-500 py-0.5">
                <AlertCircle className="w-3 h-3 shrink-0" />
                <span className="text-xs">Not configured</span>
              </div>
            )}
          </div>
        </button>
      </div>
    </div>
  );
}
