// 用户 API Key 解析 —— Route Handler 里统一获取用户的 Agnes API Key
// 从 session → DB → decrypt,失败时 fallback 到环境变量

import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { decrypt } from '@/lib/crypto';

/**
 * 获取当前登录用户的 Agnes API Key(明文)
 * 返回 null 表示未登录或 key 未配置
 */
export async function getUserApiKey(): Promise<string | null> {
  const session = await auth();
  if (!session?.user?.id) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { agnesKeyEnc: true, disabled: true },
  });

  if (!user || user.disabled) return null;

  // 用户自己配了 key → 解密返回
  if (user.agnesKeyEnc) {
    try {
      return decrypt(user.agnesKeyEnc);
    } catch {
      // 解密失败(密钥轮换等),fallback 到环境变量
    }
  }

  // fallback 到环境变量(部署者的 key)
  return process.env.AGNES_API_KEY || null;
}
