// 全局画廊 —— 跨项目列出当前用户所有 ★ 收藏的条目
// 需登录,只返回当前用户的收藏;不传 projectId(跨项目)
import { NextResponse } from 'next/server';
import { listEntries } from '@/lib/cache';
import { requireUser, isAuthError } from '@/lib/auth-guard';

export async function GET() {
  try {
    const session = await requireUser();
    if (isAuthError(session)) return session;

    const entries = await listEntries(session.user.id, undefined, true);
    return NextResponse.json({ entries });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
