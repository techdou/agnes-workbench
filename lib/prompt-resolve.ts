// Prompt 解析纯函数 —— 从 store.ts 提取,便于单元测试
// 包含:resolveMentions(解析 {@节点id} 引用,支持图片+文本)、collectAutoTexts(收集未被@引用的上游文本)、resolveTargetType(auto 检测下游类型)

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

// {@节点id} 引用标记的正则
const MENTION_RE = /\{@([\w_]+)\}/g;

/**
 * 收集上游 text 节点中**未被 rawPrompt 里的 {@id} 显式引用**的文本内容
 * 用于自动拼接:未被 @ 引用的上游文本会自动追加到 prompt 前
 *
 * @returns join(' ') 后的文本(可能为空字符串)
 */
export function collectAutoTexts(
  rawPrompt: string,
  nodes: Node[],
  edges: Edge[],
  targetId: string
): string {
  // 找出 rawPrompt 里所有 {@id} 显式引用的节点 id
  const referencedIds = new Set<string>();
  let m: RegExpExecArray | null;
  const re = new RegExp(MENTION_RE);
  while ((m = re.exec(rawPrompt)) !== null) {
    referencedIds.add(m[1]);
  }

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  // 收集符合条件的上游 text 节点(未被 @ 引用的),按 x 坐标从左到右排序
  const matched: { x: number; text: string }[] = [];
  for (const e of edges) {
    if (e.target !== targetId) continue;
    if (referencedIds.has(e.source)) continue; // 已被 @ 引用 → 跳过,避免重复
    const src = nodeMap.get(e.source);
    if (!src || src.type !== 'text') continue;
    const d = src.data as { text?: string };
    if (typeof d.text === 'string' && d.text) {
      matched.push({ x: src.position.x, text: d.text });
    }
  }
  matched.sort((a, b) => a.x - b.x);
  return matched.map((m) => m.text).join(' ');
}

/**
 * 解析 prompt 里的 {@节点id} 引用 —— 同时支持图片和文本节点
 *
 * - 图片节点(textToImage/imageToImage/imageInput/imagePreview 等):
 *   替换成 "the Nth reference image" 文字 + 收集 URL 到 referencedImages
 * - 文本节点(type='text'):
 *   替换成该节点的实际文本内容(d.text);无文本则清理成空
 * - 视频节点:跳过(防御性,即使白名单挡住了也做类型校验)
 *
 * 安全:只允许引用通过 edges 连线到当前节点的上游节点
 * 未解析的引用(无内容/未连线)清理成空,不残留 {@xxx} 进 API prompt
 * 重复引用同一图片节点时去重
 */
export function resolveMentions(
  prompt: string,
  nodes: Node[],
  edges: Edge[],
  nodeId: string
): { resolvedPrompt: string; referencedImages: string[] } {
  const upstreamIds = new Set(edges.filter((e) => e.target === nodeId).map((e) => e.source));
  const referencedImages: string[] = [];
  const seenUrls = new Set<string>();
  let imageIdx = 0;

  const resolvedPrompt = prompt.replace(MENTION_RE, (match, refId: string) => {
    if (!upstreamIds.has(refId)) return ''; // 未连线→清理

    const srcNode = nodes.find((n) => n.id === refId);
    if (!srcNode) return '';

    // [H1] 跳过视频节点(它们的 resultUrl 是视频,不能当参考图)
    if (VIDEO_NODE_TYPES.has(srcNode.type || '')) return '';

    // 文本节点:替换成实际文本内容
    if (srcNode.type === 'text') {
      const d = srcNode.data as { text?: string };
      return d.text || ''; // 无文本→清理
    }

    // 图片节点:替换成 "the Nth reference image" + 收集 URL
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
