// 本地缓存管理 —— 把 Agnes 返回的外部 URL 下载到本地磁盘
// 元数据存数据库 MediaAsset 表(按 userId 隔离),前端通过 /api/cache/[hash] 同源访问
//
// 安全措施:
//   - SSRF 白名单:只允许缓存 Agnes 域名资源
//   - 路径遍历防护:所有写入路径校验不越出 library 目录
//   - 文件大小上限:防止大视频 OOM
//   - inFlight 去重:同一 URL 并发只下载一次

import fs from 'fs/promises';
import path from 'path';
import { prisma } from '@/lib/prisma';

const LIBRARY_DIR = path.join(process.cwd(), 'library');
const IMAGES_DIR = path.join(LIBRARY_DIR, 'images');
const VIDEOS_DIR = path.join(LIBRARY_DIR, 'videos');

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
  if (
    host === 'localhost' ||
    host === '::1' ||
    host.endsWith('.local') ||
    /^(10\.|127\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|0\.)/.test(host)
  ) {
    throw new Error(`禁止访问内网/本地地址: ${host}`);
  }
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

// ---------- inFlight 去重(同一 URL 并发只下载一次) ----------

const inFlight = new Map<string, Promise<CacheResult>>();

// ---------- 类型 ----------

export interface ManifestEntry {
  hash: string;
  originalUrl: string;
  localPath: string;
  type: 'image' | 'video';
  prompt?: string;
  createdAt: string;
  projectId?: string;
  userId?: string;
}

