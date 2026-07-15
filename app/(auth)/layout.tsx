// (auth) 布局 —— 登录/注册页
// 已登录用户自动跳转到首页

import { redirect } from 'next/navigation';
import { auth } from '@/auth';

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (session?.user) {
    redirect('/');
  }

  return (
    <div
      className="flex min-h-[100dvh] flex-col items-center justify-center px-4"
      style={{ background: 'var(--c-void)' }}
    >
      {/* Logo */}
      <a href="/" className="mb-8 flex items-center gap-2 no-underline">
        <span className="font-mono text-2xl" style={{ color: 'var(--c-phosphor)' }}>
          Ψ
        </span>
        <span
          className="font-display text-xl font-semibold tracking-tight"
          style={{ color: 'var(--c-text)' }}
        >
          Phosphor Studio
        </span>
      </a>
      {children}
    </div>
  );
}
