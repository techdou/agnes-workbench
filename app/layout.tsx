import type { Metadata } from "next";
import { Fraunces, JetBrains_Mono } from "next/font/google";
import "./globals.css";

export const metadata: Metadata = {
  title: "Phosphor Studio — Agnes 创作工作台",
  description: "节点式 AI 创作 · Agnes 全模态引擎",
};

// 字体本地化:next/font 在构建时下载并内联到 CSS,运行时不依赖 Google CDN
const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-display",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
  display: "swap",
});

// 首屏防闪烁:在 React 渲染前同步从 localStorage 读主题,设到 <html data-theme>
// settings store 异步从 IndexedDB 加载会晚一帧,这里用 localStorage 的同步快照兜底
const themeBootstrap = `
(function(){
  try {
    var t = localStorage.getItem('phosphor-theme');
    if (t === 'light' || t === 'dark') {
      document.documentElement.setAttribute('data-theme', t);
    } else {
      document.documentElement.setAttribute('data-theme', 'dark');
    }
  } catch(e) {
    document.documentElement.setAttribute('data-theme', 'dark');
  }
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className={`${fraunces.variable} ${jetbrainsMono.variable} h-full`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body className="min-h-full overflow-hidden">{children}</body>
    </html>
  );
}
