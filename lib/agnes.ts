// Agnes API 客户端 —— 从 agnes_api.py 移植
// 支持:文本生成、文生图、图生图、文生视频、图生视频、多图视频、关键帧动画
// 中文 prompt 自动翻译为英文
//
// ── Agnes API 返回结构参考(OpenAI 兼容) ──
// 文本 POST /v1/chat/completions:
//   { choices: [{ message: { content: string } }] }
// 图像 POST /v1/images/generations:
//   { url: string } | { image_url: string } | { data: [{ url | image_url }] }
// 视频 POST /v1/videos:
//   { video_id: string } | { task_id: string } | { id: string, status: string }
// 视频 GET /v1/videos/{id} 或 /agnesapi?video_id=&model_name=:
//   { status, progress?, video_url | url } (status: queued|in_progress|completed|failed)

const BASE_URL = process.env.AGNES_BASE_URL || 'https://apihub.agnes-ai.com';
// 默认模型名(可被调用方覆盖:settings 面板自定义模型 or body 参数)
const DEFAULT_TEXT_MODEL = 'agnes-2.0-flash';
const DEFAULT_IMAGE_MODEL = 'agnes-image-2.1-flash';
const DEFAULT_VIDEO_MODEL = 'agnes-video-v2.0';

// API key 解析:优先用客户端通过 X-Agnes-Key 请求头传来的 key,其次环境变量
// [C2] 不再用模块级变量(并发请求会串 key),改成函数参数透传
function resolveApiKey(override?: string | null): string {
  const key = override || process.env.AGNES_API_KEY;
  if (!key) throw new Error('AGNES_API_KEY 未配置,请在设置面板填写或检查环境变量');
  return key;
}

// ---------- 调用上下文(统一装 API key + 模型覆盖) ----------
// route 从请求头/body 构造,透传给 agnes.ts 函数,避免每个函数都加一堆参数
export interface CallContext {
  apiKey?: string | null;
  textModel?: string;
  imageModel?: string;
  videoModel?: string;
  baseUrl?: string;        // [H2] 覆盖默认 API 地址
  autoTranslate?: boolean; // [H3] 是否自动翻译中文 prompt
}

// ---------- 类型定义(替代 any) ----------

// Agnes API 返回的 JSON 结构(宽松类型,因为字段名不固定)
type AgnesJson = Record<string, unknown>;

interface ChatCompletionResponse {
  choices?: { message: { content: string } }[];
}

// ---------- 基础请求 ----------
// [C2] apiKey 参数显式透传,避免模块级状态并发污染

