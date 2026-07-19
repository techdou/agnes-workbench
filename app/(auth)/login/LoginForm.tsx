'use client';

// 登录表单 —— 实际的 client 组件,被 page.tsx 用 Suspense 包裹
import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { signIn } from 'next-auth/react';
import { useTranslation } from '@/lib/i18n';

export default function LoginForm() {
  const t = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await signIn('credentials', {
      email,
      password,
      redirect: false,
    });

    if (result?.error) {
      setError(t('auth.login.error'));
      setLoading(false);
    } else {
      router.push(callbackUrl);
      router.refresh();
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
        {t('auth.login.title')}
      </h1>
      <p
        className="mb-6 font-mono text-xs"
        style={{ color: 'var(--c-text-dim)' }}
      >
        {t('auth.login.subtitle')}
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label
            className="mb-1.5 block font-mono text-xs"
            style={{ color: 'var(--c-text-dim)' }}
          >
            {t('auth.login.email')}
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
            {t('auth.login.password')}
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
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
          {loading ? '…' : t('auth.login.submit')}
        </button>
      </form>

      <p
        className="mt-6 text-center font-mono text-xs"
        style={{ color: 'var(--c-text-dim)' }}
      >
        {t('auth.login.noAccount')}{' '}
        <Link
          href="/register"
          className="underline-offset-2 hover:underline"
          style={{ color: 'var(--c-amber)' }}
        >
          {t('auth.login.register')}
        </Link>
      </p>
    </div>
  );
}
