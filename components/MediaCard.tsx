'use client';

// 画廊/归档里共用的媒体展示组件
// - 图片:简单 img
// - 视频:默认显示封面遮罩 + ▶,点击进入原生 controls 播放模式
//   不在列表里自动加载视频(preload=none),省流量
// [H2] 替代之前"装饰 ▶ 不可点"的设计

import { useState } from 'react';

interface GalleryVideoProps {
  hash: string;
  className?: string;
}

export function GalleryVideo({ hash, className }: GalleryVideoProps) {
  const [playing, setPlaying] = useState(false);

  if (playing) {
    return (
      <video
        src={`/api/cache/${hash}`}
        className={className || 'h-full w-full object-cover'}
        controls
        autoPlay
        // 点击 controls 外的区域退出播放(回到封面)
        onClick={(e) => {
          // 只在点 video 本身非 controls 区域时退出
          if (e.target === e.currentTarget) setPlaying(false);
        }}
      />
    );
  }

  // 未播放:显示封面占位。preload=none 不加载视频字节
  return (
    <div
      className="relative h-full w-full cursor-pointer"
      style={{ background: 'var(--c-void)' }}
      onClick={() => setPlaying(true)}
    >
      <video
        src={`/api/cache/${hash}`}
        className={className || 'h-full w-full object-cover'}
        muted
        preload="none"
      />
      <div className="absolute inset-0 flex items-center justify-center bg-black/40 transition-colors group-hover:bg-black/30">
        <span className="font-mono text-2xl text-white opacity-80 transition-transform group-hover:scale-110">▶</span>
      </div>
    </div>
  );
}
