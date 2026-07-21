'use client';

import { useFlowStore } from '@/lib/store';
import { useTranslation } from '@/lib/i18n';
import { NodeShell, NodeTextarea, NodeLabel, selectClass, selectStyle } from './NodeShell';
import type { TextNodeData, PromptTarget } from '@/lib/types';

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

      {/* 扩写目标类型选择 */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <NodeLabel>{t('node.targetType')}</NodeLabel>
          <select
            value={data.targetType || 'auto'}
            onChange={(e) => update(id, { targetType: e.target.value as PromptTarget })}
            className={selectClass}
            style={selectStyle}
          >
            <option value="auto">{t('node.target.auto')}</option>
            <option value="textToImage">{t('node.textToImage')}</option>
            <option value="textToVideo">{t('node.textToVideo')}</option>
            <option value="imageToImage">{t('node.imageToImage')}</option>
            <option value="imageToVideo">{t('node.imageToVideo')}</option>
          </select>
        </div>
      </div>

      {/* 两个勾选框并排:扩写 + 中文摘要 */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
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

        {/* 中文摘要:只在勾了扩写时可用(摘要依赖扩写结果) */}
        <label
          className={`flex items-center gap-2 font-mono text-[10px] transition-colors ${
            data.enhance ? 'cursor-pointer' : 'cursor-not-allowed opacity-40'
          }`}
          style={{ color: 'var(--c-text-dim)' }}
          title={!data.enhance ? t('node.summaryNeedsAugment') : undefined}
        >
          <input
            type="checkbox"
            checked={!!data.withSummary}
            disabled={!data.enhance}
            onChange={(e) => update(id, { withSummary: e.target.checked })}
            style={{ accentColor: 'var(--c-amber)' }}
          />
          {t('node.summary')}
        </label>
      </div>

      {/* 中文摘要展示区:仅展示,不传下游(textarea 不绑 text 字段) */}
      {data.summary && (
        <div
          className="rounded border-l-2 px-2.5 py-1.5"
          style={{
            borderColor: 'var(--c-phosphor)',
            background: 'color-mix(in srgb, var(--c-phosphor) 8%, transparent)',
          }}
        >
          <div
            className="mb-1 font-mono text-[8px] tracking-[0.2em] uppercase"
            style={{ color: 'var(--c-phosphor)' }}
          >
            {t('node.summaryLabel')}
          </div>
          <p
            className="text-[12px] leading-relaxed"
            style={{ color: 'var(--c-text-dim)', fontFamily: 'system-ui, -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif' }}
          >
            {data.summary}
          </p>
        </div>
      )}
    </NodeShell>
  );
}
