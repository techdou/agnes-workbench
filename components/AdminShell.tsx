'use client';

// 管理员后台布局组件 —— 侧栏 + 内容区
// 在 server layout 里鉴权通过后,这里只负责 UI 展示

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useTranslation } from '@/lib/i18n';

interface AdminShellProps {
  children: React.ReactNode;
}

const NAV_ITEMS = [
  { href: '/admin', labelKey: 'admin.overview', icon: '◈' },
  { href: '/admin/users', labelKey: 'admin.users', icon: '◔' },
  { href: '/admin/projects', labelKey: 'admin.projects', icon: '◑' },
] as const;

export function AdminShell({ children }: AdminShellProps) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const t = useTranslation();

  return (
    <div className="flex h-[100dvh] overflow-hidden" style={{ background: 'var(--c-void)' }}>
      {/* 侧栏 */}
      <aside
        className="flex w-56 shrink-0 flex-col border-r"
        style={{ borderColor: 'var(--c-edge)', background: 'var(--c-ink)' }}
      >
        {/* Logo + 管理员标识 */}
        <div className="border-b px-4 py-4" style={{ borderColor: 'var(--c-edge)' }}>
          <div className="flex items-center gap-2">
            <span className="font-mono text-lg" style={{ color: 'var(--c-amber)' }}>◆</span>
            <span className="font-display text-base font-semibold" style={{ color: 'var(--c-text)' }}>
              {t('admin.title')}
            </span>
          </div>
          {session?.user && (
            <p className="mt-2 truncate font-mono text-[10px]" style={{ color: 'var(--c-text-faint)' }}>
              {session.user.email}
            </p>
          )}
        </div>

        {/* 导航 */}
        <nav className="flex-1 py-4">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 border-l-2 px-4 py-2 font-mono text-[11px] transition-colors"
                style={{
                  borderColor: active ? 'var(--c-amber)' : 'transparent',
                  color: active ? 'var(--c-amber)' : 'var(--c-text-dim)',
                  background: active ? 'color-mix(in srgb, var(--c-amber) 8%, transparent)' : 'transparent',
                }}
              >
                <span className="w-4 text-center">{item.icon}</span>
                {t(item.labelKey)}
              </Link>
            );
          })}
        </nav>

        {/* 底部:返回工作台 */}
        <div className="border-t p-4" style={{ borderColor: 'var(--c-edge)' }}>
          <Link
            href="/"
            className="block rounded border px-3 py-2 text-center font-mono text-[10px] tracking-wider transition-colors"
            style={{ borderColor: 'var(--c-line)', color: 'var(--c-text-dim)' }}
          >
            ← {t('admin.back')}
          </Link>
        </div>
      </aside>

      {/* 主内容 */}
      <main className="flex-1 overflow-y-auto p-8">
        {children}
      </main>
    </div>
  );
}
