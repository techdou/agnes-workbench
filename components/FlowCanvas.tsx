'use client';

// 画布主组件 —— React Flow + 工具栏 + 归档面板 + Command Palette + 批量操作
import { useCallback, useEffect, useState, useRef } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  BaseEdge,
  getBezierPath,
  useReactFlow,
  type NodeTypes,
  type EdgeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { useFlowStore } from '@/lib/store';
import { NODE_ACCENT } from '@/lib/node-metadata';
import { useSettings } from '@/lib/settings';
import { useTranslation } from '@/lib/i18n';
import { useToast } from '@/lib/useToast';
import { Toolbar } from './Toolbar';
import { LibraryPanel } from './LibraryPanel';
import { ToastContainer } from './ToastContainer';
import { CommandPalette } from './CommandPalette';
import { NodeCreator } from './NodeCreator';
import { ContextMenu, type ContextMenuState } from './ContextMenu';
import { ShortcutsModal } from './ShortcutsModal';
import { SettingsModal } from './SettingsModal';

import { TextNode } from './nodes/TextNode';
import { ImageInputNode } from './nodes/ImageInputNode';
import { TextToImageNode } from './nodes/TextToImageNode';
import { ImageToImageNode } from './nodes/ImageToImageNode';
import { TextToVideoNode } from './nodes/TextToVideoNode';
import { ImageToVideoNode } from './nodes/ImageToVideoNode';
import { MultiImageVideoNode } from './nodes/MultiImageVideoNode';
import { KeyframeNode } from './nodes/KeyframeNode';
import { ImagePreviewNode, VideoPreviewNode } from './nodes/PreviewNodes';

const nodeTypes: NodeTypes = {
  text: TextNode,
  imageInput: ImageInputNode,
  textToImage: TextToImageNode,
  imageToImage: ImageToImageNode,
  textToVideo: TextToVideoNode,
  imageToVideo: ImageToVideoNode,
  multiImageVideo: MultiImageVideoNode,
  keyframe: KeyframeNode,
  imagePreview: ImagePreviewNode,
  videoPreview: VideoPreviewNode,
};

// MiniMap 节点颜色映射(从统一元数据生成)
const ACCENT_COLOR: Record<string, string> = {
  amber: 'var(--c-amber)',
  phosphor: 'var(--c-phosphor)',
  fog: 'var(--c-text-dim)',
  rust: 'var(--c-rust)',
};

// 自定义 edge:中间显示一个 ✕ 按钮,点击删除连线
function DeletableEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  style,
}: EdgeProps) {
  const deleteEdge = useFlowStore((s) => s.deleteEdge);
  const [path] = getBezierPath({ sourceX, sourceY, targetX, targetY });
  const midX = (sourceX + targetX) / 2;
  const midY = (sourceY + targetY) / 2;

  return (
    <>
      <BaseEdge id={id} path={path} style={style} />
      <foreignObject x={midX - 14} y={midY - 14} width={28} height={28} className="nodrag nopan">
        <button
          onClick={() => deleteEdge(id as string)}
          className="flex h-5 w-5 items-center justify-center rounded-full border text-[10px] font-bold leading-none transition-transform hover:scale-125"
          style={{
            margin: '4px',
            borderColor: 'var(--c-rust)',
            background: 'var(--c-void)',
            color: 'var(--c-rust)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.4), 0 0 0 2px color-mix(in srgb, var(--c-rust) 20%, transparent)',
          }}
          title="删除此连线"
        >
          ✕
        </button>
      </foreignObject>
    </>
  );
}

const edgeTypes = { default: DeletableEdge };

export function FlowCanvas() {
  return (
    <ReactFlowProvider>
      <FlowCanvasInner />
    </ReactFlowProvider>
  );
}

