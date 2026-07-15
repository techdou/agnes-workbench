// 数据访问层 —— 从 IndexedDB 迁移到服务端 API
// 接口签名与原 IndexedDB 版本保持一致,store.ts 改动最小
//
// 所有请求携带 cookie(Auth.js session),服务端按 userId 隔离

import type { Edge, Node } from '@xyflow/react';

// ---------- 数据结构(与 DB model 对齐) ----------

export interface Project {
  id: string;
  name: string;
  nodes: Node[];
  edges: Edge[];
  thumbnail?: string;
  createdAt: string;
  updatedAt: string;
}

// ---------- 项目 CRUD(走 /api/projects) ----------

export async function getAllProjects(): Promise<Project[]> {
  const resp = await fetch('/api/projects', { cache: 'no-store' });
  if (!resp.ok) throw new Error(`加载项目列表失败: ${resp.status}`);
  const data = await resp.json();
  // 列表 API 不返回 nodes/edges(太重),补上空数组保持类型一致
  return (data.projects as Project[]).map((p) => ({
    ...p,
    nodes: [],
    edges: [],
  }));
}

export async function getProject(id: string): Promise<Project | undefined> {
  const resp = await fetch(`/api/projects/${id}`, { cache: 'no-store' });
  if (!resp.ok) {
    if (resp.status === 404) return undefined;
    throw new Error(`加载项目失败: ${resp.status}`);
  }
  const data = await resp.json();
  return data.project as Project;
}

export async function saveProject(project: Project): Promise<void> {
  const resp = await fetch(`/api/projects/${project.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: project.name,
      nodes: project.nodes,
      edges: project.edges,
      thumbnail: project.thumbnail,
    }),
  });
  if (!resp.ok) throw new Error(`保存项目失败: ${resp.status}`);
}

export async function deleteProject(id: string): Promise<void> {
  const resp = await fetch(`/api/projects/${id}`, { method: 'DELETE' });
  if (!resp.ok) throw new Error(`删除项目失败: ${resp.status}`);
}

// ---------- 创建项目(返回 server 生成的 id) ----------

export async function createProject(name: string): Promise<Project> {
  const resp = await fetch('/api/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  if (!resp.ok) throw new Error(`创建项目失败: ${resp.status}`);
  const data = await resp.json();
  return data.project as Project;
}
