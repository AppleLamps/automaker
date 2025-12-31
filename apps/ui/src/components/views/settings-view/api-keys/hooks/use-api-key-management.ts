import { useState, useEffect } from 'react';
import { useAppStore } from '@/store/app-store';
import { getElectronAPI } from '@/lib/electron';
import type { ProviderConfigParams } from '@/config/api-providers';
import { isElectronRenderer } from '@/lib/runtime';
import { toast } from 'sonner';

interface TestResult {
  success: boolean;
  message: string;
}

interface ApiKeyStatus {
  hasAnthropicKey: boolean;
  hasGoogleKey: boolean;
  hasOpenAIKey: boolean;
  hasOpenRouterKey: boolean;
}

/**
 * Custom hook for managing API key state and operations
 * Handles input values, visibility toggles, connection testing, and saving
 */
export function useApiKeyManagement() {
  const { apiKeys, setApiKeys } = useAppStore();

  // API key values
  const [anthropicKey, setAnthropicKey] = useState(apiKeys.anthropic);
  const [googleKey, setGoogleKey] = useState(apiKeys.google);
  const [openaiKey, setOpenaiKey] = useState(apiKeys.openai);
  const [openrouterKey, setOpenrouterKey] = useState(apiKeys.openrouter);

  // Visibility toggles
  const [showAnthropicKey, setShowAnthropicKey] = useState(false);
  const [showGoogleKey, setShowGoogleKey] = useState(false);
  const [showOpenaiKey, setShowOpenaiKey] = useState(false);
  const [showOpenrouterKey, setShowOpenrouterKey] = useState(false);

  // Test connection states
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [testingGeminiConnection, setTestingGeminiConnection] = useState(false);
  const [geminiTestResult, setGeminiTestResult] = useState<TestResult | null>(
    null
  );
  const [testingOpenaiConnection, setTestingOpenaiConnection] = useState(false);
  const [openaiTestResult, setOpenaiTestResult] = useState<TestResult | null>(
    null
  );
  const [testingOpenrouterConnection, setTestingOpenrouterConnection] =
    useState(false);
  const [openrouterTestResult, setOpenrouterTestResult] =
    useState<TestResult | null>(null);

  // API key status from environment
  const [apiKeyStatus, setApiKeyStatus] = useState<ApiKeyStatus | null>(null);

  // Save state
  const [saved, setSaved] = useState(false);

  // Sync local state with store
  useEffect(() => {
    setAnthropicKey(apiKeys.anthropic);
    setGoogleKey(apiKeys.google);
    setOpenaiKey(apiKeys.openai);
    setOpenrouterKey(apiKeys.openrouter);
  }, [apiKeys]);

  // Check API key status from environment on mount
  useEffect(() => {
    const checkApiKeyStatus = async () => {
      const api = getElectronAPI();
      if (api?.setup?.getApiKeys) {
        try {
          const status = await api.setup.getApiKeys();
          if (status.success) {
            setApiKeyStatus({
              hasAnthropicKey: status.hasAnthropicKey,
              hasGoogleKey: status.hasGoogleKey,
              hasOpenAIKey: status.hasOpenAIKey,
              hasOpenRouterKey: status.hasOpenRouterKey,
            });
          }
        } catch (error) {
          console.error('Failed to check API key status:', error);
        }
      }
    };
    checkApiKeyStatus();
  }, []);

  // Test Anthropic/Claude connection
  const handleTestAnthropicConnection = async () => {
    setTestingConnection(true);
    setTestResult(null);

    try {
      const api = getElectronAPI();
      const data = await api.setup.verifyClaudeAuth('api_key');

      if (data.success && data.authenticated) {
        setTestResult({
          success: true,
          message: 'Connection successful! Claude responded.',
        });
      } else {
        setTestResult({
          success: false,
          message: data.error || 'Failed to connect to Claude API.',
        });
      }
    } catch {
      setTestResult({
        success: false,
        message: 'Network error. Please check your connection.',
      });
    } finally {
      setTestingConnection(false);
    }
  };

  // Test Google/Gemini connection
  // TODO: Add backend endpoint for Gemini API key verification
  const handleTestGeminiConnection = async () => {
    setTestingGeminiConnection(true);
    setGeminiTestResult(null);

    // Basic validation - check key format
    if (!googleKey || googleKey.trim().length < 10) {
      setGeminiTestResult({
        success: false,
        message: 'Please enter a valid API key.',
      });
      setTestingGeminiConnection(false);
      return;
    }

    // For now, just validate the key format (starts with expected prefix)
    // Full verification requires a backend endpoint
    setGeminiTestResult({
      success: true,
      message: 'API key saved. Connection test not yet available.',
    });
    setTestingGeminiConnection(false);
  };

  const handleTestOpenAIConnection = async () => {
    setTestingOpenaiConnection(true);
    setOpenaiTestResult(null);

    if (!openaiKey || openaiKey.trim().length < 10) {
      setOpenaiTestResult({
        success: false,
        message: 'Please enter a valid API key.',
      });
      setTestingOpenaiConnection(false);
      return;
    }

    setOpenaiTestResult({
      success: true,
      message: 'API key saved. Connection test not yet available.',
    });
    setTestingOpenaiConnection(false);
  };

  const handleTestOpenRouterConnection = async () => {
    setTestingOpenrouterConnection(true);
    setOpenrouterTestResult(null);

    if (!openrouterKey || openrouterKey.trim().length < 10) {
      setOpenrouterTestResult({
        success: false,
        message: 'Please enter a valid API key.',
      });
      setTestingOpenrouterConnection(false);
      return;
    }

    setOpenrouterTestResult({
      success: true,
      message: 'API key saved. Connection test not yet available.',
    });
    setTestingOpenrouterConnection(false);
  };

  // Save API keys
  const handleSave = async () => {
    const trimmedAnthropicKey = anthropicKey.trim();
    const trimmedGoogleKey = googleKey.trim();
    const trimmedOpenaiKey = openaiKey.trim();
    const trimmedOpenrouterKey = openrouterKey.trim();

    if (isElectronRenderer()) {
      try {
        const api = getElectronAPI();
        if (api.setup?.storeApiKey && trimmedAnthropicKey) {
          const result = await api.setup.storeApiKey('anthropic', trimmedAnthropicKey);
          if (!result.success) {
            toast.error('Failed to save API key', {
              description: result.error,
            });
            setSaved(false);
            return;
          }
        }
      } catch (error) {
        toast.error('Failed to save API key');
        setSaved(false);
        return;
      }
    }

    const updates = {
      anthropic: trimmedAnthropicKey,
      google: trimmedGoogleKey,
      openai: trimmedOpenaiKey,
      openrouter: trimmedOpenrouterKey,
    };

    const { syncCredentialsToServer } = await import(
      '@/hooks/use-settings-migration'
    );
    await syncCredentialsToServer(updates);

    setApiKeys(updates);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  // Build provider config params for buildProviderConfigs
  const providerConfigParams: ProviderConfigParams = {
    apiKeys,
    storedKeyStatus: apiKeyStatus ?? undefined,
    anthropic: {
      value: anthropicKey,
      setValue: setAnthropicKey,
      show: showAnthropicKey,
      setShow: setShowAnthropicKey,
      testing: testingConnection,
      onTest: handleTestAnthropicConnection,
      result: testResult,
    },
    google: {
      value: googleKey,
      setValue: setGoogleKey,
      show: showGoogleKey,
      setShow: setShowGoogleKey,
      testing: testingGeminiConnection,
      onTest: handleTestGeminiConnection,
      result: geminiTestResult,
    },
    openai: {
      value: openaiKey,
      setValue: setOpenaiKey,
      show: showOpenaiKey,
      setShow: setShowOpenaiKey,
      testing: testingOpenaiConnection,
      onTest: handleTestOpenAIConnection,
      result: openaiTestResult,
    },
    openrouter: {
      value: openrouterKey,
      setValue: setOpenrouterKey,
      show: showOpenrouterKey,
      setShow: setShowOpenrouterKey,
      testing: testingOpenrouterConnection,
      onTest: handleTestOpenRouterConnection,
      result: openrouterTestResult,
    },
  };

  return {
    // Provider config params for buildProviderConfigs
    providerConfigParams,

    // API key status from environment
    apiKeyStatus,

    // Save handler and state
    handleSave,
    saved,
  };
}
