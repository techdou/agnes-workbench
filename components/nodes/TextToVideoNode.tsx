'use client';

import { useFlowStore } from '@/lib/store';
import { NodeShell, NodeTextarea, NodeLabel } from './NodeShell';
import { VideoParams, VideoProgress } from './VideoParams';
import type { TextToVideoData } from '@/lib/types';

export function TextToVideoNode({ id, data }: { id: string; data: TextToVideoData }) {
  const update = useFlowStore((s) => s.updateNodeData);
  const run = useFlowStore((s) => s.runNode);

  return (
    <NodeShell
      id={id}
      title="文生视频"
      sigil="Ϝ"
      accent="amber"
      status={data.status}
      error={data.error}
      hasTarget
      onRun={() => run(id)}
      runLabel="RENDER VIDEO"
    >
      <div
        className="rounded border border-dashed px-2 py-1 text-center font-mono text-[9px]"
        style={{ borderColor: 'var(--c-line)', color: 'var(--c-text-ghost)' }}
      >
        ← 可连接文本节点作为 prompt
      </div>
      <NodeLabel>提示词 · 留空则用上游文本</NodeLabel>
      <NodeTextarea
        value={data.prompt || ''}
        onChange={(v) => update(id, { prompt: v })}
        placeholder="海滩日落,电影级镜头…"
        rows={3}
      />
      <VideoParams
        numFrames={data.numFrames ?? 121}
        frameRate={data.frameRate ?? 24}
        width={data.width}
        height={data.height}
        onChange={(p) => update(id, p)}
      />
      <VideoProgress progress={data.progress} status={data.status} />
      {data.cachedUrl && (
        <video
          src={data.cachedUrl}
          controls
          className="mt-1 max-h-40 w-full rounded border" style={{ borderColor: "color-mix(in srgb, var(--c-amber) 30%, transparent)", boxShadow: "0 0 12px var(--c-bg-glow-1)" }}
        />
      )}
    </NodeShell>
  );
}
