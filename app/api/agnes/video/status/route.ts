// 视频状态查询代理
import { NextRequest, NextResponse } from 'next/server';
import { getVideoStatus, type CallContext } from '@/lib/agnes';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const videoModel = searchParams.get('videoModel') || undefined;
    const baseUrl = searchParams.get('baseUrl') || undefined;
    if (!id) return NextResponse.json({ error: 'id 必填' }, { status: 400 });
    const ctx: CallContext = {
      apiKey: req.headers.get('X-Agnes-Key'),
      videoModel,
      baseUrl,
    };
    const result = await getVideoStatus(id, ctx);
    return NextResponse.json(result);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
