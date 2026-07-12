// 工作流模板 —— 预置典型工作流,新用户一键创建
// 每个模板就是预设好的 nodes + edges + 描述

import type { Edge, Node } from '@xyflow/react';

export interface WorkflowTemplate {
  id: string;
  nameKey: string;       // i18n key
  descKey: string;       // i18n key
  icon: string;          // 展示用符号
  nodes: Node[];
  edges: Edge[];
}

// 辅助:快速创建节点
function node(id: string, type: string, x: number, y: number, data: Record<string, unknown> = {}): Node {
  return { id, type, position: { x, y }, data: { status: 'idle', ...data } };
}

// 辅助:快速创建连线
function edge(source: string, target: string): Edge {
  return {
    id: `e_${source}_${target}`,
    source,
    target,
    sourceHandle: 'out',
    targetHandle: 'in',
    animated: true,
  };
}

// ---------- 模板定义 ----------

export const TEMPLATES: WorkflowTemplate[] = [
  {
    id: 'text-to-image',
    nameKey: 'template.t2i.name',
    descKey: 'template.t2i.desc',
    icon: 'ℑ',
    nodes: [
      node('t1', 'text', 100, 200, { text: 'A majestic lion sitting on a cliff at sunset, cinematic lighting, golden hour' }),
      node('t2i', 'textToImage', 520, 200, { size: '1024x768' }),
      node('prev', 'imagePreview', 940, 200),
    ],
    edges: [
      edge('t1', 't2i'),
      edge('t2i', 'prev'),
    ],
  },
  {
    id: 'image-to-video',
    nameKey: 'template.i2v.name',
    descKey: 'template.i2v.desc',
    icon: 'δ',
    nodes: [
      node('t1', 'text', 100, 150, { text: 'A serene mountain lake at dawn' }),
      node('t2i', 'textToImage', 520, 150, { size: '1024x768' }),
      node('i2v', 'imageToVideo', 940, 150, { numFrames: 121, frameRate: 24 }),
      node('prev', 'videoPreview', 1360, 150),
    ],
    edges: [
      edge('t1', 't2i'),
      edge('t2i', 'i2v'),
      edge('i2v', 'prev'),
    ],
  },
  {
    id: 'multi-image-fusion',
    nameKey: 'template.fusion.name',
    descKey: 'template.fusion.desc',
    icon: 'ℜ',
    nodes: [
      node('img1', 'imageInput', 100, 100),
      node('img2', 'imageInput', 100, 400),
      node('i2i', 'imageToImage', 520, 250, { prompt: 'Combine elements from both reference images into a cohesive new composition' }),
      node('prev', 'imagePreview', 940, 250),
    ],
    edges: [
      edge('img1', 'i2i'),
      edge('img2', 'i2i'),
      edge('i2i', 'prev'),
    ],
  },
];
