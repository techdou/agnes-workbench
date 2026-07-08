'use client';

import { useFlowStore } from '@/lib/store';
import { NodeShell, NodeTextarea, NodeLabel } from './NodeShell';
import { VideoParams, VideoProgress } from './VideoParams';
import type { KeyframeData } from '@/lib/types';

export function KeyframeNode({ id, data }: { id: string; data: KeyframeData }) {
  const update = useFlowStore((s) => s.updateNodeData);
  const run = useFlowStore((s) => s.runNode);

  return (
    <NodeShell
      id={id}
      title="关键帧动画"
      sigil="Φ"
      accent="amber"
      status={data.status}
      error={data.error}
      hasTarget
      onRun={() => run(id)}
      runLabel="INTERPOLATE"
    >
      <div className="rounded border border-dashed px-2 py-1.5 text-center font-mono text-[10px]" style={{ borderColor: "var(--c-line)", color: "var(--c-text-ghost)" }}>
        ← 连接 2 张图片(首帧 + 末帧)
      </div>
      <NodeLabel>过渡指令 · transition</NodeLabel>
      <NodeTextarea
        value={data.prompt || ''}
        onChange={(v) => update(id, { prompt: v })}
        placeholder="电影感过渡,保持视觉一致…"
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
