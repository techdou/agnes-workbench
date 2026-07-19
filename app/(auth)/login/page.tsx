'use client';

// 登录页 —— 邮箱+密码,调 Auth.js signIn('credentials')
// page 是 Server Component 默认导出 Suspense 包裹的 client form
// (Next 16 要求 useSearchParams 必须在 Suspense 内)
import { Suspense } from 'react';
import LoginForm from './LoginForm';

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
