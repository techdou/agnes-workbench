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
    // [H2] Base URL 容错:用户可能填了末尾 / 或 /v1,统一处理避免 /v1/v1/ 重复
    let baseUrl = baseUrlOverride || BASE_URL;
    if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1);
    if (baseUrl.endsWith('/v1')) baseUrl = baseUrl.slice(0, -3);
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
      // 提取 Agnes 返回的友好错误信息(不是整段 JSON)
      let friendlyMsg = `HTTP ${resp.status}`;
      let extracted = false;
      try {
        const errJson = JSON.parse(text);
        // 尝试多种常见错误结构:OpenAI 风格 / 简单 message / detail
        const msg = errJson?.error?.message || errJson?.message || errJson?.detail
          || (typeof errJson?.error === 'string' ? errJson.error : null);
        if (msg) { friendlyMsg = String(msg); extracted = true; }
      } catch {
        // 非 JSON,走纯文本
      }
      // [BugFix] JSON parse 成功但没命中已知错误结构时,之前丢弃了 body,
      // 用户只看到无意义的 "HTTP 429"。现在保留原始片段用于排障。
      if (!extracted && text) {
        friendlyMsg += `: ${text.slice(0, 200)}`;
      }
      // 用自定义 Error 保留状态码,让 route 层能透传(503 不该包成 500)
      const err = new Error(friendlyMsg) as Error & { statusCode?: number };
      err.statusCode = resp.status;
      throw err;
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

// 从 Agnes 返回结构里提取图片 URL
// [BugFix] 与 extractVideoUrl 对齐:扩充输出字段名 + metadata 递归 + b64_json 兼容
// 只查输出语义的字段(url/image_url/output_url),不扫描 input_image 等输入字段
const IMAGE_OUTPUT_KEYS = ['url', 'image_url', 'output_url'] as const;
const IMAGE_RE = /^https?:\/\//i;
function extractImageUrls(data: AgnesJson): string[] {
  const urls: string[] = [];
  const pushIfUrl = (v: unknown) => {
    if (typeof v === 'string' && IMAGE_RE.test(v)) urls.push(v);
  };
  // b64_json 兼容:Agnes 可能忽略 response_format:'url' 返回 base64
  if (typeof data?.b64_json === 'string' && data.b64_json.length > 0) {
    urls.push(`data:image/png;base64,${data.b64_json}`);
  }
  for (const key of IMAGE_OUTPUT_KEYS) {
    pushIfUrl(data?.[key]);
  }
  // metadata 递归(与 extractVideoUrl 对等)
  const meta = data?.metadata;
  if (meta && typeof meta === 'object') {
    for (const key of IMAGE_OUTPUT_KEYS) {
      pushIfUrl((meta as AgnesJson)?.[key]);
    }
  }
  if (Array.isArray(data?.data)) {
    for (const item of data.data) {
      if (item && typeof item === 'object') {
        for (const key of IMAGE_OUTPUT_KEYS) {
          pushIfUrl((item as AgnesJson)?.[key]);
        }
        // 兼容 b64_json 在 data[] 里的情况
        if (typeof (item as AgnesJson)?.b64_json === 'string') {
          urls.push(`data:image/png;base64,${(item as AgnesJson).b64_json}`);
        }
      }
    }
  }
  return [...new Set(urls)];
}

