// 项目详情 CRUD —— 带所有权校验
// GET    /api/projects/:id  → 完整项目(含 nodes/edges)
// PUT    /api/projects/:id  → 更新画布(nodes/edges/thumbnail/name)
// DELETE /api/projects/:id  → 删除项目(级联删除关联 MediaAsset)

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser, isAuthError } from '@/lib/auth-guard';

type RouteContext = {
  params: Promise<{ id: string }>;
};

// ---------- 获取项目 ----------
export async function GET(_req: NextRequest, ctx: RouteContext) {
  const session = await requireUser();
  if (isAuthError(session)) return session;

  const { id } = await ctx.params;
  const project = await prisma.project.findUnique({ where: { id } });

  // 不存在或不属于当前用户 → 404(不暴露存在性)
  if (!project || project.userId !== session.user.id) {
    return NextResponse.json({ error: '项目不存在' }, { status: 404 });
  }

  return NextResponse.json({ project });
}

// ---------- 更新项目 ----------
export async function PUT(req: NextRequest, ctx: RouteContext) {
  const session = await requireUser();
  if (isAuthError(session)) return session;

  const { id } = await ctx.params;
  const project = await prisma.project.findUnique({ where: { id } });

  if (!project || project.userId !== session.user.id) {
    return NextResponse.json({ error: '项目不存在' }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));

  // 只允许更新这些字段(防止 userId 被篡改)
  const data: Record<string, unknown> = {};
  if (body.name !== undefined) data.name = String(body.name).slice(0, 200);
  if (body.nodes !== undefined) data.nodes = body.nodes;
  if (body.edges !== undefined) data.edges = body.edges;
  if (body.thumbnail !== undefined) data.thumbnail = body.thumbnail;

  const updated = await prisma.project.update({
    where: { id },
    data,
  });

  return NextResponse.json({ project: updated });
}

// ---------- 删除项目 ----------
export async function DELETE(_req: NextRequest, ctx: RouteContext) {
  const session = await requireUser();
  if (isAuthError(session)) return session;

  const { id } = await ctx.params;
  const project = await prisma.project.findUnique({ where: { id } });

  if (!project || project.userId !== session.user.id) {
    return NextResponse.json({ error: '项目不存在' }, { status: 404 });
  }

  // onDelete: Cascade 会自动删除关联的 MediaAsset
  await prisma.project.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
