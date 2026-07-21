'use client';

// 全局画廊 —— 跨项目展示所有 ★ 收藏的作品
// 跟 Dashboard 共享顶栏风格,内容是 masonry 网格
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSettings } from '@/lib/settings';
import { useTranslation } from '@/lib/i18n';
import { useToast } from '@/lib/useToast';
import { GalleryVideo } from './MediaCard';

interface GalleryEntry {
  hash: string;
  originalUrl: string;
  type: 'image' | 'video';
  prompt?: string;
  createdAt: string;
  favorited?: boolean;
  favoritedAt?: string;
  projectId?: string;
}

export function GalleryPage() {
  const t = useTranslation();
  const router = useRouter();
  const pushToast = useToast((s) => s.push);
  const loadSettings = useSettings((s) => s.load);

  const [entries, setEntries] = useState<GalleryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      await loadSettings();
      await refresh();
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function refresh() {
    setError(null);
    try {
      const resp = await fetch('/api/gallery');
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      setEntries(data.entries || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('archive.loadFailed'));
    }
  }

  // 取消收藏:乐观更新,从列表移除,失败回滚
  async function unfavorite(entry: GalleryEntry) {
    const prev = entries;
    setEntries(entries.filter((e) => e.hash !== entry.hash));
    try {
      const resp = await fetch(`/api/cache/${entry.hash}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ favorited: false }),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    } catch {
      setEntries(prev);
      // [M3] 用专门的 unfavoriteFailed 文案,不再复用"加载失败"
      pushToast(t('archive.unfavoriteFailed'), 'error');
    }
  }

  const imgCount = entries.filter((e) => e.type === 'image').length;
  const vidCount = entries.filter((e) => e.type === 'video').length;

  if (loading) {
    return (
      <div className="flex h-[100dvh] items-center justify-center" style={{ background: 'var(--c-void)' }}>
        <span className="font-mono text-sm flicker" style={{ color: 'var(--c-amber)' }}>◈ LOADING…</span>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-[100dvh] flex-col overflow-hidden" style={{ background: 'var(--c-void)' }}>
      {/* 顶栏:复用 Dashboard 风格 */}
      <header
        className="relative z-10 border-b backdrop-blur-md"
        style={{ borderColor: 'var(--c-edge)', background: 'color-mix(in srgb, var(--c-void) 95%, transparent)' }}
      >
        <div className="flex items-center justify-between px-5 py-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/')}
              className="rounded border px-2 py-1 font-mono text-[12px] transition-colors"
              style={{ borderColor: 'var(--c-line)', color: 'var(--c-text-dim)' }}
              title={t('toolbar.back')}
            >
              ←
            </button>
            <div className="flex h-8 w-8 items-center justify-center rounded border"
              style={{ borderColor: 'color-mix(in srgb, var(--c-amber) 40%, transparent)', background: 'color-mix(in srgb, var(--c-amber) 10%, transparent)' }}
            >
              <span className="font-mono text-base" style={{ color: 'var(--c-amber)' }}>★</span>
            </div>
            <div>
              <h1 className="font-[family-name:var(--font-display)] text-[16px] font-semibold leading-none tracking-wide" style={{ color: 'var(--c-text)' }}>
                {t('gallery.title')}
              </h1>
              <p className="mt-1 font-mono text-[9px] tracking-[0.2em]" style={{ color: 'var(--c-text-faint)' }}>
                {t('gallery.subtitle')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 font-mono text-[10px] tracking-wider" style={{ color: 'var(--c-text-faint)' }}>
            <span><span style={{ color: 'var(--c-phosphor)' }}>{imgCount}</span> {t('gallery.imgCount')}</span>
            <span><span style={{ color: 'var(--c-amber)' }}>{vidCount}</span> {t('gallery.vidCount')}</span>
            <button
              onClick={refresh}
              className="ml-2 rounded border px-2 py-1 transition-colors"
              style={{ borderColor: 'var(--c-line)', color: 'var(--c-text-dim)' }}
              title={t('archive.retry')}
            >
              ↻
            </button>
          </div>
        </div>
      </header>

      {/* 内容区 */}
      <main className="flex-1 overflow-y-auto p-5">
        {error && (
          <div className="mb-4 rounded border-l-2 px-3 py-2" style={{ borderColor: 'var(--c-rust)', background: 'color-mix(in srgb, var(--c-rust) 10%, transparent)' }}>
            <p className="font-mono text-[10px]" style={{ color: 'var(--c-rust)' }}>{t('archive.loadFailed')}: {error}</p>
            <button onClick={refresh} className="mt-1 font-mono text-[9px] underline" style={{ color: 'var(--c-rust)' }}>
              {t('archive.retry')}
            </button>
          </div>
        )}

        {!error && entries.length === 0 && (
          <div className="flex h-full min-h-[400px] flex-col items-center justify-center">
            <div className="relative mb-6 h-24 w-24">
              <div
                className="absolute inset-0 rounded-full border opacity-40"
                style={{ borderColor: 'var(--c-amber)' }}
              />
              <div
                className="absolute inset-0 flex items-center justify-center font-mono text-4xl"
                style={{ color: 'var(--c-amber)', textShadow: '0 0 16px var(--c-bg-glow-1)' }}
              >
                ★
              </div>
            </div>
            <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold" style={{ color: 'var(--c-text-dim)' }}>
              {t('gallery.empty')}
            </h2>
            <p className="mt-2 max-w-md text-center text-[13px]" style={{ color: 'var(--c-text-faint)' }}>
              {t('gallery.emptyDesc')}
            </p>
            <p className="mt-1 font-mono text-[10px] tracking-wider" style={{ color: 'var(--c-text-ghost)' }}>
              {t('gallery.howTo')}
            </p>
            <button
              onClick={() => router.push('/')}
              className="mt-6 rounded border px-6 py-2.5 font-mono text-[11px] font-semibold tracking-wider transition-all"
              style={{
                borderColor: 'color-mix(in srgb, var(--c-amber) 50%, transparent)',
                background: 'color-mix(in srgb, var(--c-amber) 12%, transparent)',
                color: 'var(--c-amber)',
              }}
            >
              ← {t('toolbar.back')}
            </button>
          </div>
        )}

        {entries.length > 0 && (
          // CSS columns 实现 masonry,响应式列数
          <div className="columns-1 gap-4 sm:columns-2 md:columns-3 lg:columns-4 [&>*]:mb-4 [&>*]:break-inside-avoid">
            {entries.map((e) => (
              <div
                key={e.hash}
                className="group relative overflow-hidden rounded-md border transition-all duration-200 hover:-translate-y-0.5"
                style={{ borderColor: 'var(--c-edge)', background: 'var(--c-ink)' }}
              >
                {/* 左色条(收藏标记) */}
                <span
                  className="pointer-events-none absolute left-0 top-0 z-10 h-full w-[3px]"
                  style={{ background: 'var(--c-amber)', boxShadow: '0 0 8px color-mix(in srgb, var(--c-amber) 40%, transparent)' }}
                />
                {/* 媒体 */}
                <a
                  href={`/api/cache/${e.hash}`}
                  // [M4] 下载文件名规范化:agnes-image-a3f2c1d9.<ext>
                  download={`agnes-${e.type}-${e.hash.slice(0, 8)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="relative block overflow-hidden"
                  style={{ background: 'var(--c-void)' }}
                >
                  {e.type === 'image' ? (
                    <img
                      src={`/api/cache/${e.hash}`}
                      alt={e.prompt || ''}
                      className="w-full object-cover transition-transform group-hover:scale-105"
                      loading="lazy"
                    />
                  ) : (
                    <GalleryVideo hash={e.hash} className="w-full object-cover" />
                  )}
                  <span
                    className="absolute left-2 top-2 rounded px-1.5 py-0.5 font-mono text-[8px] tracking-wider backdrop-blur-sm"
                    style={{
                      background: 'color-mix(in srgb, var(--c-void) 85%, transparent)',
                      color: e.type === 'image' ? 'var(--c-phosphor)' : 'var(--c-amber)',
                    }}
                  >
                    {e.type === 'image' ? 'IMG' : 'VID'}
                  </span>
                </a>
                {/* ★ 取消收藏按钮:DOM 跟 <a> 平级,避免事件竞争 */}
                <button
                  onClick={() => unfavorite(e)}
                  className="absolute right-2 top-2 z-10 rounded px-1.5 py-0.5 font-mono text-[12px] leading-none backdrop-blur-sm transition-transform hover:scale-125"
                  style={{
                    background: 'color-mix(in srgb, var(--c-void) 85%, transparent)',
                    color: 'var(--c-amber)',
                    textShadow: '0 0 8px color-mix(in srgb, var(--c-amber) 40%, transparent)',
                  }}
                  title={t('archive.unfavorite')}
                  aria-label={t('archive.unfavorite')}
                >
                  ★
                </button>
                {/* 底部信息 + 操作 */}
                <div className="px-3 py-2.5 pl-4">
                  {e.prompt && (
                    <p className="mb-1.5 line-clamp-2 font-[family-name:var(--font-display)] text-[11px] leading-relaxed" style={{ color: 'var(--c-text-dim)' }}>
                      {e.prompt}
                    </p>
                  )}
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[9px] tracking-wider" style={{ color: 'var(--c-text-ghost)' }}>
                      {new Date(e.favoritedAt || e.createdAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <div className="flex items-center gap-1">
                      {e.projectId && (
                        <button
                          onClick={() => router.push(`/canvas/${e.projectId}`)}
                          className="rounded border px-1.5 py-0.5 font-mono text-[8px] tracking-wider transition-colors hover:bg-white/5"
                          style={{ borderColor: 'var(--c-line)', color: 'var(--c-text-faint)' }}
                          title={t('gallery.openProject')}
                          aria-label={t('gallery.openProject')}
                        >
                          →
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
