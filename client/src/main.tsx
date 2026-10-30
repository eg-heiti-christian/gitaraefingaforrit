import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ApiError } from './api';
import { clearSession, meQueryKey } from './auth';
import App from './App';
import './index.css';

// A 401 while logged in means the session ended: clear it, as logout does.
// A 401 while logged out is just a failed login, so it's left alone.
const onError = (error: Error) => {
  if (error instanceof ApiError && error.status === 401 && queryClient.getQueryData(meQueryKey)) {
    clearSession(queryClient);
  }
};

const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError }),
  mutationCache: new MutationCache({ onError }),
  defaultOptions: {
    queries: {
      retry: (failureCount, error) =>
        !(error instanceof ApiError && error.status < 500) && failureCount < 3,
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
);
