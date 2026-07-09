// 本地缓存管理 —— 把 Agnes 返回的外部 URL 下载到本地磁盘
// library/manifest.json 记录映射,前端通过 /api/cache/[hash] 同源访问
//
// 安全措施:
//   - SSRF 白名单:只允许缓存 Agnes 域名资源
//   - 路径遍历防护:所有写入路径校验不越出 library 目录
//   - 文件大小上限:防止大视频 OOM
//   - manifest 写锁:串行化 manifest 读写,防止并发覆盖丢数据

import fs from 'fs/promises';
import path from 'path';

const LIBRARY_DIR = path.join(process.cwd(), 'library');
const IMAGES_DIR = path.join(LIBRARY_DIR, 'images');
const VIDEOS_DIR = path.join(LIBRARY_DIR, 'videos');
const MANIFEST_PATH = path.join(LIBRARY_DIR, 'manifest.json');

// 单文件最大 200MB(视频可能较大),超过拒绝,防止 OOM
const MAX_FILE_SIZE = 200 * 1024 * 1024;

// ---------- SSRF 防护 ----------

// 只允许缓存 Agnes 相关域名(生产域名可能后续扩充)
const ALLOWED_HOST_SUFFIXES = [
  'agnes-ai.com',
  'agnesai.com',
];

/**
 * 校验外部 URL 是否安全可缓存
 * - 必须是 http(s)
 * - 域名必须在白名单后缀里
 * - 拒绝 localhost / 内网 IP / 元数据地址
 */
function assertSafeUrl(raw: string): void {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new Error(`非法 URL: ${raw}`);
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    throw new Error(`仅允许 http(s) 协议,当前 ${u.protocol}`);
  }
  const host = u.hostname.toLowerCase();
  // 拒绝 localhost 和常见内网/元数据地址
  if (
    host === 'localhost' ||
    host === '::1' ||
    host.endsWith('.local') ||
    /^(10\.|127\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|0\.)/.test(host)
  ) {
    throw new Error(`禁止访问内网/本地地址: ${host}`);
  }
  // 域名白名单
  const ok = ALLOWED_HOST_SUFFIXES.some((s) => host === s || host.endsWith('.' + s));
  if (!ok) {
    throw new Error(`仅允许缓存 Agnes 域名资源,当前域名: ${host}`);
  }
}

/**
 * 校验本地路径不越出 library 目录(防路径遍历)
 */
function assertSafeLocalPath(localPath: string): void {
  const full = path.resolve(LIBRARY_DIR, localPath);
  if (full !== LIBRARY_DIR && !full.startsWith(LIBRARY_DIR + path.sep)) {
    throw new Error(`非法本地路径: ${localPath}`);
  }
}

// ---------- manifest 写锁(单进程内串行化) ----------

// inFlight 防同一 URL 并发;manifestLock 防不同 URL 并发写 manifest 互相覆盖
const inFlight = new Map<string, Promise<CacheResult>>();
let manifestLock = Promise.resolve();

/**
 * 串行化对 manifest 的读-改-写操作,避免并发覆盖
 */
async function withManifestLock<T>(fn: () => Promise<T>): Promise<T> {
  const prev = manifestLock;
  let release!: () => void;
  manifestLock = new Promise<void>((r) => (release = r));
  await prev;
  try {
    return await fn();
  } finally {
    release();
  }
}

// ---------- 类型 ----------

export interface ManifestEntry {
  hash: string;
  originalUrl: string;
  localPath: string; // 相对 library 的路径,如 images/abc.png
  type: 'image' | 'video';
  prompt?: string;
  createdAt: string;
}

export interface Manifest {
  entries: Record<string, ManifestEntry>;
}

async function ensureDirs() {
  await fs.mkdir(IMAGES_DIR, { recursive: true });
  await fs.mkdir(VIDEOS_DIR, { recursive: true });
}

export async function loadManifest(): Promise<Manifest> {
  try {
    const raw = await fs.readFile(MANIFEST_PATH, 'utf-8');
    return JSON.parse(raw) as Manifest;
  } catch {
    return { entries: {} };
  }
}

async function saveManifest(m: Manifest) {
  await ensureDirs();
  await fs.writeFile(MANIFEST_PATH, JSON.stringify(m, null, 2), 'utf-8');
}

