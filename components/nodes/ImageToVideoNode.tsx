'use client';

import { VideoNodeBase, type VideoNodeConfig } from './VideoNodeBase';
import type { ImageToVideoData } from '@/lib/types';

const CONFIG: VideoNodeConfig = {
  titleKey: 'node.imageToVideo',
  sigil: 'δ',
  runLabel: 'ANIMATE',
  promptLabel: 'Motion',
  placeholder: '缓慢镜头推近…',
  upstreamHintKey: 'node.upstreamHint.image',
};

export function ImageToVideoNode({ id, data }: { id: string; data: ImageToVideoData }) {
  return <VideoNodeBase id={id} data={data} config={CONFIG} />;
}
