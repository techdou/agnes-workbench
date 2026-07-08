// 本地缓存管理 —— 把 Agnes 返回的外部 URL 下载到本地磁盘
// library/manifest.json 记录映射,前端通过 /api/cache/[hash] 同源访问

import fs from 'fs/promises';
import path from 'path';

const LIBRARY_DIR = path.join(process.cwd(), 'library');
const IMAGES_DIR = path.join(LIBRARY_DIR, 'images');
const VIDEOS_DIR = path.join(LIBRARY_DIR, 'videos');
const MANIFEST_PATH = path.join(LIBRARY_DIR, 'manifest.json');

// 内存级并发锁:防止同一 URL 被并发请求重复下载
const inFlight = new Map<string, Promise<CacheResult>>();

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
// 并发安全:同一 URL 的并发请求会复用同一个 in-flight Promise。
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
  await ensureDirs();
  const manifest = await loadManifest();
  const hash = await hashUrl(url);

  // 双重检查:可能在等待锁期间已被其他请求写入
  if (manifest.entries[hash]) {
    const entry = manifest.entries[hash];
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
  const fullPath = path.join(LIBRARY_DIR, localPath);

  const resp = await fetch(url);
  if (!resp.ok) {
    throw new Error(`下载失败: HTTP ${resp.status} ${url}`);
  }
  const buf = Buffer.from(await resp.arrayBuffer());
  await fs.writeFile(fullPath, buf);

  // 重新读取 manifest 再写入,避免覆盖期间其他并发写入
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
