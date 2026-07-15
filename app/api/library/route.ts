// 画廊列表(按项目隔离 + 按用户隔离)
// 需登录,只返回当前用户的媒体
import { NextRequest, NextResponse } from 'next/server';
import { listEntries } from '@/lib/cache';
import { requireUser, isAuthError } from '@/lib/auth-guard';

export async function GET(req: NextRequest) {
  try {
    const session = await requireUser();
    if (isAuthError(session)) return session;

    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId') || undefined;
    const entries = await listEntries(session.user.id, projectId);
    return NextResponse.json({ entries });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
