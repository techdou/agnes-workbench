'use client';

import { useEffect, useState } from 'react';

interface Entry {
  hash: string;
  originalUrl: string;
  type: 'image' | 'video';
  prompt?: string;
  createdAt: string;
}

export function LibraryPanel() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null); // [H8] 错误状态

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch('/api/library');
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      setEntries(data.entries || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (open) refresh();
  }, [open]);

  const imgCount = entries.filter((e) => e.type === 'image').length;
  const vidCount = entries.filter((e) => e.type === 'video').length;

  return (
    <>
      {/* [M17] ARCHIVE 按钮:定位避开工具栏(用 top-[104px] 给两行工具栏留空间) */}
      <button
        onClick={() => setOpen(!open)}
        className="fixed right-0 top-[104px] z-20 flex items-center gap-1.5 rounded-l-md border border-r-0 border-l-[3px] px-3 py-2 font-mono text-[10px] font-semibold tracking-[0.15em] shadow-lg backdrop-blur-md transition-all hover:pl-4"
        style={{
          borderColor: 'var(--c-edge)',
          borderLeftColor: 'var(--c-amber)',
          background: 'color-mix(in srgb, var(--c-ink) 95%, transparent)',
          color: 'var(--c-amber)',
        }}
      >
        <span className="flicker">◈</span>
        <span className="hidden sm:inline">ARCHIVE</span>
        <span className="rounded px-1.5 py-0.5" style={{ background: 'var(--c-void)', color: 'var(--c-text-dim)' }}>
          {entries.length}
        </span>
      </button>

      {open && (
        <aside
          className="fixed bottom-0 right-0 top-36 z-20 flex w-72 flex-col border-l backdrop-blur-md sm:w-80"
          style={{ borderColor: 'var(--c-edge)', background: 'color-mix(in srgb, var(--c-void) 98%, transparent)' }}
        >
          <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: 'var(--c-edge)' }}>
            <div>
              <h2 className="font-[family-name:var(--font-display)] text-[14px] font-semibold" style={{ color: 'var(--c-text)' }}>
                作品归档
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
            {/* [H8] 错误状态 */}
            {error && (
              <div className="mb-3 rounded border-l-2 px-3 py-2" style={{ borderColor: 'var(--c-rust)', background: 'color-mix(in srgb, var(--c-rust) 10%, transparent)' }}>
                <p className="font-mono text-[10px]" style={{ color: 'var(--c-rust)' }}>加载失败: {error}</p>
                <button onClick={refresh} className="mt-1 font-mono text-[9px] underline" style={{ color: 'var(--c-rust)' }}>
                  重试
                </button>
              </div>
            )}

            {!error && entries.length === 0 && !loading && (
              <div className="mt-16 text-center">
                <div className="font-mono text-2xl opacity-30">∅</div>
                <p className="mt-2 font-mono text-[10px] tracking-wider" style={{ color: 'var(--c-text-ghost)' }}>
                  ARCHIVE EMPTY
                </p>
                <p className="mt-1 text-[11px]" style={{ color: 'var(--c-text-faint)' }}>
                  生成作品后会自动归档
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
                    className="group relative overflow-hidden rounded border transition-all"
                    style={{ borderColor: 'var(--c-edge)', background: 'var(--c-ink)' }}
                  >
                    <div className="relative aspect-square overflow-hidden">
                      {e.type === 'image' ? (
                        <img src={`/api/cache/${e.hash}`} alt={e.prompt || ''} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                      ) : (
                        <>
                          {/* [M13] 视频用 poster 属性显示首帧,失败则显示播放图标占位 */}
                          <video
                            src={`/api/cache/${e.hash}`}
                            poster={`/api/cache/${e.hash}`}
                            className="h-full w-full object-cover"
                            muted
                            preload="metadata"
                          />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
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
                        {e.prompt || '(无 prompt)'}
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
