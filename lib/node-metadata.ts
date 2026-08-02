// 节点元数据 —— 全局唯一定义,CommandPalette / NodeCreator / Toolbar / FlowCanvas 共享
// 新增节点类型时只改这里,不用改三处

import type { NodeType } from './types';

// 节点视觉尺寸(单一来源,CommandPalette 视角中心对齐 + NodeShell 渲染共用)
export const NODE_WIDTH = 300;
export const NODE_HEIGHT = 160; // 大致高度(内容可变,取典型值)

export type NodeGroup = 'input' | 'image' | 'video' | 'output';

export interface NodeMeta {
  type: NodeType;
  labelKey: string;      // i18n key,如 'node.text'
  sigil: string;         // 希腊字母标识
  group: NodeGroup;
  accent: 'amber' | 'phosphor' | 'fog';
}

// 全部节点定义(顺序 = UI 展示顺序)
export const NODE_METADATA: NodeMeta[] = [
  // INPUT
  { type: 'text', labelKey: 'node.text', sigil: 'Τ', group: 'input', accent: 'fog' },
  { type: 'imageInput', labelKey: 'node.imageInput', sigil: '↥', group: 'input', accent: 'amber' },
  // IMAGE
  { type: 'textToImage', labelKey: 'node.textToImage', sigil: 'ℑ', group: 'image', accent: 'phosphor' },
  { type: 'imageToImage', labelKey: 'node.imageToImage', sigil: 'ℜ', group: 'image', accent: 'phosphor' },
  // VIDEO
  { type: 'textToVideo', labelKey: 'node.textToVideo', sigil: 'Ϝ', group: 'video', accent: 'amber' },
  { type: 'imageToVideo', labelKey: 'node.imageToVideo', sigil: 'δ', group: 'video', accent: 'amber' },
  { type: 'multiImageVideo', labelKey: 'node.multiImageVideo', sigil: 'Σ', group: 'video', accent: 'amber' },
  { type: 'keyframe', labelKey: 'node.keyframe', sigil: 'Φ', group: 'video', accent: 'amber' },
  // OUTPUT
  { type: 'imagePreview', labelKey: 'node.imagePreview', sigil: '▣', group: 'output', accent: 'phosphor' },
  { type: 'videoPreview', labelKey: 'node.videoPreview', sigil: '▶', group: 'output', accent: 'amber' },
];

export const NODE_GROUP_ORDER: NodeGroup[] = ['input', 'image', 'video', 'output'];

export const NODE_GROUP_LABEL_KEY: Record<NodeGroup, string> = {
  input: 'nodeGroup.input',
  image: 'nodeGroup.image',
  video: 'nodeGroup.video',
  output: 'nodeGroup.output',
};

// 按 type 快速查 sigil(给 FlowCanvas MiniMap 颜色映射用)
export const NODE_SIGIL: Record<string, string> = Object.fromEntries(
  NODE_METADATA.map((m) => [m.type, m.sigil])
);

// 按 type 快速查 accent(给 MiniMap 颜色用)
export const NODE_ACCENT: Record<string, NodeMeta['accent']> = Object.fromEntries(
  NODE_METADATA.map((m) => [m.type, m.accent])
);

// 按 group 分组的元数据(给 Toolbar / CommandPalette 分组渲染用)
export function getNodesByGroup(): { group: NodeGroup; items: NodeMeta[] }[] {
  return NODE_GROUP_ORDER.map((group) => ({
    group,
    items: NODE_METADATA.filter((m) => m.group === group),
  }));
}
