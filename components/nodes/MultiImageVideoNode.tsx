'use client';

import { useFlowStore } from '@/lib/store';
import { NodeShell, NodeTextarea, NodeLabel } from './NodeShell';
import { VideoParams, VideoProgress } from './VideoParams';
import type { MultiImageVideoData } from '@/lib/types';

export function MultiImageVideoNode({ id, data }: { id: string; data: MultiImageVideoData }) {
  const update = useFlowStore((s) => s.updateNodeData);
  const run = useFlowStore((s) => s.runNode);

  return (
    <NodeShell
      id={id}
      title="多图视频"
      sigil="Σ"
      accent="amber"
      status={data.status}
      error={data.error}
      hasTarget
      onRun={() => run(id)}
      runLabel="COMPOSE"
    >
      <div className="rounded border border-dashed px-2 py-1.5 text-center font-mono text-[10px]" style={{ borderColor: "var(--c-line)", color: "var(--c-text-ghost)" }}>
        ← 连接多张图片
      </div>
      <NodeLabel>动画指令 · motion</NodeLabel>
      <NodeTextarea
        value={data.prompt || ''}
        onChange={(v) => update(id, { prompt: v })}
        placeholder="两张图之间平滑过渡…"
        rows={2}
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
