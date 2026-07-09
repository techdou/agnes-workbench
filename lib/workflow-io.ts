// 工作流导入导出 —— JSON 文件格式,便于分享和复用
// 导出:把项目(nodes + edges + meta)下载为 .json
// 导入:解析 .json,校验格式,生成新项目

import type { Edge, Node } from '@xyflow/react';
import type { Project } from './db';
import { getLanguage } from './settings';
import { t } from './i18n';

// ---------- 导出格式 ----------

export interface WorkflowExport {
  format: 'phosphor-workflow';
  version: 1;
  exportedAt: string;
  name: string;
  nodes: Node[];
  edges: Edge[];
}

// ---------- 导出 ----------

/**
 * 把项目导出为 JSON 文件并触发下载
 */
export function exportWorkflow(project: Pick<Project, 'name' | 'nodes' | 'edges'>): void {
  const data: WorkflowExport = {
    format: 'phosphor-workflow',
    version: 1,
    exportedAt: new Date().toISOString(),
    name: project.name,
    nodes: cleanNodes(project.nodes),
    edges: project.edges,
  };

  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  // 文件名:项目名 + 日期,清理非法字符
  const safeName = project.name.replace(/[<>:"/\\|?*]/g, '_').slice(0, 40) || 'workflow';
  const date = new Date().toISOString().slice(0, 10);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${safeName}-${date}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// 剔除节点里不可序列化的字段(如 onRun 回调)
function cleanNodes(nodes: Node[]): Node[] {
  return nodes.map((n) => {
    const d = { ...n.data } as Record<string, unknown>;
    delete d.onRun;
    delete d.onUpdate;
    return { ...n, data: d };
  });
}

// ---------- 导入 ----------

export interface ImportResult {
  ok: boolean;
  project?: Pick<Project, 'name' | 'nodes' | 'edges'>;
  error?: string;
}

/**
 * 解析导入的 JSON 文件,校验格式
 */
export async function importWorkflow(file: File): Promise<ImportResult> {
  try {
    const text = await file.text();
    const data = JSON.parse(text);

    // 校验格式
    if (data.format !== 'phosphor-workflow') {
      return { ok: false, error: t('toast.importFailed') };
    }
    if (!Array.isArray(data.nodes) || !Array.isArray(data.edges)) {
      return { ok: false, error: t('toast.importFailed') };
    }

    return {
      ok: true,
      project: {
        name: typeof data.name === 'string' ? data.name : t('dashboard.untitled'),
        nodes: data.nodes as Node[],
        edges: data.edges as Edge[],
      },
    };
  } catch {
    return { ok: false, error: t('toast.importFailed') };
  }
}

// 语言占位引用(防止 tree-shake 移除 getLanguage import)
export { getLanguage };
