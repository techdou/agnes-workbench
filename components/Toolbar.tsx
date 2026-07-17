'use client';

// 画布页工具栏 —— 单行精简版
// 左:返回 + 项目名(可编辑) | 中:RUN ALL | 右:添加节点(+) + 导出 + 设置 + 清空
import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useFlowStore } from '@/lib/store';
import { useTranslation } from '@/lib/i18n';
import { useToast } from '@/lib/useToast';
import { exportWorkflow } from '@/lib/workflow-io';
import { UserMenu } from '@/components/UserMenu';

interface ToolbarProps {
  onOpenPalette: () => void;
  onOpenSettings: () => void;
}

export function Toolbar({ onOpenPalette, onOpenSettings }: ToolbarProps) {
  const t = useTranslation();
  const router = useRouter();
  const pushToast = useToast((s) => s.push);

  const nodes = useFlowStore((s) => s.nodes);
  const runAll = useFlowStore((s) => s.runAll);
  const clearAll = useFlowStore((s) => s.clearAll);
  const currentProjectName = useFlowStore((s) => s.currentProjectName);
  const currentProjectId = useFlowStore((s) => s.currentProjectId);
  const saveStatus = useFlowStore((s) => s.saveStatus);
  const persistCurrentProject = useFlowStore((s) => s.persistCurrentProject);

  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(currentProjectName);
  const nameRef = useRef<HTMLInputElement>(null);

  // 进入编辑模式时:同步当前名 + 聚焦
  const startEditing = () => {
    setNameDraft(currentProjectName);
    setEditingName(true);
    // 下一帧聚焦(state 刚变,DOM 还没更新)
    requestAnimationFrame(() => nameRef.current?.focus());
  };

  // 项目名编辑:通过 store 更新 currentProjectName + 触发保存
  function commitName() {
    const trimmed = nameDraft.trim();
    if (trimmed && trimmed !== currentProjectName) {
      useFlowStore.setState({ currentProjectName: trimmed });
      persistCurrentProject();
    } else {
      setNameDraft(currentProjectName);
    }
    setEditingName(false);
  }

  function handleExport() {
    if (!currentProjectId) return;
    exportWorkflow({ name: currentProjectName, nodes, edges: useFlowStore.getState().edges });
    pushToast(t('toast.workflowExported'), 'success');
  }

  const nodeCount = nodes.length;

  return (
    <header
      className="relative z-10 border-b backdrop-blur-md"
      style={{ borderColor: 'var(--c-edge)', background: 'color-mix(in srgb, var(--c-void) 95%, transparent)' }}
    >
      <div className="flex items-center justify-between gap-2 px-4 py-2 sm:px-5">
        {/* 左:返回 + 项目名 */}
        <div className="flex min-w-0 items-center gap-3">
          <button
            onClick={() => router.push('/')}
            className="rounded border px-2 py-1 font-mono text-[12px] transition-colors"
            style={{ borderColor: 'var(--c-line)', color: 'var(--c-text-dim)' }}
            title={t('toolbar.back')}
          >
            ←
          </button>
          <div className="flex min-w-0 items-center gap-2">
            <span className="font-mono text-sm shrink-0" style={{ color: 'var(--c-amber)' }}>◈</span>
            {editingName ? (
              <input
                ref={nameRef}
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                onBlur={commitName}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitName();
                  if (e.key === 'Escape') { setNameDraft(currentProjectName); setEditingName(false); }
                }}
                className="w-48 rounded border bg-transparent px-1.5 py-0.5 font-[family-name:var(--font-display)] text-[14px] font-semibold focus:outline-none"
                style={{ borderColor: 'var(--c-amber)', color: 'var(--c-text)' }}
              />
            ) : (
              <h1
                className="cursor-pointer truncate font-[family-name:var(--font-display)] text-[15px] font-semibold tracking-wide"
                style={{ color: 'var(--c-text)' }}
                onDoubleClick={startEditing}
                title={currentProjectName}
              >
                {currentProjectName}
              </h1>
            )}
            {/* 保存状态指示 */}
            <span className="font-mono text-[9px] tracking-wider shrink-0" style={{ color: 'var(--c-text-ghost)' }}>
              {saveStatus === 'saving' && <span className="flicker">{t('toolbar.saving')}</span>}
              {saveStatus === 'saved' && <span style={{ color: 'var(--c-phosphor)' }}>● {t('toolbar.saved')}</span>}
            </span>
          </div>
        </div>

        {/* 右:操作按钮 */}
        <div className="flex items-center gap-2">
          <span className="hidden font-mono text-[10px] tracking-wider sm:inline" style={{ color: 'var(--c-text-faint)' }}>
            {nodeCount} <span style={{ color: 'var(--c-text-ghost)' }}>NODES</span>
          </span>

          <button
            onClick={onOpenPalette}
            className="rounded border px-2.5 py-1 font-mono text-[11px] font-semibold tracking-wider transition-colors"
            style={{
              borderColor: 'color-mix(in srgb, var(--c-phosphor) 50%, transparent)',
              background: 'color-mix(in srgb, var(--c-phosphor) 10%, transparent)',
              color: 'var(--c-phosphor)',
            }}
            title={t('palette.hint')}
          >
            ＋ {t('toolbar.addNode')}
          </button>

          <button
            onClick={() => runAll()}
            disabled={nodeCount === 0}
            className="rounded border px-2.5 py-1 font-mono text-[10px] font-semibold tracking-wider transition-colors disabled:opacity-30"
            style={{
              borderColor: 'color-mix(in srgb, var(--c-amber) 50%, transparent)',
              background: 'color-mix(in srgb, var(--c-amber) 12%, transparent)',
              color: 'var(--c-amber)',
            }}
            title={t('toolbar.runAll')}
          >
            ▶▶ {t('toolbar.runAll')}
          </button>

          <button
            onClick={handleExport}
            disabled={nodeCount === 0}
            className="rounded border px-2.5 py-1 font-mono text-[10px] tracking-wider transition-colors disabled:opacity-30"
            style={{ borderColor: 'var(--c-line)', color: 'var(--c-text-dim)' }}
            title={t('toolbar.export')}
          >
            ↓
          </button>

          <button
            onClick={onOpenSettings}
            className="rounded border px-2.5 py-1 font-mono text-[11px] transition-colors"
            style={{ borderColor: 'var(--c-line)', color: 'var(--c-text-dim)' }}
            title={t('dashboard.settings')}
          >
            ⚙
          </button>

          <button
            onClick={() => { if (confirm(t('toolbar.clearConfirm'))) clearAll(); }}
            className="rounded border px-2.5 py-1 font-mono text-[10px] tracking-wider transition-colors"
            style={{ borderColor: 'color-mix(in srgb, var(--c-rust) 30%, transparent)', color: 'var(--c-rust)' }}
          >
            {t('toolbar.clear')}
          </button>

          <UserMenu onOpenSettings={onOpenSettings} />
        </div>
      </div>
    </header>
  );
}
