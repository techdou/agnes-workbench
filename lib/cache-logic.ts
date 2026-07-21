// 缓存层纯逻辑(类型 + 过滤排序纯函数)
// 单独抽出来便于单测——cache.ts 顶层 import Prisma,测试环境没 DB 连接会炸,
// 这里没有任何 IO 依赖,可以直接 import 跑

export interface ManifestEntry {
  hash: string;
  originalUrl: string;
  localPath: string;
  type: 'image' | 'video';
  prompt?: string;
  createdAt: string;
  projectId?: string;
  userId?: string;
  favorited?: boolean;
  favoritedAt?: string;
}

/**
 * 纯函数:过滤 + 排序条目
 * - projectId 过滤本项目归档
 * - onlyFavorited 只看收藏(跨项目,用于 /gallery)
 * - 收藏视图按 favoritedAt 排序,普通视图按 createdAt
 * - favoritedAt 缺失时 fallback 到 createdAt(老数据兼容)
 */
export function filterAndSortEntries(
  entries: ManifestEntry[],
  opts: { projectId?: string; onlyFavorited?: boolean } = {}
): ManifestEntry[] {
  let result = [...entries];
  if (opts.projectId) {
    result = result.filter((e) => e.projectId === opts.projectId);
  }
  if (opts.onlyFavorited) {
    result = result.filter((e) => e.favorited === true);
  }
  const sortKey = opts.onlyFavorited ? 'favoritedAt' : 'createdAt';
  return result.sort((a, b) => {
    const ta = new Date((a[sortKey] as string | undefined) || a.createdAt).getTime();
    const tb = new Date((b[sortKey] as string | undefined) || b.createdAt).getTime();
    return tb - ta;
  });
}
