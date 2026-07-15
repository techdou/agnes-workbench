// (app) 布局 —— 需登录才能访问
// Server Component:await auth() 校验,无 session 则 redirect 到 /login

import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { SessionProvider } from '@/components/SessionProvider';

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect('/login');
  }

  return <SessionProvider session={session}>{children}</SessionProvider>;
}