async function requestJson<T = AgnesJson>(
  method: string,
  path: string,
  payload?: Record<string, unknown>,
  apiKeyOverride?: string | null,
  timeoutMs = 120000,
  baseUrlOverride?: string
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const body = payload ? JSON.stringify(payload) : undefined;
    const baseUrl = baseUrlOverride || BASE_URL; // [H2] 支持自定义 Base URL
    const resp = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${resolveApiKey(apiKeyOverride)}`,
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

function needsTranslation(prompt: string, autoTranslate?: boolean): boolean {
  // [H3] 如果设置面板关闭了自动翻译,直接返回 false
  if (autoTranslate === false) return false;
  // 含非 ASCII 字符就翻
  return /[^\x00-\x7F]/.test(prompt);
}

export async function translatePromptToEnglish(prompt: string, ctx?: CallContext): Promise<string> {
  if (!needsTranslation(prompt, ctx?.autoTranslate)) return prompt;
  const data = await requestJson<ChatCompletionResponse>('POST', '/v1/chat/completions', {
    model: ctx?.textModel || DEFAULT_TEXT_MODEL,
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
  }, ctx?.apiKey, 120000, ctx?.baseUrl);
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
  opts?: { system?: string; temperature?: number; maxTokens?: number },
  ctx?: CallContext
): Promise<TextResult> {
  const messages: { role: string; content: string }[] = [];
  if (opts?.system) messages.push({ role: 'system', content: opts.system });
  messages.push({ role: 'user', content: prompt });
  const data = await requestJson<ChatCompletionResponse>('POST', '/v1/chat/completions', {
    model: ctx?.textModel || DEFAULT_TEXT_MODEL,
    messages,
    temperature: opts?.temperature ?? 0.7,
    max_tokens: opts?.maxTokens ?? 1024,
  }, ctx?.apiKey, 120000, ctx?.baseUrl);
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

// 从 Agnes 返回结构里提取图片 URL(字段名可能是 url / image_url / data[].url)
function extractImageUrls(data: AgnesJson): string[] {
  const urls: string[] = [];
  if (typeof data?.url === 'string') urls.push(data.url);
  if (typeof data?.image_url === 'string') urls.push(data.image_url);
  if (Array.isArray(data?.data)) {
    for (const item of data.data) {
      if (item && typeof item === 'object') {
        const obj = item as Record<string, unknown>;
        for (const key of ['url', 'image_url']) {
          if (typeof obj[key] === 'string') urls.push(obj[key] as string);
        }
      }
    }
  }
  return [...new Set(urls)];
}

// 文生图
export async function textToImage(prompt: string, size = '1024x768', ctx?: CallContext): Promise<ImageResult> {
  const englishPrompt = await translatePromptToEnglish(prompt, ctx);
  const data = await requestJson<AgnesJson>('POST', '/v1/images/generations', {
    model: ctx?.imageModel || DEFAULT_IMAGE_MODEL,
    prompt: englishPrompt,
    size,
    extra_body: { response_format: 'url' },
  }, ctx?.apiKey, 120000, ctx?.baseUrl);
  return { urls: extractImageUrls(data), raw: data };
}

// 图生图 / 图片编辑 —— 支持多图参考(实测 agnes-image-2.1-flash 会融合多张参考图)
export async function imageToImage(
  prompt: string,
  inputImageUrls: string[],
  size = '1024x768',
  ctx?: CallContext
): Promise<ImageResult> {
  const englishPrompt = await translatePromptToEnglish(prompt, ctx);
  const data = await requestJson<AgnesJson>('POST', '/v1/images/generations', {
    model: ctx?.imageModel || DEFAULT_IMAGE_MODEL,
    prompt: englishPrompt,
    size,
    extra_body: {
      image: inputImageUrls,
      response_format: 'url',
    },
  }, ctx?.apiKey, 120000, ctx?.baseUrl);
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

// 从创建响应里提取任务标识(字段名可能是 video_id / task_id / id)
function pickVideoId(data: AgnesJson): { id?: string; kind: 'video_id' | 'task_id' } {
  if (typeof data?.video_id === 'string' && data.video_id) {
    return { id: data.video_id, kind: 'video_id' };
  }
  for (const key of ['task_id', 'id']) {
    if (typeof data?.[key] === 'string' && data[key]) {
      return { id: data[key] as string, kind: 'task_id' };
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

// ---------- [L2] 视频创建公共逻辑(三个 create* 合并) ----------
// 差异只在 payload 构造,后面的翻译+请求+解析完全一样

/**
 * 内部:构造 payload → 发请求 → 解析 id,三个 create* 共用
 * buildPayload 负责把 prompt + 模式相关的额外字段塞进 payload
 */
async function createVideoTask(
  prompt: string,
  opts: VideoOptions,
  buildPayload: (englishPrompt: string) => Record<string, unknown>,
  ctx?: CallContext
): Promise<VideoCreateResult> {
  validateVideoArgs(opts);
  const englishPrompt = await translatePromptToEnglish(prompt, ctx);

  const payload = buildPayload(englishPrompt);
  // 通用可选参数
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

  const data = await requestJson<AgnesJson>('POST', '/v1/videos', payload, ctx?.apiKey, 120000, ctx?.baseUrl);
  const { id, kind } = pickVideoId(data);
  return {
    videoId: kind === 'video_id' ? id : undefined,
    taskId: kind === 'task_id' ? id : undefined,
    id,
    status: typeof data?.status === 'string' ? data.status : 'queued',
    raw: data,
  };
}

// 文生视频:创建任务
export function createTextToVideo(
  prompt: string,
  opts: VideoOptions = {},
  ctx?: CallContext
): Promise<VideoCreateResult> {
  const model = ctx?.videoModel || DEFAULT_VIDEO_MODEL;
  return createVideoTask(prompt, opts, (englishPrompt) => ({
    model,
    prompt: englishPrompt,
  }), ctx);
}

// 图生视频:创建任务(单张参考图)
export function createImageToVideo(
  prompt: string,
  imageUrl: string,
  opts: VideoOptions = {},
  ctx?: CallContext
): Promise<VideoCreateResult> {
  const model = ctx?.videoModel || DEFAULT_VIDEO_MODEL;
  return createVideoTask(prompt, opts, (englishPrompt) => ({
    model,
    prompt: englishPrompt,
    image: imageUrl,
  }), ctx);
}

// 多图视频 / 关键帧动画:创建任务
export function createMultiImageVideo(
  prompt: string,
  imageUrls: string[],
  mode: 'keyframes' | 'ti2vid',
  opts: VideoOptions = {},
  ctx?: CallContext
): Promise<VideoCreateResult> {
  const model = ctx?.videoModel || DEFAULT_VIDEO_MODEL;
  return createVideoTask(prompt, opts, (englishPrompt) => ({
    model,
    prompt: englishPrompt,
    extra_body: {
      image: imageUrls,
      mode,
    },
  }), ctx);
}

// ---------- 视频状态查询 ----------

export interface VideoStatusResult {
  status: 'queued' | 'in_progress' | 'completed' | 'failed' | string;
  progress?: number;
  url?: string; // 完成时的下载 URL
  error?: string;
  raw: unknown;
}

function extractVideoUrl(data: AgnesJson): string | undefined {
  for (const key of ['video_url', 'url', 'remixed_from_video_id']) {
    const v = data?.[key];
    if (typeof v === 'string' && /^https?:\/\//.test(v)) return v;
  }
  if (Array.isArray(data?.data)) {
    for (const item of data.data) {
      if (item && typeof item === 'object') {
        const u = extractVideoUrl(item as AgnesJson);
        if (u) return u;
      }
    }
  }
  return undefined;
}

export async function getVideoStatus(identifier: string, ctx?: CallContext): Promise<VideoStatusResult> {
  let path: string;
  if (identifier.startsWith('video_')) {
    const q = new URLSearchParams({ video_id: identifier, model_name: ctx?.videoModel || DEFAULT_VIDEO_MODEL });
    path = `/agnesapi?${q.toString()}`;
  } else {
    path = `/v1/videos/${encodeURIComponent(identifier)}`;
  }
  const data = await requestJson<AgnesJson>('GET', path, undefined, ctx?.apiKey, 120000, ctx?.baseUrl);
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
  TEXT: DEFAULT_TEXT_MODEL,
  IMAGE: DEFAULT_IMAGE_MODEL,
  VIDEO: DEFAULT_VIDEO_MODEL,
};
