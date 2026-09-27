import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useI18n } from '../../context/I18nContext';
import { Button } from '../ui/Button';
import styles from './ErrorBoundary.module.css';

type ErrorLevel = 'root' | 'section' | 'widget';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onReset?: () => void;
  level?: ErrorLevel;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  showDetails: boolean;
}

interface ErrorFallbackProps {
  level: ErrorLevel;
  error: Error | null;
  showDetails: boolean;
  onReload: () => void;
  onReset: () => void;
  onToggleDetails: () => void;
}

/** What shows in place of a part that crashed; in English when the language provider itself failed. */
const ErrorFallback: React.FC<ErrorFallbackProps> = ({
  level,
  error,
  showDetails,
  onReload,
  onReset,
  onToggleDetails,
}) => {
  const { t } = useI18n();
  const isRoot = level === 'root';

  return (
    <div className={styles.fallback} data-level={level} role="alert">
      <AlertTriangle size={40} className={styles.icon} aria-hidden="true" />
      <h3 className={styles.title}>{isRoot ? t('common.errorBoundary.appTitle') : t('common.errorBoundary.title')}</h3>
      <p className={styles.subtitle}>{t('common.errorBoundary.subtitle')}</p>
      <div className={styles.actions}>
        {isRoot ? (
          <Button variant="primary" onClick={onReload}>
            {t('common.errorBoundary.reload')}
          </Button>
        ) : (
          <Button variant="primary" onClick={onReset}>
            {t('common.errorBoundary.tryAgain')}
          </Button>
        )}
        <Button onClick={onToggleDetails} aria-expanded={showDetails}>
          {showDetails ? t('common.errorBoundary.hideDetails') : t('common.errorBoundary.showDetails')}
        </Button>
      </div>
      {showDetails && error && (
        <pre className={styles.details}>
          {error.message}
          {'\n\n'}
          {error.stack}
        </pre>
      )}
    </div>
  );
};

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
    this.setState((prev) => ({ showDetails: !prev.showDetails }));
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <ErrorFallback
          level={this.props.level ?? 'section'}
          error={this.state.error}
          showDetails={this.state.showDetails}
          onReload={this.handleReload}
          onReset={this.handleReset}
          onToggleDetails={this.toggleDetails}
        />
      );
    }

    return this.props.children;
  }
}
