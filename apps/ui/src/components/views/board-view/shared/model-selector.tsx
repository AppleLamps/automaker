import { useMemo } from 'react';
import { Label } from '@/components/ui/label';
import { Brain } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppStore, type AgentModel } from '@/store/app-store';
import { getModelOptions } from '@/lib/model-options';

interface ModelSelectorProps {
  selectedModel: AgentModel;
  onModelSelect: (model: AgentModel) => void;
  testIdPrefix?: string;
}

export function ModelSelector({
  selectedModel,
  onModelSelect,
  testIdPrefix = 'model-select',
}: ModelSelectorProps) {
  const availableModels = useAppStore((state) => state.availableModels);
  const modelOptions = useMemo(
    () => getModelOptions(availableModels),
    [availableModels]
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-primary" />
          Model
        </Label>
      </div>
      <div className="flex gap-2 flex-wrap">
        {modelOptions.map((option) => {
          const isSelected = selectedModel === option.id;
          const shortName = option.label.startsWith('Claude ')
            ? option.label.replace('Claude ', '')
            : option.label;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onModelSelect(option.id)}
              title={option.description}
              className={cn(
                'flex-1 min-w-[80px] px-3 py-2 rounded-md border text-sm font-medium transition-colors',
                isSelected
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background hover:bg-accent border-input'
              )}
              data-testid={`${testIdPrefix}-${option.id}`}
            >
              {shortName}
            </button>
          );
        })}
      </div>
    </div>
  );
}
