import { describe, it, expect } from 'vitest';
import { filterAndSortEntries, type ManifestEntry } from '../cache';

// ---------- 辅助 ----------
function makeEntry(opts: Partial<ManifestEntry> & { hash: string }): ManifestEntry {
  return {
    originalUrl: 'https://apihub.agnes-ai.com/x.png',
    localPath: `images/${opts.hash}.png`,
    type: 'image',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...opts,
  };
}

// ---------- filterAndSortEntries ----------

describe('filterAndSortEntries', () => {
  it('无过滤:按 createdAt 倒序', () => {
    const entries = [
      makeEntry({ hash: 'a', createdAt: '2026-01-01T00:00:00.000Z' }),
      makeEntry({ hash: 'b', createdAt: '2026-02-01T00:00:00.000Z' }),
      makeEntry({ hash: 'c', createdAt: '2026-01-15T00:00:00.000Z' }),
    ];
    const result = filterAndSortEntries(entries);
    expect(result.map((e) => e.hash)).toEqual(['b', 'c', 'a']);
  });

  it('按 projectId 过滤', () => {
    const entries = [
      makeEntry({ hash: 'a', projectId: 'p1' }),
      makeEntry({ hash: 'b', projectId: 'p2' }),
      makeEntry({ hash: 'c', projectId: 'p1' }),
    ];
    const result = filterAndSortEntries(entries, { projectId: 'p1' });
    expect(result.map((e) => e.hash).sort()).toEqual(['a', 'c']);
  });

  it('只看收藏:过滤 favorited=true,按 favoritedAt 倒序', () => {
    const entries = [
      makeEntry({ hash: 'a', favorited: true, favoritedAt: '2026-03-01T00:00:00.000Z' }),
      makeEntry({ hash: 'b', favorited: false }),
      makeEntry({ hash: 'c', favorited: true, favoritedAt: '2026-04-01T00:00:00.000Z' }),
      makeEntry({ hash: 'd', favorited: true, favoritedAt: '2026-02-01T00:00:00.000Z' }),
    ];
    const result = filterAndSortEntries(entries, { onlyFavorited: true });
    expect(result.map((e) => e.hash)).toEqual(['c', 'a', 'd']);
  });

  it('收藏视图:老数据缺 favoritedAt 时 fallback 到 createdAt', () => {
    // 模拟 M1 迁移场景:favorited=true 但 favoritedAt 缺失
    const entries = [
      makeEntry({ hash: 'old', favorited: true, createdAt: '2026-01-01T00:00:00.000Z' }),
      makeEntry({ hash: 'new', favorited: true, favoritedAt: '2026-05-01T00:00:00.000Z', createdAt: '2026-04-01T00:00:00.000Z' }),
    ];
    const result = filterAndSortEntries(entries, { onlyFavorited: true });
    // new 的 favoritedAt=2026-05 比 old 的 fallback createdAt=2026-01 新,排前面
    expect(result.map((e) => e.hash)).toEqual(['new', 'old']);
  });

  it('组合过滤:projectId + onlyFavorited', () => {
    const entries = [
      makeEntry({ hash: 'a', projectId: 'p1', favorited: true, favoritedAt: '2026-03-01T00:00:00.000Z' }),
      makeEntry({ hash: 'b', projectId: 'p2', favorited: true, favoritedAt: '2026-04-01T00:00:00.000Z' }),
      makeEntry({ hash: 'c', projectId: 'p1', favorited: false }),
    ];
    const result = filterAndSortEntries(entries, { projectId: 'p1', onlyFavorited: true });
    // 只剩 a(c 没收藏,b 是别的项目)
    expect(result.map((e) => e.hash)).toEqual(['a']);
  });

  it('不改原数组(纯函数)', () => {
    const entries = [
      makeEntry({ hash: 'a', createdAt: '2026-01-01T00:00:00.000Z' }),
      makeEntry({ hash: 'b', createdAt: '2026-02-01T00:00:00.000Z' }),
    ];
    const originalOrder = entries.map((e) => e.hash);
    filterAndSortEntries(entries);
    expect(entries.map((e) => e.hash)).toEqual(originalOrder);
  });

  it('空数组入参返回空数组', () => {
    expect(filterAndSortEntries([])).toEqual([]);
  });
});
