'use client';

// 视频节点通用参数区(双主题 + 宽高可调)
import { useState } from 'react';
import { NodeLabel, selectClass, selectStyle } from './NodeShell';

interface VideoParamsProps {
  numFrames: number;
  frameRate: number;
  width?: number;
  height?: number;
  onChange: (patch: { numFrames?: number; frameRate?: number; width?: number; height?: number }) => void;
}

const FRAME_OPTIONS = [81, 121, 161, 241, 441];
const FPS_OPTIONS = [24, 30];

// 常用分辨率预设(宽高都是 8 的倍数)
const RES_PRESETS: { label: string; w: number; h: number }[] = [
  { label: '默认 1152×768', w: 1152, h: 768 },
  { label: '竖屏 720×1280', w: 720, h: 1280 },
  { label: '横屏 1280×720', w: 1280, h: 720 },
  { label: '方 1024×1024', w: 1024, h: 1024 },
];

export function VideoParams({ numFrames, frameRate, width, height, onChange }: VideoParamsProps) {
  const [showSize, setShowSize] = useState(false);
  const curPreset = RES_PRESETS.find((p) => p.w === width && p.h === height);

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <NodeLabel>帧数 · 8n+1</NodeLabel>
          <select
            value={numFrames}
            onChange={(e) => onChange({ numFrames: Number(e.target.value) })}
            className={selectClass}
            style={selectStyle}
          >
            {FRAME_OPTIONS.map((f) => (
              <option key={f} value={f}>
                {f}f · {(f / frameRate).toFixed(1)}s
              </option>
            ))}
          </select>
        </div>
        <div>
          <NodeLabel>帧率</NodeLabel>
          <select
            value={frameRate}
            onChange={(e) => onChange({ frameRate: Number(e.target.value) })}
            className={selectClass}
            style={selectStyle}
          >
            {FPS_OPTIONS.map((f) => (
              <option key={f} value={f}>
                {f} fps
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* [M12] 宽高:折叠式,默认收起省空间 */}
      <button
        onClick={() => setShowSize(!showSize)}
        className="font-mono text-[9px] tracking-wider transition-colors"
        style={{ color: 'var(--c-text-faint)' }}
      >
        {showSize ? '▾' : '▸'} 分辨率 {curPreset ? `(${curPreset.label.split(' ')[0]})` : width ? `${width}×${height}` : '(默认)'}
      </button>
      {showSize && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <NodeLabel>宽 · 8的倍数</NodeLabel>
            <input
              type="number"
              step={8}
              value={width ?? ''}
              placeholder="1152"
              onChange={(e) => {
                const v = e.target.value;
                onChange({ width: v ? Number(v) : undefined });
              }}
              className={selectClass}
              style={selectStyle}
            />
          </div>
          <div>
            <NodeLabel>高 · 8的倍数</NodeLabel>
            <input
              type="number"
              step={8}
              value={height ?? ''}
              placeholder="768"
              onChange={(e) => {
                const v = e.target.value;
                onChange({ height: v ? Number(v) : undefined });
              }}
              className={selectClass}
              style={selectStyle}
            />
          </div>
          <div className="col-span-2 flex flex-wrap gap-1">
            {RES_PRESETS.map((p) => (
              <button
                key={p.label}
                onClick={() => onChange({ width: p.w, height: p.h })}
                className="rounded border px-1.5 py-0.5 font-mono text-[9px] transition-colors"
                style={{
                  borderColor: curPreset?.label === p.label ? 'var(--c-amber)' : 'var(--c-line)',
                  color: curPreset?.label === p.label ? 'var(--c-amber)' : 'var(--c-text-faint)',
                  background: 'var(--c-void)',
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// 进度条
export function VideoProgress({ progress, status }: { progress?: number; status: string }) {
  if (status !== 'running' && status !== 'done') return null;
  const pct = Math.max(0, Math.min(100, progress ?? 0));
  const barColor = status === 'done' ? 'var(--c-phosphor)' : 'var(--c-amber)';
  return (
    <div className="mt-1">
      <div className="h-1 w-full overflow-hidden rounded-full" style={{ background: 'var(--c-void)' }}>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: barColor, boxShadow: `0 0 8px ${barColor}` }}
        />
      </div>
      <div className="mt-1 flex justify-between font-mono text-[9px] tracking-wider" style={{ color: 'var(--c-text-faint)' }}>
        <span>{status === 'done' ? 'COMPLETE' : 'INFERRING'}</span>
        <span>{pct}%</span>
      </div>
    </div>
  );
}
