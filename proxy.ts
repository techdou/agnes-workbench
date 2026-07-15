// Next.js 16 proxy(原 middleware)—— Auth.js 路由保护
// ⚠️ Next.js 16 把 middleware 改名为 proxy,export 的函数名必须是 proxy
// proxy 只是"乐观检查",每个 Route Handler 仍需独立校验 auth

export { auth as proxy } from '@/auth';

export const config = {
  // 排除:auth API、登录/注册页、静态资源
  matcher: ['/((?!api/auth|login|register|_next/static|_next/image|favicon.ico).*)'],
};
