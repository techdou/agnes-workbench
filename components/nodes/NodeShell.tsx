'use client';

// Phosphor Studio 节点外壳(双主题 + 色条 + 扫描线 + hover)
import { Handle, Position } from '@xyflow/react';
import { NodeToolbar } from '@xyflow/react';
import type { ReactNode } from 'react';
import type { NodeStatus } from '@/lib/types';
import { useFlowStore } from '@/lib/store';
import { useTranslation } from '@/lib/i18n';

interface NodeShellProps {
  id: string;
  title: string;
  sigil?: string;
  accent?: 'amber' | 'phosphor' | 'rust' | 'fog';
  status: NodeStatus;
  error?: string;
  hasSource?: boolean;
  hasTarget?: boolean;
  onRun?: () => void;
  runLabel?: string;
  children: ReactNode;
}

const ACCENT = {
  amber: { dot: 'var(--c-amber)', glow: 'var(--c-bg-glow-1)', bar: 'var(--c-amber)' },
  phosphor: { dot: 'var(--c-phosphor)', glow: 'var(--c-bg-glow-2)', bar: 'var(--c-phosphor)' },
  rust: { dot: 'var(--c-rust)', glow: 'rgba(200,85,61,0.4)', bar: 'var(--c-rust)' },
  fog: { dot: 'var(--c-text-dim)', glow: 'rgba(139,149,167,0.3)', bar: 'var(--c-text-faint)' },
};

const STATUS_DOT: Record<NodeStatus, string> = {
  idle: 'var(--c-text-faint)',
  running: 'var(--c-amber)',
  done: 'var(--c-phosphor)',
  error: 'var(--c-rust)',
};

const STATUS_LABEL_KEY: Record<NodeStatus, string> = {
  idle: 'node.status.idle',
  running: 'node.status.running',
  done: 'node.status.done',
  error: 'node.status.error',
};

