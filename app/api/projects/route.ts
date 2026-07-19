// 项目列表 + 创建
// GET  /api/projects     → 当前用户的项目列表(按 updatedAt 倒序)
// POST /api/projects     → 创建空项目,返回 server 生成的 id

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser, isAuthError } from '@/lib/auth-guard';

// ---------- 项目列表 ----------
export async function GET() {
  const session = await requireUser();
  if (isAuthError(session)) return session;

  const projects = await prisma.project.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      name: true,
      thumbnail: true,
      createdAt: true,
      updatedAt: true,
      // nodes/edges 列表页不需要(太重),详情页才拉
    },
  });

  return NextResponse.json({ projects });
}

// ---------- 创建项目 ----------
// 支持创建时带入初始画布(模板/导入/复制 都走这里)
export async function POST(req: NextRequest) {
  const session = await requireUser();
  if (isAuthError(session)) return session;

  const body = await req.json().catch(() => ({}));
  const name = (body.name as string)?.trim() || '未命名项目';
  // 可选:初始 nodes/edges(用于从模板创建、导入工作流、复制项目)
  const initialNodes = Array.isArray(body.nodes) ? body.nodes : [];
  const initialEdges = Array.isArray(body.edges) ? body.edges : [];

  const project = await prisma.project.create({
    data: {
      userId: session.user.id,
      name,
      nodes: initialNodes,
      edges: initialEdges,
    },
  });

  return NextResponse.json({ project }, { status: 201 });
}
