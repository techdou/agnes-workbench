// 文本生成代理
import { NextRequest, NextResponse } from 'next/server';
import { generateText } from '@/lib/agnes';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { prompt, system, temperature, maxTokens } = body;
    if (!prompt) return NextResponse.json({ error: 'prompt 必填' }, { status: 400 });
    const result = await generateText(prompt, { system, temperature, maxTokens });
    return NextResponse.json(result);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
