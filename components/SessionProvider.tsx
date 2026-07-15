'use client';

// SessionProvider —— 把服务端拿到的 session 传给 next-auth 客户端 Provider
// 这样客户端组件可以用 useSession() 读 session

import { SessionProvider as NextAuthSessionProvider } from 'next-auth/react';
import type { Session } from 'next-auth';

export function SessionProvider({
  children,
  session,
}: {
  children: React.ReactNode;
  session: Session | null;
}) {
  return (
    <NextAuthSessionProvider session={session}>
      {children}
    </NextAuthSessionProvider>
  );
}
