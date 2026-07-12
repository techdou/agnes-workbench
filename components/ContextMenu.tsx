'use client';

// 右键菜单 —— 节点上右键 / 空白处右键
// 节点菜单:运行 / 复制 / 断开连线 / 删除
// 空白菜单:在此添加节点(打开 Command Palette)
import { useEffect, useRef } from 'react';
import { useFlowStore } from '@/lib/store';
import { useTranslation } from '@/lib/i18n';

export interface ContextMenuState {
  x: number;
  y: number;
  // 节点菜单
  nodeId?: string;
  // 空白菜单:用这个坐标打开 Command Palette
  panePos?: { x: number; y: number };
}

interface ContextMenuProps {
  state: ContextMenuState;
  onClose: () => void;
  onAddNodeAt?: (pos: { x: number; y: number }) => void;
}

export function ContextMenu({ state, onClose, onAddNodeAt }: ContextMenuProps) {
  const t = useTranslation();
  const runNode = useFlowStore((s) => s.runNode);
  const duplicateNodes = useFlowStore((s) => s.duplicateNodes);
  const deleteNodes = useFlowStore((s) => s.deleteNodes);
  const nodes = useFlowStore((s) => s.nodes);
  const edges = useFlowStore((s) => s.edges);
  const onNodesChange = useFlowStore((s) => s.onNodesChange);
  const ref = useRef<HTMLDivElement>(null);

  // 点外面关闭
  useEffect(() => {
    const onDocClick = () => onClose();
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    setTimeout(() => {
      document.addEventListener('click', onDocClick);
      document.addEventListener('contextmenu', onDocClick);
    }, 0);
    window.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('click', onDocClick);
      document.removeEventListener('contextmenu', onDocClick);
      window.removeEventListener('keydown', onEsc);
    };
  }, [onClose]);

  // 边界检测:菜单不超出视口
  const left = Math.min(state.x, window.innerWidth - 180);
  const top = Math.min(state.y, window.innerHeight - 240);

  // ---------- 节点菜单 ----------
  if (state.nodeId) {
    const node = nodes.find((n) => n.id === state.nodeId);
    if (!node) { onClose(); return null; }
    const isConnected = edges.some((e) => e.source === state.nodeId || e.target === state.nodeId);

    const handleRun = () => { runNode(state.nodeId!); onClose(); };
    const handleDuplicate = () => { duplicateNodes([state.nodeId!]); onClose(); };
    const handleDisconnect = () => {
      // 删除该节点所有连线
      const remainingEdges = edges.filter((e) => e.source !== state.nodeId && e.target !== state.nodeId);
      useFlowStore.setState({ edges: remainingEdges });
      onClose();
    };
    const handleDelete = () => { deleteNodes([state.nodeId!]); onClose(); };

    return (
      <div
        ref={ref}
        className="fixed z-[80] w-44 overflow-hidden rounded-md border py-1 shadow-xl"
        style={{ left, top, borderColor: 'var(--c-line)', background: 'var(--c-panel)', animation: 'fade-up 0.1s ease-out' }}
      >
        <MenuItem icon="▶" label={t('context.run')} onClick={handleRun} />
        <MenuItem icon="⧉" label={t('context.duplicate')} onClick={handleDuplicate} />
        <MenuItem
          icon="✂"
          label={t('context.disconnect')}
          onClick={handleDisconnect}
          disabled={!isConnected}
        />
        <div className="my-1 border-t" style={{ borderColor: 'var(--c-edge)' }} />
        <MenuItem icon="✕" label={t('common.delete')} onClick={handleDelete} danger />
      </div>
    );
  }

  // ---------- 空白菜单 ----------
  const handleAddHere = () => {
    if (state.panePos && onAddNodeAt) onAddNodeAt(state.panePos);
    onClose();
  };

  return (
    <div
      ref={ref}
      className="fixed z-[80] w-44 overflow-hidden rounded-md border py-1 shadow-xl"
      style={{ left, top, borderColor: 'var(--c-line)', background: 'var(--c-panel)', animation: 'fade-up 0.1s ease-out' }}
    >
      <MenuItem icon="＋" label={t('context.addHere')} onClick={handleAddHere} />
    </div>
  );
}

function MenuItem({
  icon,
  label,
  onClick,
  disabled,
  danger,
}: {
  icon: string;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); if (!disabled) onClick(); }}
      disabled={disabled}
      className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left font-mono text-[11px] transition-colors hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-30"
      style={{ color: danger ? 'var(--c-rust)' : 'var(--c-text-dim)' }}
    >
      <span className="w-4 text-center">{icon}</span>
      {label}
    </button>
  );
}
