'use client';

import { Eye, LockKeyhole, Phone, UserPlus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { PrimaryButton, SecondaryButton } from '@/components/controls/Buttons';
import { AppShell } from '@/components/layout/AppShell';
import { apiClient } from '@/lib/api-client';
import { clearAllChildOSData } from '@/lib/storage/localStorageService';

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState('');

  async function submit() {
    if (loading) return;
    if (!phone.trim() || password.length < 8) {
      setToast('请填写手机号，并设置至少 8 位密码。');
      return;
    }
    setLoading(true);
    setToast('');
    const result = mode === 'login' ? await apiClient.login({ phone, password }) : await apiClient.register({ phone, password });
    if (result.ok) {
      clearAllChildOSData(); // 进入前清本浏览器旧账号缓存，防串数据（真数据从 DB 按租户加载）
      router.replace('/home');
    } else {
      setToast(result.error.message);
    }
    setLoading(false);
  }

  async function enterDemoMode() {
    if (loading) return;
    setLoading(true);
    setToast('');
    const result = await apiClient.demoLogin();
    if (result.ok) {
      clearAllChildOSData();
      router.replace('/home');
    } else {
      setToast(result.error.message);
    }
    setLoading(false);
  }

  return (
    <AppShell>
      <div className="page without-voice auth-page">
        <section className="module-hero-card auth-hero">
          <div className="module-kicker">
            <Eye size={16} />
            心镜
          </div>
          <h1>{mode === 'login' ? '欢迎回来。' : '创建一个家庭档案。'}</h1>
          <p>{mode === 'login' ? '登录后，你的对话、记录和孩子档案会保存在自己的账号下。' : '先用手机号和密码创建账号，后面可以继续补充孩子信息。'}</p>
        </section>

        <form className="auth-card" onSubmit={(event) => { event.preventDefault(); void submit(); }}>
          <label className="auth-field">
            <span>手机号</span>
            <div>
              <Phone size={18} />
              <input inputMode="tel" autoComplete="username" name="phone" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="请输入手机号" disabled={loading} />
            </div>
          </label>
          <label className="auth-field">
            <span>密码</span>
            <div>
              <LockKeyhole size={18} />
              <input type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} name="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="至少 8 位" disabled={loading} />
            </div>
          </label>

          {toast ? <div className="toast">{toast}</div> : null}

          <PrimaryButton type="submit" loading={loading}>
            {mode === 'login' ? '登录' : '注册并进入'}
          </PrimaryButton>
          <SecondaryButton disabled={loading} onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
            <UserPlus size={16} />
            {mode === 'login' ? '还没有账号，去注册' : '已有账号，去登录'}
          </SecondaryButton>
          <SecondaryButton disabled={loading} onClick={enterDemoMode}>先用演示模式进入</SecondaryButton>
        </form>
      </div>
    </AppShell>
  );
}
