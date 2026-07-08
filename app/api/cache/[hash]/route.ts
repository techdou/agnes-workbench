// 缓存代理:POST 提交外部 URL 下载到本地;GET 按 hash 取本地文件
import { NextRequest, NextResponse } from 'next/server';
import { cacheExternalUrl, getEntryByHash } from '@/lib/cache';
import fs from 'fs/promises';
import path from 'path';

const LIBRARY_DIR = path.join(process.cwd(), 'library');

const MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
};

// POST /api/cache/[hash]?url=...&type=image|video
// 把外部 URL 缓存到本地,返回同源访问路径
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ hash: string }> }
) {
  try {
    const { hash: expectedHash } = await params;
    const { searchParams } = new URL(req.url);
    const url = searchParams.get('url');
    const type = (searchParams.get('type') || 'image') as 'image' | 'video';
    const prompt = searchParams.get('prompt') || undefined;

    if (!url) return NextResponse.json({ error: 'url 必填' }, { status: 400 });

    const result = await cacheExternalUrl(url, type, prompt);
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

// GET /api/cache/[hash] —— 返回缓存的文件
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ hash: string }> }
) {
  try {
    const { hash } = await params;
    const entry = await getEntryByHash(hash);
    if (!entry) {
      return NextResponse.json({ error: `hash ${hash} 未找到` }, { status: 404 });
    }
    const fullPath = path.join(LIBRARY_DIR, entry.localPath);
    const buf = await fs.readFile(fullPath);
    const ext = path.extname(entry.localPath).toLowerCase();
    const mime = MIME[ext] || 'application/octet-stream';
    return new NextResponse(buf, {
      headers: {
        'Content-Type': mime,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
