'use client';

// 节点结果收藏按钮 —— 复用 PATCH /api/cache/[hash] 切换收藏状态
// cachedUrl 格式:/api/cache/{hash},从中提取 hash 调用 API
import { useState, useCallback, useEffect } from 'react';
import { useTranslation } from '@/lib/i18n';
import { useToast } from '@/lib/useToast';

interface FavoriteButtonProps {
  cachedUrl: string; // /api/cache/{hash}
  className?: string;
}

// hash 格式:十六进制,1-32 位(与服务端校验一致)
function extractHash(cachedUrl: string): string | null {
  if (!cachedUrl.startsWith('/api/cache/')) return null;
  const hash = cachedUrl.slice('/api/cache/'.length);
  return /^[0-9a-f]{1,32}$/.test(hash) ? hash : null;
}

export function FavoriteButton({ cachedUrl, className = '' }: FavoriteButtonProps) {
  const t = useTranslation();
  const pushToast = useToast((s) => s.push);
  const [favorited, setFavorited] = useState(false);
  const [loading, setLoading] = useState(false);

  const hash = extractHash(cachedUrl);

  // 挂载时查一次初始收藏状态(避免已收藏资源显示 ☆)
  useEffect(() => {
    if (!hash) return;
    let cancelled = false;
    fetch(`/api/cache/${hash}?meta=1`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data) setFavorited(!!data.favorited);
      })
      .catch(() => {}); // 查询失败静默处理,保持默认 false
    return () => { cancelled = true; };
  }, [hash]);

  const toggle = useCallback(async () => {
    if (loading || !hash) return;
    setLoading(true);
    const prev = favorited;
    const next = !prev;
    setFavorited(next); // 乐观更新
    try {
      const resp = await fetch(`/api/cache/${hash}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ favorited: next }),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      pushToast(next ? t('archive.favorite') : t('archive.unfavorite'), 'info');
    } catch {
      setFavorited(prev); // 失败回滚
    } finally {
      setLoading(false);
    }
  }, [favorited, loading, hash, pushToast, t]);

  // hash 非法(如 cachedUrl 是外部 URL,缓存失败回退)→ 不渲染
  if (!hash) return null;

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className={`flex shrink-0 items-center justify-center rounded border px-1.5 py-1 font-mono text-[12px] leading-none transition-all hover:scale-110 disabled:opacity-50 ${className}`}
      style={{
        borderColor: favorited
          ? 'color-mix(in srgb, var(--c-amber) 50%, transparent)'
          : 'var(--c-line)',
        background: favorited
          ? 'color-mix(in srgb, var(--c-amber) 12%, transparent)'
          : 'transparent',
        color: favorited ? 'var(--c-amber)' : 'var(--c-text-faint)',
        textShadow: favorited ? '0 0 8px color-mix(in srgb, var(--c-amber) 40%, transparent)' : 'none',
      }}
      title={favorited ? t('archive.unfavorite') : t('archive.favorite')}
      aria-label={favorited ? t('archive.unfavorite') : t('archive.favorite')}
      aria-pressed={favorited}
    >
      {favorited ? '★' : '☆'}
    </button>
  );
}
