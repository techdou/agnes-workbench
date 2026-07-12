// 图片上传代理 —— 接收 multipart 文件,存到 library/uploads/,写入 cache manifest
// 复用 cache 的 manifest 机制:上传的图也进 manifest,前端通过 /api/cache/[hash] 访问
// 这样上传图和生成图走同一套缓存代理,下游节点无感知

import { NextRequest, NextResponse } from 'next/server';
import { loadManifest, saveManifest, LIBRARY_DIR, assertSafeLocalPath } from '@/lib/cache';
import fs from 'fs/promises';
import path from 'path';
import { createHash } from 'crypto';

const UPLOADS_DIR_NAME = 'uploads';
const MAX_UPLOAD_SIZE = 20 * 1024 * 1024; // 20MB

const ACCEPTED_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
const ACCEPTED_EXTS: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: '未收到文件(file 字段必填)' }, { status: 400 });
    }

    // 校验类型
    if (!ACCEPTED_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: `不支持的文件类型: ${file.type},仅支持 PNG/JPEG/WebP/GIF` },
        { status: 400 }
      );
    }

    // 校验大小
    if (file.size > MAX_UPLOAD_SIZE) {
      return NextResponse.json(
        { error: `文件过大(${(file.size / 1024 / 1024).toFixed(1)}MB),上限 ${MAX_UPLOAD_SIZE / 1024 / 1024}MB` },
        { status: 400 }
      );
    }

    // 读取文件内容
    const buf = Buffer.from(await file.arrayBuffer());

    // 用文件内容 hash 做文件名(去重:同一张图上传多次只存一份)
    const hash = createHash('sha1').update(buf).digest('hex').slice(0, 16);
    const ext = ACCEPTED_EXTS[file.type] || '.png';
    const localPath = `${UPLOADS_DIR_NAME}/${hash}${ext}`;
    assertSafeLocalPath(localPath);
    const fullPath = path.join(LIBRARY_DIR, localPath);

    // 确保目录存在 + 写入文件(hash 去重:已存在就不重复写)
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    try {
      await fs.access(fullPath);
    } catch {
      await fs.writeFile(fullPath, buf);
    }

    // 写入 cache manifest,让 /api/cache/[hash] 能找到这张图
    const manifest = await loadManifest();
    if (!manifest.entries[hash]) {
      manifest.entries[hash] = {
        hash,
        originalUrl: `upload://${localPath}`, // 占位:上传图没有外部 URL
        localPath,
        type: 'image',
        prompt: 'Uploaded image',
        createdAt: new Date().toISOString(),
      };
      await saveManifest(manifest);
    }

    const localUrl = `/api/cache/${hash}`;

    return NextResponse.json({
      hash,
      localUrl,
      size: file.size,
      type: file.type,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
