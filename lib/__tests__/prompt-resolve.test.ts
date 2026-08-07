import { describe, it, expect } from 'vitest';
import { resolveMentions, resolveTargetType, collectAutoTexts } from '../prompt-resolve';
import type { Node, Edge } from '@xyflow/react';

// ---------- 辅助 ----------
function makeNode(id: string, type: string, data: Record<string, unknown> = {}, x = 0): Node {
  return { id, type, position: { x, y: 0 }, data: { status: 'idle', ...data } };
}
function makeEdge(source: string, target: string): Edge {
  return { id: `e_${source}_${target}`, source, target };
}

// ---------- resolveMentions(原 resolveImageRefs) ----------

describe('resolveMentions', () => {
  it('无引用时 prompt 原样返回,images 为空', () => {
    const nodes = [makeNode('a', 'text'), makeNode('b', 'imageToImage')];
    const edges = [makeEdge('a', 'b')];
    const result = resolveMentions('no refs here', nodes, edges, 'b');
    expect(result.resolvedPrompt).toBe('no refs here');
    expect(result.referencedImages).toEqual([]);
  });

  it('引用已连线且有图的上游节点 → 替换成自然语言 + 收集 URL', () => {
    const nodes = [
      makeNode('img1', 'textToImage', { resultUrl: 'https://a.com/1.png' }),
      makeNode('target', 'imageToImage'),
    ];
    const edges = [makeEdge('img1', 'target')];
    const result = resolveMentions('edit {@img1} please', nodes, edges, 'target');
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
    const result = resolveMentions('edit {@stranger}', nodes, edges, 'target');
    expect(result.resolvedPrompt).toBe('edit '); // {@stranger} 被清理
    expect(result.referencedImages).toEqual([]);
  });

  it('引用已连线但无图的节点(未运行) → 清理成空', () => {
    const nodes = [
      makeNode('img1', 'textToImage'), // 没有 resultUrl
      makeNode('target', 'imageToImage'),
    ];
    const edges = [makeEdge('img1', 'target')];
    const result = resolveMentions('edit {@img1}', nodes, edges, 'target');
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
    const result = resolveMentions('{@a} + {@b}', nodes, edges, 'target');
    expect(result.resolvedPrompt).toBe('the first reference image + the second reference image');
    expect(result.referencedImages).toEqual(['https://a.com/1.png', 'https://b.com/2.png']);
  });

  it('重复引用同一图片节点 → 去重,引用序号复用', () => {
    const nodes = [
      makeNode('a', 'textToImage', { resultUrl: 'https://a.com/1.png' }),
      makeNode('target', 'imageToImage'),
    ];
    const edges = [makeEdge('a', 'target')];
    const result = resolveMentions('{@a} then {@a}', nodes, edges, 'target');
    expect(result.resolvedPrompt).toBe('the first reference image then the first reference image');
    expect(result.referencedImages).toEqual(['https://a.com/1.png']); // 只一张
  });

  it('图片节点优先取 resultUrl,fallback imageUrl,再 fallback cachedUrl', () => {
    const nodes = [
      makeNode('a', 'imageInput', { imageUrl: '/api/cache/upload.png' }),
      makeNode('b', 'imagePreview', { cachedUrl: '/api/cache/prev.png' }),
      makeNode('target', 'imageToImage'),
    ];
    const edges = [makeEdge('a', 'target'), makeEdge('b', 'target')];
    const result = resolveMentions('{@a} {@b}', nodes, edges, 'target');
    expect(result.referencedImages).toEqual(['/api/cache/upload.png', '/api/cache/prev.png']);
  });

  it('非法 id 格式(含大括号)不匹配', () => {
    const nodes = [makeNode('a', 'textToImage', { resultUrl: 'https://a.com/1.png' })];
    const result = resolveMentions('{@a{b}}', nodes, [], 'target');
    // 正则只匹配 [\w_]+,a{b} 不匹配
    expect(result.resolvedPrompt).toBe('{@a{b}}');
    expect(result.referencedImages).toEqual([]);
  });

  // ---------- 新增:文本节点 @ 引用 ----------

  it('引用已连线的文本节点 → 替换成实际文本内容', () => {
    const nodes = [
      makeNode('t1', 'text', { text: '一只猫在阳光下' }),
      makeNode('target', 'textToVideo'),
    ];
    const edges = [makeEdge('t1', 'target')];
    const result = resolveMentions('生成 {@t1} 的视频', nodes, edges, 'target');
    expect(result.resolvedPrompt).toBe('生成 一只猫在阳光下 的视频');
    expect(result.referencedImages).toEqual([]); // 文本引用不收集图片
  });

  it('引用文本节点但无文本内容 → 清理成空', () => {
    const nodes = [
      makeNode('t1', 'text'), // 空 text
      makeNode('target', 'textToVideo'),
    ];
    const edges = [makeEdge('t1', 'target')];
    const result = resolveMentions('{@t1} 视频', nodes, edges, 'target');
    expect(result.resolvedPrompt).toBe(' 视频');
    expect(result.referencedImages).toEqual([]);
  });

  it('同时引用文本和图片节点 → 文本替换 + 图片收集', () => {
    const nodes = [
      makeNode('t1', 'text', { text: '缓慢推近' }),
      makeNode('img1', 'textToImage', { resultUrl: 'https://a.com/1.png' }),
      makeNode('target', 'imageToVideo'),
    ];
    const edges = [makeEdge('t1', 'target'), makeEdge('img1', 'target')];
    const result = resolveMentions('{@t1} {@img1}', nodes, edges, 'target');
    expect(result.resolvedPrompt).toBe('缓慢推近 the first reference image');
    expect(result.referencedImages).toEqual(['https://a.com/1.png']);
  });

  it('视频节点 @ 引用被跳过(防御性)', () => {
    const nodes = [
      makeNode('v1', 'textToVideo', { resultUrl: 'https://a.com/v1.mp4' }),
      makeNode('target', 'imageToVideo'),
    ];
    const edges = [makeEdge('v1', 'target')];
    const result = resolveMentions('{@v1}', nodes, edges, 'target');
    expect(result.resolvedPrompt).toBe(''); // 视频节点被跳过 → 清空
    expect(result.referencedImages).toEqual([]);
  });
});

