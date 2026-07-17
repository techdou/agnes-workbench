'use client';

// 管理总览 —— 统计卡片 + 最近用户

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslation } from '@/lib/i18n';

interface Stats {
  users: number;
  projects: number;
  media: number;
  disabled: number;
}

interface RecentUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
  createdAt: string;
}

export default function AdminOverviewPage() {
  const t = useTranslation();
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentUsers, setRecentUsers] = useState<RecentUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [statsResp, usersResp] = await Promise.all([
        fetch('/api/admin/stats'),
        fetch('/api/admin/users'),
      ]);
      if (statsResp.ok) {
        const data = await statsResp.json();
        setStats(data.stats);
      }
      if (usersResp.ok) {
        const data = await usersResp.json();
        setRecentUsers(data.users.slice(0, 5));
      }
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <span className="font-mono text-sm flicker" style={{ color: 'var(--c-amber)' }}>◈ LOADING…</span>
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-6 font-display text-2xl font-semibold" style={{ color: 'var(--c-text)' }}>
        {t('admin.overview')}
      </h1>

      {/* 统计卡片 */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label={t('admin.stats.users')} value={stats?.users ?? 0} accent="phosphor" />
        <StatCard label={t('admin.stats.projects')} value={stats?.projects ?? 0} accent="amber" />
        <StatCard label={t('admin.stats.media')} value={stats?.media ?? 0} accent="phosphor" />
        <StatCard label={t('admin.stats.disabled')} value={stats?.disabled ?? 0} accent="rust" />
      </div>

      {/* 最近用户 */}
      <section className="mt-10">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold" style={{ color: 'var(--c-text)' }}>
            最近用户
          </h2>
          <Link
            href="/admin/users"
            className="font-mono text-xs"
            style={{ color: 'var(--c-amber)' }}
          >
            查看全部 →
          </Link>
        </div>
        <div className="rounded-lg border" style={{ borderColor: 'var(--c-edge)', background: 'var(--c-panel)' }}>
          {recentUsers.map((u) => (
            <div
              key={u.id}
              className="flex items-center justify-between border-b px-4 py-3 last:border-b-0"
              style={{ borderColor: 'var(--c-edge)' }}
            >
              <div>
                <p className="font-mono text-xs" style={{ color: 'var(--c-text)' }}>
                  {u.email}
                </p>
                {u.name && (
                  <p className="mt-0.5 font-mono text-[10px]" style={{ color: 'var(--c-text-faint)' }}>
                    {u.name}
                  </p>
                )}
              </div>
              <span
                className="rounded px-2 py-0.5 font-mono text-[10px]"
                style={{
                  background: u.role === 'ADMIN'
                    ? 'color-mix(in srgb, var(--c-amber) 15%, transparent)'
                    : 'color-mix(in srgb, var(--c-text-faint) 15%, transparent)',
                  color: u.role === 'ADMIN' ? 'var(--c-amber)' : 'var(--c-text-dim)',
                }}
              >
                {u.role}
              </span>
            </div>
          ))}
          {recentUsers.length === 0 && (
            <p className="px-4 py-6 text-center font-mono text-xs" style={{ color: 'var(--c-text-faint)' }}>
              暂无用户
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: number; accent: 'phosphor' | 'amber' | 'rust' }) {
  const colorVar =
    accent === 'phosphor' ? 'var(--c-phosphor)' :
    accent === 'amber' ? 'var(--c-amber)' :
    'var(--c-rust)';
  return (
    <div
      className="rounded-lg border p-5"
      style={{
        borderColor: 'var(--c-edge)',
        background: 'var(--c-panel)',
      }}
    >
      <p className="font-mono text-[10px] uppercase tracking-[0.15em]" style={{ color: 'var(--c-text-faint)' }}>
        {label}
      </p>
      <p className="mt-2 font-display text-3xl font-semibold" style={{ color: colorVar }}>
        {value}
      </p>
    </div>
  );
}
