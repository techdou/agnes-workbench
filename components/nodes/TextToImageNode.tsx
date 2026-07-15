'use client';

import { useFlowStore } from '@/lib/store';
import { useTranslation } from '@/lib/i18n';
import { useSettings } from '@/lib/settings';
import { NodeShell, NodeTextarea, NodeLabel, ResultThumb, selectClass, selectStyle } from './NodeShell';
import type { TextToImageData } from '@/lib/types';

const SIZES = ['1024x768', '1024x1024', '768x1024', '1280x768', '720x1280'];

export function TextToImageNode({ id, data }: { id: string; data: TextToImageData }) {
  const update = useFlowStore((s) => s.updateNodeData);
  const run = useFlowStore((s) => s.runNode);
  const t = useTranslation();
  const defaultSize = useSettings((s) => s.settings.defaultImageSize);

  return (
    <NodeShell
      id={id}
      title={t('node.textToImage')}
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
        {t('node.upstreamHint.text')}
      </div>
      <NodeLabel>{t('node.prompt')}</NodeLabel>
      <NodeTextarea
        value={data.prompt || ''}
        onChange={(v) => update(id, { prompt: v })}
        placeholder={t('node.promptPlaceholder.text')}
        rows={3}
      />
      <NodeLabel>{t('node.size')}</NodeLabel>
      <select
        value={data.size || defaultSize}
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
