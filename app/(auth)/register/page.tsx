'use client';

// 注册页 —— 邮箱+密码,调 /api/auth/register,成功后自动登录
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { signIn } from 'next-auth/react';
import { useTranslation } from '@/lib/i18n';

export default function RegisterPage() {
  const t = useTranslation();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError(t('auth.register.passwordMismatch'));
      return;
    }

    setLoading(true);

    try {
      const resp = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name: name || undefined }),
      });

      const data = await resp.json();

      if (!resp.ok) {
        setError(data.error || t('auth.register.error'));
        setLoading(false);
        return;
      }

      // 注册成功,自动登录
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        // 注册成功但自动登录失败,跳到登录页
        router.push('/login');
      } else {
        router.push('/');
        router.refresh();
      }
    } catch {
      setError(t('auth.register.error'));
      setLoading(false);
    }
  }

  return (
    <div
      className="w-full max-w-sm rounded-lg border p-8"
      style={{
        background: 'var(--c-panel)',
        borderColor: 'var(--c-edge)',
      }}
    >
      <h1
        className="mb-1 font-display text-2xl font-semibold"
        style={{ color: 'var(--c-text)' }}
      >
        {t('auth.register.title')}
      </h1>
      <p
        className="mb-6 font-mono text-xs"
        style={{ color: 'var(--c-text-dim)' }}
      >
        {t('auth.register.subtitle')}
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label
            className="mb-1.5 block font-mono text-xs"
            style={{ color: 'var(--c-text-dim)' }}
          >
            {t('auth.register.name')}
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            className="w-full rounded border bg-transparent px-3 py-2 font-mono text-sm outline-none transition-colors"
            style={{
              borderColor: 'var(--c-line)',
              color: 'var(--c-text)',
            }}
          />
        </div>

        <div>
          <label
            className="mb-1.5 block font-mono text-xs"
            style={{ color: 'var(--c-text-dim)' }}
          >
            {t('auth.register.email')}
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            autoFocus
            className="w-full rounded border bg-transparent px-3 py-2 font-mono text-sm outline-none transition-colors"
            style={{
              borderColor: 'var(--c-line)',
              color: 'var(--c-text)',
            }}
          />
        </div>

        <div>
          <label
            className="mb-1.5 block font-mono text-xs"
            style={{ color: 'var(--c-text-dim)' }}
          >
            {t('auth.register.password')}
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="new-password"
            className="w-full rounded border bg-transparent px-3 py-2 font-mono text-sm outline-none transition-colors"
            style={{
              borderColor: 'var(--c-line)',
              color: 'var(--c-text)',
            }}
          />
        </div>

        <div>
          <label
            className="mb-1.5 block font-mono text-xs"
            style={{ color: 'var(--c-text-dim)' }}
          >
            {t('auth.register.confirmPassword')}
          </label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            autoComplete="new-password"
            className="w-full rounded border bg-transparent px-3 py-2 font-mono text-sm outline-none transition-colors"
            style={{
              borderColor: 'var(--c-line)',
              color: 'var(--c-text)',
            }}
          />
        </div>

        {error && (
          <p
            className="font-mono text-xs"
            style={{ color: 'var(--c-rust)' }}
          >
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="mt-2 rounded px-4 py-2.5 font-mono text-sm font-medium tracking-wider transition-opacity disabled:opacity-50"
          style={{
            background: 'var(--c-amber)',
            color: 'var(--c-void)',
          }}
        >
          {loading ? '…' : t('auth.register.submit')}
        </button>
      </form>

      <p
        className="mt-6 text-center font-mono text-xs"
        style={{ color: 'var(--c-text-dim)' }}
      >
        {t('auth.register.hasAccount')}{' '}
        <Link
          href="/login"
          className="underline-offset-2 hover:underline"
          style={{ color: 'var(--c-amber)' }}
        >
          {t('auth.register.login')}
        </Link>
      </p>
    </div>
  );
}
