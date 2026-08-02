// 注册端点 —— 邮箱+密码注册
// 如果邮箱匹配 ADMIN_EMAIL,自动授予 ADMIN 角色(第一个管理员由此创建)
//
// 安全:
//   - 密码长度 12 位起
//   - 邮箱重复时不暴露存在性(统一返回 200,前端引导登录)
//   - 分布式 Rate Limit(配置 Upstash Redis 时跨实例共享,否则 fallback 内存)

import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { checkRateLimit } from '@/lib/rate-limit';

const BCRYPT_COST = 12;
const MIN_PASSWORD_LENGTH = 12;
const REGISTER_MAX_PER_IP = 5;

function getClientIp(req: NextRequest): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return req.headers.get('x-real-ip') || 'unknown';
}

export async function POST(req: NextRequest) {
  try {
    // ---------- Rate limit ----------
    // [BugFix] 旧代码用进程内 Map,serverless 多实例下每个实例各自计数,限流失效。
    // 改用 lib/rate-limit:配置了 UPSTASH_REDIS_REST_URL 时用 Redis 分布式限流,
    // 否则 fallback 到内存 Map(开发环境够用)
    const ip = getClientIp(req);
    const { success } = await checkRateLimit(`register:${ip}`, REGISTER_MAX_PER_IP, '5 m');
    if (!success) {
      return NextResponse.json(
        { error: '注册过于频繁,请稍后再试' },
        { status: 429, headers: { 'Retry-After': '300' } }
      );
    }

    const body = await req.json();
    const { email, password, name } = body as {
      email?: string;
      password?: string;
      name?: string;
    };

    // ---------- 校验 ----------
    if (!email || !password) {
      return NextResponse.json({ error: '邮箱和密码必填' }, { status: 400 });
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      return NextResponse.json(
        { error: `密码至少 ${MIN_PASSWORD_LENGTH} 位` },
        { status: 400 }
      );
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: '邮箱格式不正确' }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // 邮箱重复:不返回 409(防邮箱枚举),统一返回 200 + alreadyRegistered
    // 前端拿到 alreadyRegistered 应提示"如已注册请直接登录"
    const existing = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (existing) {
      return NextResponse.json({ ok: true, alreadyRegistered: true });
    }

    // ---------- 创建用户 ----------
    const hashedPassword = await bcrypt.hash(password, BCRYPT_COST);

    // 首个管理员:邮箱匹配 ADMIN_EMAIL
    const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase().trim();
    const role = adminEmail && normalizedEmail === adminEmail ? 'ADMIN' : 'USER';

    await prisma.user.create({
      data: {
        email: normalizedEmail,
        password: hashedPassword,
        name: name?.trim() || null,
        role,
      },
    });

    return NextResponse.json({ ok: true, alreadyRegistered: false });
  } catch (e: unknown) {
    // [BugFix] 不直接回 e.message(可能含 DB 连接串等内部信息)
    console.error('注册失败:', e);
    return NextResponse.json({ error: '注册失败,请稍后重试' }, { status: 500 });
  }
}
