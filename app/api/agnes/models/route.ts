// 模型列表代理 —— 转发 GET /v1/models,返回 Agnes 当前所有可用模型
// 需登录,API Key 从用户 DB 记录读取
import { NextRequest, NextResponse } from 'next/server';
import { getUserApiKey } from '@/lib/user-key';

const BASE_URL = process.env.AGNES_BASE_URL || 'https://apihub.agnes-ai.com';

export async function GET(req: NextRequest) {
  try {
    const apiKey = await getUserApiKey();
    if (!apiKey) {
      return NextResponse.json({ error: '请先登录并配置 API Key' }, { status: 401 });
    }

    // baseUrl 可以被 settings 覆盖
    const searchParams = new URL(req.url).searchParams;
    const baseUrl = searchParams.get('baseUrl') || BASE_URL;

    const resp = await fetch(`${baseUrl}/v1/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
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
