// Next.js 16 proxy(原 middleware)—— Auth.js 路由保护 + CSRF 同源校验
// ⚠️ Next.js 16 把 middleware 改名为 proxy,export 的函数名必须是 proxy
// proxy 只是"乐观检查",每个 Route Handler 仍需独立校验 auth
//
// 两层防护:
//   1. auth() —— 乐观登录检查(未登录的请求直接重定向到 /login)
//   2. CSRF 同源校验 —— 对非 GET 请求校验 Origin === Host,挡跨站伪造
//      (Auth.js 的 /api/auth/* 自带 CSRF token,排除避免冲突)
//
// matcher 排除项:
//   - api/auth/* : next-auth 端点 + 自建 /api/auth/register(Auth.js 自带 CSRF)
//   - login/register : 登录注册页本身
//   - _next/static, _next/image, favicon.ico : 静态资源

import { NextResponse, type NextRequest } from 'next/server';
import { auth } from '@/auth';
import { isSameOrigin } from '@/lib/auth-guard';

const AUTH_ROUTES = ['/login', '/register'];

// auth 包裹的 proxy:登录检查 + CSRF 校验
// auth() 回调注入 req.auth(Auth.js v5),类型上用扩展接口声明
type AuthedRequest = NextRequest & { auth?: { user?: { id?: string } } | null };
export default auth((req: AuthedRequest) => {
  const { pathname } = req.nextUrl;
  const isLoggedIn = !!req.auth?.user;

  // 登录路由保护:已登录用户访问 login/register → 重定向到首页
  if (AUTH_ROUTES.some((p) => pathname.startsWith(p)) && isLoggedIn) {
    return NextResponse.redirect(new URL('/', req.url));
  }

  // CSRF 同源校验:对所有非 GET 的状态变更请求校验 Origin
  // 排除 api/auth/*(Auth.js 自带 double-submit CSRF token 机制)
  if (
    req.method !== 'GET' &&
    !pathname.startsWith('/api/auth/')
  ) {
    if (!isSameOrigin(req)) {
      return NextResponse.json(
        { error: '跨站请求被拒绝(CSRF 校验失败)' },
        { status: 403 }
      );
    }
  }

  // 未登录的非 GET 请求(非 auth 路由)直接拒绝,不重定向(避免泄露路由存在性)
  if (!isLoggedIn && req.method !== 'GET' && !pathname.startsWith('/api/auth/')) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  return NextResponse.next();
});

export const config = {
  matcher: ['/((?!api/auth|login|register|_next/static|_next/image|favicon.ico).*)'],
};
