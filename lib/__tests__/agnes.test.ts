import { describe, it, expect } from 'vitest';
import { extractVideoUrl } from '../agnes';

// extractVideoUrl 的回归测试
// 锁死 BugFix:Agnes 在 /v1/videos/{id} 路径完成态把 URL 藏在 metadata.url,
// 之前代码只查顶层 url/video_url,导致图生视频永远报"未返回 URL"
describe('extractVideoUrl', () => {
  it('从顶层 video_url 提取 URL(agnesapi 路径完成态)', () => {
    const data = {
      status: 'completed',
      video_url: 'https://platform-outputs.agnes-ai.space/videos/agnes-video-v2.0/abc.mp4',
    };
    expect(extractVideoUrl(data)).toBe(data.video_url);
  });

  it('从顶层 url 提取 URL(agnesapi 路径另一种返回)', () => {
    const data = {
      status: 'completed',
      url: 'https://platform-outputs.agnes-ai.space/videos/agnes-video-v2.0/abc.mp4',
    };
    expect(extractVideoUrl(data)).toBe(data.url);
  });

  it('从 metadata.url 提取 URL(/v1/videos/{id} 路径完成态——BugFix 核心场景)', () => {
    // 这是 2026-07-25 实测从 Agnes 真实抓到的响应结构
    const data = {
      id: 'task_4NJtF8piTI2QBmX98bwwJEaBcYRD6aHr',
      video_id: 'task_4NJtF8piTI2QBmX98bwwJEaBcYRD6aHr',
      task_id: 'task_4NJtF8piTI2QBmX98bwwJEaBcYRD6aHr',
      object: 'video',
      model: 'agnes-video-v2.0',
      status: 'completed',
      progress: 100,
      created_at: 1784979098,
      completed_at: 1784979207,
      seconds: '5.0',
      size: '1088x832',
      metadata: {
        size_mapping: {
          adjusted: true,
          height: 832,
          ratio: '4:3',
          resolution: '720p',
          width: 1088,
        },
        url: 'https://platform-outputs.agnes-ai.space/videos/agnes-video-v2.0/task_4NJtF8piTI2QBmX98bwwJEaBcYRD6aHr.mp4',
      },
      // 注意:顶层没有 url / video_url 字段
    };
    expect(extractVideoUrl(data)).toBe(data.metadata.url);
  });

  it('顶层 url 优先于 metadata.url(避免 metadata 误覆盖)', () => {
    const data = {
      url: 'https://top-level-url.example.com/video.mp4',
      metadata: {
        url: 'https://metadata-url.example.com/different.mp4',
      },
    };
    expect(extractVideoUrl(data)).toBe(data.url);
  });

  it('data 数组里的 url 也能提取(兼容 OpenAI 风格)', () => {
    const data = {
      data: [
        { url: 'https://platform-outputs.agnes-ai.space/videos/arr.mp4' },
      ],
    };
    expect(extractVideoUrl(data)).toBe(data.data[0].url);
  });

  it('对没有 url 的响应返回 undefined', () => {
    const data = {
      status: 'in_progress',
      progress: 30,
      metadata: { progress: 30 },
    };
    expect(extractVideoUrl(data)).toBeUndefined();
  });

  it('对 null/undefined 安全返回 undefined', () => {
    expect(extractVideoUrl(null as never)).toBeUndefined();
    expect(extractVideoUrl(undefined as never)).toBeUndefined();
  });

  it('非 http(s) 字符串不当成 URL(过滤脏字段)', () => {
    const data = {
      url: 'not-a-url',
      video_url: '/relative/path.mp4',
      metadata: { url: 'javascript:alert(1)' },
    };
    expect(extractVideoUrl(data)).toBeUndefined();
  });

  it('remixed_from_video_id 不被误认为 URL(防回归)', () => {
    // [H4] 注释里提到:remixed_from_video_id 语义是"源视频 ID",
    // 服务商哪天把它写成 URL 会把源视频当下载链接返回
    const data = {
      status: 'completed',
      remixed_from_video_id: 'task_abc123',
      metadata: {
        url: 'https://platform-outputs.agnes-ai.space/videos/correct.mp4',
      },
    };
    expect(extractVideoUrl(data)).toBe(data.metadata.url);
  });
});
