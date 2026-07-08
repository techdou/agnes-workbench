'use client';

// 图片/视频预览节点(双主题适配)
import { useFlowStore } from '@/lib/store';
import { NodeShell } from './NodeShell';
import type { ImagePreviewData, VideoPreviewData } from '@/lib/types';

function DownloadButton({ url, filename }: { url: string; filename: string }) {
  return (
    <a
      href={url}
      download={filename}
      className="mt-2 flex items-center justify-center gap-1.5 rounded border px-3 py-1.5 font-mono text-[10px] tracking-[0.15em] transition-all"
      style={{
        borderColor: 'color-mix(in srgb, var(--c-phosphor) 40%, transparent)',
        background: 'var(--c-void)',
        color: 'var(--c-phosphor)',
      }}
    >
      ↓ DOWNLOAD
    </a>
  );
}

function EmptyState() {
  return (
    <div
      className="flex h-32 items-center justify-center rounded border border-dashed"
      style={{ borderColor: 'var(--c-line)' }}
    >
      <span className="font-mono text-[10px] tracking-wider" style={{ color: 'var(--c-text-ghost)' }}>
        AWAITING INPUT
      </span>
    </div>
  );
}

export function ImagePreviewNode({ id, data }: { id: string; data: ImagePreviewData }) {
  const run = useFlowStore((s) => s.runNode);
  return (
    <NodeShell
      id={id}
      title="图片预览"
      sigil="▣"
      accent="phosphor"
      status={data.status}
      error={data.error}
      hasTarget
      hasSource
      onRun={() => run(id)}
      runLabel="SYNC FROM UPSTREAM"
    >
      {data.cachedUrl ? (
        <div style={{ animation: 'fade-up 0.4s ease-out' }}>
          <div
            className="overflow-hidden rounded border"
            style={{
              borderColor: 'color-mix(in srgb, var(--c-phosphor) 30%, transparent)',
              boxShadow: '0 0 16px var(--c-bg-glow-2)',
            }}
          >
            <img src={data.cachedUrl} alt="preview" className="max-h-64 w-full object-contain" />
          </div>
          <DownloadButton url={data.cachedUrl} filename={`agnes-${id}.png`} />
        </div>
      ) : (
        <EmptyState />
      )}
    </NodeShell>
  );
}

export function VideoPreviewNode({ id, data }: { id: string; data: VideoPreviewData }) {
  const run = useFlowStore((s) => s.runNode);
  return (
    <NodeShell
      id={id}
      title="视频预览"
      sigil="▶"
      accent="amber"
      status={data.status}
      error={data.error}
      hasTarget
      hasSource={false}
      onRun={() => run(id)}
      runLabel="SYNC FROM UPSTREAM"
    >
      {data.cachedUrl ? (
        <div style={{ animation: 'fade-up 0.4s ease-out' }}>
          <div
            className="overflow-hidden rounded border"
            style={{
              borderColor: 'color-mix(in srgb, var(--c-amber) 30%, transparent)',
              boxShadow: '0 0 16px var(--c-bg-glow-1)',
            }}
          >
            <video src={data.cachedUrl} controls autoPlay loop className="max-h-64 w-full" />
          </div>
          <DownloadButton url={data.cachedUrl} filename={`agnes-${id}.mp4`} />
        </div>
      ) : (
        <EmptyState />
      )}
    </NodeShell>
  );
}
