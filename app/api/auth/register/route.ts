// 注册端点 —— 邮箱+密码注册
// 如果邮箱匹配 ADMIN_EMAIL,自动授予 ADMIN 角色(第一个管理员由此创建)
//
// 安全:
//   - 密码长度 12 位起
//   - 邮箱重复时不暴露存在性(统一返回 200,前端引导登录)
//   - 内存级 rate limit(单 IP 5 分钟内最多 5 次注册,生产建议替换为 Redis)

import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';

const BCRYPT_COST = 12;
const MIN_PASSWORD_LENGTH = 12;
const REGISTER_WINDOW_MS = 5 * 60 * 1000;
const REGISTER_MAX_PER_IP = 5;

// 内存级 rate limit(IP → 时间戳数组)。生产环境应换 Redis/Upstash。
const registerHits = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const hits = (registerHits.get(ip) || []).filter((t) => now - t < REGISTER_WINDOW_MS);
  if (hits.length >= REGISTER_MAX_PER_IP) {
    registerHits.set(ip, hits);
    return true;
  }
  hits.push(now);
  registerHits.set(ip, hits);
  return false;
}

function getClientIp(req: NextRequest): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return req.headers.get('x-real-ip') || 'unknown';
}

export async function POST(req: NextRequest) {
  try {
    // ---------- Rate limit ----------
    const ip = getClientIp(req);
    if (isRateLimited(ip)) {
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
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
