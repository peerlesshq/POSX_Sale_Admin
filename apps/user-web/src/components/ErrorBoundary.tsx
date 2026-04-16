/**
 * Top-level error boundary for user-web.
 *
 * React doesn't recover from render-phase errors inside hooks, so we
 * wrap the whole router tree. The boundary uses the raw i18n dict via
 * `t(...)` because it can't access LayoutContext — this ensures the
 * fallback still renders when the app's state is broken.
 */
import { Component, type ErrorInfo, type ReactNode } from 'react';

import { getStoredLocale, t } from '../lib/i18n';

interface State {
  hasError: boolean;
  error: Error | null;
}

interface Props {
  readonly children: ReactNode;
}

export class ErrorBoundary extends Component<Props, State> {
  override state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // Keep the console log simple; a real telemetry sink can plug in
    // here later without affecting the UI contract.
    // eslint-disable-next-line no-console
    console.error('[user-web] render error:', error, info.componentStack);
  }

  handleReload = (): void => {
    window.location.reload();
  };

  override render(): ReactNode {
    if (!this.state.hasError) return this.props.children;
    const locale = getStoredLocale('zh-CN');
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 px-4">
        <div className="max-w-md text-center">
          <h1 className="text-xl font-semibold mb-2">{t(locale, 'error.boundary.title')}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
            {t(locale, 'error.boundary.message')}
          </p>
          <button
            type="button"
            onClick={this.handleReload}
            className="px-4 py-2 rounded bg-brand-600 text-white hover:bg-brand-700"
          >
            {t(locale, 'error.boundary.reload')}
          </button>
          {this.state.error && (
            <pre className="mt-4 text-left text-xs text-slate-400 overflow-auto max-h-40">
              {this.state.error.message}
            </pre>
          )}
        </div>
      </div>
    );
  }
}
