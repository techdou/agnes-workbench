// 分布式 Rate Limit —— 优先 Upstash Redis(serverless 多实例共享),
// 无 Redis 配置时 fallback 到进程内 Map(单实例开发环境够用)
//
// 用法:
//   const { success } = await checkRateLimit('register:' + ip, 5, '5 m');
//   if (!success) return 429;

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// ---------- Redis 实例(可选) ----------
let redisLimiter: Ratelimit | null = null;

if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });
  redisLimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, '5 m'),
    prefix: 'agnes:ratelimit',
    analytics: false,
  });
}

// ---------- 内存 fallback(无 Redis 配置时) ----------
interface MemoryEntry {
  timestamps: number[];
}
const memoryStore = new Map<string, MemoryEntry>();

function memoryRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): { success: boolean } {
  const now = Date.now();
  const entry = memoryStore.get(key) || { timestamps: [] };
  entry.timestamps = entry.timestamps.filter((t) => now - t < windowMs);
  if (entry.timestamps.length >= maxRequests) {
    memoryStore.set(key, entry);
    return { success: false };
  }
  entry.timestamps.push(now);
  memoryStore.set(key, entry);
  return { success: true };
}

/**
 * 统一 Rate Limit 检查
 * @param key 限流键(如 'register:1.2.3.4')
 * @param maxRequests 窗口内最大请求数
 * @param window 时间窗口('5 m' / '1 h' 等,Redis 模式用;内存模式解析成 ms)
 */
export async function checkRateLimit(
  key: string,
  maxRequests: number,
  window: string
): Promise<{ success: boolean; remaining: number }> {
  // Redis 模式:分布式,serverless 多实例共享
  if (redisLimiter) {
    const result = await redisLimiter.limit(key);
    return { success: result.success, remaining: result.remaining };
  }

  // 内存 fallback:单实例开发环境
  const windowMs = parseWindowToMs(window);
  // 内存模式 maxRequests 固定用参数值(Redis 模式用 slidingWindow 构造时的值)
  const result = memoryRateLimit(key, maxRequests, windowMs);
  return { success: result.success, remaining: 0 };
}

function parseWindowToMs(window: string): number {
  const match = window.match(/^(\d+)\s*(s|m|h|d)$/);
  if (!match) return 5 * 60 * 1000; // 默认 5 分钟
  const num = parseInt(match[1], 10);
  const unit = match[2];
  const multipliers: Record<string, number> = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };
  return num * (multipliers[unit] || multipliers.m);
}
