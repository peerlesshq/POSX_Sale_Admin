/**
 * Login page — Phase 7 rewrite.
 *
 * Same auth behaviour as Phase 6 (real admin/auth/login, seeded dev
 * buttons). Visual layer rebuilt to match the fintech dark shell:
 *   - Two-column marketing + form card
 *   - Brand mark + tagline
 *   - Inter font, tokenised colors, subtle grid background
 *   - Dev-mode alert card + three role shortcut buttons
 *
 * No business logic changes.
 */
import { LockOutlined, MailOutlined } from '@ant-design/icons';
import { Alert, Button, Divider, Form, Input, Space, message } from 'antd';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { api } from '../api/endpoints';
import { loadEnv, type AdminDevCredential } from '../env';
import { useT } from '../lib/i18n';
import { saveSession } from '../lib/session';

import './LoginPage.css';

export function LoginPage() {
  const t = useT();
  const env = loadEnv();
  const navigate = useNavigate();
  const [busyRole, setBusyRole] = useState<string | null>(null);
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const applyLoginResult = (res: {
    admin_user_id: string;
    name: string;
    role: 'super_admin' | 'operator' | 'viewer';
    session_token: string;
    expires_at: string;
  }) => {
    saveSession({
      token: res.session_token,
      adminUserId: res.admin_user_id,
      role: res.role,
      name: res.name,
      expiresAt: res.expires_at,
    });
    void message.success(t('auth.signed_in'));
    navigate('/dashboard');
  };

  const handleSubmit = async (values: { email: string; password: string }) => {
    setLoading(true);
    try {
      const res = await api.login(values.email, values.password);
      applyLoginResult(res as unknown as Parameters<typeof applyLoginResult>[0]);
    } catch (err) {
      void message.error(err instanceof Error ? err.message : t('auth.login_failed'));
    } finally {
      setLoading(false);
    }
  };

  const handleDevLogin = async (cred: AdminDevCredential) => {
    setBusyRole(cred.role);
    try {
      const res = await api.login(cred.email, cred.password);
      applyLoginResult(res as unknown as Parameters<typeof applyLoginResult>[0]);
    } catch (err) {
      void message.error(err instanceof Error ? err.message : t('auth.login_failed'));
    } finally {
      setBusyRole(null);
    }
  };

  return (
    <div className="px-login">
      {/* Left — brand pane */}
      <aside className="px-login__brand">
        <div className="px-login__brand-inner">
          <div className="px-login__logo">P</div>
          <div className="px-login__brand-name">{t('app.name')}</div>
          <div className="px-login__brand-tag">{t('app.tagline')}</div>
          <div className="px-login__brand-points">
            <div>· {t('nav.dashboard')}</div>
            <div>· {t('nav.network')}</div>
            <div>· {t('nav.rewards')}</div>
            <div>· {t('nav.settlement')}</div>
          </div>
        </div>
      </aside>

      {/* Right — form pane */}
      <main className="px-login__main">
        <div className="px-login__card">
          <div className="px-login__env-row">
            <span className={`px-login__env-tag px-login__env-tag--${env.appEnv}`}>
              {env.appEnv}
            </span>
            {env.useMockApi && (
              <span className="px-login__env-tag px-login__env-tag--mock">
                {t('dev.mock_api_badge')}
              </span>
            )}
          </div>

          <h1 className="px-login__title">{t('auth.login_title')}</h1>
          <p className="px-login__subtitle">{t('auth.login_subtitle')}</p>

          <Form form={form} layout="vertical" onFinish={handleSubmit} requiredMark={false}>
            <Form.Item
              name="email"
              label={t('auth.email')}
              rules={[{ required: true, type: 'email' }]}
            >
              <Input
                prefix={<MailOutlined style={{ color: 'var(--px-text-tertiary)' }} />}
                placeholder="admin@posx.local"
                size="large"
              />
            </Form.Item>
            <Form.Item
              name="password"
              label={t('auth.password')}
              rules={[{ required: true, min: 12 }]}
            >
              <Input.Password
                prefix={<LockOutlined style={{ color: 'var(--px-text-tertiary)' }} />}
                placeholder={t('auth.password_min_12')}
                size="large"
              />
            </Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} size="large" block>
              {t('auth.sign_in')}
            </Button>
          </Form>

          {env.enableAdminDevLogin && (
            <>
              <Divider plain className="px-login__divider">
                {t('auth.dev_login_header')}
              </Divider>
              <Alert
                type="warning"
                message={t('dev.banner')}
                description={t('auth.dev_login_description')}
                showIcon
                style={{ marginBottom: 12 }}
              />
              {env.devCredentials.length === 0 ? (
                <Alert
                  type="info"
                  message={t('auth.dev_login_missing_creds')}
                  description={t('auth.dev_login_missing_creds_hint')}
                  showIcon
                />
              ) : (
                <Space direction="vertical" style={{ width: '100%' }}>
                  {env.devCredentials.map((cred) => (
                    <Button
                      key={`${cred.role}-${cred.email}`}
                      block
                      loading={busyRole === cred.role}
                      onClick={() => handleDevLogin(cred)}
                    >
                      {t(cred.labelKey)}
                    </Button>
                  ))}
                </Space>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
