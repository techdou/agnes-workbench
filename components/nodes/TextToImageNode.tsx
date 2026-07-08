'use client';

import { useFlowStore } from '@/lib/store';
import { NodeShell, NodeTextarea, NodeLabel, ResultThumb, selectClass, selectStyle } from './NodeShell';
import type { TextToImageData } from '@/lib/types';

const SIZES = ['1024x768', '1024x1024', '768x1024', '1280x768', '720x1280'];

export function TextToImageNode({ id, data }: { id: string; data: TextToImageData }) {
  const update = useFlowStore((s) => s.updateNodeData);
  const run = useFlowStore((s) => s.runNode);

  return (
    <NodeShell
      id={id}
      title="文生图"
      sigil="ℑ"
      accent="phosphor"
      status={data.status}
      error={data.error}
      hasTarget
      onRun={() => run(id)}
      runLabel="RENDER IMAGE"
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
        placeholder="橘猫坐在书堆上,复古油画风格…"
        rows={3}
      />
      <NodeLabel>尺寸 · dimensions</NodeLabel>
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
