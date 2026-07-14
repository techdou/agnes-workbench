// 图像生成代理(文生图 + 图生图,图生图支持多图参考)
import { NextRequest, NextResponse } from 'next/server';
import { textToImage, imageToImage, type CallContext } from '@/lib/agnes';
import { resolveLocalImages } from '@/lib/cache';

export async function POST(req: NextRequest) {
  try {
    const apiKey = req.headers.get('X-Agnes-Key');
    const body = await req.json();
    const { mode, prompt, size, inputImageUrls, imageModel, baseUrl, autoTranslate } = body;
    if (!prompt) return NextResponse.json({ error: 'prompt 必填' }, { status: 400 });

    const ctx: CallContext = { apiKey, imageModel, baseUrl, autoTranslate };

    let result;
    if (mode === 'image-to-image') {
      let urls: string[] = Array.isArray(inputImageUrls)
        ? inputImageUrls
        : inputImageUrls ? [inputImageUrls] : [];
      if (urls.length === 0) {
        return NextResponse.json({ error: '图生图至少需要一张参考图(inputImageUrls)' }, { status: 400 });
      }
      // [Bug1] 同源 URL(/api/cache/xxx)转 data URL,让 Agnes 能访问本地上传的图片
      urls = await resolveLocalImages(urls);
      result = await imageToImage(prompt, urls, size || '1024x768', ctx);
    } else {
      result = await textToImage(prompt, size || '1024x768', ctx);
    }
    return NextResponse.json(result);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
