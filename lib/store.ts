'use client';

// 全局画布状态 + 节点执行引擎
// 支持:项目制(IndexedDB 多画布)、自动保存、上游自动拓扑执行、轮询取消、指数退避、连线类型校验
import { create } from 'zustand';
import { temporal } from 'zundo';
import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
  type OnConnect,
  type OnEdgesChange,
  type OnNodesChange,
} from '@xyflow/react';
import { getUpstreamNodes, collectUpstreamOutputs, VIDEO_NODE_TYPES } from './workflow';
import { toast } from './useToast';
import { t } from './i18n';
import {
  getProject,
  saveProject,
  type Project,
} from './db';
import { useSettings } from './settings';
import { buildEnhanceSystemPrompt } from './prompt-templates';
import { resolveTargetType, resolveImageRefs } from './prompt-resolve';

// ---------- API 调用封装 ----------

// 统一构建请求头(API Key 现在从服务端 DB 读取,不再前端传)
function authHeaders(): Record<string, string> {
  return { 'Content-Type': 'application/json' };
}

// 读 settings 里的模型名+baseUrl+autoTranslate(透传给 API route)
function modelParams(): Record<string, unknown> {
  const s = useSettings.getState().settings;
  const params: Record<string, unknown> = {};
  if (s.textModel) params.textModel = s.textModel;
  if (s.imageModel) params.imageModel = s.imageModel;
  if (s.videoModel) params.videoModel = s.videoModel;
  if (s.baseUrl) params.baseUrl = s.baseUrl;           // [H2]
  params.autoTranslate = s.autoTranslate;               // [H3]
  return params;
}

// 友好化 API 错误:5xx/限流/鉴权错误给中文提示
function friendlyApiError(status: number, msg: string): string {
  if (status === 401) return 'API Key 无效,请检查设置';
  if (status === 403) return 'API Key 无访问权限,请检查设置';
  if (status === 408) return '请求超时,请稍后重试';
  if (status === 429) return '请求过于频繁,请稍后重试';
  if (status === 500) return 'Agnes 服务异常,请稍后重试';
  if (status === 502) return 'Agnes 网关异常,请稍后重试';
  if (status === 503) return '服务繁忙,请稍后重试';
  if (status === 504) return 'Agnes 服务超时,请稍后重试';
  if (status >= 500) return 'Agnes 服务暂不可用,请稍后重试';
  return msg;
}

async function callImage(
  mode: 'text-to-image' | 'image-to-image',
  prompt: string,
  size: string,
  inputImageUrls?: string[]
): Promise<{ urls: string[] }> {
  const resp = await fetch('/api/agnes/image', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ mode, prompt, size, inputImageUrls, ...modelParams() }),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(friendlyApiError(resp.status, err.error || `HTTP ${resp.status}`));
  }
  return resp.json();
}

async function callText(prompt: string, system?: string): Promise<string> {
  const resp = await fetch('/api/agnes/text', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ prompt, system, temperature: 0.7, ...modelParams() }),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(friendlyApiError(resp.status, err.error || `HTTP ${resp.status}`));
  }
  const r = await resp.json();
  if (!r.content) throw new Error('文本 API 未返回内容');
  return r.content as string;
}

async function callVideoCreate(body: Record<string, unknown>): Promise<{ videoId?: string; id?: string; status: string }> {
  const resp = await fetch('/api/agnes/video/create', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ ...body, ...modelParams() }),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(friendlyApiError(resp.status, err.error || `HTTP ${resp.status}`));
  }
  return resp.json();
}

async function callVideoStatus(id: string): Promise<{ status: string; progress?: number; url?: string; error?: string }> {
  const s = useSettings.getState().settings;
  const params = new URLSearchParams({ id });
  if (s.videoModel) params.set('videoModel', s.videoModel);
  if (s.baseUrl) params.set('baseUrl', s.baseUrl);
  const resp = await fetch(`/api/agnes/video/status?${params}`, {
    headers: authHeaders(),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(friendlyApiError(resp.status, err.error || `HTTP ${resp.status}`));
  }
  return resp.json();
}

async function cacheUrl(url: string, type: 'image' | 'video', prompt?: string): Promise<string> {
  try {
    // 读取当前项目 ID,让画廊按项目隔离
    const projectId = useFlowStore.getState().currentProjectId || undefined;
    const resp = await fetch('/api/cache/item', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, type, prompt, projectId }),
    });
    if (resp.ok) {
      const data = await resp.json();
      if (data.localUrl) return data.localUrl;
    }
  } catch {
    /* 缓存失败不阻塞 */
  }
  return url;
}

