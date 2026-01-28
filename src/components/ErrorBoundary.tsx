import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('❌ ErrorBoundary caught an error:', error);
    console.error('❌ Error info:', errorInfo);
    this.setState({ error, errorInfo });
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="p-6 bg-slate-900 min-h-screen text-white">
          <div className="max-w-4xl mx-auto">
            <div className="bg-red-600 text-white p-4 rounded-lg mb-6">
              <h2 className="text-xl font-bold mb-2">🚨 Component Error</h2>
              <p className="mb-2">Something went wrong with the Game Analytics component.</p>
            </div>
            
            <div className="bg-slate-800 rounded-lg p-6 mb-6">
              <h3 className="text-lg font-semibold mb-4 text-red-400">Error Details:</h3>
              <div className="bg-slate-900 p-4 rounded font-mono text-sm overflow-auto">
                <p className="text-red-300 mb-2">
                  <strong>Error:</strong> {this.state.error?.message}
                </p>
                <p className="text-red-300 mb-2">
                  <strong>Stack:</strong>
                </p>
                <pre className="text-xs text-slate-400 whitespace-pre-wrap">
                  {this.state.error?.stack}
                </pre>
              </div>
            </div>

            <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4 mb-6">
              <h3 className="text-blue-400 font-semibold mb-2">Troubleshooting Steps:</h3>
              <ul className="text-sm text-slate-300 space-y-1">
                <li>1. Check browser console for additional errors</li>
                <li>2. Refresh the page to try again</li>
                <li>3. Clear browser cache and reload</li>
                <li>4. Check if backend server is running</li>
                <li>5. Verify you're logged in properly</li>
              </ul>
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg"
              >
                Reload Page
              </button>
              <button
                onClick={() => this.setState({ hasError: false, error: undefined, errorInfo: undefined })}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;