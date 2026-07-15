// 文本生成代理
import { NextRequest, NextResponse } from 'next/server';
import { generateText, type CallContext } from '@/lib/agnes';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { prompt, system, temperature, maxTokens, textModel, baseUrl, autoTranslate } = body;
    if (!prompt) return NextResponse.json({ error: 'prompt 必填' }, { status: 400 });
    const ctx: CallContext = {
      apiKey: req.headers.get('X-Agnes-Key'),
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
