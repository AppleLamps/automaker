import { createFileRoute } from '@tanstack/react-router';
import { Loader2 } from 'lucide-react';
import { lazy, Suspense } from 'react';

const TerminalView = lazy(() =>
  import('@/components/views/terminal-view').then((module) => ({
    default: module.TerminalView,
  }))
);

function TerminalRoute() {
  return (
    <Suspense
      fallback={
        <div
          className="flex min-h-[60vh] items-center justify-center gap-2 text-sm text-muted-foreground"
          role="status"
          aria-live="polite"
        >
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Loading terminal...
        </div>
      }
    >
      <TerminalView />
    </Suspense>
  );
}

export const Route = createFileRoute('/terminal')({
  component: TerminalRoute,
});
