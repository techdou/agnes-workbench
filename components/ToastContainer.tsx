'use client';

// 全局 toast 通知(右下角浮窗)
import { useToast } from '@/lib/useToast';

const TYPE_STYLE = {
  info: { border: 'var(--c-text-dim)', color: 'var(--c-text)' },
  error: { border: 'var(--c-rust)', color: 'var(--c-rust)' },
  success: { border: 'var(--c-phosphor)', color: 'var(--c-phosphor)' },
};

const TYPE_ICON = { info: 'ℹ', error: '✕', success: '✓' };

export function ToastContainer() {
  const toasts = useToast((s) => s.toasts);
  const dismiss = useToast((s) => s.dismiss);

  return (
    // [M15] 放左下角,避免和右侧 ARCHIVE 抽屉重叠
    <div className="pointer-events-none fixed bottom-4 left-4 z-50 flex flex-col gap-2">
      {toasts.map((t) => {
        const s = TYPE_STYLE[t.type];
        return (
          <div
            key={t.id}
            className="pointer-events-auto flex max-w-sm items-start gap-2 rounded border-l-2 px-3 py-2 shadow-lg backdrop-blur-md"
            style={{
              borderLeftColor: s.border,
              background: 'color-mix(in srgb, var(--c-panel) 95%, transparent)',
              animation: 'toast-in 0.3s ease-out',
            }}
            onClick={() => dismiss(t.id)}
          >
            <span className="font-mono text-xs leading-relaxed" style={{ color: s.color }}>
              {TYPE_ICON[t.type]}
            </span>
            <span className="font-mono text-[11px] leading-relaxed" style={{ color: 'var(--c-text)' }}>
              {t.message}
            </span>
          </div>
        );
      })}
    </div>
  );
}
