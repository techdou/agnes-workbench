import { describe, it, expect, beforeAll } from 'vitest';
import type { Node, Edge } from '@xyflow/react';

// topologicalSort 是 store.ts 的内部函数,导出供纯函数测试
describe('topologicalSort', () => {
  let topologicalSort: (nodes: Node[], edges: Edge[]) => Node[];

  beforeAll(async () => {
    const mod = await import('../store');
    topologicalSort = mod.topologicalSort;
  });

  function makeNode(id: string, type = 'text'): Node {
    return { id, type, position: { x: 0, y: 0 }, data: {} };
  }
  function makeEdge(source: string, target: string): Edge {
    return { id: `${source}-${target}`, source, target };
  }

  it('线性链路按拓扑顺序排列(A→B→C)', () => {
    const nodes = [makeNode('a'), makeNode('b'), makeNode('c')];
    const edges = [makeEdge('a', 'b'), makeEdge('b', 'c')];
    const sorted = topologicalSort(nodes, edges).map((n) => n.id);
    expect(sorted).toEqual(['a', 'b', 'c']);
  });

  it('孤立节点(无连线)保留在结果中', () => {
    const nodes = [makeNode('a'), makeNode('lonely')];
    const edges: Edge[] = [];
    const sorted = topologicalSort(nodes, edges).map((n) => n.id);
    expect(sorted).toContain('a');
    expect(sorted).toContain('lonely');
  });

  // [CRITICAL 回归] 环路必须抛错,不能静默吞掉当成孤立节点执行
  it('环路(A→B→C→A)抛错,不静默执行', () => {
    const nodes = [makeNode('a'), makeNode('b'), makeNode('c')];
    const edges = [makeEdge('a', 'b'), makeEdge('b', 'c'), makeEdge('c', 'a')];
    expect(() => topologicalSort(nodes, edges)).toThrow(/环/);
  });

  it('自环(A→A)抛错', () => {
    const nodes = [makeNode('a')];
    const edges = [makeEdge('a', 'a')];
    expect(() => topologicalSort(nodes, edges)).toThrow(/环/);
  });

  it('部分环 + 部分正常节点,有环就抛错', () => {
    const nodes = [makeNode('a'), makeNode('b'), makeNode('c'), makeNode('d')];
    // a→b 正常;d 自环
    const edges = [makeEdge('a', 'b'), makeEdge('d', 'd')];
    expect(() => topologicalSort(nodes, edges)).toThrow(/环/);
  });

  it('菱形依赖(DAG)正确排序', () => {
    // a→b, a→c, b→d, c→d
    const nodes = [makeNode('a'), makeNode('b'), makeNode('c'), makeNode('d')];
    const edges = [makeEdge('a', 'b'), makeEdge('a', 'c'), makeEdge('b', 'd'), makeEdge('c', 'd')];
    const sorted = topologicalSort(nodes, edges).map((n) => n.id);
    expect(sorted.indexOf('a')).toBeLessThan(sorted.indexOf('b'));
    expect(sorted.indexOf('a')).toBeLessThan(sorted.indexOf('c'));
    expect(sorted.indexOf('b')).toBeLessThan(sorted.indexOf('d'));
    expect(sorted.indexOf('c')).toBeLessThan(sorted.indexOf('d'));
  });
});
