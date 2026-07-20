// 缓存代理:GET 按 hash 取本地文件,PATCH 切换收藏
// 需登录,严格校验 (userId, hash) 所有权 —— 用户 A 不能读/改 B 的缓存
import { NextRequest, NextResponse } from 'next/server';
import { getEntryByHash, getEntryByUserHash, setFavorited, LIBRARY_DIR, assertSafeLocalPath } from '@/lib/cache';
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

    // 管理员可读任意媒体;普通用户严格按 (userId, hash) 校验
    const isAdmin = session.user.role === 'ADMIN';
    const entry = isAdmin
      ? await getEntryByHash(hash)
      : await getEntryByUserHash(session.user.id, hash);
    if (!entry) {
      return NextResponse.json({ error: `hash ${hash} 未找到` }, { status: 404 });
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

// PATCH /api/cache/[hash] —— 切换收藏状态
// body: { favorited: boolean }
// 严格按 (userId, hash) 所有权校验:用户只能改自己名下的
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ hash: string }> }
) {
  try {
    const session = await getSession();
    if (!session?.user) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }
    const { hash } = await params;
    if (!/^[0-9a-f]{1,32}$/.test(hash)) {
      return NextResponse.json({ error: '非法 hash' }, { status: 400 });
    }
    const body = await req.json().catch(() => ({}));
    const favorited = body.favorited;
    if (typeof favorited !== 'boolean') {
      return NextResponse.json({ error: 'favorited 必须是 boolean' }, { status: 400 });
    }
    // Prisma 在 (userId, hash) 不存在时抛 P2025,转 404
    const entry = await setFavorited(session.user.id, hash, favorited);
    return NextResponse.json({
      hash: entry.hash,
      favorited: entry.favorited,
      favoritedAt: entry.favoritedAt,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    // Prisma P2025 = record not found / unique constraint violation on update
    const isNotFound = /未找到|P2025|Record to update not found/i.test(msg);
    return NextResponse.json({ error: isNotFound ? '条目不存在或无权修改' : msg }, { status: isNotFound ? 404 : 500 });
  }
}
