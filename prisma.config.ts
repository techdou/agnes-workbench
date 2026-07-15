// Prisma 配置 —— 优先从 .env.local 读取环境变量(Next.js 约定)
import { config } from "dotenv";
import { defineConfig } from "prisma/config";

// .env.local 优先(Next.js 约定,gitignore),fallback .env
config({ path: ".env.local" });
config({ path: ".env" });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
