import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import './design/tokens.css';
import './design/base.css';
import './index.css';
import App from './App.tsx';
import { AsOfProvider } from './asOf.tsx';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 60_000,
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AsOfProvider>
        <App />
      </AsOfProvider>
    </QueryClientProvider>
  </StrictMode>,
);
