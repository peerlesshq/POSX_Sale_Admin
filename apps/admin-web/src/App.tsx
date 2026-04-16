import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App as AntdApp, ConfigProvider } from 'antd';
import enUS from 'antd/locale/en_US';
import zhCN from 'antd/locale/zh_CN';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import { ErrorBoundary } from './components/ErrorBoundary';
import { Shell } from './components/shell/Shell';
import { useLocale } from './lib/i18n';
import { AdminAccountsPage } from './pages/AdminAccountsPage';
import { ConfigPage } from './pages/ConfigPage';
import { DashboardPage } from './pages/dashboard/DashboardPage';
import { LoginPage } from './pages/LoginPage';
import { HierarchyAnalysisPage, NetworkOverviewPage } from './pages/NetworkPage';
import { NetworkTeamPage } from './pages/NetworkTeamPage';
import { ReportsPage } from './pages/ReportsPage';
import {
  RewardsBurnsPage,
  RewardsDirectPage,
  RewardsEqualLevelPage,
  RewardsOverviewPage,
  RewardsTeamPage,
} from './pages/RewardsPage';
import { RecomputePage, SettlementJobsPage } from './pages/SettlementPage';
import { SystemOverviewPage } from './pages/SystemOverviewPage';
import {
  ChainSyncPage,
  HealthPage,
  JobsPage,
  LogsPage,
} from './pages/SystemPage';
import { UserDetailPage, UserTreePage, UsersListPage } from './pages/UsersPage';
import { AdminThemeProvider, buildAdminAntdTheme, useAdminTheme } from './theme';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 10_000, retry: 1 },
  },
});

/**
 * Inner app body — reads the admin theme reactively so ConfigProvider
 * re-renders whenever the user toggles light/dark.
 */
function AppBody() {
  const locale = useLocale();
  const { theme } = useAdminTheme();
  const antdTheme = buildAdminAntdTheme(theme);

  return (
    <ConfigProvider
      locale={locale === 'zh-CN' ? zhCN : enUS}
      theme={antdTheme}
    >
      <AntdApp>
        <ErrorBoundary>
          <QueryClientProvider client={queryClient}>
            <BrowserRouter>
              <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route element={<Shell />}>
                  <Route index element={<Navigate to="/dashboard" replace />} />
                  <Route path="dashboard" element={<DashboardPage />} />
                  <Route path="users" element={<UsersListPage />} />
                  <Route path="users/:wallet" element={<UserDetailPage />} />
                  <Route path="users/:wallet/tree" element={<UserTreePage />} />
                  <Route path="network" element={<NetworkOverviewPage />} />
                  <Route path="network/team" element={<NetworkTeamPage />} />
                  <Route path="network/hierarchy" element={<HierarchyAnalysisPage />} />
                  <Route path="rewards" element={<RewardsOverviewPage />} />
                  <Route path="rewards/direct" element={<RewardsDirectPage />} />
                  <Route path="rewards/team" element={<RewardsTeamPage />} />
                  <Route path="rewards/equal-level" element={<RewardsEqualLevelPage />} />
                  <Route path="rewards/burns" element={<RewardsBurnsPage />} />
                  <Route path="config" element={<ConfigPage />} />
                  <Route path="reports" element={<ReportsPage />} />
                  <Route path="settlement/jobs" element={<SettlementJobsPage />} />
                  <Route path="recompute" element={<RecomputePage />} />
                  <Route path="system" element={<SystemOverviewPage />} />
                  <Route path="system/chain-sync" element={<ChainSyncPage />} />
                  <Route path="system/jobs" element={<JobsPage />} />
                  <Route path="system/health" element={<HealthPage />} />
                  <Route path="logs" element={<LogsPage />} />
                  <Route path="admin-accounts" element={<AdminAccountsPage />} />
                </Route>
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </Routes>
            </BrowserRouter>
          </QueryClientProvider>
        </ErrorBoundary>
      </AntdApp>
    </ConfigProvider>
  );
}

export function App() {
  return (
    <AdminThemeProvider>
      <AppBody />
    </AdminThemeProvider>
  );
}
