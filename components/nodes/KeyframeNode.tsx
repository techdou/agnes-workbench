'use client';

import { VideoNodeBase, type VideoNodeConfig } from './VideoNodeBase';
import type { KeyframeData } from '@/lib/types';

const CONFIG: VideoNodeConfig = {
  titleKey: 'node.keyframe',
  sigil: 'Φ',
  runLabel: 'INTERPOLATE',
  promptLabel: 'Transition',
  placeholder: '电影感过渡…',
  upstreamHintKey: 'node.upstreamHint.keyframe',
};

export function KeyframeNode({ id, data }: { id: string; data: KeyframeData }) {
  return <VideoNodeBase id={id} data={data} config={CONFIG} />;
}
