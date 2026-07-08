// Agnes API 客户端 —— 从 agnes_api.py 移植
// 支持:文本生成、文生图、图生图、文生视频、图生视频、多图视频、关键帧动画
// 中文 prompt 自动翻译为英文

const BASE_URL = process.env.AGNES_BASE_URL || 'https://apihub.agnes-ai.com';
const TEXT_MODEL = 'agnes-2.0-flash';
const IMAGE_MODEL = 'agnes-image-2.1-flash';
const VIDEO_MODEL = 'agnes-video-v2.0';

function getApiKey(): string {
  const key = process.env.AGNES_API_KEY;
  if (!key) throw new Error('AGNES_API_KEY 未配置,请检查 .env.local');
  return key;
}

// ---------- 基础请求 ----------

async function requestJson<T = any>(
  method: string,
  path: string,
  payload?: Record<string, unknown>,
  timeoutMs = 120000
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const body = payload ? JSON.stringify(payload) : undefined;
    const resp = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${getApiKey()}`,
        'Content-Type': 'application/json',
      },
      body,
      signal: controller.signal,
      // Agnes 返回的 URL 是外部域,这里不缓存,由前端代理处理
      cache: 'no-store',
    });
    const text = await resp.text();
    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status}: ${text}`);
    }
    return (text ? JSON.parse(text) : {}) as T;
  } finally {
    clearTimeout(timer);
  }
}

// ---------- 中文 → 英文 prompt 翻译 ----------

function needsTranslation(prompt: string): boolean {
  // 含非 ASCII 字符就翻
  return /[^\x00-\x7F]/.test(prompt);
}

export async function translatePromptToEnglish(prompt: string): Promise<string> {
  if (!needsTranslation(prompt)) return prompt;
  const data = await requestJson<{
    choices: { message: { content: string } }[];
  }>('POST', '/v1/chat/completions', {
    model: TEXT_MODEL,
    messages: [
      {
        role: 'system',
        content:
          'Translate the user image/video generation prompt into fluent English. ' +
          'Preserve all concrete visual details, style words, camera motion, lighting, ' +
          'composition constraints, and negative instructions. Return only the English prompt.',
      },
      { role: 'user', content: prompt },
    ],
    temperature: 0,
    max_tokens: 800,
  });
  const translated = data.choices?.[0]?.message?.content?.trim();
  if (!translated) throw new Error('翻译失败:返回为空');
  return translated;
}

// ---------- 文本生成 ----------

export interface TextResult {
  content: string;
  raw: unknown;
}

export async function generateText(
  prompt: string,
  opts?: { system?: string; temperature?: number; maxTokens?: number }
): Promise<TextResult> {
  const messages: { role: string; content: string }[] = [];
  if (opts?.system) messages.push({ role: 'system', content: opts.system });
  messages.push({ role: 'user', content: prompt });
  const data = await requestJson<{
    choices: { message: { content: string } }[];
  }>('POST', '/v1/chat/completions', {
    model: TEXT_MODEL,
    messages,
    temperature: opts?.temperature ?? 0.7,
    max_tokens: opts?.maxTokens ?? 1024,
  });
  return {
    content: data.choices?.[0]?.message?.content ?? '',
    raw: data,
  };
}

// ---------- 图像生成 ----------

export interface ImageResult {
  urls: string[];
  raw: unknown;
}

function extractImageUrls(data: any): string[] {
  const urls: string[] = [];
  if (typeof data?.url === 'string') urls.push(data.url);
  if (typeof data?.image_url === 'string') urls.push(data.image_url);
  if (Array.isArray(data?.data)) {
    for (const item of data.data) {
      if (item && typeof item === 'object') {
        for (const key of ['url', 'image_url']) {
          if (typeof item[key] === 'string') urls.push(item[key]);
        }
      }
    }
  }
  return [...new Set(urls)];
}

// 文生图
export async function textToImage(prompt: string, size = '1024x768'): Promise<ImageResult> {
  const englishPrompt = await translatePromptToEnglish(prompt);
  const data = await requestJson('POST', '/v1/images/generations', {
    model: IMAGE_MODEL,
    prompt: englishPrompt,
    size,
    extra_body: { response_format: 'url' },
  });
  return { urls: extractImageUrls(data), raw: data };
}

