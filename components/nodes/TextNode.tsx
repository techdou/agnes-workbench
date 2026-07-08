'use client';

import { useFlowStore } from '@/lib/store';
import { NodeShell, NodeTextarea, NodeLabel } from './NodeShell';
import type { TextNodeData } from '@/lib/types';

export function TextNode({ id, data }: { id: string; data: TextNodeData }) {
  const update = useFlowStore((s) => s.updateNodeData);
  const run = useFlowStore((s) => s.runNode);

  return (
    <NodeShell
      id={id}
      title="文本"
      sigil="Τ"
      accent="fog"
      status={data.status}
      error={data.error}
      onRun={() => run(id)}
      runLabel={data.enhance ? 'AUGMENT' : 'COMMIT'}
    >
      <NodeLabel>提示词 · prompt</NodeLabel>
      <NodeTextarea
        value={data.text || ''}
        onChange={(v) => update(id, { text: v })}
        placeholder="描述你想要的画面…"
        rows={4}
      />
      <label
        className="flex cursor-pointer items-center gap-2 font-mono text-[10px] transition-colors"
        style={{ color: 'var(--c-text-dim)' }}
      >
        <input
          type="checkbox"
          checked={!!data.enhance}
          onChange={(e) => update(id, { enhance: e.target.checked })}
          style={{ accentColor: 'var(--c-amber)' }}
        />
        AUGMENT · LLM 扩写
      </label>
    </NodeShell>
  );
}
