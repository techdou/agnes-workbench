'use client';

// 图片上传节点 —— 拖拽/点击上传本地图片,输出给下游(图生图/图生视频/关键帧等)
// 上传后图片走 /api/cache/[hash] 同源访问,和生成图统一
import { useRef, useState, useCallback } from 'react';
import { useFlowStore } from '@/lib/store';
import { useTranslation } from '@/lib/i18n';
import { NodeShell, NodeLabel } from './NodeShell';
import type { ImageInputData } from '@/lib/types';

export function ImageInputNode({ id, data }: { id: string; data: ImageInputData }) {
  const t = useTranslation();
  const update = useFlowStore((s) => s.updateNodeData);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);

  const handleFile = useCallback(async (file: File) => {
    // 基础前端校验
    if (!file.type.startsWith('image/')) {
      update(id, { status: 'error', error: '仅支持图片文件' });
      return;
    }
    setUploading(true);
    update(id, { status: 'running', error: undefined });
    try {
      const formData = new FormData();
      formData.append('file', file);
      const resp = await fetch('/api/upload', { method: 'POST', body: formData });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || `上传失败: HTTP ${resp.status}`);
      }
      const result = await resp.json();
      // 上传成功:存 localUrl 到 imageUrl,下游 collectUpstreamOutputs 会取它
      update(id, {
        imageUrl: result.localUrl,
        cachedUrl: result.localUrl,
        status: 'done',
        error: undefined,
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      update(id, { status: 'error', error: msg });
    } finally {
      setUploading(false);
    }
  }, [id, update]);

  // ---------- 拖拽 ----------
  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  return (
    <NodeShell
      id={id}
      title={t('node.imageInput')}
      sigil="↥"
      accent="fog"
      status={data.status}
      error={data.error}
      hasSource
      runLabel={t('node.uploaded')}
    >
      <NodeLabel>{t('node.uploadImage')}</NodeLabel>

      {/* 上传区域:点击或拖拽 */}
      <div
        onClick={() => !uploading && fileInputRef.current?.click()}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded border border-dashed py-6 transition-all"
        style={{
          borderColor: dragOver ? 'var(--c-amber)' : 'var(--c-line)',
          background: dragOver ? 'color-mix(in srgb, var(--c-amber) 8%, transparent)' : 'var(--c-void)',
        }}
      >
        {uploading ? (
          <span className="font-mono text-[10px] flicker" style={{ color: 'var(--c-amber)' }}>
            ↑ UPLOADING…
          </span>
        ) : data.cachedUrl ? (
          // 已上传:显示预览缩略图
          <div className="w-full px-2">
            <div
              className="overflow-hidden rounded border"
              style={{ borderColor: 'color-mix(in srgb, var(--c-amber) 30%, transparent)' }}
            >
              <img
                src={data.cachedUrl}
                alt="uploaded"
                className="max-h-32 w-full object-cover"
                style={{ animation: 'fade-up 0.3s ease-out' }}
              />
            </div>
            <p className="mt-1.5 text-center font-mono text-[9px]" style={{ color: 'var(--c-text-ghost)' }}>
              ✓ {t('node.clickToReplace')}
            </p>
          </div>
        ) : (
          // 空状态
          <>
            <span className="font-mono text-2xl" style={{ color: 'var(--c-text-faint)' }}>↥</span>
            <span className="font-mono text-[10px] tracking-wider" style={{ color: 'var(--c-text-faint)' }}>
              {t('node.dragOrClick')}
            </span>
            <span className="font-mono text-[8px]" style={{ color: 'var(--c-text-ghost)' }}>
              PNG · JPEG · WebP · GIF
            </span>
          </>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          // 清空,允许重复选同一文件
          e.target.value = '';
        }}
      />
    </NodeShell>
  );
}