// 文生图
export async function textToImage(prompt: string, size = '1024x768', ctx?: CallContext): Promise<ImageResult> {
  const englishPrompt = await translatePromptToEnglish(prompt, ctx);
  // [Robust] 图像生成单次实测 10~30s,留 90s 余量;默认 120s 卡太久体验差
  const data = await requestJson<AgnesJson>('POST', '/v1/images/generations', {
    model: ctx?.imageModel || DEFAULT_IMAGE_MODEL,
    prompt: englishPrompt,
    size,
    extra_body: { response_format: 'url' },
  }, ctx?.apiKey, 90000, ctx?.baseUrl);
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
  // [Robust] 图像生成单次实测 10~30s,留 90s 余量;默认 120s 卡太久体验差
  const data = await requestJson<AgnesJson>('POST', '/v1/images/generations', {
    model: ctx?.imageModel || DEFAULT_IMAGE_MODEL,
    prompt: englishPrompt,
    size,
    extra_body: {
      image: inputImageUrls,
      response_format: 'url',
    },
  }, ctx?.apiKey, 90000, ctx?.baseUrl);
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
  // [BugFix] 创建响应里必须有任务 id,否则后续状态查询无的放矢。
  // 之前 pickVideoId 找不到 id 静默返回 { kind: 'task_id' }(无 id),createVideoTask
  // 照样返回 status='queued' 的空壳,下游 pollVideo 查一个不存在的 id 直到超时。
  if (!id) {
    throw new Error(`视频创建响应未包含任务 id,原始响应: ${JSON.stringify(data).slice(0, 500)}`);
  }
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
  // [BugFix] 实测 Agnes 不同路径返回的 status 值不同:
  // /v1/videos/{id}: queued | in_progress | completed | failed
  // /agnesapi: pending | inference | completed | failed
  // 这里用 string 兜底,只关心终态 completed/failed
  status: 'queued' | 'pending' | 'in_progress' | 'inference' | 'completed' | 'failed' | string;
  progress?: number;
  url?: string; // 完成时的下载 URL
  error?: string;
  raw: unknown;
}

// 导出供单元测试验证 URL 提取逻辑(不依赖网络)
export function extractVideoUrl(data: AgnesJson): string | undefined {
  // [H4] 删掉 remixed_from_video_id:语义是"源视频 ID"不是下载 URL,
  // 服务商哪天把它写成 URL 会把别人的源视频 URL 当下载链接返回

  // [BugFix] Agnes 不同生成模式(文生视频 / 图生视频 / 多图视频)返回结构不同,
  // URL 可能藏在顶层或 metadata 的各种字段里。用"显式输出字段名优先"策略,
  // 只查语义明确为"输出"的字段(video_url / url / output_url / download_url / result_url),
  // 不做无差别深度搜索 —— 避免误提取图生视频回显的输入图 URL(image / image_url)。
  const OUTPUT_KEYS = ['video_url', 'url', 'output_url', 'download_url', 'result_url'];
  for (const key of OUTPUT_KEYS) {
    const v = data?.[key];
    if (typeof v === 'string' && /^https?:\/\//.test(v)) return v;
  }
  // [BugFix] metadata 段递归:图生视频完成态 URL 可能不在 metadata.url,
  // 而在 metadata.video_url / metadata.output_url / metadata.result.url 等。
  // 之前只硬查 metadata.url 单一路径(不像 data[] 段那样递归),
  // 导致图生视频 status=completed 却报"未返回 URL"。
  const meta = data?.metadata;
  if (meta && typeof meta === 'object') {
    const u = extractVideoUrl(meta as AgnesJson);
    if (u) return u;
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
  // [BugFix] 路径选择不再靠 identifier.startsWith('video_') 猜端点——
  // 实测 Agnes 返回的 video_id 字段值是 'task_' 开头(见测试 fixture),
  // 前缀判断会走错端点导致 404 或拿不到状态。
  // 改成:先走 /v1/videos/{id}(主路径),失败再 fallback /agnesapi。
  const parseResult = (data: AgnesJson): VideoStatusResult => ({
    status: String(data?.status ?? ''),
    progress: typeof data?.progress === 'number' ? data.progress : undefined,
    url: extractVideoUrl(data),
    error: data?.error ? JSON.stringify(data.error) : undefined,
    raw: data,
  });

  const primaryPath = `/v1/videos/${encodeURIComponent(identifier)}`;
  try {
    const data = await requestJson<AgnesJson>('GET', primaryPath, undefined, ctx?.apiKey, 120000, ctx?.baseUrl);
    return parseResult(data);
  } catch (e) {
    // 404 说明这个端点不认这个 id,fallback 到 /agnesapi
    const err = e as Error & { statusCode?: number };
    if (err?.statusCode !== 404) throw e;
  }

  // Fallback: /agnesapi?video_id=xxx
  const q = new URLSearchParams({ video_id: identifier, model_name: ctx?.videoModel || DEFAULT_VIDEO_MODEL });
  const data = await requestJson<AgnesJson>('GET', `/agnesapi?${q.toString()}`, undefined, ctx?.apiKey, 120000, ctx?.baseUrl);
  return parseResult(data);
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
