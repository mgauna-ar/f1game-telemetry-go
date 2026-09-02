import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onReset?: () => void;
  level?: 'root' | 'section' | 'widget';
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  showDetails: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, showDetails: false };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(_error: Error, _errorInfo: ErrorInfo): void {
    // Error caught and retained in component state for display
  }

  handleReload = (): void => {
    window.location.reload();
  };

  handleReset = (): void => {
    this.setState({ hasError: false, error: null, showDetails: false });
    this.props.onReset?.();
  };

  toggleDetails = (): void => {
    this.setState(prev => ({ showDetails: !prev.showDetails }));
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const { level = 'section' } = this.props;
      const isRoot = level === 'root';

      return (
        <div className={`error-boundary error-boundary--${level}`}>
          <div className="error-boundary__icon">⚠️</div>
          <h3 className="error-boundary__title">
            {isRoot ? 'Application Error' : 'Something went wrong'}
          </h3>
          <p className="error-boundary__subtitle">
            An unexpected error occurred while rendering this section.
          </p>
          <div className="error-boundary__actions">
            {isRoot ? (
              <button onClick={this.handleReload} className="error-boundary__btn error-boundary__btn--primary">
                Reload Application
              </button>
            ) : (
              <button onClick={this.handleReset} className="error-boundary__btn error-boundary__btn--primary">
                Try Again
              </button>
            )}
            <button onClick={this.toggleDetails} className="error-boundary__btn error-boundary__btn--secondary">
              {this.state.showDetails ? 'Hide Details' : 'Technical Details'}
            </button>
          </div>
          {this.state.showDetails && this.state.error && (
            <pre className="error-boundary__details">
              {this.state.error.message}
              {'\n\n'}
              {this.state.error.stack}
            </pre>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
