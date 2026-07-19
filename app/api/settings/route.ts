// 设置 API —— 服务端持久部分(模型/生成参数/apiKey)
// GET   /api/settings  → 返回设置(不含明文 apiKey,含 hasApiKey + apiKeyHint)
// PATCH /api/settings  → 更新设置;若提供 apiKey 字段则 AES 加密入库

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser, isAuthError } from '@/lib/auth-guard';
import { encrypt, decrypt, maskKey } from '@/lib/crypto';

// 服务端持久的设置字段(不含 theme/language/animations —— 那些走 localStorage)
export interface ServerSettings {
  textModel: string;
  imageModel: string;
  videoModel: string;
  defaultImageSize: string;
  defaultVideoFrames: number;
  defaultVideoFps: number;
  defaultVideoWidth?: number;
  defaultVideoHeight?: number;
  autoTranslate: boolean;
  baseUrl: string;
}

export const DEFAULT_SERVER_SETTINGS: ServerSettings = {
  textModel: 'agnes-2.0-flash',
  imageModel: 'agnes-image-2.1-flash',
  videoModel: 'agnes-video-v2.0',
  defaultImageSize: '1024x768',
  defaultVideoFrames: 121,
  defaultVideoFps: 24,
  defaultVideoWidth: undefined,
  defaultVideoHeight: undefined,
  autoTranslate: true,
  baseUrl: '',
};

// ---------- 获取设置 ----------
export async function GET() {
  const session = await requireUser();
  if (isAuthError(session)) return session;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { settings: true, agnesKeyEnc: true },
  });

  if (!user) {
    return NextResponse.json({ error: '用户不存在' }, { status: 404 });
  }

  // 合并默认值
  const saved = (user.settings || {}) as Partial<ServerSettings>;
  const settings: ServerSettings = { ...DEFAULT_SERVER_SETTINGS, ...saved };

  // API Key:不返回明文,只返回状态 + 脱敏
  let apiKeyHint = '';
  let hasApiKey = false;
  if (user.agnesKeyEnc) {
    try {
      const plain = decrypt(user.agnesKeyEnc);
      hasApiKey = true;
      apiKeyHint = maskKey(plain);
    } catch {
      // 解密失败(密钥轮换等),标记为无 key
      hasApiKey = false;
    }
  }

  return NextResponse.json({
    settings,
    hasApiKey,
    apiKeyHint,
  });
}

// ---------- 更新设置 ----------
export async function PATCH(req: NextRequest) {
  const session = await requireUser();
  if (isAuthError(session)) return session;

  const body = await req.json().catch(() => ({}));

  // 拆分 apiKey(单独加密存储)和其他设置(JSON 字段)
  const { apiKey, ...rest } = body as {
    apiKey?: string;
    [key: string]: unknown;
  };

  // 过滤出允许更新的设置字段(白名单)
  const allowedFields: (keyof ServerSettings)[] = [
    'textModel', 'imageModel', 'videoModel',
    'defaultImageSize', 'defaultVideoFrames', 'defaultVideoFps',
    'defaultVideoWidth', 'defaultVideoHeight',
    'autoTranslate', 'baseUrl',
  ];
  const settingsPatch: Partial<ServerSettings> = {};
  for (const key of allowedFields) {
    if (key in rest) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      settingsPatch[key] = rest[key] as any;
    }
  }

  // 事务:settings 字段用 PostgreSQL jsonb || 原子 shallow merge,
  // 防止并发 PATCH 互相覆盖(各自只覆盖自己的字段)
  // apiKey 单独加密存储,不走 jsonb merge
  let agnesKeyEncAfter: string | null | undefined;
  await prisma.$transaction(async (tx) => {
    if (Object.keys(settingsPatch).length > 0) {
      // settings || $1::jsonb 做字段级合并(后者覆盖前者)
      await tx.$executeRaw`
        UPDATE "User" SET settings = COALESCE(settings, '{}'::jsonb) || ${JSON.stringify(settingsPatch)}::jsonb
        WHERE id = ${session.user.id}
      `;
    }

    // 处理 apiKey:空字符串 = 清除,非空 = 加密存储
    if (apiKey !== undefined) {
      const enc = apiKey === '' ? null : encrypt(apiKey);
      await tx.user.update({
        where: { id: session.user.id },
        data: { agnesKeyEnc: enc },
        select: { agnesKeyEnc: true },
      }).then((u) => { agnesKeyEncAfter = u.agnesKeyEnc; });
    } else {
      const u = await tx.user.findUnique({
        where: { id: session.user.id },
        select: { agnesKeyEnc: true },
      });
      agnesKeyEncAfter = u?.agnesKeyEnc;
    }
  });

  // 事务外回查最终 settings(给客户端返回最新值)
  const updated = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { settings: true },
  });
  if (!updated) {
    return NextResponse.json({ error: '用户不存在' }, { status: 404 });
  }

  // 返回时同样不暴露明文
  let hasApiKey = false;
  let apiKeyHint = '';
  if (agnesKeyEncAfter) {
    try {
      apiKeyHint = maskKey(decrypt(agnesKeyEncAfter));
      hasApiKey = true;
    } catch {
      hasApiKey = false;
    }
  }

  const settings: ServerSettings = {
    ...DEFAULT_SERVER_SETTINGS,
    ...(updated.settings as Partial<ServerSettings>),
  };

  return NextResponse.json({ settings, hasApiKey, apiKeyHint });
}
