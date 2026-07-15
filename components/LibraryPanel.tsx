'use client';

import { useEffect, useState } from 'react';
import { useFlowStore } from '@/lib/store';
import { useTranslation } from '@/lib/i18n';

interface Entry {
  hash: string;
  originalUrl: string;
  type: 'image' | 'video';
  prompt?: string;
  createdAt: string;
}

export function LibraryPanel() {
  const t = useTranslation();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [open, setOpen] = useState(false);
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
      setEntries(data.entries || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('archive.loadFailed'));
    } finally {
      setLoading(false);
    }
  }

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
      <button
        onClick={() => setOpen(!open)}
        className="fixed right-0 top-[52px] z-20 flex items-center gap-1.5 rounded-l-md border border-r-0 border-l-[3px] px-3 py-2 font-mono text-[10px] font-semibold tracking-[0.15em] shadow-lg backdrop-blur-md transition-all hover:pl-4"
        style={{
          borderColor: 'var(--c-edge)',
          borderLeftColor: 'var(--c-amber)',
          background: 'color-mix(in srgb, var(--c-ink) 95%, transparent)',
          color: 'var(--c-amber)',
        }}
      >
        <span className="flicker">◈</span>
        <span className="hidden sm:inline">{t('toolbar.archive').toUpperCase()}</span>
        <span className="rounded px-1.5 py-0.5" style={{ background: 'var(--c-void)', color: 'var(--c-text-dim)' }}>
          {entries.length}
        </span>
      </button>

      {open && (
        <aside
          className="fixed bottom-0 right-0 top-[84px] z-20 flex w-72 flex-col border-l backdrop-blur-md sm:w-80"
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
            <button
              onClick={refresh}
              disabled={loading}
              className="rounded border px-2 py-1 font-mono text-[9px] tracking-wider transition-colors disabled:opacity-50"
              style={{ borderColor: 'var(--c-line)', color: 'var(--c-text-dim)' }}
            >
              {loading ? '↻…' : '↻'}
            </button>
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
                  <a
                    key={e.hash}
                    href={`/api/cache/${e.hash}`}
                    download
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group relative overflow-hidden rounded border transition-all"
                    style={{ borderColor: 'var(--c-edge)', background: 'var(--c-ink)' }}
                  >
                    <div className="relative aspect-square overflow-hidden">
                      {e.type === 'image' ? (
                        <img src={`/api/cache/${e.hash}`} alt={e.prompt || ''} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                      ) : (
                        <>
                          <video
                            src={`/api/cache/${e.hash}`}
                            className="h-full w-full object-cover"
                            muted
                            preload="none"
                          />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                            <span className="font-mono text-lg text-white opacity-80">▶</span>
                          </div>
                        </>
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
                    <div className="px-1.5 py-1.5">
                      <p className="line-clamp-2 font-[family-name:var(--font-display)] text-[10px] leading-tight" style={{ color: 'var(--c-text-dim)' }}>
                        {e.prompt || t('archive.noPrompt')}
                      </p>
                      <p className="mt-1 font-mono text-[8px] tracking-wider" style={{ color: 'var(--c-text-ghost)' }}>
                        {new Date(e.createdAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </a>
                ))}
              </div>
            )}
          </div>
        </aside>
      )}
    </>
  );
}
