'use client';

// 画布页:/canvas/[projectId]
// Next 16 客户端组件用 useParams() 读动态参数(同步,不走 props Promise)
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { FlowCanvas } from '@/components/FlowCanvas';
import { useFlowStore } from '@/lib/store';

export default function CanvasPage() {
  const params = useParams<{ projectId: string }>();
  const router = useRouter();
  const projectId = params.projectId;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const id = projectId;
    const load = async () => {
      const ok = await useFlowStore.getState().loadProject(id);
      if (!ok) {
        setError(true);
      }
      setLoading(false);
    };
    load();
  }, [projectId]);

  if (loading) {
    return (
      <div className="flex h-[100dvh] items-center justify-center" style={{ background: 'var(--c-void)' }}>
        <span className="font-mono text-sm flicker" style={{ color: 'var(--c-amber)' }}>◈ LOADING…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-[100dvh] flex-col items-center justify-center gap-4" style={{ background: 'var(--c-void)' }}>
        <span className="font-mono text-3xl" style={{ color: 'var(--c-rust)' }}>∅</span>
        <p className="font-mono text-sm" style={{ color: 'var(--c-text-dim)' }}>PROJECT NOT FOUND</p>
        <button
          onClick={() => router.push('/')}
          className="rounded border px-4 py-2 font-mono text-xs tracking-wider"
          style={{ borderColor: 'var(--c-amber)', color: 'var(--c-amber)' }}
        >
          ← BACK TO DASHBOARD
        </button>
      </div>
    );
  }

  return <FlowCanvas />;
}
