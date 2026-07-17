// IndexedDB 存储层 —— 项目数据 + 缓存的持久化
// 两个独立数据库(避免 idb-keyval 共享 DB 时的 schema 竞争):
//   - phosphor-projects:每个项目(画布)的完整数据,key = projectId
//   - phosphor-settings:全局设置(单一对象,key = 'app-settings')

import { get, set, del, keys, createStore } from 'idb-keyval';
import type { Edge, Node } from '@xyflow/react';

// ---------- 数据结构 ----------

export interface Project {
  id: string;
  name: string;
  nodes: Node[];
  edges: Edge[];
  thumbnail?: string; // 画布截图 dataURL(Dashboard 缩略图)
  createdAt: string;
  updatedAt: string;
}

// ---------- IndexedDB stores(各自独立 DB,避免 schema 竞争) ----------

const projectsStore = createStore('phosphor-projects', 'kv');
const settingsStore = createStore('phosphor-settings', 'kv');

// ---------- 项目 CRUD ----------

export async function getAllProjects(): Promise<Project[]> {
  const allKeys = await keys(projectsStore);
  const projects: Project[] = [];
  for (const k of allKeys) {
    const p = await get(k, projectsStore);
    if (p) projects.push(p as Project);
  }
  // 按 updatedAt 倒序(最近编辑在前)
  projects.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  return projects;
}

export async function getProject(id: string): Promise<Project | undefined> {
  return get(id, projectsStore) as Promise<Project | undefined>;
}

export async function saveProject(project: Project): Promise<void> {
  await set(project.id, project, projectsStore);
}

export async function deleteProject(id: string): Promise<void> {
  await del(id, projectsStore);
}

// ---------- 设置 ----------

const SETTINGS_KEY = 'app-settings';

export async function loadSettings<T>(): Promise<T | undefined> {
  return get(SETTINGS_KEY, settingsStore) as Promise<T | undefined>;
}

export async function saveSettings<T>(settings: T): Promise<void> {
  await set(SETTINGS_KEY, settings, settingsStore);
}

// 导出 store 实例(给 zustand persist 的自定义 storage 用)
export { projectsStore, settingsStore, SETTINGS_KEY };
