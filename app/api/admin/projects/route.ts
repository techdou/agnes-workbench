// 管理员:全量项目列表(带用户信息)
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin, isAuthError } from '@/lib/auth-guard';

export async function GET() {
  const session = await requireAdmin();
  if (isAuthError(session)) return session;

  const projects = await prisma.project.findMany({
    orderBy: { updatedAt: 'desc' },
    take: 200, // 防止一次性拉太多
    select: {
      id: true,
      name: true,
      createdAt: true,
      updatedAt: true,
      nodes: true,
      edges: true,
      user: {
        select: { id: true, email: true, name: true },
      },
    },
  });

  // 计算每个项目的节点/连线数(nodes 是 JSON 数组)
  const enrichedProjects = projects.map((p) => ({
    id: p.id,
    name: p.name,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    user: p.user,
    nodesCount: Array.isArray(p.nodes) ? (p.nodes as unknown[]).length : 0,
    edgesCount: Array.isArray(p.edges) ? (p.edges as unknown[]).length : 0,
  }));

  return NextResponse.json({ projects: enrichedProjects });
}
