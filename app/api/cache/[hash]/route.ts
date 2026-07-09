// 缓存代理:GET 按 hash 取本地文件
// (POST 缓存提交已统一到 /api/cache/item,这里只负责读)
import { NextRequest, NextResponse } from 'next/server';
import { getEntryByHash, LIBRARY_DIR, assertSafeLocalPath } from '@/lib/cache';
import fs from 'fs/promises';
import path from 'path';

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

// GET /api/cache/[hash] —— 返回缓存的文件
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ hash: string }> }
) {
  try {
    const { hash } = await params;
    // 防御:hash 只允许十六进制
    if (!/^[0-9a-f]{1,32}$/.test(hash)) {
      return NextResponse.json({ error: '非法 hash' }, { status: 400 });
    }
    const entry = await getEntryByHash(hash);
    if (!entry) {
      return NextResponse.json({ error: `hash ${hash} 未找到` }, { status: 404 });
    }

    // [S3] 路径遍历防护:校验 localPath 没越出 library 目录
    assertSafeLocalPath(entry.localPath);
    const fullPath = path.join(LIBRARY_DIR, entry.localPath);
    // 二次校验 resolve 之后
    if (!fullPath.startsWith(LIBRARY_DIR + path.sep) && fullPath !== LIBRARY_DIR) {
      return NextResponse.json({ error: '非法路径' }, { status: 400 });
    }

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