// ---------- 节点工厂 ----------

// 用 crypto.randomUUID 保证跨刷新/跨会话唯一(模块级 counter 刷新会重置)
export function genId(prefix: string): string {
  const uuid = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID().slice(0, 8)
    : Math.random().toString(36).slice(2, 10);
  return `${prefix}_${uuid}`;
}

// [H5] 加大节点布局间距,避免重叠
function newPos(idx: number) {
  return { x: 80 + (idx % 4) * 380, y: 80 + Math.floor(idx / 4) * 340 };
}

// ---------- 连线类型校验 [H4] ----------

// 每种节点允许的上游类型(true 表示允许 source→target)
const ALLOWED_CONNECTIONS: Record<string, Set<string>> = {
  // 文本类节点:谁都能连进来当 prompt(但通常连 text)
  textToImage: new Set(['text']),
  imageToImage: new Set(['text', 'textToImage', 'imagePreview', 'imageToImage', 'imageInput']),
  textToVideo: new Set(['text']),
  imageToVideo: new Set(['text', 'textToImage', 'imageToImage', 'imagePreview', 'imageInput']),
  multiImageVideo: new Set(['text', 'textToImage', 'imageToImage', 'imagePreview', 'imageInput']),
  keyframe: new Set(['text', 'textToImage', 'imageToImage', 'imagePreview', 'imageInput']),
  imagePreview: new Set(['textToImage', 'imageToImage', 'imagePreview', 'imageInput']),
  videoPreview: new Set(['textToVideo', 'imageToVideo', 'multiImageVideo', 'keyframe']),
};

// ---------- 节点推荐(从 ALLOWED_CONNECTIONS 反推)----------
// 给定一个 source 节点类型,返回它可以合法连接到的 target 类型列表
// 用于"拖连线到空白处松开 → 弹出推荐节点"交互
const RECOMMENDED_TARGETS: Record<string, string[]> = (() => {
  const map: Record<string, string[]> = {};
  // 遍历所有 target 类型,看它们的 allowed set 里有没有这个 source
  for (const [targetType, allowedSources] of Object.entries(ALLOWED_CONNECTIONS)) {
    for (const sourceType of allowedSources) {
      if (!map[sourceType]) map[sourceType] = [];
      // 去重
      if (!map[sourceType].includes(targetType)) map[sourceType].push(targetType);
    }
  }
  return map;
})();

/**
 * 获取某个节点类型可以连接到的推荐目标类型列表
 * 如果没有限制(text 节点谁都能连),返回所有可作为 target 的类型
 */
export function getRecommendedTargets(sourceType: string): string[] {
  const targets = RECOMMENDED_TARGETS[sourceType];
  if (targets && targets.length > 0) return targets;
  // 没有匹配的(如 text 本身没有 outgoing 限制),返回空——由调用方 fallback 到全部
  return [];
}

function isValidConnection(connection: Connection | Edge): boolean {
  // 取 source 和 target 的节点类型
  const nodes = useFlowStore.getState().nodes;
  const src = nodes.find((n) => n.id === connection.source);
  const tgt = nodes.find((n) => n.id === connection.target);
  if (!src || !tgt) return true; // 查不到就放行(不阻塞 React Flow 内部行为)
  const allowed = ALLOWED_CONNECTIONS[tgt.type || ''];
  if (!allowed) return true; // 目标无限制(如 text 节点谁都能连)
  return allowed.has(src.type || '');
}

// ---------- 自动保存(防抖) ----------

let saveTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleAutoSave() {
  if (!useFlowStore.getState().currentProjectId) return;
  if (saveTimer) clearTimeout(saveTimer);
  useFlowStore.getState().setSaveStatus('saving');
  saveTimer = setTimeout(async () => {
    saveTimer = null;
    try {
      await useFlowStore.getState().persistCurrentProject();
    } catch {
      // 保存失败:setSaveStatus('error') 由 persistCurrentProject 内部处理
      useFlowStore.getState().setSaveStatus('error');
    }
  }, 1500);
}

