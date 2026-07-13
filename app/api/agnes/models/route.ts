// 模型列表代理 —— 转发 GET /v1/models,返回 Agnes 当前所有可用模型
// 让设置面板动态拉取最新模型,不用硬编码
import { NextRequest, NextResponse } from 'next/server';

const BASE_URL = process.env.AGNES_BASE_URL || 'https://apihub.agnes-ai.com';

export async function GET(req: NextRequest) {
  try {
    const apiKey = req.headers.get('X-Agnes-Key') || process.env.AGNES_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'AGNES_API_KEY 未配置' }, { status: 500 });
    }

    const resp = await fetch(`${BASE_URL}/v1/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: 'no-store',
    });

    if (!resp.ok) {
      const text = await resp.text();
      return NextResponse.json({ error: `HTTP ${resp.status}: ${text}` }, { status: resp.status });
    }

    const data = await resp.json();
    // 提取模型 id 列表(标准 OpenAI 格式 data[].id)
    const models: string[] = Array.isArray(data?.data)
      ? data.data.map((m: { id: string }) => m.id).filter(Boolean)
      : [];

    return NextResponse.json({ models, raw: data });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
