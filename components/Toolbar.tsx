'use client';

import { useEffect, useState } from 'react';
import { useFlowStore } from '@/lib/store';
import { useTheme } from '@/lib/useTheme';
import { useToast } from '@/lib/useToast';

interface NodeTypeSpec {
  type: string;
  label: string;
  sigil: string;
  accent: 'amber' | 'phosphor' | 'fog';
}

const NODE_GROUPS: { title: string; items: NodeTypeSpec[] }[] = [
  {
    title: 'INPUT',
    items: [{ type: 'text', label: '文本', sigil: 'Τ', accent: 'fog' }],
  },
  {
    title: 'IMAGE',
    items: [
      { type: 'textToImage', label: '文生图', sigil: 'ℑ', accent: 'phosphor' },
      { type: 'imageToImage', label: '图生图', sigil: 'ℜ', accent: 'phosphor' },
    ],
  },
  {
    title: 'VIDEO',
    items: [
      { type: 'textToVideo', label: '文生视频', sigil: 'Ϝ', accent: 'amber' },
      { type: 'imageToVideo', label: '图生视频', sigil: 'δ', accent: 'amber' },
      { type: 'multiImageVideo', label: '多图视频', sigil: 'Σ', accent: 'amber' },
      { type: 'keyframe', label: '关键帧', sigil: 'Φ', accent: 'amber' },
    ],
  },
  {
    title: 'OUTPUT',
    items: [
      { type: 'imagePreview', label: '图预览', sigil: '▣', accent: 'phosphor' },
      { type: 'videoPreview', label: '视频预览', sigil: '▶', accent: 'amber' },
    ],
  },
];

const ACCENT_VAR = {
  amber: 'var(--c-amber)',
  phosphor: 'var(--c-phosphor)',
  fog: 'var(--c-text-dim)',
};

