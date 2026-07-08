// 工作流执行引擎 —— 拓扑排序 + 连线数据传递
// 给定 React Flow 的 nodes/edges,点击某节点运行时:
//   1. 找到所有上游节点
//   2. 按拓扑顺序执行
//   3. 上游输出传给下游

import type { Edge, Node } from '@xyflow/react';

// 从目标节点向上游回溯,返回所有需要先执行的节点(拓扑顺序)
export function getUpstreamNodes(
  nodes: Node[],
  edges: Edge[],
  targetId: string
): Node[] {
  // 构建 邻接表:nodeId -> 其上游 nodeId 列表
  const upstreamMap = new Map<string, string[]>();
  for (const e of edges) {
    const list = upstreamMap.get(e.target) ?? [];
    list.push(e.source);
    upstreamMap.set(e.target, list);
  }
  // 从 target 向上 BFS,收集所有依赖
  const visited = new Set<string>();
  const queue = [targetId];
  while (queue.length > 0) {
    const id = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);
    for (const upId of upstreamMap.get(id) ?? []) {
      if (!visited.has(upId)) queue.push(upId);
    }
  }
  // 拓扑排序:按入度顺序输出
  // 入度 = 该节点在 visited 子图里的上游边数
  const indeg = new Map<string, number>();
  for (const id of visited) indeg.set(id, 0);
  for (const e of edges) {
    if (visited.has(e.source) && visited.has(e.target)) {
      indeg.set(e.target, (indeg.get(e.target) ?? 0) + 1);
    }
  }
  const result: string[] = [];
  const q = [...visited].filter((id) => (indeg.get(id) ?? 0) === 0);
  while (q.length > 0) {
    const id = q.shift()!;
    result.push(id);
    for (const e of edges) {
      if (e.source === id && visited.has(e.target)) {
        indeg.set(e.target, (indeg.get(e.target) ?? 0) - 1);
        if (indeg.get(e.target) === 0) q.push(e.target);
      }
    }
  }
  if (result.length !== visited.size) {
    throw new Error('工作流存在环,无法拓扑排序');
  }
  // 把 targetId 移到末尾(确保它是最后一个)
  const ordered = result.filter((id) => id !== targetId);
  ordered.push(targetId);
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  return ordered.map((id) => nodeMap.get(id)!).filter(Boolean);
}

// 取某节点的直接上游输出,按 sourceHandle 聚合
// 返回 { texts: string[], images: string[] }
export function collectUpstreamOutputs(
  nodes: Node[],
  edges: Edge[],
  targetId: string
): { texts: string[]; images: string[]; videos: string[] } {
  const result = { texts: [] as string[], images: [] as string[], videos: [] as string[] };
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  // 视频类节点类型(其 resultUrl 是视频)
  const VIDEO_NODE_TYPES = new Set([
    'textToVideo', 'imageToVideo', 'multiImageVideo', 'keyframe', 'videoPreview',
  ]);
  for (const e of edges) {
    if (e.target !== targetId) continue;
    const src = nodeMap.get(e.source);
    if (!src) continue;
    const d = src.data as Record<string, unknown> | undefined;
    if (!d) continue;
    const isVideoNode = VIDEO_NODE_TYPES.has(src.type || '');
    // 文本节点输出
    if (typeof d.text === 'string' && d.text) result.texts.push(d.text);
    // resultUrl 根据节点类型分到 images 或 videos
    if (typeof d.resultUrl === 'string' && d.resultUrl) {
      if (isVideoNode) result.videos.push(d.resultUrl);
      else result.images.push(d.resultUrl);
    }
    // 图片专属字段
    if (typeof d.imageUrl === 'string' && d.imageUrl) result.images.push(d.imageUrl);
    if (typeof d.videoUrl === 'string' && d.videoUrl) result.videos.push(d.videoUrl);
  }
  return result;
}