// 切换项目前调用:清除挂起的 timer,避免跨项目写入污染
// 注意:不等待 pending persist,因为 currentProjectId 立即变化会导致
// persist 读到新项目状态。挂起的 timer 已被 clear,不会再触发。
function flushPendingSaveTimer() {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
}

// ---------- Store ----------

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface FlowState {
  nodes: Node[];
  edges: Edge[];
  currentProjectId: string | null;
  currentProjectName: string;
  saveStatus: SaveStatus;
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  addNode: (type: string, data?: Record<string, unknown>) => void;
  addNodeAt: (type: string, position: { x: number; y: number }, data?: Record<string, unknown>) => string;
  addNodeConnected: (type: string, position: { x: number; y: number }, sourceId: string, sourceHandle?: string) => string;
  updateNodeData: (id: string, patch: Record<string, unknown>) => void;
  runNode: (id: string, opts?: { silent?: boolean }) => Promise<void>;
  runAll: () => Promise<void>;
  deleteNode: (id: string) => void;
  deleteNodes: (ids: string[]) => void;
  duplicateNodes: (ids: string[]) => void;
  deleteEdge: (id: string) => void;
  // 项目制
  createProject: (name: string) => Promise<string>;
  loadProject: (id: string) => Promise<boolean>;
  persistCurrentProject: () => Promise<void>;
  setSaveStatus: (s: SaveStatus) => void;
  clearAll: () => void;
  // 撤销/重做
  undo: () => void;
  redo: () => void;
  // 取消节点运行
  cancelNode: (id: string) => void;
  // [C1] 取消正在进行的 runAll(下次循环检查标志后退出)
  cancelRunAll: () => void;
  // 断开节点所有连线(给右键菜单用,走 action 才能触发 autosave)
  disconnectNode: (id: string) => void;
}

// [C3] 运行中的节点控制器:节点ID → 取消函数
const runningControllers = new Map<string, () => void>();
// [M3] 运行中的节点 Promise:节点ID → 正在执行的 Promise
const runningPromises = new Map<string, Promise<void>>();

// [C1] Run All 限流 + 取消
// Agnes 视频 RPM ≈ 1/分钟,多视频节点自动间隔(留 5s buffer),可被 cancelRunAll 中止
// 注:store.ts 在 client bundle,env 只能 build 时注入,这里用硬编码便于审查
const VIDEO_MIN_INTERVAL_MS = 65000;
let runAllAborted = false;

