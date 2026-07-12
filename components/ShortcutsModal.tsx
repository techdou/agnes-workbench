'use client';

// 快捷键速查表 —— 按 ? 唤起
import { useEffect } from 'react';
import { useTranslation } from '@/lib/i18n';

interface ShortcutsModalProps {
  onClose: () => void;
}

export function ShortcutsModal({ onClose }: ShortcutsModalProps) {
  const t = useTranslation();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const shortcuts: { keys: string; labelKey: string }[] = [
    { keys: '/', labelKey: 'shortcuts.add' },
    { keys: 'Ctrl/⌘ + Enter', labelKey: 'shortcuts.runSelected' },
    { keys: 'Ctrl/⌘ + D', labelKey: 'shortcuts.duplicate' },
    { keys: 'Ctrl/⌘ + Z', labelKey: 'shortcuts.undo' },
    { keys: 'Ctrl/⌘ + Shift + Z', labelKey: 'shortcuts.redo' },
    { keys: 'Delete', labelKey: 'shortcuts.delete' },
    { keys: 'Shift / Ctrl + Click', labelKey: 'shortcuts.multiSelect' },
    { keys: 'Esc', labelKey: 'shortcuts.deselect' },
    { keys: '?', labelKey: 'shortcuts.shortcutList' },
  ];

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: 'rgba(10,14,20,0.75)', backdropFilter: 'blur(12px)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-lg border shadow-2xl"
        style={{ borderColor: 'var(--c-line)', background: 'var(--c-ink)', animation: 'fade-up 0.2s ease-out' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 标题栏 */}
        <div className="flex items-center justify-between border-b px-5 py-4" style={{ borderColor: 'var(--c-edge)' }}>
          <h2 className="font-[family-name:var(--font-display)] text-[15px] font-semibold" style={{ color: 'var(--c-text)' }}>
            {t('shortcuts.title')}
          </h2>
          <button
            onClick={onClose}
            className="rounded p-1 font-mono text-sm transition-colors hover:bg-white/5"
            style={{ color: 'var(--c-text-faint)' }}
          >
            ✕
          </button>
        </div>

        {/* 列表 */}
        <div className="p-5">
          {shortcuts.map((s) => (
            <div key={s.labelKey} className="flex items-center justify-between py-2">
              <span className="text-[13px]" style={{ color: 'var(--c-text-dim)' }}>
                {t(s.labelKey)}
              </span>
              <kbd
                className="rounded border px-2 py-1 font-mono text-[11px]"
                style={{ borderColor: 'var(--c-line)', background: 'var(--c-void)', color: 'var(--c-text)' }}
              >
                {s.keys}
              </kbd>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
