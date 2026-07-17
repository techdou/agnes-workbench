'use client';

// 用户菜单 —— 顶栏右上角下拉
// 显示当前用户邮箱 + 设置入口 + 管理员入口(仅 ADMIN) + 退出登录

import { useState, useRef, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';
import { useTranslation } from '@/lib/i18n';

interface UserMenuProps {
  onOpenSettings?: () => void;
}

export function UserMenu({ onOpenSettings }: UserMenuProps) {
  const t = useTranslation();
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  if (!session?.user) return null;

  const email = session.user.email || '';
  const initial = email[0]?.toUpperCase() || '?';
  const role = (session.user as { role?: string }).role || 'USER';

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex h-8 w-8 items-center justify-center rounded-full border font-mono text-xs transition-colors"
        style={{
          borderColor: 'var(--c-line)',
          background: 'color-mix(in srgb, var(--c-phosphor) 12%, transparent)',
          color: 'var(--c-phosphor)',
        }}
        title={email}
      >
        {initial}
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-2 w-56 rounded-lg border py-2 shadow-xl"
          style={{
            background: 'var(--c-panel)',
            borderColor: 'var(--c-edge)',
          }}
        >
          <div className="border-b px-4 py-2.5" style={{ borderColor: 'var(--c-edge)' }}>
            <p
              className="truncate font-mono text-xs"
              style={{ color: 'var(--c-text)' }}
            >
              {session.user.name || email}
            </p>
            {session.user.name && (
              <p
                className="mt-0.5 truncate font-mono text-[10px]"
                style={{ color: 'var(--c-text-faint)' }}
              >
                {email}
              </p>
            )}
            <span
              className="mt-1 inline-block rounded px-1.5 py-0.5 font-mono text-[9px] tracking-wider"
              style={{
                background:
                  role === 'ADMIN'
                    ? 'color-mix(in srgb, var(--c-amber) 15%, transparent)'
                    : 'color-mix(in srgb, var(--c-text-faint) 15%, transparent)',
                color:
                  role === 'ADMIN'
                    ? 'var(--c-amber)'
                    : 'var(--c-text-dim)',
              }}
            >
              {role}
            </span>
          </div>

          <div className="py-1">
            {onOpenSettings && (
              <button
                onClick={() => {
                  setOpen(false);
                  onOpenSettings();
                }}
                className="block w-full px-4 py-2 text-left font-mono text-xs transition-colors hover:bg-white/5"
                style={{ color: 'var(--c-text-dim)' }}
              >
                ⚙ {t('userMenu.settings')}
              </button>
            )}

            {role === 'ADMIN' && (
              <Link
                href="/admin"
                className="block px-4 py-2 font-mono text-xs transition-colors hover:bg-white/5"
                style={{ color: 'var(--c-text-dim)' }}
              >
                ◆ {t('userMenu.admin')}
              </Link>
            )}

            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="block w-full px-4 py-2 text-left font-mono text-xs transition-colors hover:bg-white/5"
              style={{ color: 'var(--c-rust)' }}
            >
              {t('userMenu.logout')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
