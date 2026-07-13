'use client';

// [L1] 视频类节点公共组件 —— 四个视频节点(textToVideo/imageToVideo/
// multiImageVideo/keyframe)UI 90% 相同,用配置驱动消除重复
import { useFlowStore } from '@/lib/store';
import { useTranslation } from '@/lib/i18n';
import { NodeShell, NodeLabel } from './NodeShell';
import { NodeMentionInput } from '@/components/NodeMentionInput';
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
  allowImageRef?: boolean; // 是否允许 @图片引用(textToVideo=false, 其他默认 true)
}

interface VideoNodeBaseProps {
  id: string;
  data: VideoNodeData;
  config: VideoNodeConfig;
}

export function VideoNodeBase({ id, data, config }: VideoNodeBaseProps) {
  const update = useFlowStore((s) => s.updateNodeData);
  const run = useFlowStore((s) => s.runNode);
  const cancelNode = useFlowStore((s) => s.cancelNode); // [H1] 真正取消:abort pollVideo
  const t = useTranslation();

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
      onCancel={() => cancelNode(id)}
      runLabel={config.runLabel}
    >
      <div
        className="rounded border border-dashed px-2 py-1.5 text-center font-mono text-[10px]"
        style={{ borderColor: 'var(--c-line)', color: 'var(--c-text-ghost)' }}
      >
        {t(config.upstreamHintKey)}
      </div>
      <NodeLabel>{config.promptLabel}</NodeLabel>
      <NodeMentionInput
        nodeId={id}
        value={data.prompt || ''}
        onChange={(v) => update(id, { prompt: v })}
        placeholder={config.placeholder}
        rows={2}
        allowImageRef={config.allowImageRef !== false}
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