export const useFlowStore = create<FlowState>()(
  temporal(
    (set, get) => ({
  nodes: [],
  edges: [],
  currentProjectId: null,
  currentProjectName: '',
  saveStatus: 'idle',

  onNodesChange: (changes: NodeChange[]) => {
    set({ nodes: applyNodeChanges(changes, get().nodes) });
    scheduleAutoSave();
  },
  onEdgesChange: (changes: EdgeChange[]) => {
    set({ edges: applyEdgeChanges(changes, get().edges) });
    scheduleAutoSave();
  },
  onConnect: (conn: Connection) => {
    // [H4] 类型校验
    if (!isValidConnection(conn)) {
      toast(t('toast.connectionRejected'), 'error');
      return;
    }
    set({ edges: addEdge({ ...conn, animated: true }, get().edges) });
    scheduleAutoSave();
  },

  addNode: (type, data = {}) => {
    const id = genId(type);
    const idx = get().nodes.length;
    const node: Node = { id, type, position: newPos(idx), data: { status: 'idle', ...data } };
    set({ nodes: [...get().nodes, node] });
    scheduleAutoSave();
  },

  // 在指定坐标创建节点(给 NodeCreator / Command Palette 用),返回新节点 id
  addNodeAt: (type, position, data = {}) => {
    const id = genId(type);
    const node: Node = { id, type, position, data: { status: 'idle', ...data } };
    set({ nodes: [...get().nodes, node] });
    scheduleAutoSave();
    return id;
  },

  // 创建节点并自动从 source 连线(给"拖连线到空白松开"用),返回新节点 id
  addNodeConnected: (type, position, sourceId, sourceHandle = 'out') => {
    const id = genId(type);
    const node: Node = { id, type, position, data: { status: 'idle' } };
    const edge: Edge = {
      id: genId('edge'),
      source: sourceId,
      target: id,
      sourceHandle,
      targetHandle: 'in',
      animated: true,
    };
    set({ nodes: [...get().nodes, node], edges: [...get().edges, edge] });
    scheduleAutoSave();
    return id;
  },

  updateNodeData: (id, patch) => {
    set({
      nodes: get().nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n)),
    });
    scheduleAutoSave();
  },

  // [C1] 运行节点:自动先跑完所有上游(拓扑序),再跑自己
  // [M3] 把执行体注册成 Promise 到 runningPromises,供下游 waitForPromise 直接 await
  // [H2] opts.silent=true 时,上游/自身失败都不弹 toast(避免联动场景多弹)
  runNode: (id, opts) => {
    // 取消该节点已有的运行
    cancelRun(id);

    const silent = !!opts?.silent;
    const p = (async () => {
      const { nodes, edges } = get();
      // 拓扑排序:拿到需要先跑的上游(不含自己)
      const upstream = getUpstreamNodes(nodes, edges, id);
      const self = nodes.find((n) => n.id === id);
      if (!self) return;

      // 按顺序跑上游里 status !== 'done' 的
      for (const up of upstream) {
        if (up.id === id) continue;
        const upData = up.data as { status?: string };
        if (upData.status === 'done') continue; // 已完成跳过
        if (upData.status === 'running') {
          // [M3] 直接 await 同一个 Promise,不再轮询 store
          const existing = runningPromises.get(up.id);
          if (existing) {
            await existing.catch(() => {}); // 上游失败不阻断,下游会自己报错
          }
          continue;
        }
        // [H2] 联动上游也用 silent,失败只在末端节点弹一次 toast
        await get().runNode(up.id, { silent: true }).catch(() => {});
      }

      // 跑自己
      await executeNode(id, { silent });
    })();

    runningPromises.set(id, p);
    return p.finally(() => runningPromises.delete(id));
  },

  // [C1] 视频类节点按 Agnes RPM 限制自动间隔(默认 65s/个),避免触发限流
  runAll: async () => {
    const { nodes, edges } = get();
    // 全图拓扑排序:反复取入度为0的
    const sorted = topologicalSort(nodes, edges);
    // 统计视频节点个数,只在 >1 个时才提示限流
    const videoCount = sorted.filter((n) => VIDEO_NODE_TYPES.has(n.type || '')).length;
    toast(t('toast.runningAll', { count: sorted.length }), 'info');
    if (videoCount > 1) {
      toast(t('toast.videoRateLimit', { interval: Math.round(VIDEO_MIN_INTERVAL_MS / 1000) }), 'info');
    }

    // 重置取消标志,开启本轮 runAll
    runAllAborted = false;
    let lastVideoStartedAt = 0;

    for (const n of sorted) {
      if (runAllAborted) break;
      const d = n.data as { status?: string };
      if (d.status === 'done') continue;

      // [C1] 视频节点限流:距离上一个视频节点开始不足间隔就 sleep 补足
      if (VIDEO_NODE_TYPES.has(n.type || '') && lastVideoStartedAt > 0) {
        const elapsed = Date.now() - lastVideoStartedAt;
        const wait = VIDEO_MIN_INTERVAL_MS - elapsed;
        if (wait > 0) {
          // 分片 sleep(每 200ms 检查一次取消),刷新页面自然中止
          const deadline = Date.now() + wait;
          while (Date.now() < deadline) {
            if (runAllAborted) break;
            await new Promise((r) => setTimeout(r, Math.min(200, deadline - Date.now())));
          }
        }
      }

      if (runAllAborted) break;
      if (VIDEO_NODE_TYPES.has(n.type || '')) lastVideoStartedAt = Date.now();
      await get().runNode(n.id);
    }
    if (!runAllAborted) toast(t('toast.allComplete'), 'success');
  },

  deleteNode: (id) => {
    // [C3] 取消该节点的运行
    cancelRun(id);
    const { nodes, edges } = get();
    set({
      nodes: nodes.filter((n) => n.id !== id),
      edges: edges.filter((e) => e.source !== id && e.target !== id),
    });
    scheduleAutoSave();
  },

  // 批量删除
  deleteNodes: (ids) => {
    const idSet = new Set(ids);
    for (const id of ids) cancelRun(id);
    const { nodes, edges } = get();
    set({
      nodes: nodes.filter((n) => !idSet.has(n.id)),
      edges: edges.filter((e) => !idSet.has(e.source) && !idSet.has(e.target)),
    });
    toast(t('toast.nodeDeleted', { count: ids.length }), 'info');
    scheduleAutoSave();
  },

  // 批量复制(偏移 40px,重新生成 id)
  duplicateNodes: (ids) => {
    const { nodes, edges } = get();
    const idSet = new Set(ids);
    const oldToNew = new Map<string, string>();
    const newNodes: Node[] = [];
    for (const n of nodes) {
      if (!idSet.has(n.id)) continue;
      const newId = genId(n.type || 'node');
      oldToNew.set(n.id, newId);
      newNodes.push({
        ...n,
        id: newId,
        position: { x: n.position.x + 40, y: n.position.y + 40 },
        data: { ...n.data, status: 'idle', error: undefined },
        selected: false,
      });
    }
    // 复制选中的内部连线
    const newEdges: Edge[] = [];
    for (const e of edges) {
      if (idSet.has(e.source) && idSet.has(e.target)) {
        newEdges.push({
          ...e,
          id: genId('edge'),
          source: oldToNew.get(e.source)!,
          target: oldToNew.get(e.target)!,
          selected: false,
        });
      }
    }
    set({ nodes: [...nodes, ...newNodes], edges: [...edges, ...newEdges] });
    scheduleAutoSave();
  },

  deleteEdge: (id) => {
    set({ edges: get().edges.filter((e) => e.id !== id) });
    scheduleAutoSave();
  },

  // ---------- 项目制 ----------

  createProject: async (name) => {
    // 切换前先清挂起的 autosave timer,防跨项目写入污染
    flushPendingSaveTimer();
    // 服务端创建项目,拿回 server 生成的 ID
    const { createProject: apiCreateProject } = await import('./db');
    const project = await apiCreateProject(name);
    set({
      currentProjectId: project.id,
      currentProjectName: name,
      nodes: [],
      edges: [],
      saveStatus: 'saved',
    });
    // [C1] 切换项目必须清空 undo 历史,否则 Ctrl+Z 会跨项目污染
    useFlowStore.temporal.getState().clear();
    return project.id;
  },

  loadProject: async (id) => {
    // 切换前先清挂起的 autosave timer
    flushPendingSaveTimer();
    const project = await getProject(id);
    if (!project) return false;
    // [M4] 加载项目时重置所有 running 状态为 idle
    // (视频生成中刷新页面后,轮询已断,节点不该卡在 running)
    const nodes = (project.nodes || []).map((n) => {
      const d = n.data as { status?: string };
      if (d.status === 'running') {
        return { ...n, data: { ...n.data, status: 'idle' as const } };
      }
      return n;
    });
    set({
      currentProjectId: id,
      currentProjectName: project.name,
      nodes,
      edges: project.edges || [],
      saveStatus: 'saved',
    });
    // [C1] 切换项目必须清空 undo 历史
    useFlowStore.temporal.getState().clear();
    return true;
  },

  persistCurrentProject: async () => {
    const { currentProjectId, currentProjectName, nodes, edges } = get();
    if (!currentProjectId) return;
    // 缩略图:取画布里第一张生成结果的 cachedUrl(图片优先,视频次之)
    const thumbnail = pickThumbnail(nodes);
    const project: Project = {
      id: currentProjectId,
      name: currentProjectName,
      nodes,
      edges,
      thumbnail,
      createdAt: new Date().toISOString(), // PUT 不用这个,但类型需要
      updatedAt: new Date().toISOString(),
    };
    try {
      await saveProject(project);
      set({ saveStatus: 'saved' });
    } catch {
      // API 调用失败:标记 error 态,UI 可显示"保存失败,请重试"
      set({ saveStatus: 'error' });
      throw new Error('persist failed');
    }
  },

  setSaveStatus: (s) => set({ saveStatus: s }),

  clearAll: () => {
    // [C3] 取消所有运行 + [C1] 取消 runAll
    get().cancelRunAll();
    set({ nodes: [], edges: [] });
    // [C1] 清空 undo 历史
    useFlowStore.temporal.getState().clear();
    scheduleAutoSave();
  },

  // 撤销/重做
  // [C3] 运行期间禁用:running 节点 promise 还在跑,回滚 nodes 会和 executeNode 的
  // updateNodeData 写入分叉,redo 时状态错乱
  undo: () => {
    if (runningControllers.size > 0) {
      toast(t('toast.undoBlockedWhileRunning'), 'info');
      return;
    }
    useFlowStore.temporal.getState().undo();
    scheduleAutoSave();
  },
  redo: () => {
    if (runningControllers.size > 0) {
      toast(t('toast.redoBlockedWhileRunning'), 'info');
      return;
    }
    useFlowStore.temporal.getState().redo();
    scheduleAutoSave();
  },

  // [H1] 真正取消节点运行:调内部 cancelRun 设置 cancelled 标志,abort pollVideo
  cancelNode: (id) => {
    cancelRun(id);
  },

  // [C1] 取消 runAll:设置标志,循环每次迭代 + sleep 分片都会检查
  cancelRunAll: () => {
    runAllAborted = true;
    // 同时取消所有正在跑的节点
    for (const id of [...runningControllers.keys()]) cancelRun(id);
  },

  // [MEDIUM] 断开节点所有连线(走 action 触发 autosave)
  disconnectNode: (id) => {
    set({ edges: get().edges.filter((e) => e.source !== id && e.target !== id) });
    scheduleAutoSave();
  },
}),
    {
      // [H2] 只剥离 running 期间的瞬态(progress),保留 done/error 等真实状态
      partialize: (state) => ({
        nodes: state.nodes.map((n) => {
          const d = n.data as { status?: string; progress?: number };
          if (d.status === 'running') {
            // running 期间不入栈(避免 pollVideo 进度变化污染历史)
            return { ...n, data: { ...n.data, status: 'idle', progress: undefined } };
          }
          return n;
        }),
        edges: state.edges,
      }),
      limit: 50,
      // [H3] 引用比较替代 JSON.stringify:applyNodeChanges/updateNodeData 都返回新数组
      // 只有 nodes/edges 引用变了才算新状态,避免每次按键全量序列化
      equality: (pastState, currentState) =>
        pastState.nodes === currentState.nodes && pastState.edges === currentState.edges,
    }
  )
);

