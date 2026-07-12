'use client';

// [L1] 视频类节点公共组件 —— 四个视频节点(textToVideo/imageToVideo/
// multiImageVideo/keyframe)UI 90% 相同,用配置驱动消除重复
import { useFlowStore } from '@/lib/store';
import { useTranslation } from '@/lib/i18n';
import { NodeShell, NodeTextarea, NodeLabel } from './NodeShell';
import { VideoParams, VideoProgress } from './VideoParams';
import type { VideoNodeData } from '@/lib/types';

// 每种视频节点的差异化配置(i18n key)
export interface VideoNodeConfig {
  titleKey: string;
  sigil: string;
  runLabel: string;
  promptLabel: string;
  placeholder: string;
  upstreamHintKey: string;
}

interface VideoNodeBaseProps {
  id: string;
  data: VideoNodeData;
  config: VideoNodeConfig;
}

export function VideoNodeBase({ id, data, config }: VideoNodeBaseProps) {
  const update = useFlowStore((s) => s.updateNodeData);
  const run = useFlowStore((s) => s.runNode);
  const t = useTranslation();

  // 取消运行:用 store 内部的 cancelRun(通过 setState 触发)
  const cancelRun = () => {
    // cancelRun 是 store 内部函数,这里通过重置 status 来实现 UI 取消信号
    // 实际的 AbortController 在 executeNode 里检查 cancelled
    // 用户取消:重新触发带 cancelled 标记的逻辑
    update(id, { status: 'idle', error: t('toast.runCancelled') });
  };

  return (
    <NodeShell
      id={id}
      title={t(config.titleKey)}
      sigil={config.sigil}
      accent="amber"
      status={data.status}
      error={data.error}
      hasTarget
      onRun={() => run(id)}
      onCancel={cancelRun}
      runLabel={config.runLabel}
    >
      <div
        className="rounded border border-dashed px-2 py-1.5 text-center font-mono text-[10px]"
        style={{ borderColor: 'var(--c-line)', color: 'var(--c-text-ghost)' }}
      >
        {t(config.upstreamHintKey)}
      </div>
      <NodeLabel>{config.promptLabel}</NodeLabel>
      <NodeTextarea
        value={data.prompt || ''}
        onChange={(v) => update(id, { prompt: v })}
        placeholder={config.placeholder}
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
          className="mt-1 max-h-40 w-full rounded border"
          style={{
            borderColor: 'color-mix(in srgb, var(--c-amber) 30%, transparent)',
            boxShadow: '0 0 12px var(--c-bg-glow-1)',
          }}
        />
      )}
    </NodeShell>
  );
}