export function NodeShell({
  id,
  title,
  sigil = '◇',
  accent = 'amber',
  status,
  error,
  hasSource = true,
  hasTarget = false,
  onRun,
  runLabel = 'EXECUTE',
  children,
}: NodeShellProps) {
  const deleteNode = useFlowStore((s) => s.deleteNode);
  const t = useTranslation();
  const ac = ACCENT[accent];
  const statusDot = STATUS_DOT[status];
  const statusLabel = t(STATUS_LABEL_KEY[status]);

  return (
    <div
      className="phosphor-node group relative w-[300px] overflow-hidden rounded-md border shadow-[0_8px_32px_rgba(0,0,0,0.4)] backdrop-blur-sm transition-all duration-200"
      style={{ borderColor: 'var(--c-edge)', background: 'var(--c-ink)' }}
    >
      {/* [优化1] 左侧类型色条 —— 3px 宽,贯穿整个节点高度 */}
      <span
        className="pointer-events-none absolute left-0 top-0 z-10 h-full w-[3px]"
        style={{ background: ac.bar, boxShadow: `0 0 8px ${ac.glow}` }}
      />

      {hasTarget && <Handle type="target" position={Position.Left} id="in" />}

      {/* 选中时浮出的删除按钮 */}
      <NodeToolbar position={Position.Top} offset={8}>
        <button
          onClick={() => deleteNode(id)}
          className="flex items-center gap-1 rounded border px-2 py-0.5 font-mono text-[10px] transition-colors"
          style={{
            borderColor: 'var(--c-rust)',
            background: 'color-mix(in srgb, var(--c-rust) 15%, transparent)',
            color: 'var(--c-rust)',
          }}
        >
          ✕ {t('common.delete')}
        </button>
      </NodeToolbar>

      {/* 标题栏 */}
      <div className="flex items-center justify-between border-b px-3 py-2 pl-4" style={{ borderColor: 'var(--c-edge)' }}>
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm leading-none" style={{ color: ac.dot, textShadow: `0 0 8px ${ac.glow}` }}>
            {sigil}
          </span>
          <h3 className="font-[family-name:var(--font-display)] text-[13px] font-semibold tracking-wide" style={{ color: 'var(--c-text)' }}>
            {title}
          </h3>
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className="inline-block h-1.5 w-1.5 rounded-full"
            style={{
              backgroundColor: statusDot,
              boxShadow: `0 0 6px ${statusDot}`,
              animation: status === 'running' ? 'flicker 1.2s ease-in-out infinite' : undefined,
            }}
          />
          <span className="font-mono text-[9px] tracking-[0.15em]" style={{ color: 'var(--c-text-faint)' }}>
            {statusLabel}
          </span>
        </div>
      </div>

      {/* 内容区 */}
      <div className="space-y-2.5 px-3 py-2.5 pl-4">{children}</div>

      {/* 错误 */}
      {error && (
        <div
          className="mx-3 mb-2 border-l-2 px-2 py-1.5"
          style={{ borderColor: 'var(--c-rust)', background: 'color-mix(in srgb, var(--c-rust) 12%, transparent)' }}
        >
          <div className="font-mono text-[10px] leading-relaxed" style={{ color: 'var(--c-rust)' }}>
            {error}
          </div>
        </div>
      )}

      {/* [优化2] 运行按钮 + 扫描线 */}
      {onRun && (
        <div className="border-t px-3 py-2" style={{ borderColor: 'var(--c-edge)' }}>
          <button
            onClick={onRun}
            disabled={status === 'running'}
            className="group relative w-full overflow-hidden rounded border px-3 py-1.5 font-mono text-[11px] font-medium tracking-[0.1em] transition-all disabled:cursor-not-allowed disabled:opacity-40"
            style={{
              borderColor: 'color-mix(in srgb, var(--c-amber) 50%, transparent)',
              background: 'color-mix(in srgb, var(--c-amber) 10%, transparent)',
              color: 'var(--c-amber)',
            }}
          >
            <span className="relative z-10">
              {status === 'running' ? (
                <span className="inline-flex items-center gap-1.5">
                  <span className="inline-block h-2 w-2 animate-pulse rounded-full" style={{ background: 'var(--c-amber)' }} />
                  {t('node.processing')}
                </span>
              ) : (
                <>▶ {runLabel}</>
              )}
            </span>
            {/* 扫描线:hover 时从左扫到右 */}
            {status !== 'running' && (
              <span
                className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-current to-transparent opacity-20 transition-transform duration-700 group-hover:translate-x-full"
                style={{ color: 'var(--c-amber)' }}
              />
            )}
          </button>
        </div>
      )}

      {hasSource && <Handle type="source" position={Position.Right} id="out" />}
    </div>
  );
}

// ---------- 通用表单控件 ----------

export function NodeLabel({ children }: { children: ReactNode }) {
  return (
    <label className="block font-mono text-[9px] uppercase tracking-[0.2em]" style={{ color: 'var(--c-text-faint)' }}>
      {children}
    </label>
  );
}

export function NodeTextarea({
  value,
  onChange,
  placeholder,
  rows = 3,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="w-full resize-none rounded border px-2.5 py-1.5 font-[family-name:var(--font-display)] text-[13px] leading-relaxed transition-colors focus:outline-none"
      style={{ borderColor: 'var(--c-line)', background: 'var(--c-void)', color: 'var(--c-text)' }}
    />
  );
}

const inputBaseClass = 'w-full rounded border px-2.5 py-1.5 font-mono text-[12px] transition-colors focus:outline-none';

export function NodeInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={inputBaseClass}
      style={{ borderColor: 'var(--c-line)', background: 'var(--c-void)', color: 'var(--c-text)' }}
    />
  );
}

export function ResultThumb({ url, alt }: { url: string; alt?: string }) {
  return (
    <div
      className="overflow-hidden rounded border"
      style={{ borderColor: 'color-mix(in srgb, var(--c-amber) 30%, transparent)', boxShadow: '0 0 12px var(--c-bg-glow-1)' }}
    >
      <img src={url} alt={alt || 'result'} className="max-h-40 w-full object-cover" style={{ animation: 'fade-up 0.4s ease-out' }} />
    </div>
  );
}

export const selectClass = 'w-full cursor-pointer rounded border px-2 py-1.5 font-mono text-[12px] transition-colors focus:outline-none';
export const selectStyle = { borderColor: 'var(--c-line)', background: 'var(--c-void)', color: 'var(--c-text)' };
