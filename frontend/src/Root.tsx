import { Suspense, lazy } from 'react';
import App from './App';
import { I18nProvider } from './context/I18nProvider';
import { isDesktopWindowPath } from './utils/desktopClient';

// The app window (/desktop) is its own small page: none of the dashboard's nav, chat or toasts
const DesktopWindow = lazy(() => import('./desktop/DesktopWindow').then((m) => ({ default: m.DesktopWindow })));

/** The dashboard, or the app window when the server opened /desktop. */
export function Root() {
  if (!isDesktopWindowPath(window.location.pathname)) return <App />;
  return (
    <I18nProvider>
      <Suspense fallback={null}>
        <DesktopWindow />
      </Suspense>
    </I18nProvider>
  );
}