// ---------- 执行单个节点(内部) ----------

async function executeNode(id: string, opts?: { silent?: boolean }): Promise<void> {
  const { nodes, edges, updateNodeData } = useFlowStore.getState();
  const target = nodes.find((n) => n.id === id);
  if (!target) return;
  const nodeType = target.type;
  const settings = useSettings.getState().settings;
  const silent = !!opts?.silent;

  // [C3] 注册取消控制器
  let cancelled = false;
  const cancel = () => { cancelled = true; };
  runningControllers.set(id, cancel);

  // 清理函数:无论正常/异常都移除控制器
  const cleanup = () => runningControllers.delete(id);

  updateNodeData(id, { status: 'running', error: undefined });
  try {
    if (cancelled) return;

    // 1. 文本节点
    if (nodeType === 'text') {
      const d = target.data as { text?: string; enhance?: boolean; targetType?: string };
      const text = d.text || '';
      if (!text) throw new Error(t('node.emptyText'));
      // 结构化扩写:按 targetType 选模板(auto 自动检测下游)
      if (d.enhance) {
        const targetType = resolveTargetType(d.targetType || 'auto', nodes, edges, id);
        const systemPrompt = buildEnhanceSystemPrompt(targetType);
        const expanded = await callText(text, systemPrompt);
        if (cancelled) return;
        updateNodeData(id, { text: expanded, status: 'done' });
        return;
      }
      updateNodeData(id, { status: 'done' });
      return;
    }

    // 2. 文生图 / 图生图
    if (nodeType === 'textToImage' || nodeType === 'imageToImage') {
      const upstream = collectUpstreamOutputs(nodes, edges, id);
      const d = target.data as { prompt?: string; size?: string };
      let prompt = d.prompt || '';
      if (!prompt && upstream.texts.length > 0) prompt = upstream.texts.join(' ');
      if (!prompt) throw new Error(t('error.missingPrompt'));

      const mode = nodeType === 'imageToImage' ? 'image-to-image' : 'text-to-image';

      // @引用解析:如果有 {@节点id} 标记,按引用顺序取特定上游图片;否则用全部上游图片
      let inputImages: string[] | undefined;
      if (nodeType === 'imageToImage') {
        const { resolvedPrompt, referencedImages } = resolveImageRefs(prompt, nodes, edges, id);
        prompt = resolvedPrompt;
        inputImages = referencedImages.length > 0 ? referencedImages : upstream.images;
        if (inputImages.length === 0) {
          throw new Error(t('error.imageToImageNoInput'));
        }
      }

      const size = d.size || settings.defaultImageSize;
      const result = await callImage(mode, prompt, size, inputImages);
      if (cancelled) return;
      const url = result.urls[0];
      if (!url) throw new Error(t('error.noImageUrl'));
      const cached = await cacheUrl(url, 'image', prompt);
      if (cancelled) return;
      updateNodeData(id, { resultUrl: url, cachedUrl: cached, status: 'done' });
      return;
    }

    // 3. 视频类节点
    if (['textToVideo', 'imageToVideo', 'multiImageVideo', 'keyframe'].includes(nodeType || '')) {
      const upstream = collectUpstreamOutputs(nodes, edges, id);
      const d = target.data as {
        prompt?: string; numFrames?: number; frameRate?: number;
        width?: number; height?: number;
      };
      let prompt = d.prompt || '';
      if (!prompt && upstream.texts.length > 0) prompt = upstream.texts.join(' ');
      if (!prompt) throw new Error(t('error.missingPrompt'));

      const common = {
        numFrames: d.numFrames ?? settings.defaultVideoFrames,
        frameRate: d.frameRate ?? settings.defaultVideoFps,
        width: d.width ?? settings.defaultVideoWidth,
        height: d.height ?? settings.defaultVideoHeight,
      };

      let createBody: Record<string, unknown>;
      if (nodeType === 'textToVideo') {
        // [M3] 清理可能残留的 {@xxx} 标记(UI 不允许 @图片,但用户可能手敲)
        prompt = prompt.replace(/\{@[\w_]+\}/g, '').trim();
        createBody = { mode: 'text', prompt, ...common };
      } else if (nodeType === 'imageToVideo') {
        // @引用:如果有 {@节点id},用引用的图;否则取第一张上游图
        const { resolvedPrompt, referencedImages } = resolveImageRefs(prompt, nodes, edges, id);
        prompt = resolvedPrompt;
        const img = referencedImages[0] || upstream.images[0];
        if (!img) throw new Error(t('error.imageToVideoNoInput'));
        createBody = { mode: 'image', prompt, imageUrl: img, ...common };
      } else {
        // multiImageVideo / keyframe:@引用解析
        const { resolvedPrompt, referencedImages } = resolveImageRefs(prompt, nodes, edges, id);
        prompt = resolvedPrompt;
        const imgs = referencedImages.length > 0 ? referencedImages : upstream.images;
        if (imgs.length === 0) throw new Error(t('error.multiImageNoInput'));
        createBody = {
          mode: nodeType === 'keyframe' ? 'keyframe' : 'multi',
          prompt,
          imageUrls: imgs,
          ...common,
        };
      }

      const created = await callVideoCreate(createBody);
      if (cancelled) return;
      const videoId = created.videoId || created.id;
      if (!videoId) throw new Error(t('error.videoCreateFailed'));
      updateNodeData(id, { videoId, progress: 0 });

      // [C3+M10] 轮询:指数退避 + 取消检查
      const result = await pollVideo(videoId, id, () => cancelled);
      if (cancelled) return;
      if (!result.url) throw new Error(t('error.videoNoUrl'));
      const cached = await cacheUrl(result.url, 'video', prompt);
      if (cancelled) return;
      updateNodeData(id, { resultUrl: result.url, cachedUrl: cached, status: 'done', progress: 100 });
      return;
    }

    // 4. 预览节点
    if (nodeType === 'imagePreview' || nodeType === 'videoPreview') {
      const upstream = collectUpstreamOutputs(nodes, edges, id);
      if (nodeType === 'imagePreview') {
        const url = upstream.images[0];
        if (!url) throw new Error(t('error.previewNoImage'));
        const cached = await cacheUrl(url, 'image');
        if (cancelled) return;
        updateNodeData(id, { imageUrl: url, cachedUrl: cached, status: 'done' });
      } else {
        const url = upstream.videos[0] || upstream.images[0];
        if (!url) throw new Error(t('error.videoPreviewNoInput'));
        const cached = await cacheUrl(url, 'video');
        if (cancelled) return;
        updateNodeData(id, { videoUrl: url, cachedUrl: cached, status: 'done' });
      }
      return;
    }

    updateNodeData(id, { status: 'done' });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    updateNodeData(id, { status: 'error', error: msg });
    // [H2/M8] silent 时不弹 toast(联动上游失败只在末端节点报一次)
    if (!silent) toast(msg, 'error');
  } finally {
    cleanup();
  }
}

