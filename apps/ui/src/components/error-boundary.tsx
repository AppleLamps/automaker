import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class GlobalErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[GlobalErrorBoundary] Application error:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-screen flex-col items-center justify-center bg-background p-8">
          <AlertCircle className="mb-4 h-16 w-16 text-destructive" />
          <h1 className="mb-2 text-2xl font-bold">Something went wrong</h1>
          <p className="mb-4 max-w-md text-center text-muted-foreground">
            An unexpected error occurred. Please reload the application.
          </p>
          <Button onClick={this.handleReload}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Reload Application
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
