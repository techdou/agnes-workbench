'use client';

import { VideoNodeBase, type VideoNodeConfig } from './VideoNodeBase';
import type { TextToVideoData } from '@/lib/types';

const CONFIG: VideoNodeConfig = {
  titleKey: 'node.textToVideo',
  sigil: 'Ϝ',
  runLabel: 'RENDER VIDEO',
  promptLabel: 'Motion',
  placeholder: '电影级镜头…',
  upstreamHintKey: 'node.upstreamHint.text',
  allowImageRef: false, // 文生视频不接受图片参考
};

export function TextToVideoNode({ id, data }: { id: string; data: TextToVideoData }) {
  return <VideoNodeBase id={id} data={data} config={CONFIG} />;
}
