// 视频状态查询代理
import { NextRequest, NextResponse } from 'next/server';
import { getVideoStatus } from '@/lib/agnes';

export async function GET(req: NextRequest) {
  try {
    const apiKey = req.headers.get('X-Agnes-Key');
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id 必填' }, { status: 400 });
    const result = await getVideoStatus(id, apiKey);
    return NextResponse.json(result);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