// 图生图 / 图片编辑
export async function imageToImage(
  prompt: string,
  inputImageUrl: string,
  size = '1024x768'
): Promise<ImageResult> {
  const englishPrompt = await translatePromptToEnglish(prompt);
  const data = await requestJson('POST', '/v1/images/generations', {
    model: IMAGE_MODEL,
    prompt: englishPrompt,
    size,
    extra_body: {
      image: [inputImageUrl],
      response_format: 'url',
    },
  });
  return { urls: extractImageUrls(data), raw: data };
}

// ---------- 视频生成(异步) ----------

export interface VideoCreateResult {
  videoId?: string;
  taskId?: string;
  id?: string;
  status: string;
  raw: unknown;
}

function validateVideoArgs(opts: {
  numFrames?: number;
  frameRate?: number;
  width?: number;
  height?: number;
}) {
  const { numFrames, frameRate, width, height } = opts;
  if (numFrames != null) {
    if (numFrames > 441 || (numFrames - 1) % 8 !== 0) {
      throw new Error(`num_frames 必须满足 8n+1 且 ≤441,当前 ${numFrames}`);
    }
  }
  if (frameRate != null && (frameRate < 1 || frameRate > 60)) {
    throw new Error(`frame_rate 必须在 1-60,当前 ${frameRate}`);
  }
  if (width != null && (width <= 0 || width % 8 !== 0)) {
    throw new Error(`width 必须是正整数且为 8 的倍数,当前 ${width}`);
  }
  if (height != null && (height <= 0 || height % 8 !== 0)) {
    throw new Error(`height 必须是正整数且为 8 的倍数,当前 ${height}`);
  }
}

function pickVideoId(data: any): { id?: string; kind: 'video_id' | 'task_id' } {
  if (typeof data?.video_id === 'string' && data.video_id) {
    return { id: data.video_id, kind: 'video_id' };
  }
  for (const key of ['task_id', 'id']) {
    if (typeof data?.[key] === 'string' && data[key]) {
      return { id: data[key], kind: 'task_id' };
    }
  }
  return { kind: 'task_id' };
}

export interface VideoOptions {
  width?: number;
  height?: number;
  numFrames?: number;
  frameRate?: number;
  seed?: number;
  negativePrompt?: string;
}

// 文生视频:创建任务
export async function createTextToVideo(
  prompt: string,
  opts: VideoOptions = {}
): Promise<VideoCreateResult> {
  validateVideoArgs(opts);
  const englishPrompt = await translatePromptToEnglish(prompt);
  const payload: Record<string, unknown> = {
    model: VIDEO_MODEL,
    prompt: englishPrompt,
  };
  for (const [k, v] of Object.entries({
    width: opts.width,
    height: opts.height,
    num_frames: opts.numFrames,
    frame_rate: opts.frameRate,
    seed: opts.seed,
    negative_prompt: opts.negativePrompt,
  })) {
    if (v != null) payload[k] = v;
  }
  const data = await requestJson<any>('POST', '/v1/videos', payload);
  const { id, kind } = pickVideoId(data);
  return {
    videoId: kind === 'video_id' ? id : undefined,
    taskId: kind === 'task_id' ? id : undefined,
    id,
    status: data?.status ?? 'queued',
    raw: data,
  };
}

// 图生视频:创建任务(单张参考图)
export async function createImageToVideo(
  prompt: string,
  imageUrl: string,
  opts: VideoOptions = {}
): Promise<VideoCreateResult> {
  validateVideoArgs(opts);
  const englishPrompt = await translatePromptToEnglish(prompt);
  const payload: Record<string, unknown> = {
    model: VIDEO_MODEL,
    prompt: englishPrompt,
    image: imageUrl,
  };
  for (const [k, v] of Object.entries({
    width: opts.width,
    height: opts.height,
    num_frames: opts.numFrames,
    frame_rate: opts.frameRate,
    seed: opts.seed,
    negative_prompt: opts.negativePrompt,
  })) {
    if (v != null) payload[k] = v;
  }
  const data = await requestJson<any>('POST', '/v1/videos', payload);
  const { id, kind } = pickVideoId(data);
  return {
    videoId: kind === 'video_id' ? id : undefined,
    taskId: kind === 'task_id' ? id : undefined,
    id,
    status: data?.status ?? 'queued',
    raw: data,
  };
}

