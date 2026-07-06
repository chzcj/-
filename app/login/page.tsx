'use client';

import { Eye, EyeOff, LockKeyhole, Phone } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { apiClient } from '@/lib/api-client';
import { resolvePostAuthRoute } from '@/lib/profile/postAuthRoute';

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const loggedOut = searchParams.get('logged_out') === '1';
  const [phase, setPhase] = useState<'welcome' | 'login'>(loggedOut ? 'login' : 'welcome');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (loggedOut) return;
    const timer = window.setTimeout(() => setPhase('login'), 1550);
    return () => window.clearTimeout(timer);
  }, [loggedOut]);

  function skipWelcome() {
    setPhase('login');
  }

  async function routeAfterAuth(clearData: boolean) {
    const href = await resolvePostAuthRoute(clearData);
    router.replace(href);
  }

  async function submit() {
    if (loading) return;
    if (!phone.trim() || password.length < 8) {
      setHasError(true);
      setToast('请填写手机号，并设置至少 8 位密码。');
      return;
    }
    setLoading(true);
    setToast('');
    setHasError(false);

    let result = await apiClient.login({ phone, password });
    if (!result.ok && result.error.code === 'BAD_CREDENTIALS') {
      result = await apiClient.register({ phone, password });
    }

    if (result.ok) {
      const me = await apiClient.getMe();
      if (!me.ok || !me.data?.user) {
        setHasError(true);
        setToast('登录成功但会话未保存。请用系统浏览器打开，或关闭应用内页面后重试。');
        setLoading(false);
        return;
      }
      await routeAfterAuth(true);
    } else {
      setHasError(true);
      if (result.error.code === 'AUTH_DATABASE_DISABLED') {
        setToast('数据库未连接，可先使用下方「演示模式」浏览界面。');
      } else if (result.error.code === 'INTERNAL_ERROR' && process.env.NODE_ENV === 'development') {
        setToast(`${result.error.message}（${String(result.error.detail ?? '')}）`);
      } else {
        setToast(result.error.message);
      }
    }
    setLoading(false);
  }

  async function submitDemo() {
    if (loading) return;
    setLoading(true);
    setToast('');
    setHasError(false);
    const result = await apiClient.demoLogin();
    if (result.ok) {
      const me = await apiClient.getMe();
      if (!me.ok || !me.data?.user) {
        setHasError(true);
        setToast('演示模式已开启，但会话未保存。请用系统浏览器打开后重试。');
        setLoading(false);
        return;
      }
      await routeAfterAuth(false);
    } else {
      setHasError(true);
      setToast(result.error.message || '演示模式暂时不可用，请稍后再试。');
    }
    setLoading(false);
  }

  return (
    <div className="hifi-build-root login-root">
      <main className="app-shell startup-gate" aria-label="登录育见">
        <section
          className={`startup-screen ${phase === 'welcome' ? 'active' : ''}`}
          aria-label="欢迎页"
          onClick={skipWelcome}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') skipWelcome();
          }}
          role="button"
          tabIndex={0}
        >
          <div className="app-safe-top" aria-hidden="true" />
          <div className="startup-center">
            <h1 className="startup-title">你好！</h1>
            <p className="startup-subtitle">欢迎来到育见</p>
          </div>
          <p className="startup-terms">
            登录即代表你已阅读并同意
            <br />
            <a href="#">《用户协议》</a>　<a href="#">《隐私政策》</a>
          </p>
        </section>

        <section className={`startup-screen ${phase === 'login' ? 'active' : ''}`} aria-label="登录页">
          <div className="app-safe-top" aria-hidden="true" />
          <div className="startup-login-content">
            <h1 className="startup-login-title">
              欢迎回来！
              <br />
              育见
            </h1>
            <form
              className="startup-fields"
              onSubmit={(e) => {
                e.preventDefault();
                void submit();
              }}
            >
              <label className="startup-field">
                <Phone size={22} color="#9ea19a" />
                <input
                  className="startup-input"
                  inputMode="tel"
                  autoComplete="username"
                  name="phone"
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value);
                    if (hasError) setHasError(false);
                  }}
                  placeholder="手机号"
                  disabled={loading}
                />
              </label>
              <label
                className="startup-field"
                style={hasError ? { boxShadow: 'inset 0 0 0 1px rgba(228,90,90,0.5)' } : undefined}
              >
                <LockKeyhole size={22} color="#9ea19a" />
                <input
                  className="startup-input"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  name="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (hasError) setHasError(false);
                  }}
                  placeholder="密码（至少 8 位）"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? '隐藏密码' : '显示密码'}
                  style={{ background: 'none', border: 0, padding: 0, color: '#9ea19a' }}
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </label>

              {loggedOut ? <p className="startup-tip">已退出登录，请重新输入账号密码。</p> : null}

              {toast ? <p className="startup-error">{toast}</p> : null}

              <button type="submit" className="startup-login-button" disabled={loading}>
                {loading ? '登录中…' : '立即登录'}
              </button>
              <button
                type="button"
                className="startup-demo-button"
                disabled={loading}
                onClick={() => void submitDemo()}
              >
                演示模式浏览
              </button>
              <p className="startup-tip">未注册手机号登录后将自动创建账号</p>
              <p className="startup-tip muted">演示模式会先走四模块采集，再解锁交流与预演</p>
            </form>
          </div>
          <p className="startup-terms">
            登录即代表你已阅读并同意　<a href="#">《用户协议》</a>　<a href="#">《隐私政策》</a>
          </p>
        </section>
      </main>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageContent />
    </Suspense>
  );
}
