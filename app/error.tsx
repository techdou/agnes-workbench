'use client';

// 路由级错误边界 —— 捕获页面内运行时错误,避免白屏
// Phosphor 风格:磷光符号 + 错误信息 + 重试按钮

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('页面错误:', error);
  }, [error]);

  return (
    <div
      className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-8"
      style={{ background: 'var(--c-void)' }}
    >
      <div className="relative h-16 w-16">
        <div
          className="absolute inset-0 rounded-full border opacity-40"
          style={{ borderColor: 'var(--c-rust)', animation: 'flicker 3s ease-in-out infinite' }}
        />
        <div
          className="absolute inset-0 flex items-center justify-center font-mono text-2xl"
          style={{ color: 'var(--c-rust)', textShadow: '0 0 12px rgba(200,85,61,0.4)' }}
        >
          ⚠
        </div>
      </div>
      <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold" style={{ color: 'var(--c-text)' }}>
        Something went wrong
      </h2>
      <p className="max-w-md text-center text-[13px]" style={{ color: 'var(--c-text-faint)' }}>
        {error.message || 'An unexpected error occurred.'}
      </p>
      {error.digest && (
        <p className="font-mono text-[9px] tracking-wider" style={{ color: 'var(--c-text-ghost)' }}>
          ID: {error.digest}
        </p>
      )}
      <div className="flex gap-3">
        <button
          onClick={reset}
          className="rounded border px-5 py-2 font-mono text-[11px] font-semibold tracking-wider transition-colors"
          style={{
            borderColor: 'color-mix(in srgb, var(--c-amber) 50%, transparent)',
            background: 'color-mix(in srgb, var(--c-amber) 12%, transparent)',
            color: 'var(--c-amber)',
          }}
        >
          ↻ RETRY
        </button>
        <button
          onClick={() => window.location.href = '/'}
          className="rounded border px-5 py-2 font-mono text-[11px] tracking-wider transition-colors"
          style={{ borderColor: 'var(--c-line)', color: 'var(--c-text-dim)' }}
        >
          ← HOME
        </button>
      </div>
    </div>
  );
}
