'use client';

import { useFlowStore } from '@/lib/store';
import { useTranslation } from '@/lib/i18n';
import { NodeShell, NodeLabel, ResultThumb, selectClass, selectStyle } from './NodeShell';
import { NodeMentionInput } from '@/components/NodeMentionInput';
import type { ImageToImageData } from '@/lib/types';

const SIZES = ['1024x768', '1024x1024', '768x1024'];

export function ImageToImageNode({ id, data }: { id: string; data: ImageToImageData }) {
  const update = useFlowStore((s) => s.updateNodeData);
  const run = useFlowStore((s) => s.runNode);
  const t = useTranslation();

  return (
    <NodeShell
      id={id}
      title={t('node.imageToImage')}
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
        ← {t('node.upstreamHint.imageMulti')}
      </div>
      <NodeLabel>{t('node.prompt')}</NodeLabel>
      <NodeMentionInput
        nodeId={id}
        value={data.prompt || ''}
        onChange={(v) => update(id, { prompt: v })}
        placeholder={t('node.promptPlaceholder.text')}
        rows={3}
      />
      <NodeLabel>{t('node.size')}</NodeLabel>
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
      {data.cachedUrl && (
        <>
          <ResultThumb url={data.cachedUrl} />
          <a
            href={data.cachedUrl}
            download={`agnes-image-${id}.png`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1.5 rounded border px-3 py-1.5 font-mono text-[10px] tracking-[0.15em] transition-all"
            style={{
              borderColor: 'color-mix(in srgb, var(--c-phosphor) 40%, transparent)',
              background: 'var(--c-void)',
              color: 'var(--c-phosphor)',
            }}
          >
            ↓ {t('node.download')}
          </a>
        </>
      )}
    </NodeShell>
  );
}
