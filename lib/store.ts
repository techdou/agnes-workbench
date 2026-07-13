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
import { getUpstreamNodes, collectUpstreamOutputs } from './workflow';
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

// 统一构建请求头:注入 settings 里的 API Key(可选覆盖 .env)
function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const apiKey = useSettings.getState().settings.apiKey;
  if (apiKey) headers['X-Agnes-Key'] = apiKey;
  return headers;
}

// 读 settings 里的模型名(透传给 API route,空值不传用服务端默认)
function modelParams(): Record<string, string> {
  const s = useSettings.getState().settings;
  const params: Record<string, string> = {};
  if (s.textModel) params.textModel = s.textModel;
  if (s.imageModel) params.imageModel = s.imageModel;
  if (s.videoModel) params.videoModel = s.videoModel;
  return params;
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
    throw new Error(err.error || `HTTP ${resp.status}`);
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
    throw new Error(err.error || `HTTP ${resp.status}`);
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
    throw new Error(err.error || `HTTP ${resp.status}`);
  }
  return resp.json();
}

async function callVideoStatus(id: string): Promise<{ status: string; progress?: number; url?: string; error?: string }> {
  const s = useSettings.getState().settings;
  const modelQ = s.videoModel ? `&videoModel=${encodeURIComponent(s.videoModel)}` : '';
  const resp = await fetch(`/api/agnes/video/status?id=${encodeURIComponent(id)}${modelQ}`, {
    headers: authHeaders(),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${resp.status}`);
  }
  return resp.json();
}

async function cacheUrl(url: string, type: 'image' | 'video', prompt?: string): Promise<string> {
  try {
    const resp = await fetch('/api/cache/item', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, type, prompt }),
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
    await useFlowStore.getState().persistCurrentProject();
  }, 1500);
}

// ---------- Store ----------

type SaveStatus = 'idle' | 'saving' | 'saved';

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
  runNode: (id: string) => Promise<void>;
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
  // 断开节点所有连线(给右键菜单用,走 action 才能触发 autosave)
  disconnectNode: (id: string) => void;
}

// [C3] 运行中的节点控制器:节点ID → 取消函数
const runningControllers = new Map<string, () => void>();
// [M3] 运行中的节点 Promise:节点ID → 正在执行的 Promise
const runningPromises = new Map<string, Promise<void>>();

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
  runNode: (id) => {
    // 取消该节点已有的运行
    cancelRun(id);

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
        await get().runNode(up.id).catch(() => {});
      }

      // 跑自己
      await executeNode(id);
    })();

    runningPromises.set(id, p);
    return p.finally(() => runningPromises.delete(id));
  },

  // [H9] Run All:按拓扑序跑所有节点
  runAll: async () => {
    const { nodes, edges } = get();
    // 全图拓扑排序:反复取入度为0的
    const sorted = topologicalSort(nodes, edges);
    toast(t('toast.runningAll', { count: sorted.length }), 'info');
    for (const n of sorted) {
      const d = n.data as { status?: string };
      if (d.status === 'done') continue;
      await get().runNode(n.id);
    }
    toast(t('toast.allComplete'), 'success');
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
    const id = genId('proj');
    const now = new Date().toISOString();
    const project: Project = {
      id,
      name,
      nodes: [],
      edges: [],
      createdAt: now,
      updatedAt: now,
    };
    await saveProject(project);
    set({
      currentProjectId: id,
      currentProjectName: name,
      nodes: [],
      edges: [],
      saveStatus: 'saved',
    });
    // [C1] 切换项目必须清空 undo 历史,否则 Ctrl+Z 会跨项目污染
    useFlowStore.temporal.getState().clear();
    return id;
  },

  loadProject: async (id) => {
    const project = await getProject(id);
    if (!project) return false;
    set({
      currentProjectId: id,
      currentProjectName: project.name,
      nodes: project.nodes || [],
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
    // 先读现有项目(保留 createdAt),再更新
    const existing = await getProject(currentProjectId);
    // 缩略图:取画布里第一张生成结果的 cachedUrl(图片优先,视频次之)
    // 不用 html-to-image 那种重依赖,用内容本身的缩略图更直观
    const thumbnail = pickThumbnail(nodes);
    const project: Project = {
      id: currentProjectId,
      name: currentProjectName,
      nodes,
      edges,
      thumbnail: thumbnail || existing?.thumbnail,
      createdAt: existing?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await saveProject(project);
    set({ saveStatus: 'saved' });
  },

  setSaveStatus: (s) => set({ saveStatus: s }),

  clearAll: () => {
    // [C3] 取消所有运行
    for (const id of [...runningControllers.keys()]) cancelRun(id);
    set({ nodes: [], edges: [] });
    // [C1] 清空 undo 历史
    useFlowStore.temporal.getState().clear();
    scheduleAutoSave();
  },

  // 撤销/重做
  undo: () => {
    useFlowStore.temporal.getState().undo();
    scheduleAutoSave();
  },
  redo: () => {
    useFlowStore.temporal.getState().redo();
    scheduleAutoSave();
  },

  // [H1] 真正取消节点运行:调内部 cancelRun 设置 cancelled 标志,abort pollVideo
  cancelNode: (id) => {
    cancelRun(id);
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

async function executeNode(id: string): Promise<void> {
  const { nodes, edges, updateNodeData } = useFlowStore.getState();
  const target = nodes.find((n) => n.id === id);
  if (!target) return;
  const nodeType = target.type;
  const settings = useSettings.getState().settings;

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
    toast(msg, 'error');
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
