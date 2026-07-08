// 图像生成代理(文生图 + 图生图)
import { NextRequest, NextResponse } from 'next/server';
import { textToImage, imageToImage } from '@/lib/agnes';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { mode, prompt, size, inputImageUrl } = body;
    if (!prompt) return NextResponse.json({ error: 'prompt 必填' }, { status: 400 });

    let result;
    if (mode === 'image-to-image') {
      if (!inputImageUrl) {
        return NextResponse.json({ error: '图生图需要 inputImageUrl' }, { status: 400 });
      }
      result = await imageToImage(prompt, inputImageUrl, size || '1024x768');
    } else {
      result = await textToImage(prompt, size || '1024x768');
    }
    return NextResponse.json(result);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
