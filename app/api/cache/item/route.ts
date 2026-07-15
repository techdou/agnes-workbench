// 缓存条目:接收 JSON body {url, type, prompt, projectId},下载到本地,返回同源 URL
import { NextRequest, NextResponse } from 'next/server';
import { cacheExternalUrl } from '@/lib/cache';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { url, type, prompt, projectId } = body as {
      url: string;
      type: 'image' | 'video';
      prompt?: string;
      projectId?: string;
    };
    if (!url) return NextResponse.json({ error: 'url 必填' }, { status: 400 });
    const result = await cacheExternalUrl(url, type || 'image', prompt, projectId);
    return NextResponse.json({
      hash: result.hash,
      localUrl: `/api/cache/${result.hash}`,
      created: result.created,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
