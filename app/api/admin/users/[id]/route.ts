// 管理员:修改用户(角色/启用状态)
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin, isAuthError } from '@/lib/auth-guard';

type RouteContext = {
  params: Promise<{ id: string }>;
};

// 可修改字段白名单
const ALLOWED_FIELDS = ['role', 'disabled'] as const;
type AllowedField = typeof ALLOWED_FIELDS[number];

export async function PATCH(req: NextRequest, ctx: RouteContext) {
  const session = await requireAdmin();
  if (isAuthError(session)) return session;

  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));

  // 防止管理员把自己降级或禁用(避免锁死系统)
  if (id === session.user.id) {
    if (body.role && body.role !== 'ADMIN') {
      return NextResponse.json({ error: '不能修改自己的角色' }, { status: 400 });
    }
    if (body.disabled === true) {
      return NextResponse.json({ error: '不能禁用自己' }, { status: 400 });
    }
  }

  const data: Record<string, unknown> = {};
  for (const field of ALLOWED_FIELDS) {
    if (field in body) data[field] = body[field];
  }

  // role 校验
  if (data.role && data.role !== 'USER' && data.role !== 'ADMIN') {
    return NextResponse.json({ error: '角色只能是 USER 或 ADMIN' }, { status: 400 });
  }

  try {
    const user = await prisma.user.update({
      where: { id },
      data,
      select: { id: true, role: true, disabled: true },
    });
    return NextResponse.json({ user });
  } catch {
    return NextResponse.json({ error: '用户不存在' }, { status: 404 });
  }
}
