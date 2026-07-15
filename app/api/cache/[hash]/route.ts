// 缓存代理:GET 按 hash 取本地文件
// 需登录,校验该媒体属于当前用户(防越权访问他人缓存)
import { NextRequest, NextResponse } from 'next/server';
import { getEntryByHash, LIBRARY_DIR, assertSafeLocalPath } from '@/lib/cache';
import { getSession } from '@/lib/auth-guard';
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

type RouteContext = {
  params: Promise<{ hash: string }>;
};

// GET /api/cache/[hash] —— 返回缓存的文件
export async function GET(
  _req: NextRequest,
  ctx: RouteContext
) {
  try {
    const session = await getSession();
    if (!session?.user) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const { hash } = await ctx.params;
    if (!/^[0-9a-f]{1,32}$/.test(hash)) {
      return NextResponse.json({ error: '非法 hash' }, { status: 400 });
    }
    const entry = await getEntryByHash(hash);
    if (!entry) {
      return NextResponse.json({ error: `hash ${hash} 未找到` }, { status: 404 });
    }

    // 所有权校验:媒体必须属于当前用户(管理员可访问任意媒体)
    if (entry.userId && entry.userId !== session.user.id && session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: '无权访问' }, { status: 403 });
    }

    assertSafeLocalPath(entry.localPath);
    const fullPath = path.join(LIBRARY_DIR, entry.localPath);
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
