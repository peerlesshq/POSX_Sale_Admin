/**
 * Top-level error boundary for admin-web.
 *
 * React doesn't recover from render-phase errors inside hooks, so we
 * wrap the whole router tree. The boundary uses the i18n `t()` helper
 * directly so the fallback still renders when the app is broken.
 */
import { Button, Result } from 'antd';
import { Component, type ErrorInfo, type ReactNode } from 'react';

import { t } from '../lib/i18n';

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
    // eslint-disable-next-line no-console
    console.error('[admin-web] render error:', error, info.componentStack);
  }

  handleReload = (): void => {
    window.location.reload();
  };

  override render(): ReactNode {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="h-screen flex items-center justify-center">
        <Result
          status="error"
          title={t('common.error.title')}
          subTitle={t('common.error.message')}
          extra={[
            <Button key="reload" type="primary" onClick={this.handleReload}>
              {t('common.error.reload')}
            </Button>,
          ]}
        >
          {this.state.error && (
            <pre className="text-xs text-slate-500 overflow-auto max-h-40">
              {this.state.error.message}
            </pre>
          )}
        </Result>
      </div>
    );
  }
}
