'use client';

// 首页 Dashboard —— 项目卡片列表 + 新建/导入/设置
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { getAllProjects, saveProject, type Project } from '@/lib/db';
import { useFlowStore } from '@/lib/store';
import { useSettings } from '@/lib/settings';
import { useTranslation } from '@/lib/i18n';
import { useToast } from '@/lib/useToast';
import { importWorkflow } from '@/lib/workflow-io';
import { ProjectCard } from './ProjectCard';
import { SettingsModal } from './SettingsModal';

export function Dashboard() {
  const t = useTranslation();
  const router = useRouter();
  const pushToast = useToast((s) => s.push);
  const createProject = useFlowStore((s) => s.createProject);
  const loadSettings = useSettings((s) => s.load);

  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 首次加载:读设置 + 项目列表
  useEffect(() => {
    (async () => {
      await loadSettings();
      await refresh();
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function refresh() {
    const all = await getAllProjects();
    setProjects(all);
  }

  async function handleNewProject() {
    const name = t('dashboard.untitled');
    const id = await createProject(name);
    pushToast(t('toast.projectCreated'), 'success');
    router.push(`/canvas/${id}`);
  }

  async function handleImportClick() {
    fileInputRef.current?.click();
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const result = await importWorkflow(file);
    if (!result.ok || !result.project) {
      pushToast(result.error || t('toast.importFailed'), 'error');
      return;
    }
    // 创建新项目
    const { genId } = await import('@/lib/store');
    const id = genId('proj');
    const now = new Date().toISOString();
    const project: Project = {
      id,
      name: result.project.name,
      nodes: result.project.nodes,
      edges: result.project.edges,
      createdAt: now,
      updatedAt: now,
    };
    await saveProject(project);
    pushToast(t('toast.workflowImported', { name: project.name }), 'success');
    await refresh();
    // 清空 input,允许重复导入同一文件
    e.target.value = '';
  }

  if (loading) {
    return (
      <div className="flex h-[100dvh] items-center justify-center" style={{ background: 'var(--c-void)' }}>
        <span className="font-mono text-sm flicker" style={{ color: 'var(--c-amber)' }}>◈ LOADING…</span>
      </div>
    );
  }

  const isEmpty = projects.length === 0;

  return (
    <div className="relative flex min-h-[100dvh] flex-col overflow-hidden" style={{ background: 'var(--c-void)' }}>
      {/* 顶栏 */}
      <header
        className="relative z-10 border-b backdrop-blur-md"
        style={{ borderColor: 'var(--c-edge)', background: 'color-mix(in srgb, var(--c-void) 95%, transparent)' }}
      >
        <div className="flex items-center justify-between px-5 py-3">
          <div className="flex items-center gap-3">
            <div
              className="flex h-8 w-8 items-center justify-center rounded border"
              style={{ borderColor: 'color-mix(in srgb, var(--c-amber) 40%, transparent)', background: 'color-mix(in srgb, var(--c-amber) 10%, transparent)' }}
            >
              <span className="font-mono text-base flicker" style={{ color: 'var(--c-amber)' }}>◈</span>
            </div>
            <div>
              <h1 className="font-[family-name:var(--font-display)] text-[16px] font-semibold leading-none tracking-wide" style={{ color: 'var(--c-text)' }}>
                {t('dashboard.title')}
              </h1>
              <p className="mt-1 font-mono text-[9px] tracking-[0.2em]" style={{ color: 'var(--c-text-faint)' }}>
                {t('dashboard.subtitle')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleFileChange} />
            <button
              onClick={handleImportClick}
              className="rounded border px-3 py-1.5 font-mono text-[10px] tracking-wider transition-colors"
              style={{ borderColor: 'var(--c-line)', color: 'var(--c-text-dim)' }}
            >
              ↑ {t('dashboard.importWorkflow')}
            </button>
            <button
              onClick={handleNewProject}
              className="rounded border px-3 py-1.5 font-mono text-[10px] font-semibold tracking-wider transition-colors"
              style={{
                borderColor: 'color-mix(in srgb, var(--c-amber) 50%, transparent)',
                background: 'color-mix(in srgb, var(--c-amber) 12%, transparent)',
                color: 'var(--c-amber)',
              }}
            >
              + {t('dashboard.newProject')}
            </button>
            <button
              onClick={() => setSettingsOpen(true)}
              className="rounded border px-2.5 py-1.5 font-mono text-[12px] transition-colors"
              style={{ borderColor: 'var(--c-line)', color: 'var(--c-text-dim)' }}
              title={t('dashboard.settings')}
            >
              ⚙
            </button>
          </div>
        </div>
      </header>

      {/* 项目网格 */}
      <main className="flex-1 overflow-y-auto p-5">
        {isEmpty ? (
          // 空状态
          <div className="flex h-full min-h-[400px] flex-col items-center justify-center">
            <div className="relative mb-6 h-24 w-24">
              <div
                className="absolute inset-0 rounded-full border opacity-40"
                style={{ borderColor: 'var(--c-amber)', animation: 'flicker 3s ease-in-out infinite' }}
              />
              <div
                className="absolute inset-4 rounded-full border opacity-25"
                style={{ borderColor: 'var(--c-phosphor)' }}
              />
              <div
                className="absolute inset-0 flex items-center justify-center font-mono text-4xl"
                style={{ color: 'var(--c-amber)', textShadow: '0 0 16px var(--c-bg-glow-1)' }}
              >
                ◈
              </div>
            </div>
            <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold" style={{ color: 'var(--c-text-dim)' }}>
              {t('dashboard.empty.title')}
            </h2>
            <p className="mt-2 text-[13px]" style={{ color: 'var(--c-text-faint)' }}>
              {t('dashboard.empty.desc')}
            </p>
            <button
              onClick={handleNewProject}
              className="mt-6 rounded border px-6 py-2.5 font-mono text-[11px] font-semibold tracking-wider transition-all"
              style={{
                borderColor: 'color-mix(in srgb, var(--c-amber) 50%, transparent)',
                background: 'color-mix(in srgb, var(--c-amber) 12%, transparent)',
                color: 'var(--c-amber)',
              }}
            >
              + {t('dashboard.empty.create')}
            </button>
          </div>
        ) : (
          <>
            <h2 className="mb-4 font-mono text-[10px] tracking-[0.2em]" style={{ color: 'var(--c-text-faint)' }}>
              {t('dashboard.recentProjects')}
            </h2>
            <div className="flex flex-wrap gap-4">
              {projects.map((p) => (
                <ProjectCard key={p.id} project={p} onDeleted={refresh} />
              ))}

              {/* 新建卡片 */}
              <button
                onClick={handleNewProject}
                className="flex w-[260px] flex-col items-center justify-center gap-2 rounded-md border border-dashed py-8 transition-all hover:-translate-y-0.5"
                style={{ borderColor: 'var(--c-line)', minHeight: '180px' }}
              >
                <span className="font-mono text-2xl" style={{ color: 'var(--c-text-faint)' }}>＋</span>
                <span className="font-mono text-[10px] tracking-wider" style={{ color: 'var(--c-text-faint)' }}>
                  {t('dashboard.newProject')}
                </span>
              </button>
            </div>
          </>
        )}
      </main>

      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}