async function ensureDirs() {
  await fs.mkdir(IMAGES_DIR, { recursive: true });
  await fs.mkdir(VIDEOS_DIR, { recursive: true });
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

/**
 * 把外部 URL 下载到本地,返回本地相对路径。已存在则直接复用。
 * 并发安全:同一 URL 的并发请求会复用同一个 in-flight Promise。
 *
 * @param userId 归属用户(用于 DB 记录隔离)
 */
export async function cacheExternalUrl(
  url: string,
  type: 'image' | 'video',
  prompt?: string,
  projectId?: string,
  userId?: string
): Promise<CacheResult> {
  const key = `${userId || 'anon'}:${type}:${url}`;
  const existing = inFlight.get(key);
  if (existing) return existing;
  const p = doCache(url, type, prompt, projectId, userId).finally(() => inFlight.delete(key));
  inFlight.set(key, p);
  return p;
}

// 实际下载逻辑
async function doCache(
  url: string,
  type: 'image' | 'video',
  prompt?: string,
  projectId?: string,
  userId?: string
): Promise<CacheResult> {
  assertSafeUrl(url);
  await ensureDirs();

  const hash = await hashUrl(url);
  const uid = userId || '';

  // 1. 当前用户是否已有该 hash 的 DB 行 → 直接复用
  const ownExisting = uid
    ? await prisma.mediaAsset.findUnique({ where: { userId_hash: { userId: uid, hash } } })
    : null;
  if (ownExisting) {
    assertSafeLocalPath(ownExisting.localPath);
    return {
      hash,
      localPath: ownExisting.localPath,
      fullPath: path.join(LIBRARY_DIR, ownExisting.localPath),
      created: false,
    };
  }

  // 2. 文件物理副本:看是否已有任意用户下载过(磁盘去重)
  const anyExisting = await prisma.mediaAsset.findFirst({
    where: { hash },
    select: { localPath: true },
  });

  let localPath: string;
  let fullPath: string;
  let fileCreated = false;

  if (anyExisting) {
    // 复用磁盘文件(无需重新下载)
    assertSafeLocalPath(anyExisting.localPath);
    localPath = anyExisting.localPath;
    fullPath = path.join(LIBRARY_DIR, localPath);
  } else {
    // 首次下载
    const ext = extFromUrl(url, type === 'image' ? '.png' : '.mp4');
    const subdir = type === 'image' ? 'images' : 'videos';
    localPath = `${subdir}/${hash}${ext}`;
    assertSafeLocalPath(localPath);
    fullPath = path.join(LIBRARY_DIR, localPath);

    const resp = await fetch(url);
    if (!resp.ok) {
      throw new Error(`下载失败: HTTP ${resp.status} ${url}`);
    }
    const contentLength = Number(resp.headers.get('content-length') || 0);
    if (contentLength > MAX_FILE_SIZE) {
      throw new Error(`文件过大(${(contentLength / 1024 / 1024).toFixed(1)}MB),超过 ${MAX_FILE_SIZE / 1024 / 1024}MB 限制`);
    }
    const buf = Buffer.from(await resp.arrayBuffer());
    if (buf.length > MAX_FILE_SIZE) {
      throw new Error(`文件过大(${(buf.length / 1024 / 1024).toFixed(1)}MB),超过 ${MAX_FILE_SIZE / 1024 / 1024}MB 限制`);
    }
    await fs.writeFile(fullPath, buf);
    fileCreated = true;
  }

  // 3. 给当前用户插一行(唯一约束 [userId, hash] 防并发)
  await prisma.mediaAsset.upsert({
    where: { userId_hash: { userId: uid, hash } },
    create: {
      hash,
      originalUrl: url,
      localPath,
      type,
      prompt,
      projectId: projectId || null,
      userId: uid,
    },
    update: {}, // 该用户已有则不更新
  });

  return { hash, localPath, fullPath, created: fileCreated };
}

// 根据 hash 取条目(用于 /api/cache/[hash] 路由)
// 多用户场景下:同一个 hash 可能属于多个用户,这里返回任意一条用于读文件
// 所有权校验由路由层基于 userId 做
export async function getEntryByHash(hash: string): Promise<ManifestEntry | undefined> {
  const asset = await prisma.mediaAsset.findFirst({ where: { hash } });
  if (!asset) return undefined;
  return {
    hash: asset.hash,
    originalUrl: asset.originalUrl,
    localPath: asset.localPath,
    type: asset.type as 'image' | 'video',
    prompt: asset.prompt || undefined,
    createdAt: asset.createdAt.toISOString(),
    projectId: asset.projectId || undefined,
    userId: asset.userId,
  };
}

// 按 (userId, hash) 精确查找 —— 用于所有权校验
export async function getEntryByUserHash(
  userId: string,
  hash: string
): Promise<ManifestEntry | undefined> {
  const asset = await prisma.mediaAsset.findUnique({
    where: { userId_hash: { userId, hash } },
  });
  if (!asset) return undefined;
  return {
    hash: asset.hash,
    originalUrl: asset.originalUrl,
    localPath: asset.localPath,
    type: asset.type as 'image' | 'video',
    prompt: asset.prompt || undefined,
    createdAt: asset.createdAt.toISOString(),
    projectId: asset.projectId || undefined,
    userId: asset.userId,
  };
}

// 列出条目(按时间倒序,按 userId + projectId 过滤)
export async function listEntries(
  userId: string,
  projectId?: string
): Promise<ManifestEntry[]> {
  const assets = await prisma.mediaAsset.findMany({
    where: {
      userId,
      ...(projectId ? { projectId } : {}),
    },
    orderBy: { createdAt: 'desc' },
  });
  return assets.map((a) => ({
    hash: a.hash,
    originalUrl: a.originalUrl,
    localPath: a.localPath,
    type: a.type as 'image' | 'video',
    prompt: a.prompt || undefined,
    createdAt: a.createdAt.toISOString(),
    projectId: a.projectId || undefined,
    userId: a.userId,
  }));
}

/**
 * 把同源 URL(/api/cache/xxx)转成 data URL(base64)
 * 让 Agnes API 能"看到"本地图片/上传图片
 * 只对图片转 base64,视频文件太大不转;加 10MB 上限防 OOM
 */
const MAX_BASE64_SIZE = 10 * 1024 * 1024;
const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif']);
const VIDEO_EXTS = new Set(['.mp4', '.webm', '.mov']);

export async function resolveLocalImages(urls: string[], userId?: string): Promise<string[]> {
  const result: string[] = [];
  for (const url of urls) {
    if (url.startsWith('/api/cache/')) {
      const hash = url.replace('/api/cache/', '');
      if (!/^[0-9a-f]{1,32}$/.test(hash)) {
        result.push(url);
        continue;
      }
      try {
        // 严格按 userId 校验所有权:用户只能 base64 自己的缓存图片
        // userId 为空时不解析(保守失败,保留原 URL)
        const entry = userId
          ? await getEntryByUserHash(userId, hash)
          : undefined;
        if (!entry) { result.push(url); continue; }

        const ext = path.extname(entry.localPath).toLowerCase();
        if (VIDEO_EXTS.has(ext)) {
          result.push(url);
          continue;
        }
        if (!IMAGE_EXTS.has(ext)) {
          result.push(url);
          continue;
        }

        const fullPath = path.join(LIBRARY_DIR, entry.localPath);
        const stat = await fs.stat(fullPath);
        if (stat.size > MAX_BASE64_SIZE) {
          result.push(url);
          continue;
        }

        const buf = await fs.readFile(fullPath);
        const mime = ext === '.png' ? 'image/png'
          : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg'
          : ext === '.webp' ? 'image/webp'
          : ext === '.gif' ? 'image/gif' : 'image/png';
        result.push(`data:${mime};base64,${buf.toString('base64')}`);
      } catch {
        result.push(url);
      }
    } else {
      result.push(url);
    }
  }
  return result;
}

// 导出供路由层使用
export { LIBRARY_DIR, assertSafeLocalPath, assertSafeUrl };
