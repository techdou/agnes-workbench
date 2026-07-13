'use client';

// NodeMentionInput —— 带 @提及的 textarea
// 输入 @ 时弹出已连线的上游节点列表,选中后插入 {@节点id} 标记
// 上游节点通过 store 的 edges 查询,只显示当前节点的 source
import { useState, useRef, useCallback, useMemo } from 'react';
import { useFlowStore } from '@/lib/store';
import { useTranslation } from '@/lib/i18n';
import { NODE_SIGIL } from '@/lib/node-metadata';

interface NodeMentionInputProps {
  nodeId: string;          // 当前节点 id(用于查上游)
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
  allowImageRef?: boolean; // 是否允许 @图片引用(默认 true;textToVideo 传 false)
}

export function NodeMentionInput({ nodeId, value, onChange, placeholder, rows = 3, allowImageRef = true }: NodeMentionInputProps) {
  const t = useTranslation();
  const nodes = useFlowStore((s) => s.nodes);
  const edges = useFlowStore((s) => s.edges);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionStart, setMentionStart] = useState(-1);
  const [activeIdx, setActiveIdx] = useState(0);

  // 查上游节点(已连线到当前节点的 source 节点),且有图片输出的
  const upstreamNodes = useMemo(() => {
    const upstreamIds = edges.filter((e) => e.target === nodeId).map((e) => e.source);
    return nodes.filter((n) => {
      if (!upstreamIds.includes(n.id)) return false;
      const d = n.data as { resultUrl?: string; imageUrl?: string; cachedUrl?: string };
      // 只显示有图片输出的节点
      return !!(d.resultUrl || d.imageUrl || d.cachedUrl);
    });
  }, [nodes, edges, nodeId]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!mentionOpen) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, upstreamNodes.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && upstreamNodes[activeIdx]) {
      e.preventDefault();
      insertMention(upstreamNodes[activeIdx].id);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setMentionOpen(false);
    }
  }, [mentionOpen, upstreamNodes, activeIdx]);

  // 插入 {@节点id} 到光标位置
  function insertMention(sourceId: string) {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const cursor = textarea.selectionStart;
    const before = value.slice(0, mentionStart);
    const after = value.slice(cursor);
    const insertion = `{@${sourceId}}`;
    const newValue = before + insertion + after;
    onChange(newValue);
    setMentionOpen(false);
    // 光标移到插入内容后面
    requestAnimationFrame(() => {
      textarea.focus();
      const newPos = before.length + insertion.length;
      textarea.setSelectionRange(newPos, newPos);
    });
  }

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const newValue = e.target.value;
    onChange(newValue);
    // 如果不允许 @图片引用(textToVideo),跳过 mention 逻辑
    if (!allowImageRef) return;
    const textarea = e.target;
    const cursor = textarea.selectionStart;
    // 检测 @ 触发:光标前最近的 @,且 @ 后没有空格或换行
    const beforeCursor = newValue.slice(0, cursor);
    const lastAt = beforeCursor.lastIndexOf('@');
    if (lastAt !== -1) {
      const textAfterAt = beforeCursor.slice(lastAt + 1);
      // @ 后只允许字母数字下划线(节点 id 格式),且不为空时过滤
      if (textAfterAt.length <= 20 && /^[\w]*$/.test(textAfterAt)) {
        setMentionStart(lastAt);
        setMentionOpen(true);
        setActiveIdx(0);
        return;
      }
    }
    setMentionOpen(false);
  }

  // 过滤上游节点(基于 @ 后输入的文字,不读 ref 避免并发渲染问题)
  const filteredUpstream = useMemo(() => {
    if (!mentionOpen) return [];
    // handleChange 每次输入后,@ 后的文字就是 mentionStart+1 到 value 末尾
    const textAfterAt = value.slice(mentionStart + 1);
    if (!textAfterAt) return upstreamNodes;
    const q = textAfterAt.toLowerCase();
    return upstreamNodes.filter((n) => {
      const typeName = t(`node.${n.type}`).toLowerCase();
      return n.type?.toLowerCase().includes(q) ||
             typeName.includes(q) ||
             n.id.includes(textAfterAt);
    });
  }, [mentionOpen, mentionStart, value, upstreamNodes, t]);

  return (
    <div className="relative">
      {allowImageRef && upstreamNodes.length > 0 && (
        <p className="mb-1 font-mono text-[8px] tracking-wider" style={{ color: 'var(--c-text-ghost)' }}>
          {t('node.mentionHint')}
        </p>
      )}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={() => setTimeout(() => setMentionOpen(false), 150)}
        placeholder={placeholder}
        rows={rows}
        className="w-full resize-none rounded border px-2.5 py-1.5 font-[family-name:var(--font-display)] text-[13px] leading-relaxed transition-colors focus:outline-none"
        style={{ borderColor: 'var(--c-line)', background: 'var(--c-void)', color: 'var(--c-text)' }}
      />

      {/* @提及弹出列表 */}
      {mentionOpen && filteredUpstream.length > 0 && (
        <div
          className="absolute z-50 mt-1 max-h-48 w-full overflow-y-auto rounded border py-1 shadow-xl"
          style={{ borderColor: 'var(--c-line)', background: 'var(--c-panel)' }}
        >
          {filteredUpstream.map((n, idx) => {
            const d = n.data as { resultUrl?: string; imageUrl?: string; cachedUrl?: string };
            const thumb = d.resultUrl || d.imageUrl || d.cachedUrl;
            const sigil = NODE_SIGIL[n.type || ''] || '◇';
            return (
              <button
                key={n.id}
                onMouseDown={(e) => { e.preventDefault(); insertMention(n.id); }}
                onMouseEnter={() => setActiveIdx(idx)}
                className="flex w-full items-center gap-2 px-2 py-1.5 text-left transition-colors"
                style={{
                  background: idx === activeIdx ? 'color-mix(in srgb, var(--c-phosphor) 12%, transparent)' : 'transparent',
                }}
              >
                {/* 缩略图 */}
                {thumb && (
                  <img src={thumb} alt="" className="h-6 w-6 shrink-0 rounded object-cover" />
                )}
                <span className="font-mono text-[12px]" style={{ color: 'var(--c-amber)' }}>{sigil}</span>
                <span className="font-mono text-[11px]" style={{ color: 'var(--c-text-dim)' }}>
                  {t(`node.${n.type}`)}
                </span>
                <span className="font-mono text-[9px]" style={{ color: 'var(--c-text-ghost)' }}>
                  #{n.id.slice(-4)}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
