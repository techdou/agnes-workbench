// 视频状态查询代理(需登录,API Key 从用户 DB 记录读取)
import { NextRequest, NextResponse } from 'next/server';
import { getVideoStatus, type CallContext } from '@/lib/agnes';
import { getUserApiKey } from '@/lib/user-key';

export async function GET(req: NextRequest) {
  try {
    const apiKey = await getUserApiKey();
    if (!apiKey) {
      return NextResponse.json({ error: '请先登录并配置 API Key' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const videoModel = searchParams.get('videoModel') || undefined;
    const baseUrl = searchParams.get('baseUrl') || undefined;
    if (!id) return NextResponse.json({ error: 'id 必填' }, { status: 400 });
    const ctx: CallContext = {
      apiKey,
      videoModel,
      baseUrl,
    };
    const result = await getVideoStatus(id, ctx);
    return NextResponse.json(result);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    const statusCode = (e as { statusCode?: number }).statusCode || 500;
    return NextResponse.json({ error: msg }, { status: statusCode });
  }
}
