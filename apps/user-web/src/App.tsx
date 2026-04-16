import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Navigate, Route, BrowserRouter, Routes } from 'react-router-dom';

import { ErrorBoundary } from './components/ErrorBoundary';
import { Layout } from './components/Layout';
import { ThemeProvider } from './lib/theme';
import { BuyPage } from './pages/BuyPage';
import { DashboardPage } from './pages/DashboardPage';
import { InvitePage } from './pages/InvitePage';
import { RewardsPage } from './pages/RewardsPage';
import { TeamPage } from './pages/TeamPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      retry: 1,
    },
  },
});

export function App() {
  return (
    <ThemeProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <Routes>
              <Route element={<Layout />}>
                <Route index element={<Navigate to="/dashboard" replace />} />
                <Route path="dashboard" element={<DashboardPage />} />
                <Route path="buy" element={<BuyPage />} />
                <Route path="rewards" element={<RewardsPage />} />
                <Route path="my-team" element={<TeamPage />} />
                <Route path="invite" element={<InvitePage />} />
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </QueryClientProvider>
      </ErrorBoundary>
    </ThemeProvider>
  );
}
