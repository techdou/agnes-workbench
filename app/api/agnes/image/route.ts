// 图像生成代理(文生图 + 图生图,图生图支持多图参考)
// 需登录,API Key 从用户 DB 记录读取
import { NextRequest, NextResponse } from 'next/server';
import { textToImage, imageToImage, type CallContext } from '@/lib/agnes';
import { resolveLocalImages } from '@/lib/cache';
import { getUserApiKey } from '@/lib/user-key';

export async function POST(req: NextRequest) {
  try {
    const apiKey = await getUserApiKey();
    if (!apiKey) {
      return NextResponse.json({ error: '请先登录并配置 API Key' }, { status: 401 });
    }

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
      urls = await resolveLocalImages(urls);
      result = await imageToImage(prompt, urls, size || '1024x768', ctx);
    } else {
      result = await textToImage(prompt, size || '1024x768', ctx);
    }
    return NextResponse.json(result);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    // 透传 Agnes 的 HTTP 状态码(503 队列满不该包成 500)
    const statusCode = (e as { statusCode?: number }).statusCode || 500;
    return NextResponse.json({ error: msg }, { status: statusCode });
  }
}
