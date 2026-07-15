// 文本生成代理(需登录,API Key 从用户 DB 记录读取)
import { NextRequest, NextResponse } from 'next/server';
import { generateText, type CallContext } from '@/lib/agnes';
import { getUserApiKey } from '@/lib/user-key';

export async function POST(req: NextRequest) {
  try {
    const apiKey = await getUserApiKey();
    if (!apiKey) {
      return NextResponse.json({ error: '请先登录并配置 API Key' }, { status: 401 });
    }

    const body = await req.json();
    const { prompt, system, temperature, maxTokens, textModel, baseUrl, autoTranslate } = body;
    if (!prompt) return NextResponse.json({ error: 'prompt 必填' }, { status: 400 });
    const ctx: CallContext = {
      apiKey,
      textModel,
      baseUrl,
      autoTranslate,
    };
    const result = await generateText(prompt, { system, temperature, maxTokens }, ctx);
    return NextResponse.json(result);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    const statusCode = (e as { statusCode?: number }).statusCode || 500;
    return NextResponse.json({ error: msg }, { status: statusCode });
  }
}
