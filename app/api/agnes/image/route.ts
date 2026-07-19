// 图像生成代理(文生图 + 图生图,图生图支持多图参考)
// 需登录 + 用户已配置 API Key,baseUrl 走 SSRF 白名单校验
import { NextRequest, NextResponse } from 'next/server';
import { textToImage, imageToImage, type CallContext } from '@/lib/agnes';
import { resolveLocalImages, assertSafeUrl } from '@/lib/cache';
import { getUserContext } from '@/lib/user-key';

export async function POST(req: NextRequest) {
  try {
    const ctx0 = await getUserContext();
    if (!ctx0) {
      return NextResponse.json({ error: '未登录或账号已禁用' }, { status: 401 });
    }
    if (!ctx0.apiKey) {
      return NextResponse.json({ error: '请先在设置中配置 API Key' }, { status: 403 });
    }

    const body = await req.json();
    const { mode, prompt, size, inputImageUrls, imageModel, baseUrl, autoTranslate } = body;
    if (!prompt) return NextResponse.json({ error: 'prompt 必填' }, { status: 400 });

    // SSRF:用户可控的 baseUrl 必须在 Agnes 域名白名单内
    const safeBaseUrl = baseUrl ? (assertSafeUrl(baseUrl), baseUrl) : undefined;

    const ctx: CallContext = {
      apiKey: ctx0.apiKey,
      imageModel,
      baseUrl: safeBaseUrl,
      autoTranslate,
    };

    let result;
    if (mode === 'image-to-image') {
      let urls: string[] = Array.isArray(inputImageUrls)
        ? inputImageUrls
        : inputImageUrls ? [inputImageUrls] : [];
      if (urls.length === 0) {
        return NextResponse.json({ error: '图生图至少需要一张参考图(inputImageUrls)' }, { status: 400 });
      }
      // 仅解析该用户自己拥有的缓存图(防越权读他人媒体)
      urls = await resolveLocalImages(urls, ctx0.userId);
      result = await imageToImage(prompt, urls, size || '1024x768', ctx);
    } else {
      result = await textToImage(prompt, size || '1024x768', ctx);
    }
    return NextResponse.json(result);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    const statusCode = (e as { statusCode?: number }).statusCode || 500;
    return NextResponse.json({ error: msg }, { status: statusCode });
  }
}
