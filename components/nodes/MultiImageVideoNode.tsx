'use client';

import { VideoNodeBase, type VideoNodeConfig } from './VideoNodeBase';
import type { MultiImageVideoData } from '@/lib/types';

const CONFIG: VideoNodeConfig = {
  titleKey: 'node.multiImageVideo',
  sigil: 'Σ',
  runLabel: 'COMPOSE',
  promptLabel: 'Motion',
  placeholder: '两张图之间平滑过渡…',
  upstreamHintKey: 'node.upstreamHint.multiImage',
};

export function MultiImageVideoNode({ id, data }: { id: string; data: MultiImageVideoData }) {
  return <VideoNodeBase id={id} data={data} config={CONFIG} />;
}