// ---------- collectAutoTexts(新增) ----------

describe('collectAutoTexts', () => {
  it('rawPrompt 无 @ 引用 → 收集所有上游 text 节点', () => {
    const nodes = [
      makeNode('t1', 'text', { text: '一只猫' }),
      makeNode('t2', 'text', { text: '阳光下' }),
      makeNode('target', 'imageToVideo'),
    ];
    const edges = [makeEdge('t1', 'target'), makeEdge('t2', 'target')];
    const result = collectAutoTexts('', nodes, edges, 'target');
    expect(result).toBe('一只猫 阳光下');
  });

  it('rawPrompt 有 @ 引用 → 排除被引用的 text 节点,只收集其余', () => {
    const nodes = [
      makeNode('t1', 'text', { text: '一只猫' }),
      makeNode('t2', 'text', { text: '阳光下' }),
      makeNode('target', 'imageToVideo'),
    ];
    const edges = [makeEdge('t1', 'target'), makeEdge('t2', 'target')];
    // t1 被 @ 引用,只有 t2 被自动收集
    const result = collectAutoTexts('{@t1} 缓慢推近', nodes, edges, 'target');
    expect(result).toBe('阳光下');
  });

  it('rawPrompt 无 @ 引用 + 上游无 text → 空字符串', () => {
    const nodes = [
      makeNode('img1', 'textToImage', { resultUrl: 'https://a.com/1.png' }),
      makeNode('target', 'imageToVideo'),
    ];
    const edges = [makeEdge('img1', 'target')];
    const result = collectAutoTexts('', nodes, edges, 'target');
    expect(result).toBe('');
  });

  it('所有上游 text 都被 @ 引用 → 空字符串(不重复)', () => {
    const nodes = [
      makeNode('t1', 'text', { text: '一只猫' }),
      makeNode('target', 'textToVideo'),
    ];
    const edges = [makeEdge('t1', 'target')];
    const result = collectAutoTexts('{@t1}', nodes, edges, 'target');
    expect(result).toBe(''); // t1 已被引用,不重复收集
  });

  it('空 text 节点被跳过', () => {
    const nodes = [
      makeNode('t1', 'text', { text: '' }),
      makeNode('t2', 'text', { text: '有效内容' }),
      makeNode('target', 'imageToVideo'),
    ];
    const edges = [makeEdge('t1', 'target'), makeEdge('t2', 'target')];
    const result = collectAutoTexts('', nodes, edges, 'target');
    expect(result).toBe('有效内容');
  });

  it('多个上游 text 按 x 坐标从左到右排序(不依赖 edges 顺序)', () => {
    const nodes = [
      makeNode('t-right', 'text', { text: '右边' }, 300),
      makeNode('t-left', 'text', { text: '左边' }, 100),
      makeNode('t-mid', 'text', { text: '中间' }, 200),
      makeNode('target', 'imageToVideo'),
    ];
    // edges 顺序故意打乱:先连右边,再连左边,最后中间
    const edges = [makeEdge('t-right', 'target'), makeEdge('t-left', 'target'), makeEdge('t-mid', 'target')];
    const result = collectAutoTexts('', nodes, edges, 'target');
    expect(result).toBe('左边 中间 右边'); // 按 x 坐标排序,不是 edges 顺序
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
