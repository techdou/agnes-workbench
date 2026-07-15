// Auth.js v5 配置 —— 邮箱+密码 Credentials Provider
// session 策略:jwt(无状态,适配 serverless)
// 扩展 session.user 暴露 role 和 id,供前端和路由守卫使用

import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';

// 扩展类型:在 Session 和 JWT 里携带 role + id
declare module 'next-auth' {
  interface User {
    role?: 'USER' | 'ADMIN';
  }
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      role: 'USER' | 'ADMIN';
    };
  }
}

declare module '@auth/core/jwt' {
  interface JWT {
    role?: 'USER' | 'ADMIN';
    id?: string;
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  // Credentials Provider:邮箱 + 密码
  providers: [
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const email = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;
        if (!email || !password) return null;

        const user = await prisma.user.findUnique({
          where: { email: email.toLowerCase() },
        });
        // 用户不存在或密码错误 —— 统一返回 null(不暴露具体原因)
        if (!user) return null;
        if (user.disabled) return null;

        const valid = await bcrypt.compare(password, user.password);
        if (!valid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        };
      },
    }),
  ],

  session: {
    strategy: 'jwt',
    // 30 天过期
    maxAge: 30 * 24 * 60 * 60,
  },

  callbacks: {
    // 登录时:把 role + id 写入 JWT
    jwt({ token, user }) {
      if (user) {
        token.role = (user as { role?: 'USER' | 'ADMIN' }).role;
        token.id = user.id;
      }
      return token;
    },
    // 每次读 session:把 JWT 里的 role + id 映射到 session.user
    session({ session, token }) {
      if (session.user) {
        session.user.role = token.role ?? 'USER';
        if (token.id) session.user.id = token.id;
      }
      return session;
    },
  },

  pages: {
    signIn: '/login',
  },
});
