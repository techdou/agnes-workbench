// Next.js 16 proxy(原 middleware)—— Auth.js 路由保护
// ⚠️ Next.js 16 把 middleware 改名为 proxy,export 的函数名必须是 proxy
// proxy 只是"乐观检查",每个 Route Handler 仍需独立校验 auth
//
// matcher 排除项:
//   - api/auth/* : next-auth 端点 + 自建 /api/auth/register(注册需匿名访问)
//   - login/register : 登录注册页本身
//   - _next/static, _next/image, favicon.ico : 静态资源

export { auth as proxy } from '@/auth';

export const config = {
  matcher: ['/((?!api/auth|login|register|_next/static|_next/image|favicon.ico).*)'],
};
