// 视频任务创建代理
import { NextRequest, NextResponse } from 'next/server';
import {
  createTextToVideo,
  createImageToVideo,
  createMultiImageVideo,
  type CallContext,
} from '@/lib/agnes';
import { resolveLocalImages } from '@/lib/cache';

export async function POST(req: NextRequest) {
  try {
    const apiKey = req.headers.get('X-Agnes-Key');
    const body = await req.json();
    const {
      mode, prompt, imageUrl, imageUrls,
      width, height, numFrames, frameRate, seed, negativePrompt,
      videoModel,
    } = body;

    if (!prompt) return NextResponse.json({ error: 'prompt 必填' }, { status: 400 });

    const ctx: CallContext = { apiKey, videoModel };
    const opts = { width, height, numFrames, frameRate, seed, negativePrompt };
    let result;

    if (mode === 'text') {
      result = await createTextToVideo(prompt, opts, ctx);
    } else if (mode === 'image') {
      if (!imageUrl) {
        return NextResponse.json({ error: '图生视频需要 imageUrl' }, { status: 400 });
      }
      // [Bug1] 同源 URL 转 data URL
      const [resolvedImg] = await resolveLocalImages([imageUrl]);
      result = await createImageToVideo(prompt, resolvedImg, opts, ctx);
    } else if (mode === 'multi' || mode === 'keyframe') {
      if (!Array.isArray(imageUrls) || imageUrls.length === 0) {
        return NextResponse.json({ error: '多图/关键帧需要 imageUrls 数组' }, { status: 400 });
      }
      // [Bug1] 同源 URL 转 data URL
      const resolvedImgs = await resolveLocalImages(imageUrls);
      const useKeyframes = mode === 'keyframe' || resolvedImgs.length >= 2;
      result = await createMultiImageVideo(
        prompt, resolvedImgs, useKeyframes ? 'keyframes' : 'ti2vid', opts, ctx
      );
    } else {
      return NextResponse.json({ error: `未知 mode: ${mode}` }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
