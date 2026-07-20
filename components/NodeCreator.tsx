'use client';

// NodeCreator —— 从连接点拖到空白处松开时弹出
// 只显示与 source 节点兼容的 target 类型(基于 ALLOWED_CONNECTIONS 反推)
// 选中后:在松开位置创建节点 + 自动连线
import { useState, useEffect, useRef, useMemo } from 'react';
import { useFlowStore, getRecommendedTargets } from '@/lib/store';
import { useTranslation } from '@/lib/i18n';
import { NODE_METADATA, NODE_GROUP_ORDER, NODE_GROUP_LABEL_KEY } from '@/lib/node-metadata';

interface NodeCreatorProps {
  sourceType: string;
  sourceId: string;
  screenPos: { x: number; y: number }; // 弹窗定位(屏幕坐标)
  flowPos: { x: number; y: number };   // 新节点位置(画布坐标)
  onClose: () => void;
}

export function NodeCreator({ sourceType, sourceId, screenPos, flowPos, onClose }: NodeCreatorProps) {
  const t = useTranslation();
  const addNodeConnected = useFlowStore((s) => s.addNodeConnected);
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // 只显示兼容的节点类型
  const compatibleTypes = useMemo(() => {
    const recommended = getRecommendedTargets(sourceType);
    return recommended.length > 0 ? recommended : NODE_METADATA.map((i) => i.type);
  }, [sourceType]);

  // 过滤后的节点列表(只含兼容类型 + 搜索匹配)
  const filtered = useMemo(() => {
    const items = NODE_METADATA.filter((i) => compatibleTypes.includes(i.type));
    if (!query.trim()) return items;
    const q = query.toLowerCase();
    return items.filter((i) => {
      const name = t(i.labelKey).toLowerCase();
      return name.includes(q) || i.type.toLowerCase().includes(q) || i.sigil === query;
    });
  }, [compatibleTypes, query, t]);

  const onQueryChange = (v: string) => {
    setQuery(v);
    setActiveIdx(0);
  };

  function create(type: string) {
    addNodeConnected(type, flowPos, sourceId);
    onClose();
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') { onClose(); return; }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const item = filtered[activeIdx];
      if (item) create(item.type);
    }
  }

  let runningIdx = -1;

  return (
    <>
      {/* 背景遮罩:点外面关闭 */}
      <div className="fixed inset-0 z-[95]" onClick={onClose} />

      {/* 弹出面板:桌面用鼠标松开位置,窄屏强制居中避免贴边 */}
      <div
        className="fixed z-[96] w-[92vw] max-w-[280px] overflow-hidden rounded-lg border shadow-2xl sm:w-64"
        style={{
          left: typeof window !== 'undefined' && window.innerWidth < 640
            ? `${(window.innerWidth - Math.min(window.innerWidth - 24, 280)) / 2}px`
            : Math.min(screenPos.x, window.innerWidth - 280),
          top: typeof window !== 'undefined' && window.innerHeight < 640
            ? `${Math.max(80, window.innerHeight / 4)}px`
            : Math.min(screenPos.y, window.innerHeight - 340),
          borderColor: 'var(--c-line)',
          background: 'var(--c-ink)',
          animation: 'fade-up 0.12s ease-out',
        }}
      >
        {/* 标题栏 */}
        <div className="flex items-center gap-2 border-b px-3 py-2" style={{ borderColor: 'var(--c-edge)' }}>
          <span className="font-mono text-xs" style={{ color: 'var(--c-phosphor)' }}>＋</span>
          <span className="font-mono text-[10px] tracking-wider" style={{ color: 'var(--c-text-faint)' }}>
            {t('creator.title')}
          </span>
        </div>

        {/* 搜索框 */}
        <div className="flex items-center gap-2 border-b px-3 py-2" style={{ borderColor: 'var(--c-edge)' }}>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={t('creator.placeholder')}
            className="flex-1 bg-transparent font-[family-name:var(--font-display)] text-[13px] focus:outline-none"
            style={{ color: 'var(--c-text)' }}
          />
        </div>

        {/* 结果列表 */}
        <div className="max-h-[280px] overflow-y-auto p-1.5">
          {filtered.length === 0 ? (
            <div className="py-6 text-center">
              <span className="font-mono text-[11px]" style={{ color: 'var(--c-text-ghost)' }}>
                {t('creator.empty')}
              </span>
            </div>
          ) : (
            NODE_GROUP_ORDER.map((group) => {
              const groupItems = filtered.filter((i) => i.group === group);
              if (groupItems.length === 0) return null;
              return (
                <div key={group} className="mb-1">
                  <div className="px-2 py-1 font-mono text-[8px] tracking-[0.2em]" style={{ color: 'var(--c-text-faint)' }}>
                    {t(NODE_GROUP_LABEL_KEY[group])}
                  </div>
                  {groupItems.map((item) => {
                    runningIdx++;
                    const idx = runningIdx;
                    const isActive = idx === activeIdx;
                    return (
                      <button
                        key={item.type}
                        onClick={() => create(item.type)}
                        onMouseEnter={() => setActiveIdx(idx)}
                        className="flex w-full items-center gap-2.5 rounded px-2 py-2 text-left transition-colors sm:py-1.5"
                        style={{
                          background: isActive ? 'color-mix(in srgb, var(--c-phosphor) 12%, transparent)' : 'transparent',
                          borderLeft: `2px solid ${isActive ? 'var(--c-phosphor)' : 'transparent'}`,
                        }}
                      >
                        <span
                          className="w-4 text-center font-mono text-[13px]"
                          style={{ color: isActive ? 'var(--c-phosphor)' : 'var(--c-text-dim)' }}
                        >
                          {item.sigil}
                        </span>
                        <span
                          className="font-[family-name:var(--font-display)] text-[12px]"
                          style={{ color: isActive ? 'var(--c-text)' : 'var(--c-text-dim)' }}
                        >
                          {t(item.labelKey)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}
