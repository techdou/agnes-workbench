'use client';

import { useCallback, useEffect } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  BaseEdge,
  getBezierPath,
  type NodeTypes,
  type Edge,
  type EdgeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { useFlowStore } from '@/lib/store';
import { useToast } from '@/lib/useToast';
import { Toolbar } from './Toolbar';
import { LibraryPanel } from './LibraryPanel';
import { ToastContainer } from './ToastContainer';

import { TextNode } from './nodes/TextNode';
import { TextToImageNode } from './nodes/TextToImageNode';
import { ImageToImageNode } from './nodes/ImageToImageNode';
import { TextToVideoNode } from './nodes/TextToVideoNode';
import { ImageToVideoNode } from './nodes/ImageToVideoNode';
import { MultiImageVideoNode } from './nodes/MultiImageVideoNode';
import { KeyframeNode } from './nodes/KeyframeNode';
import { ImagePreviewNode, VideoPreviewNode } from './nodes/PreviewNodes';

const nodeTypes: NodeTypes = {
  text: TextNode,
  textToImage: TextToImageNode,
  imageToImage: ImageToImageNode,
  textToVideo: TextToVideoNode,
  imageToVideo: ImageToVideoNode,
  multiImageVideo: MultiImageVideoNode,
  keyframe: KeyframeNode,
  imagePreview: ImagePreviewNode,
  videoPreview: VideoPreviewNode,
};

const NODE_COLOR: Record<string, string> = {
  text: 'var(--c-text-dim)',
  textToImage: 'var(--c-phosphor)',
  imageToImage: 'var(--c-phosphor)',
  textToVideo: 'var(--c-amber)',
  imageToVideo: 'var(--c-amber)',
  multiImageVideo: 'var(--c-amber)',
  keyframe: 'var(--c-amber)',
  imagePreview: 'var(--c-phosphor)',
  videoPreview: 'var(--c-amber)',
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
      {/* [M18] 点击区放大到 28px(视觉按钮仍是 20px,居中) */}
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
  const nodes = useFlowStore((s) => s.nodes);
  const edges = useFlowStore((s) => s.edges);
  const onNodesChange = useFlowStore((s) => s.onNodesChange);
  const onEdgesChange = useFlowStore((s) => s.onEdgesChange);
  const onConnect = useFlowStore((s) => s.onConnect);
  const deleteNode = useFlowStore((s) => s.deleteNode);
  const runNode = useFlowStore((s) => s.runNode);
  const loadWorkflow = useFlowStore((s) => s.loadWorkflow);
  const pushToast = useToast((s) => s.push);

  // 启动时尝试加载已保存的工作流
  useEffect(() => {
    if (useFlowStore.getState().hasSavedWorkflow()) {
      loadWorkflow();
    }
  }, [loadWorkflow]);

  // [H9] Delete 删除 + Ctrl/Cmd+Enter 运行选中节点
  const onKeyUp = useCallback(
    (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const inField = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

      // Ctrl/Cmd + Enter:运行选中节点
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        const selected = nodes.filter((n) => n.selected);
        if (selected.length > 0) {
          selected.forEach((n) => runNode(n.id));
          pushToast(`开始运行 ${selected.length} 个节点`, 'info');
        }
        return;
      }

      // Delete:删除选中节点(不在输入框时)
      if ((e.key === 'Delete' || e.key === 'Backspace') && !inField) {
        const selected = nodes.filter((n) => n.selected);
        if (selected.length > 0) {
          selected.forEach((n) => deleteNode(n.id));
          pushToast(`已删除 ${selected.length} 个节点`, 'info');
        }
      }
    },
    [nodes, deleteNode, runNode, pushToast]
  );

  useEffect(() => {
    window.addEventListener('keyup', onKeyUp);
    return () => window.removeEventListener('keyup', onKeyUp);
  }, [onKeyUp]);

  return (
    <div className="relative flex h-[100dvh] w-screen flex-col overflow-hidden">
      <Toolbar />
      <div className="relative flex-1">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          fitView
          defaultEdgeOptions={{
            type: 'default',
            style: { stroke: 'var(--edge-stroke)', strokeWidth: 1.5 },
            animated: true,
          }}
          proOptions={{ hideAttribution: true }}
          deleteKeyCode={null}
        >
          <Background color="var(--c-grid)" gap={28} size={1} />
          <Controls showInteractive={false} className="!shadow-none" />
          {/* [H6] MiniMap:用琥珀色 mask 提升暗色下可见度 */}
          <MiniMap
            pannable
            zoomable
            className="!bg-transparent"
            maskColor="color-mix(in srgb, var(--c-void) 55%, transparent)"
            nodeColor={(n) => NODE_COLOR[n.type || ''] || 'var(--c-text-ghost)'}
            nodeStrokeColor="var(--c-text)"
            nodeStrokeWidth={2}
            nodeBorderRadius={2}
          />
        </ReactFlow>
        <LibraryPanel />
        <ToastContainer />

        {/* 空状态 */}
        {nodes.length === 0 && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-4">
            <div className="text-center" style={{ animation: 'fade-up 0.6s ease-out' }}>
              {/* 装饰性发光环 + 中心符号 */}
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
                空白画布
              </h2>
              <p className="mt-2 font-mono text-[10px] tracking-[0.15em] sm:text-[11px]" style={{ color: 'var(--c-text-dim)' }}>
                ADD NODES FROM THE TOP BAR
              </p>
              <p className="mt-1 text-[11px] sm:text-[12px]" style={{ color: 'var(--c-text-faint)' }}>
                连接节点,构建你的创作流水线
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
