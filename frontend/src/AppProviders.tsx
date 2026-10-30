import type { ReactNode } from 'react';
import { RaceEngineerProvider } from './context/RaceEngineerProvider';
import { I18nProvider } from './context/I18nProvider';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { ToastContext } from './context/ToastContext';

/** What the dashboard and the race engineer's page run in: the language, the AI race engineer and toasts. */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <I18nProvider>
      <RaceEngineerProvider>
        <ErrorBoundary level="root">
          <ToastContext.Provider value={true}>{children}</ToastContext.Provider>
        </ErrorBoundary>
      </RaceEngineerProvider>
    </I18nProvider>
  );
}
