'use client';

// 全局画布状态 + 节点执行引擎
// 支持:上游自动拓扑执行、轮询取消、指数退避、连线类型校验
import { create } from 'zustand';
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

// ---------- API 调用封装 ----------

async function callImage(
  mode: 'text-to-image' | 'image-to-image',
  prompt: string,
  size: string,
  inputImageUrl?: string
): Promise<{ urls: string[] }> {
  const resp = await fetch('/api/agnes/image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode, prompt, size, inputImageUrl }),
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
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, system, temperature: 0.7 }),
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
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${resp.status}`);
  }
  return resp.json();
}

async function callVideoStatus(id: string): Promise<{ status: string; progress?: number; url?: string; error?: string }> {
  const resp = await fetch(`/api/agnes/video/status?id=${encodeURIComponent(id)}`);
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

let idCounter = 0;
export function genId(prefix: string): string {
  idCounter += 1;
  return `${prefix}_${Date.now().toString(36)}_${idCounter}`;
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
  imageToImage: new Set(['text', 'textToImage', 'imagePreview', 'imageToImage']),
  textToVideo: new Set(['text']),
  imageToVideo: new Set(['text', 'textToImage', 'imageToImage', 'imagePreview']),
  multiImageVideo: new Set(['text', 'textToImage', 'imageToImage', 'imagePreview']),
  keyframe: new Set(['text', 'textToImage', 'imageToImage', 'imagePreview']),
  imagePreview: new Set(['textToImage', 'imageToImage', 'imagePreview']),
  videoPreview: new Set(['textToVideo', 'imageToVideo', 'multiImageVideo', 'keyframe']),
};

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

// ---------- Store ----------

interface FlowState {
  nodes: Node[];
  edges: Edge[];
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  addNode: (type: string, data?: Record<string, unknown>) => void;
  updateNodeData: (id: string, patch: Record<string, unknown>) => void;
  runNode: (id: string) => Promise<void>;
  runAll: () => Promise<void>;
  deleteNode: (id: string) => void;
  deleteEdge: (id: string) => void;
  saveWorkflow: () => string;
  loadWorkflow: () => string | null;
  hasSavedWorkflow: () => boolean;
  clearAll: () => void;
}

// [C3] 运行中的节点控制器:节点ID → 取消函数
const runningControllers = new Map<string, () => void>();

export const useFlowStore = create<FlowState>((set, get) => ({
  nodes: [],
  edges: [],

  onNodesChange: (changes: NodeChange[]) => {
    set({ nodes: applyNodeChanges(changes, get().nodes) });
  },
  onEdgesChange: (changes: EdgeChange[]) => {
    set({ edges: applyEdgeChanges(changes, get().edges) });
  },
  onConnect: (conn: Connection) => {
    // [H4] 类型校验
    if (!isValidConnection(conn)) {
      toast('该类型的节点不能连接(类型不匹配)', 'error');
      return;
    }
    set({ edges: addEdge({ ...conn, animated: true }, get().edges) });
  },

  addNode: (type, data = {}) => {
    const id = genId(type);
    const idx = get().nodes.length;
    const node: Node = { id, type, position: newPos(idx), data: { status: 'idle', ...data } };
    set({ nodes: [...get().nodes, node] });
  },

  updateNodeData: (id, patch) => {
    set({
      nodes: get().nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n)),
    });
  },

  // [C1] 运行节点:自动先跑完所有上游(拓扑序),再跑自己
  runNode: async (id) => {
    const { nodes, edges } = get();
    // 取消该节点已有的运行
    cancelRun(id);

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
        // 等它跑完(简单轮询 store)
        await waitForDone(up.id);
        continue;
      }
      await get().runNode(up.id);
    }

    // 跑自己
    await executeNode(id);
  },

  // [H9] Run All:按拓扑序跑所有节点
  runAll: async () => {
    const { nodes, edges } = get();
    // 全图拓扑排序:反复取入度为0的
    const sorted = topologicalSort(nodes, edges);
    toast(`开始执行 ${sorted.length} 个节点`, 'info');
    for (const n of sorted) {
      const d = n.data as { status?: string };
      if (d.status === 'done') continue;
      await get().runNode(n.id);
    }
    toast('全部执行完成', 'success');
  },

  deleteNode: (id) => {
    // [C3] 取消该节点的运行
    cancelRun(id);
    const { nodes, edges } = get();
    set({
      nodes: nodes.filter((n) => n.id !== id),
      edges: edges.filter((e) => e.source !== id && e.target !== id),
    });
  },

  deleteEdge: (id) => {
    set({ edges: get().edges.filter((e) => e.id !== id) });
  },

  saveWorkflow: () => {
    const { nodes, edges } = get();
    const data = {
      nodes: nodes.map((n) => {
        // 剔除不可序列化的字段
        const d = { ...n.data } as Record<string, unknown>;
        delete d.onRun;
        delete d.onUpdate;
        return { ...n, data: d };
      }),
      edges,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem('phosphor-workflow', JSON.stringify(data));
    return data.savedAt;
  },

  loadWorkflow: () => {
    try {
      const raw = localStorage.getItem('phosphor-workflow');
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (Array.isArray(data.nodes) && Array.isArray(data.edges)) {
        set({ nodes: data.nodes, edges: data.edges });
        return data.savedAt || null;
      }
    } catch {
      /* 忽略 */
    }
    return null;
  },

  hasSavedWorkflow: () => {
    if (typeof window === 'undefined') return false;
    return !!localStorage.getItem('phosphor-workflow');
  },

  clearAll: () => {
    // [C3] 取消所有运行
    for (const id of [...runningControllers.keys()]) cancelRun(id);
    set({ nodes: [], edges: [] });
  },
}));

// ---------- 执行单个节点(内部) ----------

async function executeNode(id: string): Promise<void> {
  const { nodes, edges, updateNodeData } = useFlowStore.getState();
  const target = nodes.find((n) => n.id === id);
  if (!target) return;
  const nodeType = target.type;

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
      const d = target.data as { text?: string; enhance?: boolean };
      const text = d.text || '';
      if (!text) throw new Error('文本节点内容为空');
      // [C2] 扩写失败要报错,不再静默成功
      if (d.enhance) {
        const expanded = await callText(
          `Expand this image/video generation idea into a detailed English prompt with subject, scene, style, lighting, composition. Return only the prompt.\n\nIdea: ${text}`
        );
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
      if (!prompt) throw new Error('缺少 prompt(请填写或连接文本节点)');

      const mode = nodeType === 'imageToImage' ? 'image-to-image' : 'text-to-image';
      const inputImage = nodeType === 'imageToImage' ? upstream.images[0] : undefined;
      if (nodeType === 'imageToImage' && !inputImage) throw new Error('图生图需要上游连接一张图片');

      const result = await callImage(mode, prompt, d.size || '1024x768', inputImage);
      if (cancelled) return;
      const url = result.urls[0];
      if (!url) throw new Error('未返回图片 URL');
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
      if (!prompt) throw new Error('缺少 prompt(请填写或连接文本节点)');

      const common = {
        numFrames: d.numFrames ?? 121,
        frameRate: d.frameRate ?? 24,
        width: d.width,
        height: d.height,
      };

      let createBody: Record<string, unknown>;
      if (nodeType === 'textToVideo') {
        createBody = { mode: 'text', prompt, ...common };
      } else if (nodeType === 'imageToVideo') {
        const img = upstream.images[0];
        if (!img) throw new Error('图生视频需要上游连接一张图片');
        createBody = { mode: 'image', prompt, imageUrl: img, ...common };
      } else {
        if (upstream.images.length === 0) throw new Error('需要上游连接图片(至少一张)');
        createBody = {
          mode: nodeType === 'keyframe' ? 'keyframe' : 'multi',
          prompt,
          imageUrls: upstream.images,
          ...common,
        };
      }

      const created = await callVideoCreate(createBody);
      if (cancelled) return;
      const videoId = created.videoId || created.id;
      if (!videoId) throw new Error('创建视频任务失败:未返回 id');
      updateNodeData(id, { videoId, progress: 0 });

      // [C3+M10] 轮询:指数退避 + 取消检查
      const result = await pollVideo(videoId, id, () => cancelled);
      if (cancelled) return;
      if (!result.url) throw new Error('视频完成但未返回 URL');
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
        if (!url) throw new Error('预览节点需要上游连接图片');
        const cached = await cacheUrl(url, 'image');
        if (cancelled) return;
        updateNodeData(id, { imageUrl: url, cachedUrl: cached, status: 'done' });
      } else {
        const url = upstream.videos[0] || upstream.images[0];
        if (!url) throw new Error('视频预览需要上游连接视频生成节点');
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

// 取消某节点的运行
function cancelRun(id: string) {
  const c = runningControllers.get(id);
  if (c) {
    c();
    runningControllers.delete(id);
  }
}

// 等待某节点变成 done/error(给上游正在 running 时用)
function waitForDone(id: string): Promise<void> {
  return new Promise((resolve) => {
    const check = () => {
      const n = useFlowStore.getState().nodes.find((x) => x.id === id);
      const s = (n?.data as { status?: string })?.status;
      if (s === 'done' || s === 'error') resolve();
      else setTimeout(check, 500);
    };
    check();
  });
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
    if (isCancelled()) throw new Error('运行已取消');
    await new Promise((r) => setTimeout(r, interval));
    if (isCancelled()) throw new Error('运行已取消');

    const st = await callVideoStatus(videoId);
    update(nodeId, { progress: typeof st.progress === 'number' ? st.progress : 0 });

    if (st.status === 'completed') return { url: st.url };
    if (st.status === 'failed') throw new Error(st.error || '视频生成失败');

    // 指数退避,封顶 30 秒
    interval = Math.min(interval * 1.5, 30000);
  }
  throw new Error('视频生成超时');
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
