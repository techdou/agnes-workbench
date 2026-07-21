'use client';

// 快捷键速查表 —— 按 ? 唤起
// [M5] 触屏判断跟 FlowCanvas 统一用 isTouchDevice prop,不再依赖 CSS 媒体查询,
// 这样触屏笔记本(Surface 等)的行为跟其他触屏设备一致
import { useEffect } from 'react';
import { useTranslation } from '@/lib/i18n';

interface ShortcutsModalProps {
  onClose: () => void;
  isTouchDevice?: boolean;
}

export function ShortcutsModal({ onClose, isTouchDevice }: ShortcutsModalProps) {
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

  // 移动端手势列表(无键盘时展示触屏操作)
  const gestures: { keys: string; labelKey: string }[] = [
    { keys: t('mobile.gesture.oneFingerDrag'), labelKey: 'mobile.gesture.pan' },
    { keys: t('mobile.gesture.twoFingerPinch'), labelKey: 'mobile.gesture.zoom' },
    { keys: t('mobile.gesture.longPressNode'), labelKey: 'mobile.gesture.nodeMenu' },
    { keys: t('mobile.gesture.longPressPane'), labelKey: 'mobile.gesture.addNode' },
    { keys: t('mobile.gesture.tapMultiSelect'), labelKey: 'mobile.gesture.multiSelect' },
    { keys: t('mobile.gesture.dragHandle'), labelKey: 'mobile.gesture.connect' },
  ];

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4"
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
            className="touch-target-44 flex items-center justify-center rounded p-1 font-mono text-sm transition-colors hover:bg-white/5"
            style={{ color: 'var(--c-text-faint)' }}
            aria-label={t('common.close')}
          >
            ✕
          </button>
        </div>

        {/* 列表:触屏显示手势,否则显示键盘快捷键 */}
        <div className="p-4 sm:p-5">
          {/* 触屏设备:手势说明 */}
          {isTouchDevice && (
            <div className="mb-4">
              <p className="mb-2 font-mono text-[9px] tracking-[0.2em]" style={{ color: 'var(--c-text-faint)' }}>
                {t('mobile.gestures.title')}
              </p>
              {gestures.map((g) => (
                <div key={g.labelKey} className="flex items-center justify-between gap-3 py-2">
                  <span className="text-[12px]" style={{ color: 'var(--c-text-dim)' }}>
                    {t(g.labelKey)}
                  </span>
                  <span
                    className="shrink-0 rounded border px-2 py-1 font-mono text-[10px]"
                    style={{ borderColor: 'var(--c-line)', background: 'var(--c-void)', color: 'var(--c-text)' }}
                  >
                    {g.keys}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* 非触屏:键盘快捷键 */}
          {!isTouchDevice && (
            <div>
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
          )}
        </div>
      </div>
    </div>
  );
}
