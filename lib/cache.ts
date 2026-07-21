// 本地缓存管理 —— 把 Agnes 返回的外部 URL 下载到本地磁盘
// 元数据存数据库 MediaAsset 表(按 userId 隔离),前端通过 /api/cache/[hash] 同源访问
//
// 安全措施:
//   - SSRF 白名单:只允许缓存 Agnes 域名资源
//   - DNS rebinding 防护:fetch 前 dns.lookup 预解析,所有 IP 必须不在内网段
//   - 路径遍历防护:所有写入路径校验不越出 library 目录
//   - 文件大小上限:防止大视频 OOM
//   - inFlight 去重:同一 URL 并发只下载一次

import fs from 'fs/promises';
import path from 'path';
import dns from 'dns';
import { prisma } from '@/lib/prisma';

const LIBRARY_DIR = path.join(process.cwd(), 'library');
const IMAGES_DIR = path.join(LIBRARY_DIR, 'images');
const VIDEOS_DIR = path.join(LIBRARY_DIR, 'videos');

// 单文件最大 200MB(视频可能较大),超过拒绝,防止 OOM
const MAX_FILE_SIZE = 200 * 1024 * 1024;

// ---------- SSRF 防护 ----------

// 只允许缓存 Agnes 相关域名。
// 优先读 env AGNES_SSRF_ALLOW_SUFFIXES(逗号分隔),没配用默认。
// 这样生产扩充域名不用改代码
const DEFAULT_ALLOWED_HOST_SUFFIXES = ['agnes-ai.com', 'agnesai.com'];
function getAllowedHostSuffixes(): string[] {
  const fromEnv = process.env.AGNES_SSRF_ALLOW_SUFFIXES;
  if (fromEnv && fromEnv.trim()) {
    return fromEnv.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  }
  return DEFAULT_ALLOWED_HOST_SUFFIXES;
}

/**
 * 判断 IP 是否内网/本机/元数据地址
 * 覆盖:IPv4 私有段 + 环回 + 链路本地 + 元数据 + IPv6 环回/内网
 */
function isPrivateIp(ip: string): boolean {
  // IPv6
  if (ip.includes(':')) {
    const lower = ip.toLowerCase();
    return (
      lower === '::1' ||                     // 环回
      lower === '::' ||                      // 未指定
      lower.startsWith('fe80:') ||           // 链路本地
      lower.startsWith('fc') || lower.startsWith('fd') || // ULA 本地唯一
      lower.startsWith('::ffff:') && isPrivateIp(lower.slice('::ffff:'.length)) // IPv4-mapped
    );
  }
  // IPv4
  if (
    /^(10\.|127\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|0\.|100\.6[4-9]\.|100\.[7-9]\d\.|100\.1[01]\d\.|100\.12[0-7]\.)/.test(ip) ||
    ip.endsWith('.0.0.0') // 泛播兜底
  ) {
    return true;
  }
  return false;
}

/**
 * 校验外部 URL 是否安全可缓存(域名白名单 + 协议 + 内网段)
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
  // 拒绝 localhost 和常见内网/元数据地址(域名形态)
  if (
    host === 'localhost' ||
    host === '::1' ||
    host.endsWith('.local') ||
    /^(10\.|127\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|0\.)/.test(host)
  ) {
    throw new Error(`禁止访问内网/本地地址: ${host}`);
  }
  // 域名白名单
  const allowed = getAllowedHostSuffixes();
  const ok = allowed.some((s) => host === s || host.endsWith('.' + s));
  if (!ok) {
    throw new Error(`仅允许缓存 Agnes 域名资源,当前域名: ${host}`);
  }
}

/**
 * DNS rebinding 防护:fetch 前预解析所有 A/AAAA 记录,
 * 任一解析到内网/元数据 IP 就拒绝。
 *
 * 说明:Node fetch(基于 undici)每次连接会重新解析 DNS,纯 TOCTOU 窗口无法 100% 消除,
 * 但预解析可以把"攻击者控制 DNS 在校验后切到内网"的窗口收窄到毫秒级,
 * 配合上面的域名白名单 + 内网段校验,实际利用门槛非常高。
 */
