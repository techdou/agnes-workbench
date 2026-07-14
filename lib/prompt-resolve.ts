// Prompt 解析纯函数 —— 从 store.ts 提取,便于单元测试
// 包含:resolveImageRefs(解析 {@节点id} 引用)、resolveTargetType(auto 检测下游类型)

import type { Edge, Node } from '@xyflow/react';
import { toast } from './useToast';

/**
 * 解析文本节点的扩写目标类型
 * auto 模式:查 edges 找下游节点类型
 */
export function resolveTargetType(
  target: string,
  nodes: Node[],
  edges: Edge[],
  nodeId: string
): string {
  if (target !== 'auto') return target;
  const downstreamIds = edges.filter((e) => e.source === nodeId).map((e) => e.target);
  const downstreamTypes = new Set<string>();
  for (const did of downstreamIds) {
    const dn = nodes.find((n) => n.id === did);
    if (dn?.type) downstreamTypes.add(dn.type);
  }
  if (downstreamTypes.size > 1) {
    toast('检测到多个下游类型,已用第一个。建议手动指定扩写目标', 'info');
  }
  for (const did of downstreamIds) {
    const dn = nodes.find((n) => n.id === did);
    if (dn?.type) return dn.type;
  }
  return 'auto';
}

// [H1] 视频类节点类型——@引用时跳过(它们的 resultUrl 是视频不是图片)
const VIDEO_NODE_TYPES = new Set([
  'textToVideo', 'imageToVideo', 'multiImageVideo', 'keyframe', 'videoPreview',
]);

/**
 * 解析 prompt 里的 {@节点id} 引用
 * 安全:只允许引用通过 edges 连线到当前节点的上游节点
 * 未解析的引用(无图/未连线)清理成空,不残留 {@xxx} 进 API prompt
 * 重复引用同一节点时去重
 * [H1] 跳过视频节点(防御性,即使白名单挡住了也做类型校验)
 */
export function resolveImageRefs(
  prompt: string,
  nodes: Node[],
  edges: Edge[],
  nodeId: string
): { resolvedPrompt: string; referencedImages: string[] } {
  const upstreamIds = new Set(edges.filter((e) => e.target === nodeId).map((e) => e.source));
  const referencedImages: string[] = [];
  const seenUrls = new Set<string>();
  let imageIdx = 0;

  const resolvedPrompt = prompt.replace(/\{@([\w_]+)\}/g, (match, refId: string) => {
    if (!upstreamIds.has(refId)) return ''; // 未连线→清理

    const srcNode = nodes.find((n) => n.id === refId);
    if (!srcNode) return '';

    // [H1] 跳过视频节点(它们的 resultUrl 是视频,不能当参考图)
    if (VIDEO_NODE_TYPES.has(srcNode.type || '')) return '';

    const d = srcNode.data as { resultUrl?: string; imageUrl?: string; cachedUrl?: string };
    const imgUrl = d.resultUrl || d.imageUrl || d.cachedUrl;
    if (!imgUrl) return ''; // 无图→清理

    if (seenUrls.has(imgUrl)) {
      const firstIdx = referencedImages.indexOf(imgUrl) + 1;
      return `the ${ordinal(firstIdx)} reference image`;
    }
    seenUrls.add(imgUrl);
    referencedImages.push(imgUrl);
    imageIdx++;
    return `the ${ordinal(imageIdx)} reference image`;
  });

  return { resolvedPrompt, referencedImages };
}

function ordinal(n: number): string {
  const words = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth'];
  return words[n - 1] || `${n}th`;
}
