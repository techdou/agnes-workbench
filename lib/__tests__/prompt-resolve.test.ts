import { describe, it, expect } from 'vitest';
import { resolveImageRefs, resolveTargetType } from '../prompt-resolve';
import type { Node, Edge } from '@xyflow/react';

// ---------- 辅助 ----------
function makeNode(id: string, type: string, data: Record<string, unknown> = {}): Node {
  return { id, type, position: { x: 0, y: 0 }, data: { status: 'idle', ...data } };
}
function makeEdge(source: string, target: string): Edge {
  return { id: `e_${source}_${target}`, source, target };
}

// ---------- resolveImageRefs ----------

describe('resolveImageRefs', () => {
  it('无引用时 prompt 原样返回,images 为空', () => {
    const nodes = [makeNode('a', 'text'), makeNode('b', 'imageToImage')];
    const edges = [makeEdge('a', 'b')];
    const result = resolveImageRefs('no refs here', nodes, edges, 'b');
    expect(result.resolvedPrompt).toBe('no refs here');
    expect(result.referencedImages).toEqual([]);
  });

  it('引用已连线且有图的上游节点 → 替换成自然语言 + 收集 URL', () => {
    const nodes = [
      makeNode('img1', 'textToImage', { resultUrl: 'https://a.com/1.png' }),
      makeNode('target', 'imageToImage'),
    ];
    const edges = [makeEdge('img1', 'target')];
    const result = resolveImageRefs('edit {@img1} please', nodes, edges, 'target');
    expect(result.resolvedPrompt).toBe('edit the first reference image please');
    expect(result.referencedImages).toEqual(['https://a.com/1.png']);
  });

  it('安全:引用未连线的节点 → 清理成空(不残留 {@xxx})', () => {
    const nodes = [
      makeNode('img1', 'textToImage', { resultUrl: 'https://a.com/1.png' }),
      makeNode('stranger', 'textToImage', { resultUrl: 'https://b.com/2.png' }),
      makeNode('target', 'imageToImage'),
    ];
    const edges = [makeEdge('img1', 'target')]; // stranger 没连线
    const result = resolveImageRefs('edit {@stranger}', nodes, edges, 'target');
    expect(result.resolvedPrompt).toBe('edit '); // {@stranger} 被清理
    expect(result.referencedImages).toEqual([]);
  });

  it('引用已连线但无图的节点(未运行) → 清理成空', () => {
    const nodes = [
      makeNode('img1', 'textToImage'), // 没有 resultUrl
      makeNode('target', 'imageToImage'),
    ];
    const edges = [makeEdge('img1', 'target')];
    const result = resolveImageRefs('edit {@img1}', nodes, edges, 'target');
    expect(result.resolvedPrompt).toBe('edit ');
    expect(result.referencedImages).toEqual([]);
  });

  it('多图引用按顺序编号', () => {
    const nodes = [
      makeNode('a', 'textToImage', { resultUrl: 'https://a.com/1.png' }),
      makeNode('b', 'imageInput', { imageUrl: 'https://b.com/2.png' }),
      makeNode('target', 'imageToImage'),
    ];
    const edges = [makeEdge('a', 'target'), makeEdge('b', 'target')];
    const result = resolveImageRefs('{@a} + {@b}', nodes, edges, 'target');
    expect(result.resolvedPrompt).toBe('the first reference image + the second reference image');
    expect(result.referencedImages).toEqual(['https://a.com/1.png', 'https://b.com/2.png']);
  });

  it('重复引用同一节点 → 去重,引用序号复用', () => {
    const nodes = [
      makeNode('a', 'textToImage', { resultUrl: 'https://a.com/1.png' }),
      makeNode('target', 'imageToImage'),
    ];
    const edges = [makeEdge('a', 'target')];
    const result = resolveImageRefs('{@a} then {@a}', nodes, edges, 'target');
    expect(result.resolvedPrompt).toBe('the first reference image then the first reference image');
    expect(result.referencedImages).toEqual(['https://a.com/1.png']); // 只一张
  });

  it('优先取 resultUrl,fallback imageUrl,再 fallback cachedUrl', () => {
    const nodes = [
      makeNode('a', 'imageInput', { imageUrl: '/api/cache/upload.png' }),
      makeNode('b', 'imagePreview', { cachedUrl: '/api/cache/prev.png' }),
      makeNode('target', 'imageToImage'),
    ];
    const edges = [makeEdge('a', 'target'), makeEdge('b', 'target')];
    const result = resolveImageRefs('{@a} {@b}', nodes, edges, 'target');
    expect(result.referencedImages).toEqual(['/api/cache/upload.png', '/api/cache/prev.png']);
  });

  it('非法 id 格式(含大括号)不匹配', () => {
    const nodes = [makeNode('a', 'textToImage', { resultUrl: 'https://a.com/1.png' })];
    const result = resolveImageRefs('{@a{b}}', nodes, [], 'target');
    // 正则只匹配 [\w_]+,a{b} 不匹配
    expect(result.resolvedPrompt).toBe('{@a{b}}');
    expect(result.referencedImages).toEqual([]);
  });
});

// ---------- resolveTargetType ----------

describe('resolveTargetType', () => {
  it('显式 target 直接返回,不查 edges', () => {
    expect(resolveTargetType('textToImage', [], [], 'x')).toBe('textToImage');
    expect(resolveTargetType('imageToImage', [], [], 'x')).toBe('imageToImage');
  });

  it('auto 模式:查下游第一个节点类型', () => {
    const nodes = [
      makeNode('text1', 'text'),
      makeNode('t2i', 'textToImage'),
    ];
    const edges = [makeEdge('text1', 't2i')];
    expect(resolveTargetType('auto', nodes, edges, 'text1')).toBe('textToImage');
  });

  it('auto 模式:无下游返回 auto', () => {
    const nodes = [makeNode('text1', 'text')];
    expect(resolveTargetType('auto', nodes, [], 'text1')).toBe('auto');
  });

  it('auto 模式:下游有视频节点 → 返回 video 类型', () => {
    const nodes = [
      makeNode('text1', 'text'),
      makeNode('t2v', 'textToVideo'),
    ];
    const edges = [makeEdge('text1', 't2v')];
    expect(resolveTargetType('auto', nodes, edges, 'text1')).toBe('textToVideo');
  });
});
