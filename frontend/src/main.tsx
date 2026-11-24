import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import './design/tokens.css';
import './design/base.css';
import './index.css';
import './shell/shell.css';
import App from './App.tsx';
import { AsOfProvider } from './asOf.tsx';
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
  root.render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <AsOfProvider>
          <App />
        </AsOfProvider>
      </QueryClientProvider>
    </StrictMode>,
  );
}
