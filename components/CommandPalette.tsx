'use client';

// Command Palette —— 搜索式节点添加,替代横向滚动节点栏
// 触发:/ 键 或 Toolbar 的 + 按钮
// 交互:输入过滤 → 方向键导航 → Enter 添加 → Esc 关闭
import { useState, useEffect, useRef, useMemo } from 'react';
import { useFlowStore } from '@/lib/store';
import { useTranslation } from '@/lib/i18n';
import type { NodeType } from '@/lib/types';

interface PaletteItem {
  type: NodeType;
  group: 'input' | 'image' | 'video' | 'output';
  sigil: string;
}

const ITEMS: PaletteItem[] = [
  { type: 'text', group: 'input', sigil: 'Τ' },
  { type: 'textToImage', group: 'image', sigil: 'ℑ' },
  { type: 'imageToImage', group: 'image', sigil: 'ℜ' },
  { type: 'textToVideo', group: 'video', sigil: 'Ϝ' },
  { type: 'imageToVideo', group: 'video', sigil: 'δ' },
  { type: 'multiImageVideo', group: 'video', sigil: 'Σ' },
  { type: 'keyframe', group: 'video', sigil: 'Φ' },
  { type: 'imagePreview', group: 'output', sigil: '▣' },
  { type: 'videoPreview', group: 'output', sigil: '▶' },
];

const GROUP_ORDER: PaletteItem['group'][] = ['input', 'image', 'video', 'output'];
const GROUP_LABEL_KEY: Record<PaletteItem['group'], string> = {
  input: 'nodeGroup.input',
  image: 'nodeGroup.image',
  video: 'nodeGroup.video',
  output: 'nodeGroup.output',
};

interface CommandPaletteProps {
  onClose: () => void;
}

export function CommandPalette({ onClose }: CommandPaletteProps) {
  const t = useTranslation();
  const addNode = useFlowStore((s) => s.addNode);
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // 过滤:匹配节点类型名(中英文)或 sigil
  const filtered = useMemo(() => {
    if (!query.trim()) return ITEMS;
    const q = query.toLowerCase();
    return ITEMS.filter((item) => {
      const nodeName = t(`node.${item.type}`).toLowerCase();
      return nodeName.includes(q) || item.type.toLowerCase().includes(q) || item.sigil === query;
    });
  }, [query, t]);

  // 输入变化时重置选中项(不用 effect,直接在 onChange 里处理)
  const onQueryChange = (v: string) => {
    setQuery(v);
    setActiveIdx(0);
  };

  const flatFiltered = filtered; // 扁平化索引用

  function add(type: NodeType) {
    addNode(type);
    onClose();
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') { onClose(); return; }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, flatFiltered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const item = flatFiltered[activeIdx];
      if (item) add(item.type);
    }
  }

  // 按 group 分组渲染,但保持 flatFiltered 的全局索引
  let runningIdx = -1;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-start justify-center pt-[15vh]"
      style={{ background: 'rgba(10,14,20,0.6)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-lg border shadow-2xl"
        style={{ borderColor: 'var(--c-line)', background: 'var(--c-ink)', animation: 'fade-up 0.15s ease-out' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 搜索框 */}
        <div className="flex items-center gap-2 border-b px-4 py-3" style={{ borderColor: 'var(--c-edge)' }}>
          <span className="font-mono text-sm" style={{ color: 'var(--c-amber)' }}>＋</span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={t('palette.placeholder')}
            className="flex-1 bg-transparent font-[family-name:var(--font-display)] text-[14px] focus:outline-none"
            style={{ color: 'var(--c-text)' }}
          />
          <kbd
            className="rounded border px-1.5 py-0.5 font-mono text-[9px]"
            style={{ borderColor: 'var(--c-line)', color: 'var(--c-text-faint)' }}
          >
            ESC
          </kbd>
        </div>

        {/* 结果列表 */}
        <div className="max-h-[50vh] overflow-y-auto p-2">
          {flatFiltered.length === 0 ? (
            <div className="py-8 text-center">
              <span className="font-mono text-[11px]" style={{ color: 'var(--c-text-ghost)' }}>
                {t('palette.empty')}
              </span>
            </div>
          ) : (
            GROUP_ORDER.map((group) => {
              const groupItems = flatFiltered.filter((i) => i.group === group);
              if (groupItems.length === 0) return null;
              return (
                <div key={group} className="mb-1">
                  <div className="px-2 py-1 font-mono text-[8px] tracking-[0.2em]" style={{ color: 'var(--c-text-faint)' }}>
                    {t(GROUP_LABEL_KEY[group])}
                  </div>
                  {groupItems.map((item) => {
                    runningIdx++;
                    const idx = runningIdx;
                    const isActive = idx === activeIdx;
                    return (
                      <button
                        key={item.type}
                        onClick={() => add(item.type)}
                        onMouseEnter={() => setActiveIdx(idx)}
                        className="flex w-full items-center gap-3 rounded px-2 py-2 text-left transition-colors"
                        style={{
                          background: isActive ? 'color-mix(in srgb, var(--c-amber) 12%, transparent)' : 'transparent',
                          borderLeft: `2px solid ${isActive ? 'var(--c-amber)' : 'transparent'}`,
                        }}
                      >
                        <span
                          className="w-5 text-center font-mono text-[13px]"
                          style={{ color: isActive ? 'var(--c-amber)' : 'var(--c-text-dim)' }}
                        >
                          {item.sigil}
                        </span>
                        <span
                          className="font-[family-name:var(--font-display)] text-[13px]"
                          style={{ color: isActive ? 'var(--c-text)' : 'var(--c-text-dim)' }}
                        >
                          {t(`node.${item.type}`)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>

        {/* 底部提示 */}
        <div className="border-t px-4 py-2 font-mono text-[9px] tracking-wider" style={{ borderColor: 'var(--c-edge)', color: 'var(--c-text-ghost)' }}>
          {t('palette.hint')}
        </div>
      </div>
    </div>
  );
}
