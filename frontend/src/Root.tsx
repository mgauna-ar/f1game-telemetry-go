import { Suspense, lazy } from 'react';
import App from './App';
import { AppProviders } from './AppProviders';
import { I18nProvider } from './context/I18nProvider';
import { isDesktopWindowPath } from './utils/desktopClient';
import { isEngineerPath } from './utils/nativeWindow';

// The app window (/desktop) is its own small page: none of the dashboard's nav, chat or toasts
const DesktopWindow = lazy(() => import('./desktop/DesktopWindow').then((m) => ({ default: m.DesktopWindow })));
// The race engineer's page (/engineer) has no nav either: the engineer window shows only it
const EngineerPage = lazy(() =>
  import('./components/engineer/EngineerPage').then((m) => ({ default: m.EngineerPage }))
);

/** The dashboard, the race engineer's page, or the app window when the server opened /desktop. */
export function Root() {
  const { pathname } = window.location;
  if (isEngineerPath(pathname)) {
    return (
      <AppProviders>
        <Suspense fallback={null}>
          <EngineerPage />
        </Suspense>
      </AppProviders>
    );
  }
  if (!isDesktopWindowPath(pathname)) return <App />;
  return (
    <I18nProvider>
      <Suspense fallback={null}>
        <DesktopWindow />
      </Suspense>
    </I18nProvider>
  );
}
