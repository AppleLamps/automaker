import { useEffect } from 'react';
import { getHttpApiClient } from '@/lib/http-api-client';
import { useAppStore } from '@/store/app-store';

export function useAvailableModels() {
  const { availableModels, setAvailableModels } = useAppStore();

  useEffect(() => {
    let cancelled = false;

    const fetchModels = async () => {
      try {
        const api = getHttpApiClient();
        const result = await api.model.getAvailable();
        if (!cancelled && result.success && result.models) {
          setAvailableModels(result.models);
        }
      } catch (error) {
        console.error('[Models] Failed to load available models:', error);
      }
    };

    if (availableModels.length === 0) {
      fetchModels();
    }

    return () => {
      cancelled = true;
    };
  }, [availableModels.length, setAvailableModels]);
}