export function Toolbar() {
  const addNode = useFlowStore((s) => s.addNode);
  const clearAll = useFlowStore((s) => s.clearAll);
  const nodeCount = useFlowStore((s) => s.nodes.length);
  const saveWorkflow = useFlowStore((s) => s.saveWorkflow);
  const loadWorkflow = useFlowStore((s) => s.loadWorkflow);
  const runAll = useFlowStore((s) => s.runAll);
  const { theme, toggle, mounted } = useTheme();
  const pushToast = useToast((s) => s.push);
  const [hasSaved, setHasSaved] = useState(false);

  useEffect(() => {
    setHasSaved(useFlowStore.getState().hasSavedWorkflow());
  }, []);

  return (
    <header
      className="relative z-10 border-b backdrop-blur-md"
      style={{ borderColor: 'var(--c-edge)', background: 'color-mix(in srgb, var(--c-void) 95%, transparent)' }}
    >
      {/* 顶栏 */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 sm:px-5 sm:py-2.5">
        <div className="flex items-center gap-3">
          <div
            className="flex h-7 w-7 items-center justify-center rounded border"
            style={{ borderColor: 'color-mix(in srgb, var(--c-amber) 40%, transparent)', background: 'color-mix(in srgb, var(--c-amber) 10%, transparent)' }}
          >
            <span className="font-mono text-sm flicker" style={{ color: 'var(--c-amber)' }}>◈</span>
          </div>
          <div>
            <h1 className="font-[family-name:var(--font-display)] text-[15px] font-semibold leading-none tracking-wide" style={{ color: 'var(--c-text)' }}>
              Phosphor Studio
            </h1>
            <p className="mt-0.5 hidden font-mono text-[9px] tracking-[0.2em] sm:block" style={{ color: 'var(--c-text-faint)' }}>
              AGNES CREATION WORKBENCH
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* [H9] RUN ALL:运行整个画布(拓扑序) */}
          <button
            onClick={() => runAll()}
            disabled={nodeCount === 0}
            className="rounded border px-2.5 py-1 font-mono text-[10px] font-semibold tracking-wider transition-colors disabled:opacity-30"
            style={{
              borderColor: 'color-mix(in srgb, var(--c-amber) 50%, transparent)',
              background: 'color-mix(in srgb, var(--c-amber) 12%, transparent)',
              color: 'var(--c-amber)',
            }}
            title="运行所有节点(Ctrl+Enter 运行选中)"
          >
            ▶▶ RUN ALL
          </button>
          {/* 工作流保存 */}
          <button
            onClick={() => {
              const at = saveWorkflow();
              setHasSaved(true);
              pushToast(`工作流已保存 (${new Date(at).toLocaleTimeString('zh-CN')})`, 'success');
            }}
            className="rounded border px-2.5 py-1 font-mono text-[10px] tracking-wider transition-colors"
            style={{ borderColor: 'var(--c-line)', color: 'var(--c-text-dim)' }}
            title="保存当前画布到浏览器"
          >
            ⬇ SAVE
          </button>
          {hasSaved && (
            <button
              onClick={() => {
                const at = loadWorkflow();
                if (at) pushToast(`已加载工作流 (${new Date(at).toLocaleTimeString('zh-CN')})`, 'success');
                else pushToast('没有已保存的工作流', 'error');
              }}
              className="rounded border px-2.5 py-1 font-mono text-[10px] tracking-wider transition-colors"
              style={{ borderColor: 'var(--c-line)', color: 'var(--c-text-dim)' }}
              title="加载上次保存的画布"
            >
              ↺ LOAD
            </button>
          )}

          <span className="hidden font-mono text-[10px] tracking-wider sm:inline" style={{ color: 'var(--c-text-faint)' }}>
            {nodeCount} <span style={{ color: 'var(--c-text-ghost)' }}>NODES</span>
          </span>

          {/* 主题切换 */}
          {mounted && (
            <button
              onClick={toggle}
              className="rounded border px-2.5 py-1 font-mono text-[10px] tracking-wider transition-colors"
              style={{ borderColor: 'var(--c-line)', color: 'var(--c-text-dim)' }}
              title="切换亮/暗主题"
            >
              {theme === 'dark' ? '☀ LIGHT' : '◐ DARK'}
            </button>
          )}

          <button
            onClick={() => { if (confirm('清空整个画布?')) clearAll(); }}
            className="rounded border px-2.5 py-1 font-mono text-[10px] tracking-wider transition-colors"
            style={{ borderColor: 'color-mix(in srgb, var(--c-rust) 30%, transparent)', color: 'var(--c-rust)' }}
          >
            CLEAR
          </button>
        </div>
      </div>

      {/* 节点添加栏:按组分类,横向滚动 */}
      <div className="flex items-center gap-2 overflow-x-auto border-t px-4 py-1.5 sm:px-5" style={{ borderColor: 'var(--c-edge)' }}>
        {NODE_GROUPS.map((group) => (
          <div
            key={group.title}
            className="flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5"
            style={{ background: 'color-mix(in srgb, var(--c-void) 60%, transparent)' }}
          >
            <span
              className="mr-0.5 border-r pr-1.5 font-mono text-[8px] tracking-[0.2em]"
              style={{ borderColor: 'var(--c-line)', color: 'var(--c-text-faint)' }}
            >
              {group.title}
            </span>
            {group.items.map((n) => (
              <button
                key={n.type}
                onClick={() => addNode(n.type)}
                className="group flex shrink-0 items-center gap-1 rounded border px-2 py-1 transition-all hover:border-[color:var(--c-amber)]"
                style={{ borderColor: 'var(--c-line)', background: 'var(--c-ink)' }}
              >
                <span className="font-mono text-[11px] leading-none" style={{ color: ACCENT_VAR[n.accent] }}>
                  {n.sigil}
                </span>
                <span className="font-[family-name:var(--font-display)] text-[11px]" style={{ color: 'var(--c-text)' }}>
                  {n.label}
                </span>
              </button>
            ))}
          </div>
        ))}
      </div>
    </header>
  );
}