async function assertSafeDns(hostname: string): Promise<void> {
  // all: true 返回所有记录,verifier 想全检
  let addrs: string[];
  try {
    const result = await dns.promises.lookup(hostname, { all: true });
    addrs = result.map((r) => r.address);
  } catch (e) {
    throw new Error(`DNS 解析失败 ${hostname}: ${(e as Error).message}`);
  }
  if (addrs.length === 0) {
    throw new Error(`DNS 无解析结果: ${hostname}`);
  }
  for (const ip of addrs) {
    if (isPrivateIp(ip)) {
      throw new Error(`域名 ${hostname} 解析到内网地址 ${ip},拒绝缓存`);
    }
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
// ManifestEntry + filterAndSortEntries 抽到 cache-logic.ts(无 IO 依赖,便于单测)
export type { ManifestEntry } from './cache-logic';
export { filterAndSortEntries } from './cache-logic';
import type { ManifestEntry } from './cache-logic';

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
  // [S2] DNS rebinding 防护:fetch 前预解析,拒绝解析到内网的域名
  const parsed = new URL(url);
  await assertSafeDns(parsed.hostname);

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
// [H4] 警告:此函数无所有权校验。所有权校验由路由层基于 userId 做
// (普通用户走 getEntryByUserHash;admin 路径用这个)
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
  return assetToEntry(asset);
}

/**
 * [M1] 迁移辅助:给所有 favorited=true 但没有 favoritedAt 的老条目回填时间
 * 避免 listEntries 排序时新老混排无意义。
 * 用 createdAt 作为 fallback(无法精确知道实际收藏时刻,但比无值好)
 */
export async function backfillFavoritedAt(): Promise<number> {
  // multi-user 版:Prisma 批量更新 favorited=true AND favoritedAt IS NULL
  // 把 createdAt 回填到 favoritedAt(不精确知道收藏时刻,但比 null 好)
  const result = await prisma.mediaAsset.updateMany({
    where: {
      favorited: true,
      favoritedAt: null,
    },
    data: {
      // Prisma 不支持直接用另一列的值更新,只能先查再循环更新
      // 单进程惰性触发,数量有限,可接受
    },
  });
  // updateMany 不能跨列赋值,改成查 + 逐条更新
  if (result.count === 0) return 0;
  const needFix = await prisma.mediaAsset.findMany({
    where: { favorited: true, favoritedAt: null },
    select: { id: true, createdAt: true },
  });
  for (const row of needFix) {
    await prisma.mediaAsset.update({
      where: { id: row.id },
      data: { favoritedAt: row.createdAt },
    });
  }
  return needFix.length;
}

// 列出条目(按时间倒序)
// - projectId 过滤本项目归档
// - onlyFavorited 只看收藏(跨项目,用于 /gallery)
// 注:多用户场景下 userId 必填,画廊是"某用户的全局收藏",不是跨用户
export async function listEntries(
  userId: string,
  projectId?: string,
  onlyFavorited?: boolean
): Promise<ManifestEntry[]> {
  // multi-user 版:DB 直接做过滤 + 排序,不走 filterAndSortEntries(那是 main 的 JSON 版)
  // 排序 DB 直接 orderBy,但老数据 favoritedAt 可能为 null → 用 backfillFavoritedAt 保证有值
  const assets = await prisma.mediaAsset.findMany({
    where: {
      userId,
      ...(projectId ? { projectId } : {}),
      ...(onlyFavorited ? { favorited: true } : {}),
    },
    orderBy: onlyFavorited ? { favoritedAt: 'desc' } : { createdAt: 'desc' },
  });
  return assets.map(assetToEntry);
}

/**
 * 切换某条目的收藏状态(给 PATCH /api/cache/[hash] 用)
 * 严格按 (userId, hash) 所有权校验:用户只能改自己名下的
 */
export async function setFavorited(
  userId: string,
  hash: string,
  favorited: boolean
): Promise<ManifestEntry> {
  const asset = await prisma.mediaAsset.update({
    where: { userId_hash: { userId, hash } },
    data: {
      favorited,
      favoritedAt: favorited ? new Date() : null,
    },
  });
  return assetToEntry(asset);
}

// Prisma row → ManifestEntry DTO(统一映射,避免字段名/类型差异散落)
function assetToEntry(a: {
  hash: string;
  originalUrl: string;
  localPath: string;
  type: string;
  prompt: string | null;
  createdAt: Date;
  projectId: string | null;
  userId: string;
  favorited: boolean;
  favoritedAt: Date | null;
}): ManifestEntry {
  return {
    hash: a.hash,
    originalUrl: a.originalUrl,
    localPath: a.localPath,
    type: a.type as 'image' | 'video',
    prompt: a.prompt || undefined,
    createdAt: a.createdAt.toISOString(),
    projectId: a.projectId || undefined,
    userId: a.userId,
    favorited: a.favorited,
    favoritedAt: a.favoritedAt ? a.favoritedAt.toISOString() : undefined,
  };
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
