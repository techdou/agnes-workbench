'use client';

// 项目卡片 —— 缩略图 + 名称 + 时间 + 操作菜单
import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { Project } from '@/lib/db';
import { useTranslation } from '@/lib/i18n';
import { useToast } from '@/lib/useToast';
import { exportWorkflow } from '@/lib/workflow-io';
import { deleteProject as dbDeleteProject, renameProject, createProject } from '@/lib/db';

interface ProjectCardProps {
  project: Project;
  onDeleted: () => void;
}

export function ProjectCard({ project, onDeleted }: ProjectCardProps) {
  const t = useTranslation();
  const router = useRouter();
  const pushToast = useToast((s) => s.push);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(project.name);
  const [menuOpen, setMenuOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const open = () => router.push(`/canvas/${project.id}`);

  const commitName = async () => {
    const trimmed = name.trim();
    if (trimmed && trimmed !== project.name) {
      try {
        // 只改 name,不动 nodes/edges(避免用列表页的空 nodes 清空画布)
        await renameProject(project.id, trimmed);
        pushToast(t('toast.projectRenamed'), 'success');
      } catch {
        pushToast(t('toast.saveFailed'), 'error');
        setName(project.name);
      }
    } else {
      setName(project.name);
    }
    setEditing(false);
  };

  const handleDelete = async () => {
    if (!confirm(t('dashboard.card.deleteConfirm', { name: project.name }))) return;
    await dbDeleteProject(project.id);
    pushToast(t('toast.projectDeleted'), 'info');
    onDeleted();
  };

  const handleExport = () => {
    exportWorkflow(project);
    pushToast(t('toast.workflowExported'), 'success');
    setMenuOpen(false);
  };

  const handleDuplicate = async () => {
    try {
      // 走 POST 创建新项目,服务端生成 ID 并带入画布
      // 注意:列表页 project.nodes/edges 是空的,需要先拉详情
      const resp = await fetch(`/api/projects/${project.id}`, { cache: 'no-store' });
      if (!resp.ok) throw new Error('加载项目失败');
      const data = await resp.json();
      const fullProject = data.project as Project;
      await createProject(`${project.name} (copy)`, {
        nodes: fullProject.nodes,
        edges: fullProject.edges,
      });
      pushToast(t('dashboard.card.duplicate'), 'success');
      setMenuOpen(false);
      onDeleted(); // 刷新列表
    } catch {
      pushToast(t('toast.saveFailed'), 'error');
    }
  };

  const nodeCount = project.nodes?.length ?? 0;
  const updated = new Date(project.updatedAt);

  return (
    <div
      className="group relative w-[260px] shrink-0 overflow-hidden rounded-md border transition-all duration-200 hover:-translate-y-0.5"
      style={{ borderColor: 'var(--c-edge)', background: 'var(--c-ink)' }}
    >
      {/* 左侧色条 */}
      <span
        className="pointer-events-none absolute left-0 top-0 z-10 h-full w-[3px]"
        style={{ background: 'var(--c-amber)', boxShadow: '0 0 8px var(--c-bg-glow-1)' }}
      />

      {/* 缩略图区 */}
      <button
        onClick={open}
        className="relative block aspect-[16/10] w-full overflow-hidden"
        style={{ background: 'var(--c-void)' }}
      >
        {project.thumbnail ? (
          <img
            src={project.thumbnail}
            alt={project.name}
            className="h-full w-full object-cover opacity-80 transition-all group-hover:scale-105 group-hover:opacity-100"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            {/* 装饰性空状态 */}
            <div className="relative h-12 w-12">
              <div
                className="absolute inset-0 rounded-full border opacity-30"
                style={{ borderColor: 'var(--c-amber)' }}
              />
              <div
                className="absolute inset-0 flex items-center justify-center font-mono text-lg"
                style={{ color: 'var(--c-amber)' }}
              >
                ◇
              </div>
            </div>
          </div>
        )}
        {/* hover 扫描线 */}
        <span
          className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-current to-transparent opacity-10 transition-transform duration-700 group-hover:translate-x-full"
          style={{ color: 'var(--c-amber)' }}
        />
      </button>

      {/* 信息区 */}
      <div className="px-3 py-2.5 pl-4">
        {editing ? (
          <input
            ref={inputRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitName();
              if (e.key === 'Escape') { setName(project.name); setEditing(false); }
            }}
            className="w-full rounded border bg-transparent px-1.5 py-0.5 font-[family-name:var(--font-display)] text-[14px] font-semibold focus:outline-none"
            style={{ borderColor: 'var(--c-amber)', color: 'var(--c-text)' }}
          />
        ) : (
          <h3
            className="cursor-pointer truncate font-[family-name:var(--font-display)] text-[14px] font-semibold"
            style={{ color: 'var(--c-text)' }}
            onDoubleClick={() => setEditing(true)}
            title={project.name}
          >
            {project.name}
          </h3>
        )}
        <div className="mt-1 flex items-center justify-between">
          <span className="font-mono text-[9px] tracking-wider" style={{ color: 'var(--c-text-ghost)' }}>
            {nodeCount} {t('dashboard.card.nodes')} · {updated.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })}
          </span>

          {/* 操作菜单 */}
          <div className="relative">
            <button
              onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }}
              className="rounded p-1 font-mono text-xs opacity-0 transition-opacity hover:bg-white/5 group-hover:opacity-100"
              style={{ color: 'var(--c-text-dim)' }}
            >
              ⋮
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} />
                <div
                  className="absolute bottom-0 right-0 z-40 w-36 overflow-hidden rounded-md border py-1 shadow-xl"
                  style={{ borderColor: 'var(--c-line)', background: 'var(--c-panel)' }}
                >
                  <MenuItem onClick={() => { setEditing(true); setMenuOpen(false); }}>
                    ✎ {t('common.rename')}
                  </MenuItem>
                  <MenuItem onClick={handleDuplicate}>
                    ⧉ {t('dashboard.card.duplicate')}
                  </MenuItem>
                  <MenuItem onClick={handleExport}>
                    ↓ {t('common.export')}
                  </MenuItem>
                  <div className="my-1 border-t" style={{ borderColor: 'var(--c-edge)' }} />
                  <MenuItem onClick={handleDelete} danger>
                    ✕ {t('common.delete')}
                  </MenuItem>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function MenuItem({ children, onClick, danger }: { children: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      className="block w-full px-3 py-1.5 text-left font-mono text-[11px] transition-colors hover:bg-white/5"
      style={{ color: danger ? 'var(--c-rust)' : 'var(--c-text-dim)' }}
    >
      {children}
    </button>
  );
}
