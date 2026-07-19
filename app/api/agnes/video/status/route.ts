// 视频状态查询代理(需登录 + 用户已配置 API Key,baseUrl SSRF 校验)
import { NextRequest, NextResponse } from 'next/server';
import { getVideoStatus, type CallContext } from '@/lib/agnes';
import { assertSafeUrl } from '@/lib/cache';
import { getUserContext } from '@/lib/user-key';

export async function GET(req: NextRequest) {
  try {
    const ctx0 = await getUserContext();
    if (!ctx0) {
      return NextResponse.json({ error: '未登录或账号已禁用' }, { status: 401 });
    }
    if (!ctx0.apiKey) {
      return NextResponse.json({ error: '请先在设置中配置 API Key' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const videoModel = searchParams.get('videoModel') || undefined;
    const baseUrl = searchParams.get('baseUrl') || undefined;
    if (!id) return NextResponse.json({ error: 'id 必填' }, { status: 400 });

    const safeBaseUrl = baseUrl ? (assertSafeUrl(baseUrl), baseUrl) : undefined;
    const ctx: CallContext = {
      apiKey: ctx0.apiKey,
      videoModel,
      baseUrl: safeBaseUrl,
    };
    const result = await getVideoStatus(id, ctx);
    return NextResponse.json(result);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    const statusCode = (e as { statusCode?: number }).statusCode || 500;
    return NextResponse.json({ error: msg }, { status: statusCode });
  }
}