// 简单 hash(不追求密码学强度,URL 去重够用)
async function hashUrl(url: string): Promise<string> {
  const { createHash } = await import('crypto');
  return createHash('sha1').update(url).digest('hex').slice(0, 16);
}

function extFromUrl(url: string, fallback: string): string {
  const m = url.match(/\.(png|jpg|jpeg|webp|gif|mp4|webm|mov)(\?|$)/i);
  return m ? `.${m[1].toLowerCase()}` : fallback;
}

export interface CacheResult {
  hash: string;
  localPath: string;
  fullPath: string;
  created: boolean; // true = 本次新下载,false = 已存在
}

// 把外部 URL 下载到本地,返回本地相对路径。已存在则直接复用。
// 并发安全:同一 URL 的并发请求会复用同一个 in-flight Promise;
// 不同 URL 的并发请求通过 manifestLock 串行化 manifest 写入。
export async function cacheExternalUrl(
  url: string,
  type: 'image' | 'video',
  prompt?: string
): Promise<CacheResult> {
  const key = `${type}:${url}`;
  const existing = inFlight.get(key);
  if (existing) return existing;
  const p = doCache(url, type, prompt).finally(() => inFlight.delete(key));
  inFlight.set(key, p);
  return p;
}

// 实际下载逻辑(被并发锁包裹)
async function doCache(
  url: string,
  type: 'image' | 'video',
  prompt?: string
): Promise<CacheResult> {
  // [S1] SSRF 校验:下载前先验域名
  assertSafeUrl(url);

  await ensureDirs();

  // 已存在检查也放进锁里,避免和另一个正在写的请求竞争
  return withManifestLock(async () => {
    const manifest = await loadManifest();
    const hash = await hashUrl(url);

    // 已缓存,直接复用
    if (manifest.entries[hash]) {
      const entry = manifest.entries[hash];
      assertSafeLocalPath(entry.localPath); // 防御性:读出来也校验
      return {
        hash,
        localPath: entry.localPath,
        fullPath: path.join(LIBRARY_DIR, entry.localPath),
        created: false,
      };
    }

    const ext = extFromUrl(url, type === 'image' ? '.png' : '.mp4');
    const subdir = type === 'image' ? 'images' : 'videos';
    const localPath = `${subdir}/${hash}${ext}`;
    assertSafeLocalPath(localPath);
    const fullPath = path.join(LIBRARY_DIR, localPath);

    // 下载 + 大小限制(防止大视频 OOM)
    const resp = await fetch(url);
    if (!resp.ok) {
      throw new Error(`下载失败: HTTP ${resp.status} ${url}`);
    }
    const contentLength = Number(resp.headers.get('content-length') || 0);
    if (contentLength > MAX_FILE_SIZE) {
      throw new Error(`文件过大(${(contentLength / 1024 / 1024).toFixed(1)}MB),超过 ${(MAX_FILE_SIZE / 1024 / 1024)}MB 限制`);
    }
    const buf = Buffer.from(await resp.arrayBuffer());
    if (buf.length > MAX_FILE_SIZE) {
      throw new Error(`文件过大(${(buf.length / 1024 / 1024).toFixed(1)}MB),超过 ${(MAX_FILE_SIZE / 1024 / 1024)}MB 限制`);
    }
    await fs.writeFile(fullPath, buf);

    // 在锁内重新读取最新 manifest 再写入,避免覆盖期间其他并发写入
    const fresh = await loadManifest();
    fresh.entries[hash] = {
      hash,
      originalUrl: url,
      localPath,
      type,
      prompt,
      createdAt: new Date().toISOString(),
    };
    await saveManifest(fresh);

    return { hash, localPath, fullPath, created: true };
  });
}

// 根据 hash 取 manifest 条目
export async function getEntryByHash(hash: string): Promise<ManifestEntry | undefined> {
  const manifest = await loadManifest();
  return manifest.entries[hash];
}

// 列出所有条目(按时间倒序)
export async function listEntries(): Promise<ManifestEntry[]> {
  const manifest = await loadManifest();
  return Object.values(manifest.entries).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

// 导出供路由层使用
export { LIBRARY_DIR, assertSafeLocalPath };
