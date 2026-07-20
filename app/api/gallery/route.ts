// 全局画廊 —— 跨项目列出所有 ★ 收藏的条目
// 不传 projectId,只看 favorited === true
import { NextResponse } from 'next/server';
import { listEntries } from '@/lib/cache';

export async function GET() {
  try {
    const entries = await listEntries(undefined, true);
    return NextResponse.json({ entries });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
