// 全局画廊 —— 跨项目列出所有 ★ 收藏的条目
// 不传 projectId,只看 favorited === true
import { NextResponse } from 'next/server';
import { listEntries, backfillFavoritedAt } from '@/lib/cache';

export async function GET() {
  try {
    // [M1] 惰性回填:老数据 favorited=true 但缺 favoritedAt,用 createdAt 补上
    // 不阻塞:出错也继续(只是排序 fallback 到 createdAt)
    await backfillFavoritedAt().catch(() => 0);
    const entries = await listEntries(undefined, true);
    return NextResponse.json({ entries });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
