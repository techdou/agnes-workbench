'use client';

import { useFlowStore } from '@/lib/store';
import { NodeShell, NodeTextarea, NodeLabel, ResultThumb, selectClass, selectStyle } from './NodeShell';
import type { ImageToImageData } from '@/lib/types';

const SIZES = ['1024x768', '1024x1024', '768x1024'];

export function ImageToImageNode({ id, data }: { id: string; data: ImageToImageData }) {
  const update = useFlowStore((s) => s.updateNodeData);
  const run = useFlowStore((s) => s.runNode);

  return (
    <NodeShell
      id={id}
      title="图生图"
      sigil="ℜ"
      accent="phosphor"
      status={data.status}
      error={data.error}
      hasTarget
      onRun={() => run(id)}
      runLabel="TRANSFORM"
    >
      <div
        className="rounded border border-dashed px-2 py-1.5 text-center font-mono text-[10px]"
        style={{ borderColor: 'var(--c-line)', color: 'var(--c-text-ghost)' }}
      >
        ← 连接上游图片
      </div>
      <NodeLabel>编辑指令 · instruction</NodeLabel>
      <NodeTextarea
        value={data.prompt || ''}
        onChange={(v) => update(id, { prompt: v })}
        placeholder="把背景改成雨夜赛博朋克…"
        rows={3}
      />
      <NodeLabel>尺寸</NodeLabel>
      <select
        value={data.size || '1024x768'}
        onChange={(e) => update(id, { size: e.target.value })}
        className={selectClass}
        style={selectStyle}
      >
        {SIZES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      {data.cachedUrl && <ResultThumb url={data.cachedUrl} />}
    </NodeShell>
  );
}
