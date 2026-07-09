'use client';

import { useFlowStore } from '@/lib/store';
import { useTranslation } from '@/lib/i18n';
import { NodeShell, NodeTextarea, NodeLabel } from './NodeShell';
import type { TextNodeData } from '@/lib/types';

export function TextNode({ id, data }: { id: string; data: TextNodeData }) {
  const update = useFlowStore((s) => s.updateNodeData);
  const run = useFlowStore((s) => s.runNode);
  const t = useTranslation();

  return (
    <NodeShell
      id={id}
      title={t('node.text')}
      sigil="Τ"
      accent="fog"
      status={data.status}
      error={data.error}
      onRun={() => run(id)}
      runLabel={data.enhance ? 'AUGMENT' : 'COMMIT'}
    >
      <NodeLabel>{t('node.prompt')}</NodeLabel>
      <NodeTextarea
        value={data.text || ''}
        onChange={(v) => update(id, { text: v })}
        placeholder={t('node.promptPlaceholder.text')}
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
        {t('node.augment')}
      </label>
    </NodeShell>
  );
}
