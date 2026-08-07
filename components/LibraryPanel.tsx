'use client';

import { useEffect, useState } from 'react';
import { useFlowStore } from '@/lib/store';
import { useTranslation } from '@/lib/i18n';
import { GalleryVideo } from './MediaCard';

interface Entry {
  hash: string;
  originalUrl: string;
  type: 'image' | 'video';
  prompt?: string;
  createdAt: string;
  favorited?: boolean;
}

interface LibraryPanelProps {
  open: boolean;
  onClose: () => void;
  onCountChange?: (count: number) => void; // 资源数量变化时通知父组件(给 Toolbar 徽标用)
}

export function LibraryPanel({ open, onClose, onCountChange }: LibraryPanelProps) {
  const t = useTranslation();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      // 按当前项目拉取画廊
      const projectId = useFlowStore.getState().currentProjectId;
      const q = projectId ? `?projectId=${encodeURIComponent(projectId)}` : '';
      const resp = await fetch(`/api/library${q}`);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      const newEntries = data.entries || [];
      setEntries(newEntries);
      onCountChange?.(newEntries.length);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('archive.loadFailed'));
    } finally {
      setLoading(false);
    }
  }

  // 切换收藏:乐观更新,失败回滚
  async function toggleFavorite(hash: string, current: boolean) {
    const prev = entries;
    const next = current ? false : true;
    setEntries(entries.map((e) => (e.hash === hash ? { ...e, favorited: next } : e)));
    try {
      const resp = await fetch(`/api/cache/${hash}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ favorited: next }),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    } catch {
      setEntries(prev); // 失败回滚
    }
  }

  // 挂载时静默拉一次 count(即使面板未打开,Toolbar 徽标也需要)
  useEffect(() => {
    const projectId = useFlowStore.getState().currentProjectId;
    if (!projectId || !onCountChange) return;
    const q = `?projectId=${encodeURIComponent(projectId)}`;
    fetch(`/api/library${q}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data) onCountChange((data.entries || []).length); })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const imgCount = entries.filter((e) => e.type === 'image').length;
  const vidCount = entries.filter((e) => e.type === 'video').length;

  return (
    <>
      {open && (
        <>
          {/* 移动端遮罩:点击关闭 */}
          <div
            className="fixed inset-0 z-[19] bg-black/40 sm:hidden"
            onClick={onClose}
          />
          <aside
            className="fixed bottom-0 right-0 top-[84px] z-20 flex w-full flex-col border-l backdrop-blur-md sm:w-80"
            style={{ borderColor: 'var(--c-edge)', background: 'color-mix(in srgb, var(--c-void) 98%, transparent)' }}
          >
          <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: 'var(--c-edge)' }}>
            <div>
              <h2 className="font-[family-name:var(--font-display)] text-[14px] font-semibold" style={{ color: 'var(--c-text)' }}>
                {t('archive.title')}
              </h2>
              <p className="mt-0.5 font-mono text-[9px] tracking-[0.15em]" style={{ color: 'var(--c-text-faint)' }}>
                {imgCount} IMG · {vidCount} VID
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={refresh}
                disabled={loading}
                className="rounded border px-2 py-1 font-mono text-[9px] tracking-wider transition-colors disabled:opacity-50"
                style={{ borderColor: 'var(--c-line)', color: 'var(--c-text-dim)' }}
              >
                {loading ? '↻…' : '↻'}
              </button>
              <button
                onClick={onClose}
                className="rounded border px-2 py-1 font-mono text-[12px] leading-none transition-colors"
                style={{ borderColor: 'var(--c-line)', color: 'var(--c-text-dim)' }}
                aria-label={t('toolbar.back')}
              >
                ✕
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3">
            {error && (
              <div className="mb-3 rounded border-l-2 px-3 py-2" style={{ borderColor: 'var(--c-rust)', background: 'color-mix(in srgb, var(--c-rust) 10%, transparent)' }}>
                <p className="font-mono text-[10px]" style={{ color: 'var(--c-rust)' }}>{t('archive.loadFailed')}: {error}</p>
                <button onClick={refresh} className="mt-1 font-mono text-[9px] underline" style={{ color: 'var(--c-rust)' }}>
                  {t('archive.retry')}
                </button>
              </div>
            )}

            {!error && entries.length === 0 && !loading && (
              <div className="mt-16 text-center">
                <div className="font-mono text-2xl opacity-30">∅</div>
                <p className="mt-2 font-mono text-[10px] tracking-wider" style={{ color: 'var(--c-text-ghost)' }}>
                  {t('archive.empty')}
                </p>
                <p className="mt-1 text-[11px]" style={{ color: 'var(--c-text-faint)' }}>
                  {t('archive.emptyDesc')}
                </p>
              </div>
            )}

            {entries.length > 0 && (
              <div className="grid grid-cols-2 gap-2">
                {entries.map((e) => (
                  // [C2] 卡片根用 div 不用 a,避免收藏按钮嵌在 a 内部产生事件竞争
                  <div
                    key={e.hash}
                    className="group relative overflow-hidden rounded border transition-all"
                    style={{ borderColor: 'var(--c-edge)', background: 'var(--c-ink)' }}
                  >
                    <a
                      href={`/api/cache/${e.hash}`}
                      download={`agnes-${e.type}-${e.hash.slice(0, 8)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block"
                    >
                      <div className="relative aspect-square overflow-hidden">
                        {e.type === 'image' ? (
                          <img src={`/api/cache/${e.hash}`} alt={e.prompt || ''} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                        ) : (
                          <GalleryVideo hash={e.hash} />
                        )}
                        <span
                          className="absolute left-1 top-1 rounded px-1 py-0.5 font-mono text-[8px] tracking-wider backdrop-blur-sm"
                          style={{
                            background: 'color-mix(in srgb, var(--c-void) 85%, transparent)',
                            color: e.type === 'image' ? 'var(--c-phosphor)' : 'var(--c-amber)',
                          }}
                        >
                          {e.type === 'image' ? 'IMG' : 'VID'}
                        </span>
                      </div>
                    </a>
                    {/* ★ 收藏按钮:移出 <a>,DOM 兄弟节点,从根本上避免事件冒泡 */}
                    <button
                      onClick={() => toggleFavorite(e.hash, !!e.favorited)}
                      className="absolute right-1 top-1 z-10 rounded px-1.5 py-0.5 font-mono text-[12px] leading-none backdrop-blur-sm transition-transform hover:scale-125"
                      style={{
                        background: 'color-mix(in srgb, var(--c-void) 85%, transparent)',
                        color: e.favorited ? 'var(--c-amber)' : 'var(--c-text-faint)',
                        // [L6] 不再借用 --c-bg-glow-1(琥珀色背景辉光),改用 amber 直接 mix
                        textShadow: e.favorited ? '0 0 8px color-mix(in srgb, var(--c-amber) 40%, transparent)' : 'none',
                      }}
                      title={e.favorited ? t('archive.unfavorite') : t('archive.favorite')}
                      aria-label={e.favorited ? t('archive.unfavorite') : t('archive.favorite')}
                      aria-pressed={!!e.favorited}
                    >
                      {e.favorited ? '★' : '☆'}
                    </button>
                    <div className="px-1.5 py-1.5">
                      <p className="line-clamp-2 font-[family-name:var(--font-display)] text-[10px] leading-tight" style={{ color: 'var(--c-text-dim)' }}>
                        {e.prompt || t('archive.noPrompt')}
                      </p>
                      <p className="mt-1 font-mono text-[8px] tracking-wider" style={{ color: 'var(--c-text-ghost)' }}>
                        {new Date(e.createdAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>
        </>
      )}
    </>
  );
}
