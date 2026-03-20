import React, { Component, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

// Global error log buffer for debugging
const ERROR_LOG: { ts: string; msg: string; stack?: string }[] = [];

function logError(error: Error, context?: string) {
  const entry = {
    ts: new Date().toISOString(),
    msg: `[${context || 'App'}] ${error.message}`,
    stack: error.stack?.split('\n').slice(0, 5).join('\n'),
  };
  ERROR_LOG.push(entry);
  // Keep last 50 errors
  if (ERROR_LOG.length > 50) ERROR_LOG.shift();
  
  // Persist to sessionStorage for debugging
  try {
    sessionStorage.setItem('app-error-log', JSON.stringify(ERROR_LOG.slice(-20)));
  } catch {}
}

// Global unhandled error/rejection listeners
if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    logError(new Error(event.message || 'Unknown error'), 'GlobalError');
  });
  window.addEventListener('unhandledrejection', (event) => {
    const msg = event.reason?.message || String(event.reason);
    logError(new Error(msg), 'UnhandledRejection');
  });
}

export { ERROR_LOG };

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    logError(error, 'ErrorBoundary');
    console.error('[ErrorBoundary]', error.message, errorInfo.componentStack);
  }

  handleReset = () => {
    try {
      localStorage.removeItem('sellercloud-cache');
    } catch {}
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
          <div className="max-w-md text-center space-y-4">
            <AlertTriangle className="h-12 w-12 text-destructive mx-auto" />
            <h1 className="text-xl font-semibold">Xatolik yuz berdi</h1>
            <p className="text-muted-foreground text-sm">
              Sahifa yuklanishida muammo. Iltimos, sahifani yangilang.
            </p>
            {this.state.error && (
              <details className="text-left text-xs text-muted-foreground bg-muted p-3 rounded-lg">
                <summary className="cursor-pointer font-medium mb-1">Texnik ma'lumot</summary>
                <code className="block whitespace-pre-wrap break-all">{this.state.error.message}</code>
              </details>
            )}
            <Button onClick={this.handleReset} className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Sahifani yangilash
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
