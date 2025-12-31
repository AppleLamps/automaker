import { useEffect, useRef } from 'react';
import { getElectronAPI } from '@/lib/electron';
import { useAppStore } from '@/store/app-store';

interface UseBoardEffectsProps {
  currentProject: { path: string; id: string } | null;
  specCreatingForProject: string | null;
  setSpecCreatingForProject: (path: string | null) => void;
  setSuggestionsCount: (count: number) => void;
  setFeatureSuggestions: (suggestions: any[]) => void;
  setIsGeneratingSuggestions: (generating: boolean) => void;
  checkContextExists: (featureId: string) => Promise<boolean>;
  features: any[];
  isLoading: boolean;
  setFeaturesWithContext: (set: Set<string>) => void;
}

export function useBoardEffects({
  currentProject,
  specCreatingForProject,
  setSpecCreatingForProject,
  setSuggestionsCount,
  setFeatureSuggestions,
  setIsGeneratingSuggestions,
  checkContextExists,
  features,
  isLoading,
  setFeaturesWithContext,
}: UseBoardEffectsProps) {
  const contextCheckRunIdRef = useRef(0);
  const contextCheckCacheRef = useRef<Map<string, boolean>>(new Map());

  // Make current project available globally for modal
  useEffect(() => {
    if (currentProject) {
      (window as any).__currentProject = currentProject;
    }
    return () => {
      (window as any).__currentProject = null;
    };
  }, [currentProject]);

  // Listen for suggestions events to update count (persists even when dialog is closed)
  useEffect(() => {
    const api = getElectronAPI();
    if (!api?.suggestions) return;

    const unsubscribe = api.suggestions.onEvent((event) => {
      if (event.type === 'suggestions_complete' && event.suggestions) {
        setSuggestionsCount(event.suggestions.length);
        setFeatureSuggestions(event.suggestions);
        setIsGeneratingSuggestions(false);
      } else if (event.type === 'suggestions_error') {
        setIsGeneratingSuggestions(false);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [setSuggestionsCount, setFeatureSuggestions, setIsGeneratingSuggestions]);

  // Subscribe to spec regeneration events to clear creating state on completion
  useEffect(() => {
    const api = getElectronAPI();
    if (!api.specRegeneration) return;

    const unsubscribe = api.specRegeneration.onEvent((event) => {
      console.log(
        '[BoardView] Spec regeneration event:',
        event.type,
        'for project:',
        event.projectPath
      );

      if (event.projectPath !== specCreatingForProject) {
        return;
      }

      if (event.type === 'spec_regeneration_complete') {
        setSpecCreatingForProject(null);
      } else if (event.type === 'spec_regeneration_error') {
        setSpecCreatingForProject(null);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [specCreatingForProject, setSpecCreatingForProject]);

  // Sync running tasks from electron backend on mount
  useEffect(() => {
    if (!currentProject) return;

    const syncRunningTasks = async () => {
      try {
        const api = getElectronAPI();
        if (!api?.autoMode?.status) return;

        const status = await api.autoMode.status(currentProject.path);
        if (status.success) {
          const projectId = currentProject.id;
          const { clearRunningTasks, addRunningTask } = useAppStore.getState();

          if (status.runningFeatures) {
            console.log('[Board] Syncing running tasks from backend:', status.runningFeatures);

            clearRunningTasks(projectId);

            status.runningFeatures.forEach((featureId: string) => {
              addRunningTask(projectId, featureId);
            });
          }
        }
      } catch (error) {
        console.error('[Board] Failed to sync running tasks:', error);
      }
    };

    syncRunningTasks();
  }, [currentProject]);

  // Check which features have context files
  useEffect(() => {
    if (features.length === 0 || isLoading) {
      setFeaturesWithContext(new Set());
      contextCheckCacheRef.current.clear();
      return;
    }

    const relevantStatuses = new Set(['in_progress', 'waiting_approval', 'verified']);
    const relevantFeatures = features.filter((f) => relevantStatuses.has(f.status));
    const relevantIds = new Set(relevantFeatures.map((f) => f.id));

    // Prune cache entries for features that are no longer relevant.
    for (const cachedId of contextCheckCacheRef.current.keys()) {
      if (!relevantIds.has(cachedId)) {
        contextCheckCacheRef.current.delete(cachedId);
      }
    }

    const idsToCheck = relevantFeatures
      .filter((f) => !contextCheckCacheRef.current.has(f.id))
      .map((f) => f.id);

    const runId = ++contextCheckRunIdRef.current;

    const applyCachedResults = () => {
      if (runId !== contextCheckRunIdRef.current) return;
      const newSet = new Set<string>();
      for (const id of relevantIds) {
        if (contextCheckCacheRef.current.get(id)) {
          newSet.add(id);
        }
      }
      setFeaturesWithContext(newSet);
    };

    if (idsToCheck.length === 0) {
      applyCachedResults();
      return;
    }

    void Promise.all(
      idsToCheck.map(async (id) => {
        const hasContext = await checkContextExists(id);
        return { id, hasContext };
      })
    ).then((results) => {
      if (runId !== contextCheckRunIdRef.current) return;
      results.forEach(({ id, hasContext }) => {
        contextCheckCacheRef.current.set(id, hasContext);
      });
      applyCachedResults();
    });
  }, [features, isLoading, checkContextExists, setFeaturesWithContext]);
}