function FlowCanvasInner() {
  const t = useTranslation();
  const { screenToFlowPosition } = useReactFlow();
  const nodes = useFlowStore((s) => s.nodes);
  const edges = useFlowStore((s) => s.edges);
  const onNodesChange = useFlowStore((s) => s.onNodesChange);
  const onEdgesChange = useFlowStore((s) => s.onEdgesChange);
  const onConnect = useFlowStore((s) => s.onConnect);
  const deleteNodes = useFlowStore((s) => s.deleteNodes);
  const duplicateNodes = useFlowStore((s) => s.duplicateNodes);
  const runNode = useFlowStore((s) => s.runNode);
  const undo = useFlowStore((s) => s.undo);
  const redo = useFlowStore((s) => s.redo);
  const loadSettings = useSettings((s) => s.load);
  const pushToast = useToast((s) => s.push);

  const [paletteOpen, setPaletteOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  // 移动端多选模式:开启后点击节点 toggle 选中(替代桌面 Shift+Click)
  const [multiSelectMode, setMultiSelectMode] = useState(false);

  // 触屏设备检测:仅在客户端渲染后判断一次(SSR 时为 false)
  // 同时支持 hover + 精确指针的设备视为桌面(不显示移动专属 UI)
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const finePointer = window.matchMedia('(pointer: fine)').matches;
    const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsTouchDevice(coarsePointer && !finePointer);
  }, []);

  // NodeCreator 状态:拖连线到空白处松开时弹出
  const [creator, setCreator] = useState<{
    sourceType: string;
    sourceId: string;
    screenPos: { x: number; y: number };  // 弹窗定位(屏幕坐标)
    flowPos: { x: number; y: number };    // 新节点位置(画布坐标)
  } | null>(null);

  // 跟踪正在拖的连线起点(onConnectStart 记录,onConnectEnd 判断是否连到空白)
  const connectingSource = useRef<{ nodeId: string; handleType: string } | null>(null);

  // 首次加载设置(i18n 需要 settings.language)
  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // 选中的节点(用于批量操作浮动条)
  const selectedNodes = nodes.filter((n) => n.selected);
  const selectedCount = selectedNodes.length;
  const selectedIds = selectedNodes.map((n) => n.id);

  // [H9] Delete 删除 + Ctrl/Cmd+Enter 运行选中节点 + / 唤起 Command Palette
  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // 如果焦点在输入框/palette/settings 里,不拦截
      const tag = (e.target as HTMLElement)?.tagName;
      const inField = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

      // ? 唤起快捷键速查表
      if (e.key === '?' && !inField) {
        e.preventDefault();
        setShortcutsOpen(true);
        return;
      }

      // Ctrl/Cmd + D:复制选中节点
      if ((e.ctrlKey || e.metaKey) && e.key === 'd' && !inField) {
        e.preventDefault();
        const selected = nodes.filter((n) => n.selected);
        if (selected.length > 0) duplicateNodes(selected.map((n) => n.id));
        return;
      }

      // Ctrl/Cmd + Z / Y:撤销/重做
      if ((e.ctrlKey || e.metaKey) && !inField && !e.altKey) {
        if (e.key === 'z' && !e.shiftKey) {
          e.preventDefault();
          useFlowStore.getState().undo();
          return;
        }
        if ((e.key === 'z' && e.shiftKey) || e.key === 'y') {
          e.preventDefault();
          useFlowStore.getState().redo();
          return;
        }
      }

      // / 唤起 Command Palette(不在输入框时)
      if (e.key === '/' && !inField && !paletteOpen) {
        e.preventDefault();
        setPaletteOpen(true);
        return;
      }

      // Ctrl/Cmd + Enter:运行选中节点
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        const selected = nodes.filter((n) => n.selected);
        if (selected.length > 0) {
          selected.forEach((n) => runNode(n.id));
          pushToast(t('toast.runningAll', { count: selected.length }), 'info');
        }
        return;
      }

      // Delete:删除选中节点(不在输入框时)
      if ((e.key === 'Delete' || e.key === 'Backspace') && !inField) {
        const selected = nodes.filter((n) => n.selected);
        if (selected.length > 0) {
          if (selected.length >= 3 && !confirm(t('batch.deleteConfirm', { count: selected.length }))) return;
          deleteNodes(selected.map((n) => n.id));
        }
      }
    },
    [nodes, deleteNodes, duplicateNodes, runNode, pushToast, t, paletteOpen]
  );

  useEffect(() => {
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onKeyDown]);

  // ---------- NodeCreator:拖连线到空白处弹出推荐节点 ----------
  const onConnectStart = useCallback((_: MouseEvent | TouchEvent, params: { nodeId: string | null; handleType: string | null }) => {
    if (params.nodeId && params.handleType === 'source') {
      connectingSource.current = { nodeId: params.nodeId, handleType: params.handleType };
    }
  }, []);

  const onConnectEnd = useCallback(
    (event: MouseEvent | TouchEvent) => {
      // 没有正在拖的连线起点,跳过
      const src = connectingSource.current;
      connectingSource.current = null;
      if (!src) return;

      // 检查松开位置是否在某个节点 handle 上(如果是,说明正常连线了,不弹 creator)
      const clientX = 'touches' in event ? event.changedTouches[0].clientX : event.clientX;
      const clientY = 'touches' in event ? event.changedTouches[0].clientY : event.clientY;
      const target = document.elementFromPoint(clientX, clientY);
      // 如果松在 handle 上或节点内部,让 React Flow 正常处理
      if (target?.closest('.react-flow__handle') || target?.closest('.react-flow__node')) return;

      // 找到 source 节点类型
      const sourceNode = useFlowStore.getState().nodes.find((n) => n.id === src.nodeId);
      if (!sourceNode?.type) return;

      // 鼠标屏幕坐标 → 画布坐标(给新建节点定位)
      const flowPos = screenToFlowPosition({ x: clientX, y: clientY });

      setCreator({
        sourceType: sourceNode.type,
        sourceId: src.nodeId,
        // NodeCreator 弹窗用屏幕坐标定位,新建节点用画布坐标
        screenPos: { x: clientX, y: clientY },
        flowPos,
      });
    },
    [screenToFlowPosition]
  );

  // ---------- 移动端长按交互 ----------
  // 长按节点 350ms = 右键菜单(运行/复制/断开/删除)
  // 长按空白 400ms = 空白右键菜单(添加节点)
  // 手指移动超过 10px 视为拖拽/平移,取消长按
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressStart = useRef<{ x: number; y: number } | null>(null);

  const clearLongPress = useCallback(() => {
    if (longPressTimer.current !== null) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    longPressStart.current = null;
  }, []);

  // 统一在画布外层 div 上监听 touch,通过 target 判断点的是节点还是空白
  const onCanvasTouchStart = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    if (!isTouchDevice || e.touches.length !== 1) return;
    const touch = e.touches[0];
    // 判断是否点在节点上(xyFlow 节点根元素带 .react-flow__node,属性 data-id 是节点 id)
    const nodeEl = (e.target as HTMLElement).closest('.react-flow__node') as HTMLElement | null;
    const nodeId = nodeEl?.getAttribute('data-id') || null;
    longPressStart.current = { x: touch.clientX, y: touch.clientY };
    // 节点长按 350ms,空白长按 400ms(略长,避免误触)
    const delay = nodeId ? 350 : 400;
    longPressTimer.current = setTimeout(() => {
      if (nodeId) {
        setContextMenu({ x: touch.clientX, y: touch.clientY, nodeId });
      } else {
        const flowPos = screenToFlowPosition({ x: touch.clientX, y: touch.clientY });
        setContextMenu({ x: touch.clientX, y: touch.clientY, panePos: flowPos });
      }
      clearLongPress();
    }, delay);
  }, [isTouchDevice, screenToFlowPosition, clearLongPress]);

  const onCanvasTouchMove = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    if (longPressStart.current && e.touches.length === 1) {
      const dx = e.touches[0].clientX - longPressStart.current.x;
      const dy = e.touches[0].clientY - longPressStart.current.y;
      if (Math.hypot(dx, dy) > 10) clearLongPress();
    } else if (e.touches.length > 1) {
      // 双指操作 = 缩放,取消长按
      clearLongPress();
    }
  }, [clearLongPress]);

  // 多选模式下点击节点 toggle 选中(替代桌面 Shift+Click)
  const onNodeClick = useCallback((_: React.MouseEvent, node: { id: string; selected?: boolean }) => {
    if (!multiSelectMode) return;
    // 手动 toggle selected,xyFlow 会同步触发 change
    onNodesChange([{
      type: 'select',
      id: node.id,
      selected: !node.selected,
    }]);
  }, [multiSelectMode, onNodesChange]);

  return (
    <div className="relative flex h-[100dvh] w-screen flex-col overflow-hidden">
      <Toolbar
        onOpenPalette={() => setPaletteOpen(true)}
        onOpenSettings={() => setSettingsOpen(true)}
        isTouchDevice={isTouchDevice}
        multiSelectMode={multiSelectMode}
        onToggleMultiSelect={() => setMultiSelectMode((v) => !v)}
      />

      <div
        className="relative flex-1"
        onTouchStart={onCanvasTouchStart}
        onTouchMove={onCanvasTouchMove}
        onTouchEnd={clearLongPress}
        onTouchCancel={clearLongPress}
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onConnectStart={onConnectStart}
          onConnectEnd={onConnectEnd}
          onNodeClick={onNodeClick}
          onNodeContextMenu={(e, node) => {
            e.preventDefault();
            setContextMenu({ x: e.clientX, y: e.clientY, nodeId: node.id });
          }}
          onPaneContextMenu={(e) => {
            e.preventDefault();
            const flowPos = screenToFlowPosition({ x: e.clientX, y: e.clientY });
            setContextMenu({ x: e.clientX, y: e.clientY, panePos: flowPos });
          }}
          fitView
          defaultEdgeOptions={{
            type: 'default',
            style: { stroke: 'var(--edge-stroke)', strokeWidth: 1.5 },
            animated: true,
          }}
          proOptions={{ hideAttribution: true }}
          deleteKeyCode={null}
          multiSelectionKeyCode={isTouchDevice ? null : ['Meta', 'Control', 'Shift']}
          selectionOnDrag={!isTouchDevice && !multiSelectMode}
          // 移动端触屏:单指拖动 = 平移,双指捏合 = 缩放
          panOnDrag
          zoomOnPinch
          // 关闭双击缩放(手机上容易误触)
          zoomOnDoubleClick={!isTouchDevice}
          onNodeDragStop={(e, node) => {
            // Alt+拖拽 = 复制节点到新位置(原节点留在原地)
            if (e.altKey) {
              duplicateNodes([node.id]);
              // 把原节点位置恢复(React Flow 已移动了它,撤销移动让副本偏移)
              // 简化:直接复制,副本会偏移 40px,原节点保持拖拽后位置——可接受
            }
          }}
        >
          <Background color="var(--c-grid)" gap={28} size={1} />
          <Controls showInteractive={false} className="!shadow-none" />
          <MiniMap
            pannable
            zoomable
            className="!bg-transparent"
            maskColor="color-mix(in srgb, var(--c-void) 55%, transparent)"
            nodeColor={(n) => ACCENT_COLOR[NODE_ACCENT[n.type || '']] || 'var(--c-text-ghost)'}
            nodeStrokeColor="var(--c-text)"
            nodeStrokeWidth={2}
            nodeBorderRadius={2}
          />
        </ReactFlow>

        <LibraryPanel />
        <ToastContainer />

        {/* 移动端底部工具条:撤销/重做(替代 Ctrl+Z/Ctrl+Shift+Z) */}
        {isTouchDevice && (
          <div
            className="fixed bottom-6 left-6 z-30 flex flex-col gap-1.5 rounded-full border p-1 shadow-xl backdrop-blur-md"
            style={{
              borderColor: 'var(--c-line)',
              background: 'color-mix(in srgb, var(--c-ink) 95%, transparent)',
            }}
          >
            <RoundButton onClick={undo} icon="↶" label={t('toolbar.undo')} />
            <RoundButton onClick={redo} icon="↷" label={t('toolbar.redo')} />
          </div>
        )}

        {/* 批量操作浮动条:选中 >=1 节点时显示 */}
        {selectedCount > 0 && (
          <div
            className="fixed bottom-6 left-1/2 z-40 flex max-w-[92vw] -translate-x-1/2 items-center gap-1 overflow-x-auto rounded-full border px-3 py-2 shadow-xl backdrop-blur-md scrollbar-hide sm:gap-2 sm:px-4"
            style={{
              borderColor: 'var(--c-line)',
              background: 'color-mix(in srgb, var(--c-ink) 95%, transparent)',
              animation: 'fade-up 0.2s ease-out',
            }}
          >
            <span className="shrink-0 font-mono text-[10px] tracking-wider" style={{ color: 'var(--c-phosphor)' }}>
              {selectedCount} <span style={{ color: 'var(--c-text-faint)' }}>SEL</span>
            </span>
            <div className="mx-0.5 h-4 w-px shrink-0 sm:mx-1" style={{ background: 'var(--c-line)' }} />
            <BatchButton onClick={() => {
              selectedIds.forEach((id) => runNode(id));
              pushToast(t('toast.runningAll', { count: selectedIds.length }), 'info');
            }} icon="▶" label={t('toolbar.runSelected')} />
            <BatchButton onClick={() => duplicateNodes(selectedIds)} icon="⧉" label={t('batch.duplicate')} />
            <BatchButton
              onClick={() => {
                if (selectedCount >= 3 && !confirm(t('batch.deleteConfirm', { count: selectedCount }))) return;
                deleteNodes(selectedIds);
              }}
              icon="✕"
              label={t('batch.delete')}
              danger
            />
          </div>
        )}

        {/* 空状态 */}
        {nodes.length === 0 && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-4">
            <div className="text-center" style={{ animation: 'fade-up 0.6s ease-out' }}>
              <div className="relative mx-auto mb-5 h-20 w-20">
                <div
                  className="absolute inset-0 rounded-full border opacity-40"
                  style={{ borderColor: 'var(--c-amber)', animation: 'flicker 3s ease-in-out infinite' }}
                />
                <div
                  className="absolute inset-3 rounded-full border opacity-25"
                  style={{ borderColor: 'var(--c-phosphor)' }}
                />
                <div
                  className="absolute inset-0 flex items-center justify-center font-mono text-3xl"
                  style={{ color: 'var(--c-amber)', textShadow: '0 0 12px var(--c-bg-glow-1)' }}
                >
                  ◈
                </div>
              </div>
              <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold sm:text-2xl" style={{ color: 'var(--c-text-dim)' }}>
                {t('canvas.empty.title')}
              </h2>
              <p className="mt-2 font-mono text-[10px] tracking-[0.15em] sm:text-[11px]" style={{ color: 'var(--c-text-dim)' }}>
                {t('canvas.empty.desc')}
              </p>
              <p className="mt-1 text-[11px] sm:text-[12px]" style={{ color: 'var(--c-text-faint)' }}>
                {t('canvas.empty.hint')}
              </p>
            </div>
          </div>
        )}
      </div>

      {paletteOpen && <CommandPalette onClose={() => setPaletteOpen(false)} />}
      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
      {shortcutsOpen && <ShortcutsModal onClose={() => setShortcutsOpen(false)} />}
      {creator && (
        <NodeCreator
          sourceType={creator.sourceType}
          sourceId={creator.sourceId}
          screenPos={creator.screenPos}
          flowPos={creator.flowPos}
          onClose={() => setCreator(null)}
        />
      )}
      {contextMenu && (
        <ContextMenu
          state={contextMenu}
          onClose={() => setContextMenu(null)}
          onAddNodeAt={() => {
            // 空白右键"添加节点":打开 palette
            setPaletteOpen(true);
          }}
        />
      )}
    </div>
  );
}

function BatchButton({ onClick, icon, label, danger }: { onClick: () => void; icon: string; label: string; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      className="touch-target-44 flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[10px] tracking-wider transition-colors hover:bg-white/5 sm:px-3"
      style={{ color: danger ? 'var(--c-rust)' : 'var(--c-text-dim)' }}
    >
      <span>{icon}</span>
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

// 移动端专用:圆形按钮(撤销/重做)
function RoundButton({ onClick, icon, label }: { onClick: () => void; icon: string; label: string }) {
  return (
    <button
      onClick={onClick}
      className="touch-target-44 flex h-9 w-9 items-center justify-center rounded-full font-mono text-sm transition-colors hover:bg-white/5"
      style={{ color: 'var(--c-text-dim)' }}
      aria-label={label}
      title={label}
    >
      {icon}
    </button>
  );
}
