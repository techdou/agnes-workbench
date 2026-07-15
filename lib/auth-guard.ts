// Auth 守卫工具 —— Route Handler 里统一鉴权
// 用法:
//   const session = await requireUser();
//   if (session instanceof NextResponse) return session; // 未登录
//   const userId = session.user.id;

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import type { Session } from 'next-auth';

/**
 * 获取当前 session(可能为 null)
 */
export async function getSession(): Promise<Session | null> {
  return auth();
}

/**
 * 要求用户已登录,否则返回 401
 * 返回值:Session(已登录) 或 NextResponse(未登录,直接 return)
 */
export async function requireUser(): Promise<Session | NextResponse> {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }
  return session;
}

/**
 * 要求管理员,否则返回 403
 */
export async function requireAdmin(): Promise<Session | NextResponse> {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }
  if (session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: '需要管理员权限' }, { status: 403 });
  }
  return session;
}

/**
 * 类型守卫:区分 requireUser/requireAdmin 返回的是 Session 还是错误响应
 */
export function isAuthError(resp: Session | NextResponse): resp is NextResponse {
  return resp instanceof NextResponse;
}