// ---------- 辅助函数 ----------

// resolveTargetType 和 resolveImageRefs 已提取到 lib/prompt-resolve.ts(便于单测)

// 从画布节点里挑一个缩略图 URL(图片优先,视频次之,用于 Dashboard 卡片)
function pickThumbnail(nodes: Node[]): string | undefined {
  // 优先:图片类节点的 cachedUrl
  const imageTypes = new Set(['textToImage', 'imageToImage', 'imagePreview']);
  for (const n of nodes) {
    if (imageTypes.has(n.type || '')) {
      const d = n.data as { cachedUrl?: string };
      if (d.cachedUrl) return d.cachedUrl;
    }
  }
  // 次选:视频类节点的 cachedUrl
  const videoTypes = new Set(['textToVideo', 'imageToVideo', 'multiImageVideo', 'keyframe', 'videoPreview']);
  for (const n of nodes) {
    if (videoTypes.has(n.type || '')) {
      const d = n.data as { cachedUrl?: string };
      if (d.cachedUrl) return d.cachedUrl;
    }
  }
  return undefined;
}

// 取消某节点的运行
function cancelRun(id: string) {
  const c = runningControllers.get(id);
  if (c) {
    c();
    runningControllers.delete(id);
  }
}

// [C3+M10] 视频轮询:指数退避(2→4→8→封顶30秒)+ 取消检查
async function pollVideo(
  videoId: string,
  nodeId: string,
  isCancelled: () => boolean
): Promise<{ url?: string }> {
  const deadline = Date.now() + 900000; // 15 分钟
  let interval = 2000;
  const update = useFlowStore.getState().updateNodeData;

  while (Date.now() < deadline) {
    if (isCancelled()) throw new Error(t('toast.runCancelled'));
    await new Promise((r) => setTimeout(r, interval));
    if (isCancelled()) throw new Error(t('toast.runCancelled'));

    const st = await callVideoStatus(videoId);
    update(nodeId, { progress: typeof st.progress === 'number' ? st.progress : 0 });

    if (st.status === 'completed') return { url: st.url };
    if (st.status === 'failed') throw new Error(st.error || '视频生成失败');

    // 指数退避,封顶 30 秒
    interval = Math.min(interval * 1.5, 30000);
  }
  throw new Error(t('toast.videoTimeout'));
}

// 拓扑排序(给 runAll 用)
function topologicalSort(nodes: Node[], edges: Edge[]): Node[] {
  const indeg = new Map<string, number>();
  for (const n of nodes) indeg.set(n.id, 0);
  for (const e of edges) {
    if (indeg.has(e.target)) indeg.set(e.target, (indeg.get(e.target) ?? 0) + 1);
  }
  const queue = nodes.filter((n) => (indeg.get(n.id) ?? 0) === 0).map((n) => n.id);
  const result: string[] = [];
  const visited = new Set<string>();
  while (queue.length) {
    const id = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);
    result.push(id);
    for (const e of edges) {
      if (e.source === id && indeg.has(e.target)) {
        indeg.set(e.target, (indeg.get(e.target) ?? 0) - 1);
        if ((indeg.get(e.target) ?? 0) <= 0 && !visited.has(e.target)) queue.push(e.target);
      }
    }
  }
  // 处理孤立节点(没连线的)
  for (const n of nodes) if (!visited.has(n.id)) result.push(n.id);
  const map = new Map(nodes.map((n) => [n.id, n]));
  return result.map((id) => map.get(id)!).filter(Boolean);
}

export { getUpstreamNodes };
