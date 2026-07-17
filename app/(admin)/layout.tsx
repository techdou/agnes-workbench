// (admin) 布局 —— 需管理员才能访问
// Server Component:await auth() 校验

import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { AdminShell } from '@/components/AdminShell';

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

  return <AdminShell>{children}</AdminShell>;
}
