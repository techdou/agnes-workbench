'use client';

// 管理员:项目浏览(只读)

import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from '@/lib/i18n';
import Link from 'next/link';

interface AdminProject {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  nodesCount: number;
  edgesCount: number;
  user: {
    id: string;
    email: string;
    name: string | null;
  };
}

export default function AdminProjectsPage() {
  const t = useTranslation();
  const [projects, setProjects] = useState<AdminProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    const resp = await fetch(`/api/admin/projects?${params}`);
    if (resp.ok) {
      const data = await resp.json();
      setProjects(data.projects);
    }
    setLoading(false);
  }, [search]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <h1 className="mb-6 font-display text-2xl font-semibold" style={{ color: 'var(--c-text)' }}>
        {t('admin.projects')}
      </h1>

      <div className="mb-4 flex gap-2">
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') setSearch(searchInput.trim()); }}
          placeholder="搜索项目名或用户邮箱…"
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
          搜索
        </button>
      </div>

      <div className="overflow-x-auto rounded-lg border" style={{ borderColor: 'var(--c-edge)', background: 'var(--c-panel)' }}>
        <table className="w-full">
          <thead>
            <tr style={{ borderBottom: '1px solid var(--c-edge)' }}>
              <Th>{t('admin.projects.name')}</Th>
              <Th>{t('admin.projects.user')}</Th>
              <Th>{t('admin.projects.nodes')}</Th>
              <Th>{t('admin.projects.updatedAt')}</Th>
              <Th>Actions</Th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="p-6 text-center">
                  <span className="font-mono text-xs" style={{ color: 'var(--c-amber)' }}>LOADING…</span>
                </td>
              </tr>
            ) : projects.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-6 text-center font-mono text-xs" style={{ color: 'var(--c-text-faint)' }}>
                  暂无项目
                </td>
              </tr>
            ) : (
              projects.filter((p) => !search ||
                p.name.toLowerCase().includes(search.toLowerCase()) ||
                p.user.email.toLowerCase().includes(search.toLowerCase())
              ).map((p) => (
                <tr key={p.id} style={{ borderBottom: '1px solid var(--c-edge)' }}>
                  <Td style={{ color: 'var(--c-text)' }}>{p.name}</Td>
                  <Td style={{ color: 'var(--c-text-dim)' }}>{p.user.email}</Td>
                  <Td style={{ color: 'var(--c-text-dim)' }}>
                    {p.nodesCount}n / {p.edgesCount}e
                  </Td>
                  <Td style={{ color: 'var(--c-text-faint)' }}>
                    {new Date(p.updatedAt).toLocaleString()}
                  </Td>
                  <Td>
                    <Link
                      href={`/canvas/${p.id}`}
                      target="_blank"
                      className="rounded border px-2 py-1 font-mono text-[10px]"
                      style={{ borderColor: 'var(--c-amber)', color: 'var(--c-amber)' }}
                    >
                      打开 →
                    </Link>
                  </Td>
                </tr>
              ))
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
