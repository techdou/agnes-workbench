'use client';

// 管理员:用户管理

import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useTranslation } from '@/lib/i18n';

interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  role: 'USER' | 'ADMIN';
  disabled: boolean;
  createdAt: string;
  updatedAt: string;
  _count: { projects: number; mediaAssets: number };
}

export default function AdminUsersPage() {
  const t = useTranslation();
  const { data: currentSession } = useSession();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    const resp = await fetch(`/api/admin/users?${params}`);
    if (resp.ok) {
      const data = await resp.json();
      setUsers(data.users);
    }
    setLoading(false);
  }, [search]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      const resp = await fetch(`/api/admin/users?${params}`);
      if (cancelled) return;
      if (resp.ok) {
        const data = await resp.json();
        if (!cancelled) setUsers(data.users);
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [search]);

  async function patchUser(id: string, patch: Partial<Pick<AdminUser, 'role' | 'disabled'>>) {
    const resp = await fetch(`/api/admin/users/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      alert(err.error || '操作失败');
    }
    await load();
  }

  return (
    <div>
      <h1 className="mb-6 font-display text-2xl font-semibold" style={{ color: 'var(--c-text)' }}>
        {t('admin.users')}
      </h1>

      {/* 搜索栏 */}
      <div className="mb-4 flex gap-2">
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') setSearch(searchInput.trim()); }}
          placeholder={t('admin.users.email') + ' / ' + t('admin.users.name')}
          className="flex-1 rounded border px-3 py-2 font-mono text-xs outline-none"
          style={{
            borderColor: 'var(--c-line)',
            background: 'var(--c-panel)',
            color: 'var(--c-text)',
          }}
        />
        <button
          onClick={() => setSearch(searchInput.trim())}
          className="rounded border px-4 py-2 font-mono text-xs"
          style={{ borderColor: 'var(--c-phosphor)', color: 'var(--c-phosphor)' }}
        >
          {t('admin.search.button')}
        </button>
        {search && (
          <button
            onClick={() => { setSearch(''); setSearchInput(''); }}
            className="rounded border px-3 py-2 font-mono text-xs"
            style={{ borderColor: 'var(--c-line)', color: 'var(--c-text-dim)' }}
          >
            ✕
          </button>
        )}
      </div>

      {/* 用户表格 */}
      <div className="overflow-x-auto rounded-lg border" style={{ borderColor: 'var(--c-edge)', background: 'var(--c-panel)' }}>
        <table className="w-full">
          <thead>
            <tr style={{ borderBottom: '1px solid var(--c-edge)' }}>
              <Th>{t('admin.users.email')}</Th>
              <Th>{t('admin.users.name')}</Th>
              <Th>{t('admin.users.role')}</Th>
              <Th>{t('admin.users.status')}</Th>
              <Th>{t('admin.users.projects')}</Th>
              <Th>{t('admin.users.media')}</Th>
              <Th>{t('admin.users.createdAt')}</Th>
              <Th>{t('admin.users.actions')}</Th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="p-6 text-center">
                  <span className="font-mono text-xs" style={{ color: 'var(--c-amber)' }}>LOADING…</span>
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-6 text-center font-mono text-xs" style={{ color: 'var(--c-text-faint)' }}>
                  {t('admin.empty')}
                </td>
              </tr>
            ) : (
              users.map((u) => {
                const isMe = u.id === currentSession?.user?.id;
                return (
                  <tr key={u.id} style={{ borderBottom: '1px solid var(--c-edge)' }}>
                    <Td>
                      <span style={{ color: 'var(--c-text)' }}>{u.email}</span>
                      {isMe && (
                        <span
                          className="ml-2 rounded px-1.5 py-0.5 font-mono text-[9px]"
                          style={{ background: 'color-mix(in srgb, var(--c-amber) 15%, transparent)', color: 'var(--c-amber)' }}
                        >
                          YOU
                        </span>
                      )}
                    </Td>
                    <Td style={{ color: 'var(--c-text-dim)' }}>{u.name || '—'}</Td>
                    <Td>
                      <span
                        className="rounded px-2 py-0.5 font-mono text-[10px]"
                        style={{
                          background:
                            u.role === 'ADMIN'
                              ? 'color-mix(in srgb, var(--c-amber) 15%, transparent)'
                              : 'color-mix(in srgb, var(--c-text-faint) 15%, transparent)',
                          color: u.role === 'ADMIN' ? 'var(--c-amber)' : 'var(--c-text-dim)',
                        }}
                      >
                        {u.role}
                      </span>
                    </Td>
                    <Td>
                      <span
                        className="font-mono text-[10px]"
                        style={{ color: u.disabled ? 'var(--c-rust)' : 'var(--c-phosphor)' }}
                      >
                        {u.disabled ? t('admin.users.disabled') : t('admin.users.active')}
                      </span>
                    </Td>
                    <Td style={{ color: 'var(--c-text-dim)' }}>{u._count.projects}</Td>
                    <Td style={{ color: 'var(--c-text-dim)' }}>{u._count.mediaAssets}</Td>
                    <Td style={{ color: 'var(--c-text-faint)' }}>{new Date(u.createdAt).toLocaleDateString()}</Td>
                    <Td>
                      <div className="flex items-center gap-2">
                        {/* 切换角色 */}
                        {!isMe && (
                          <button
                            onClick={() => patchUser(u.id, { role: u.role === 'ADMIN' ? 'USER' : 'ADMIN' })}
                            className="rounded border px-2 py-1 font-mono text-[10px]"
                            style={{ borderColor: 'var(--c-line)', color: 'var(--c-text-dim)' }}
                            title={
                              u.role === 'ADMIN'
                                ? t('admin.users.makeUser')
                                : t('admin.users.makeAdmin')
                            }
                          >
                            {u.role === 'ADMIN' ? '↓ USER' : '↑ ADMIN'}
                          </button>
                        )}
                        {/* 启用/禁用 */}
                        <button
                          onClick={() => {
                            if (confirm(t('admin.users.confirmToggle', { email: u.email }))) {
                              patchUser(u.id, { disabled: !u.disabled });
                            }
                          }}
                          className="rounded border px-2 py-1 font-mono text-[10px]"
                          style={{
                            borderColor: u.disabled ? 'var(--c-phosphor)' : 'var(--c-rust)',
                            color: u.disabled ? 'var(--c-phosphor)' : 'var(--c-rust)',
                          }}
                        >
                          {u.disabled ? t('admin.users.enable') : t('admin.users.disable')}
                        </button>
                      </div>
                    </Td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-3 text-left font-mono text-[10px] uppercase tracking-[0.1em]" style={{ color: 'var(--c-text-faint)' }}>
      {children}
    </th>
  );
}

function Td({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <td className="px-4 py-3 font-mono text-xs" style={style}>
      {children}
    </td>
  );
}
