import { describe, it, expect } from 'vitest';
import { getUpstreamNodes, collectUpstreamOutputs } from '../workflow';
import type { Node, Edge } from '@xyflow/react';

// ---------- 辅助 ----------
function makeNode(id: string, type: string, data: Record<string, unknown> = {}): Node {
  return { id, type, position: { x: 0, y: 0 }, data: { status: 'idle', ...data } };
}

function makeEdge(source: string, target: string): Edge {
  return { id: `e_${source}_${target}`, source, target };
}

// ---------- getUpstreamNodes ----------

describe('getUpstreamNodes', () => {
  it('线性链路:A→B→C,目标 C 返回 [A, B, C]', () => {
    const nodes = [makeNode('a', 'text'), makeNode('b', 'textToImage'), makeNode('c', 'imagePreview')];
    const edges = [makeEdge('a', 'b'), makeEdge('b', 'c')];
    const result = getUpstreamNodes(nodes, edges, 'c');
    expect(result.map((n) => n.id)).toEqual(['a', 'b', 'c']);
  });

  it('目标节点在末尾', () => {
    const nodes = [makeNode('a', 'text'), makeNode('b', 'textToImage')];
    const edges = [makeEdge('a', 'b')];
    const result = getUpstreamNodes(nodes, edges, 'b');
    expect(result[result.length - 1].id).toBe('b');
  });

  it('菱形依赖:A→B, A→C, B→D, C→D', () => {
    const nodes = [
      makeNode('a', 'text'),
      makeNode('b', 'textToImage'),
      makeNode('c', 'imageToImage'),
      makeNode('d', 'imagePreview'),
    ];
    const edges = [makeEdge('a', 'b'), makeEdge('a', 'c'), makeEdge('b', 'd'), makeEdge('c', 'd')];
    const result = getUpstreamNodes(nodes, edges, 'd');
    const ids = result.map((n) => n.id);
    expect(ids).toContain('a');
    expect(ids).toContain('b');
    expect(ids).toContain('c');
    expect(ids).toContain('d');
    expect(ids[ids.length - 1]).toBe('d');
    // A 应该在 B 和 C 之前
    expect(ids.indexOf('a')).toBeLessThan(ids.indexOf('b'));
    expect(ids.indexOf('a')).toBeLessThan(ids.indexOf('c'));
  });

  it('孤立节点(无连线)只返回自己', () => {
    const nodes = [makeNode('a', 'text')];
    const edges: Edge[] = [];
    const result = getUpstreamNodes(nodes, edges, 'a');
    expect(result.map((n) => n.id)).toEqual(['a']);
  });

  it('检测环并抛错', () => {
    const nodes = [makeNode('a', 'text'), makeNode('b', 'text')];
    const edges = [makeEdge('a', 'b'), makeEdge('b', 'a')];
    expect(() => getUpstreamNodes(nodes, edges, 'a')).toThrow();
  });
});

// ---------- collectUpstreamOutputs ----------

describe('collectUpstreamOutputs', () => {
  it('收集文本节点的 text 字段', () => {
    const nodes = [
      makeNode('a', 'text', { text: 'hello world' }),
      makeNode('b', 'textToImage'),
    ];
    const edges = [makeEdge('a', 'b')];
    const result = collectUpstreamOutputs(nodes, edges, 'b');
    expect(result.texts).toEqual(['hello world']);
  });

  it('收集图片节点的 resultUrl 到 images', () => {
    const nodes = [
      makeNode('a', 'textToImage', { resultUrl: 'https://example.com/img.png' }),
      makeNode('b', 'imagePreview'),
    ];
    const edges = [makeEdge('a', 'b')];
    const result = collectUpstreamOutputs(nodes, edges, 'b');
    expect(result.images).toContain('https://example.com/img.png');
  });

  it('视频节点的 resultUrl 分到 videos 不是 images', () => {
    const nodes = [
      makeNode('a', 'textToVideo', { resultUrl: 'https://example.com/vid.mp4' }),
      makeNode('b', 'videoPreview'),
    ];
    const edges = [makeEdge('a', 'b')];
    const result = collectUpstreamOutputs(nodes, edges, 'b');
    expect(result.videos).toContain('https://example.com/vid.mp4');
    expect(result.images).not.toContain('https://example.com/vid.mp4');
  });

  it('上传节点的 imageUrl 收集到 images', () => {
    const nodes = [
      makeNode('up', 'imageInput', { imageUrl: '/api/cache/abc123' }),
      makeNode('i2i', 'imageToImage'),
    ];
    const edges = [makeEdge('up', 'i2i')];
    const result = collectUpstreamOutputs(nodes, edges, 'i2i');
    expect(result.images).toContain('/api/cache/abc123');
  });

  it('多上游合并', () => {
    const nodes = [
      makeNode('t', 'text', { text: 'prompt' }),
      makeNode('img1', 'textToImage', { resultUrl: 'https://a.com/1.png' }),
      makeNode('img2', 'imageInput', { imageUrl: '/api/cache/up.png' }),
      makeNode('target', 'imageToImage'),
    ];
    const edges = [makeEdge('t', 'target'), makeEdge('img1', 'target'), makeEdge('img2', 'target')];
    const result = collectUpstreamOutputs(nodes, edges, 'target');
    expect(result.texts).toEqual(['prompt']);
    expect(result.images).toHaveLength(2);
  });
});
