import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

// 测试需要 ENCRYPTION_KEY,但 vitest 不能加载 .env.local(那是 next 的事)
// 这里给一个固定的测试 key(不在生产中使用),让 crypto 测试可以跑
process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || Buffer.alloc(32, 0x42).toString('base64');
process.env.AUTH_SECRET = process.env.AUTH_SECRET || 'test-secret-not-for-production';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['lib/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@': resolve(__dirname),
    },
  },
});
