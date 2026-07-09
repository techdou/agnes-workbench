// 节点类型定义

export type NodeStatus = 'idle' | 'running' | 'done' | 'error';

export type NodeType =
  | 'text'
  | 'textToImage'
  | 'imageToImage'
  | 'textToVideo'
  | 'imageToVideo'
  | 'multiImageVideo'
  | 'keyframe'
  | 'imagePreview'
  | 'videoPreview';

// 节点 data 结构(传给 React Flow node.data)
export interface BaseNodeData {
  status: NodeStatus;
  error?: string;
  [key: string]: unknown;
}

export interface TextNodeData extends BaseNodeData {
  text: string;
  // 可选:是否用 LLM 增强 prompt
  enhance?: boolean;
}

export interface TextToImageData extends BaseNodeData {
  prompt: string;
  size: string; // 如 1024x768
  resultUrl?: string; // 生成结果图 URL
  cachedUrl?: string; // 本地缓存同源 URL
}

export interface ImageToImageData extends BaseNodeData {
  prompt: string;
  size: string;
  resultUrl?: string;
  cachedUrl?: string;
}

// [L1] 四个视频类节点(textToVideo/imageToVideo/multiImageVideo/keyframe)
// data 字段完全相同,合并为一个 interface
export interface VideoNodeData extends BaseNodeData {
  prompt: string;
  width?: number;
  height?: number;
  numFrames: number;
  frameRate: number;
  resultUrl?: string;
  cachedUrl?: string;
  progress?: number;
  videoId?: string;
}

// 向后兼容的别名(外部 import 可能用旧名)
export type TextToVideoData = VideoNodeData;
export type ImageToVideoData = VideoNodeData;
export type MultiImageVideoData = VideoNodeData;
export type KeyframeData = VideoNodeData;

export interface ImagePreviewData extends BaseNodeData {
  imageUrl?: string; // 来自上游或直接填
  cachedUrl?: string; // 本地缓存后的同源 URL
}

export interface VideoPreviewData extends BaseNodeData {
  videoUrl?: string;
  cachedUrl?: string;
}

// 工作流执行时,节点输出的数据类型
export type NodeOutput =
  | { kind: 'text'; text: string }
  | { kind: 'image'; url: string }
  | { kind: 'video'; url: string }
  | { kind: 'images'; urls: string[] };