// 多图视频 / 关键帧动画:创建任务
export async function createMultiImageVideo(
  prompt: string,
  imageUrls: string[],
  mode: 'keyframes' | 'ti2vid',
  opts: VideoOptions = {}
): Promise<VideoCreateResult> {
  validateVideoArgs(opts);
  const englishPrompt = await translatePromptToEnglish(prompt);
  const payload: Record<string, unknown> = {
    model: VIDEO_MODEL,
    prompt: englishPrompt,
    extra_body: {
      image: imageUrls,
      mode,
    },
  };
  for (const [k, v] of Object.entries({
    width: opts.width,
    height: opts.height,
    num_frames: opts.numFrames,
    frame_rate: opts.frameRate,
    seed: opts.seed,
    negative_prompt: opts.negativePrompt,
  })) {
    if (v != null) payload[k] = v;
  }
  const data = await requestJson<any>('POST', '/v1/videos', payload);
  const { id, kind } = pickVideoId(data);
  return {
    videoId: kind === 'video_id' ? id : undefined,
    taskId: kind === 'task_id' ? id : undefined,
    id,
    status: data?.status ?? 'queued',
    raw: data,
  };
}

// ---------- 视频状态查询 ----------

export interface VideoStatusResult {
  status: 'queued' | 'in_progress' | 'completed' | 'failed' | string;
  progress?: number;
  url?: string; // 完成时的下载 URL
  error?: string;
  raw: unknown;
}

function extractVideoUrl(data: any): string | undefined {
  for (const key of ['video_url', 'url', 'remixed_from_video_id']) {
    const v = data?.[key];
    if (typeof v === 'string' && /^https?:\/\//.test(v)) return v;
  }
  if (Array.isArray(data?.data)) {
    for (const item of data.data) {
      if (item && typeof item === 'object') {
        const u = extractVideoUrl(item);
        if (u) return u;
      }
    }
  }
  return undefined;
}

export async function getVideoStatus(identifier: string): Promise<VideoStatusResult> {
  let path: string;
  if (identifier.startsWith('video_')) {
    const q = new URLSearchParams({ video_id: identifier, model_name: VIDEO_MODEL });
    path = `/agnesapi?${q.toString()}`;
  } else {
    path = `/v1/videos/${encodeURIComponent(identifier)}`;
  }
  const data = await requestJson<any>('GET', path);
  return {
    status: String(data?.status ?? ''),
    progress: typeof data?.progress === 'number' ? data.progress : undefined,
    url: extractVideoUrl(data),
    error: data?.error ? JSON.stringify(data.error) : undefined,
    raw: data,
  };
}

// ---------- 视频轮询工具(给前端用) ----------

export interface PollOptions {
  intervalMs?: number;
  timeoutMs?: number;
  onProgress?: (progress: number, status: string) => void;
}

export async function pollVideoUntilDone(
  identifier: string,
  opts: PollOptions = {}
): Promise<VideoStatusResult> {
  const interval = opts.intervalMs ?? 5000;
  const timeout = opts.timeoutMs ?? 900000; // 15 分钟
  const deadline = Date.now() + timeout;
  let last: VideoStatusResult;
  do {
    last = await getVideoStatus(identifier);
    if (last.status === 'completed' || last.status === 'failed') return last;
    if (typeof last.progress === 'number') {
      opts.onProgress?.(last.progress, last.status);
    }
    await new Promise((r) => setTimeout(r, interval));
  } while (Date.now() < deadline);
  throw new Error(`视频 ${identifier} 轮询超时,最后状态:${last.status}`);
}

// ---------- 导出模型常量(给 UI 提示用) ----------

export const MODELS = {
  TEXT: TEXT_MODEL,
  IMAGE: IMAGE_MODEL,
  VIDEO: VIDEO_MODEL,
};
