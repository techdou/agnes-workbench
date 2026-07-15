// 注册端点 —— 邮箱+密码注册
// 如果邮箱匹配 ADMIN_EMAIL,自动授予 ADMIN 角色(第一个管理员由此创建)

import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';

const BCRYPT_COST = 12;

export async function POST(req: NextRequest) {
  try {
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
    if (password.length < 8) {
      return NextResponse.json({ error: '密码至少 8 位' }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: '邮箱格式不正确' }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // 邮箱重复检查
    const existing = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (existing) {
      return NextResponse.json({ error: '该邮箱已注册' }, { status: 409 });
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

    return NextResponse.json({ ok: true, role });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
