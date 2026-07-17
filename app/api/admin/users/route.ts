// 管理员:用户列表
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin, isAuthError } from '@/lib/auth-guard';

export async function GET(req: Request) {
  const session = await requireAdmin();
  if (isAuthError(session)) return session;

  const url = new URL(req.url);
  const search = url.searchParams.get('search')?.toLowerCase() || '';

  const where = search
    ? {
        OR: [
          { email: { contains: search, mode: 'insensitive' as const } },
          { name: { contains: search, mode: 'insensitive' as const } },
        ],
      }
    : {};

  const users = await prisma.user.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      disabled: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: { projects: true, mediaAssets: true },
      },
    },
  });

  return NextResponse.json({ users });
}
