// (admin) 布局 —— 需管理员才能访问
// Server Component:await auth() 校验,SessionProvider 让客户端 useSession 可用

import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { AdminShell } from '@/components/AdminShell';
import { SessionProvider } from '@/components/SessionProvider';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect('/login');
  }
  if (session.user.role !== 'ADMIN') {
    redirect('/');
  }

  return (
    <SessionProvider session={session}>
      <AdminShell>{children}</AdminShell>
    </SessionProvider>
  );
}
