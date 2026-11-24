import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import './design/tokens.css';
import './design/base.css';
import './index.css';
import './shell/shell.css';
import { AsOfProvider } from './asOf.tsx';
import { readUrl } from './nav';
import { BootBoundary, BootSkeleton } from './shell/Boot';
import { preloadScreen } from './shell/screens';
import { applyThemePref, readThemePref } from './shell/theme';

// Apply the saved theme (System / Light / Dark) before the first render, so the app never paints
// in the other theme first.
applyThemePref(readThemePref());

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 60_000,
    },
  },
});

const root = createRoot(document.getElementById('root')!);

// The design styleguide is dev-only: import.meta.env.DEV is false in a production build, so this
// branch and its dynamic import are dropped from the bundle. The app's ?screen= URLs are untouched.
if (import.meta.env.DEV && window.location.pathname === '/__styleguide') {
  void import('./design/styleguide/Styleguide').then(({ default: Styleguide }) => {
    root.render(<StrictMode><Styleguide /></StrictMode>);
  });
} else {
  // Code-split boot: the entry chunk is React, TanStack Query, the as-of context and a shell-shaped
  // skeleton. The shell (nav, top bar, motion) and the first screen start downloading right now,
  // in parallel with GET /meta, which every screen needs before it can show anything.
  const shell = import('./App.tsx');
  void preloadScreen(readUrl().screen ?? 'brief').catch(() => undefined);
  const App = lazy(() => shell);

  root.render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <AsOfProvider>
          <BootBoundary>
            <Suspense fallback={<BootSkeleton />}>
              <App />
            </Suspense>
          </BootBoundary>
        </AsOfProvider>
      </QueryClientProvider>
    </StrictMode>,
  );
}
