// 用户上下文解析 —— Route Handler 里统一获取 { userId, apiKey }
//
// 安全设计:
//   - apiKey 只从用户 DB 记录解密,**不再 fallback 到 process.env.AGNES_API_KEY**
//     (否则任意注册用户都能消耗部署者付费配额,且 CRITICAL-1 中可能被窃取)
//   - 用户禁用 / 未配 Key → 返回 null,路由层应返回 403/400

import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { decrypt } from '@/lib/crypto';

export interface UserContext {
  userId: string;
  role: 'USER' | 'ADMIN';
  apiKey: string | null; // null = 用户未配置自己的 Key
}

/**
 * 获取当前登录用户的上下文(userId + 解密后的 API Key)
 * 返回 null 表示未登录、被禁用。
 *
 * 注意:不再 fallback 到 process.env.AGNES_API_KEY。
 * 部署者若想提供共享 Key,应当通过管理后台或 DB 直接写入用户记录。
 */
export async function getUserContext(): Promise<UserContext | null> {
  const session = await auth();
  if (!session?.user?.id) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { agnesKeyEnc: true, disabled: true, role: true },
  });

  if (!user || user.disabled) return null;

  let apiKey: string | null = null;
  if (user.agnesKeyEnc) {
    try {
      apiKey = decrypt(user.agnesKeyEnc);
    } catch {
      // 解密失败(密钥轮换等)→ 视为未配 Key
      apiKey = null;
    }
  }

  return {
    userId: session.user.id,
    role: user.role,
    apiKey,
  };
}
