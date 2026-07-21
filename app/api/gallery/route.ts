// 全局画廊 —— 跨项目列出当前用户所有 ★ 收藏的条目
// 需登录,只返回当前用户的收藏;不传 projectId(跨项目)
import { NextResponse } from 'next/server';
import { listEntries, backfillFavoritedAt } from '@/lib/cache';
import { requireUser, isAuthError } from '@/lib/auth-guard';

export async function GET() {
  try {
    const session = await requireUser();
    if (isAuthError(session)) return session;

    // [M1] 惰性回填:老数据 favorited=true 但缺 favoritedAt,用 createdAt 补上
    // 不阻塞:出错也继续(只是排序 fallback 到 createdAt)
    await backfillFavoritedAt().catch(() => 0);
    const entries = await listEntries(session.user.id, undefined, true);
    return NextResponse.json({ entries });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
