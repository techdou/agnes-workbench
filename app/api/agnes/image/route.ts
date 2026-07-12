// 图像生成代理(文生图 + 图生图,图生图支持多图参考)
import { NextRequest, NextResponse } from 'next/server';
import { textToImage, imageToImage, setApiKeyOverride } from '@/lib/agnes';

export async function POST(req: NextRequest) {
  try {
    setApiKeyOverride(req.headers.get('X-Agnes-Key'));
    const body = await req.json();
    const { mode, prompt, size, inputImageUrls } = body;
    if (!prompt) return NextResponse.json({ error: 'prompt 必填' }, { status: 400 });

    let result;
    if (mode === 'image-to-image') {
      const urls: string[] = Array.isArray(inputImageUrls)
        ? inputImageUrls
        : inputImageUrls ? [inputImageUrls] : [];
      if (urls.length === 0) {
        return NextResponse.json({ error: '图生图至少需要一张参考图(inputImageUrls)' }, { status: 400 });
      }
      result = await imageToImage(prompt, urls, size || '1024x768');
    } else {
      result = await textToImage(prompt, size || '1024x768');
    }
    return NextResponse.json(result);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
