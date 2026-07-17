// 管理员统计 API —— 总览数据
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin, isAuthError } from '@/lib/auth-guard';

export async function GET() {
  const session = await requireAdmin();
  if (isAuthError(session)) return session;

  const [users, projects, media, disabledUsers] = await Promise.all([
    prisma.user.count(),
    prisma.project.count(),
    prisma.mediaAsset.count(),
    prisma.user.count({ where: { disabled: true } }),
  ]);

  return NextResponse.json({
    stats: {
      users,
      projects,
      media,
      disabled: disabledUsers,
    },
  });
}
