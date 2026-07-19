// 模型列表代理 —— 转发 GET /v1/models,返回 Agnes 当前所有可用模型
// 需登录 + 用户已配置 API Key,baseUrl SSRF 校验
import { NextRequest, NextResponse } from 'next/server';
import { assertSafeUrl } from '@/lib/cache';
import { getUserContext } from '@/lib/user-key';

const BASE_URL = process.env.AGNES_BASE_URL || 'https://apihub.agnes-ai.com';

export async function GET(req: NextRequest) {
  try {
    const ctx0 = await getUserContext();
    if (!ctx0) {
      return NextResponse.json({ error: '未登录或账号已禁用' }, { status: 401 });
    }
    if (!ctx0.apiKey) {
      return NextResponse.json({ error: '请先在设置中配置 API Key' }, { status: 403 });
    }

    const searchParams = new URL(req.url).searchParams;
    const baseUrlRaw = searchParams.get('baseUrl') || BASE_URL;
    // SSRF:用户可控 baseUrl 必须过白名单
    assertSafeUrl(baseUrlRaw);
    const baseUrl = baseUrlRaw;

    const resp = await fetch(`${baseUrl}/v1/models`, {
      headers: { Authorization: `Bearer ${ctx0.apiKey}` },
      cache: 'no-store',
    });

    if (!resp.ok) {
      const text = await resp.text();
      return NextResponse.json({ error: `HTTP ${resp.status}: ${text}` }, { status: resp.status });
    }

    const data = await resp.json();
    const models: string[] = Array.isArray(data?.data)
      ? data.data.map((m: { id: string }) => m.id).filter(Boolean)
      : [];

    return NextResponse.json({ models, raw: data });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
