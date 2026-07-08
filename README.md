# ◈ Phosphor Studio

> 基于 [Agnes AI](https://agnes-ai.com) 全模态 API 的节点式创作工作台 · ComfyUI 风格连线画布

[![License: MIT](https://img.shields.io/badge/License-MIT-amber.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-16-black)](https://nextjs.org)
[![React Flow](https://img.shields.io/badge/React_Flow-12-blue)](https://reactflow.dev)
[![CI](https://github.com/techdou/agnes-workbench/actions/workflows/ci.yml/badge.svg)](https://github.com/techdou/agnes-workbench/actions/workflows/ci.yml)

通过拖拽节点、连线编排,一句话驱动 Agnes 的文本、图片、视频全模态生成能力。支持暗/亮双主题、本地永久缓存、工作流保存。

---

## ✨ 功能特性

### 七种生成能力

| 节点 | 能力 | 对应模型 |
|------|------|---------|
| `Τ` 文本 | 文本生成 / LLM prompt 扩写 | `agnes-2.0-flash` |
| `ℑ` 文生图 | 文本 → 图片 | `agnes-image-2.1-flash` |
| `ℜ` 图生图 | 基于参考图编辑 | `agnes-image-2.1-flash` |
| `Ϝ` 文生视频 | 文本 → 视频(异步) | `agnes-video-v2.0` |
| `δ` 图生视频 | 图片动画化 | `agnes-video-v2.0` |
| `Σ` 多图视频 | 多张参考图生成视频 | `agnes-video-v2.0` |
| `Φ` 关键帧 | 两图之间过渡动画 | `agnes-video-v2.0` |

外加 `▣ 图片预览`、`▶ 视频预览` 两个展示节点,带下载按钮。

### 核心机制

- **节点连线画布** — React Flow 驱动,拖拽连接,数据从上游流向下游
- **自动拓扑执行** — 点击下游节点自动跑完所有上游依赖
- **中文 prompt 自动翻译** — 非英文提示词自动翻成英文再调 API(Agnes 视频模型对英文更稳)
- **本地永久缓存** — 生成结果自动下载到 `library/`,原 URL 过期也能访问
- **作品归档** — 右侧抽屉展示历史作品,支持下载
- **暗/亮双主题** — 磷光工作室风格,一键切换
- **工作流持久化** — 画布保存到 localStorage,刷新不丢

## 🚀 快速开始

### 1. 获取 API Key

前往 [platform.agnes-ai.com](https://platform.agnes-ai.com) → 注册 → API Keys → Create new secret key

> Agnes 目前全模态 API **无限期免费开放**(2026-06 起),无需绑卡。

### 2. 配置环境变量

```bash
cp .env.example .env.local
# 编辑 .env.local,填入你的 API Key
```

### 3. 安装并启动

```bash
npm install
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000)

## 📖 使用方法

### 基本操作

1. **添加节点** — 顶部工具栏按组点击按钮(INPUT / IMAGE / VIDEO / OUTPUT)
2. **连线** — 拖拽节点右侧 ● 到下一个节点左侧 ●
3. **运行** — 点节点底部「▶ EXECUTE」按钮,会自动先跑完上游
4. **查看** — 结果自动缓存,视频节点显示进度条
5. **归档** — 右上角「◈ ARCHIVE」查看历史作品

### 键盘快捷键

| 快捷键 | 功能 |
|--------|------|
| `Delete` / `Backspace` | 删除选中节点 |
| `Ctrl/Cmd + Enter` | 运行选中节点 |
| 选中节点 → NodeToolbar | 浮出删除按钮 |

### 典型工作流

**文生图**:
```
[文本 Τ] ──→ [文生图 ℑ] ──→ [图片预览 ▣]
```

**图生视频**:
```
[文本 Τ] ──→ [文生图 ℑ] ──→ [图生视频 δ] ──→ [视频预览 ▶]
```

**关键帧动画**(两图之间过渡):
```
[文生图 ℑ] ──┐
             ├─→ [关键帧 Φ] ──→ [视频预览 ▶]
[文生图 ℑ] ──┘
```

**一键全跑**:点工具栏「▶▶ RUN ALL」按拓扑序执行整个画布。

## 🏗️ 技术栈

| 层 | 技术 | 说明 |
|----|------|------|
| 框架 | Next.js 16 (App Router) | 全栈 TypeScript |
| 画布 | @xyflow/react 12 | 节点连线引擎 |
| 状态 | Zustand 5 | 轻量全局状态 |
| 样式 | Tailwind CSS 4 | 原子化 CSS |
| 字体 | Fraunces + JetBrains Mono | 衬线 + 等宽 |
| API | Agnes AI | OpenAI 兼容协议 |

**零 Python 依赖,全 TypeScript。**

## 📁 项目结构

```
agnes-workbench/
├── app/
│   ├── page.tsx                      # 主画布入口
│   ├── layout.tsx                    # 根布局(字体加载)
│   ├── globals.css                   # 设计系统(双主题 CSS 变量)
│   └── api/
│       ├── agnes/                    # Agnes API 代理
│       │   ├── text/route.ts         #   文本生成
│       │   ├── image/route.ts        #   文生图 / 图生图
│       │   └── video/                #   视频(创建 + 状态轮询)
│       ├── cache/                    # 本地缓存代理
│       │   ├── [hash]/route.ts       #   按 hash 取文件
│       │   └── item/route.ts         #   提交 URL 下载到本地
│       └── library/route.ts          # 作品库列表
├── components/
│   ├── FlowCanvas.tsx                # 画布主组件(键盘/edge/MiniMap)
│   ├── Toolbar.tsx                   # 顶部工具栏(节点/主题/Run All)
│   ├── LibraryPanel.tsx              # 作品归档抽屉
│   ├── ToastContainer.tsx            # 全局通知
│   └── nodes/                        # 9 种节点组件
│       ├── NodeShell.tsx             #   节点外壳(色条/状态灯/扫描线)
│       ├── VideoParams.tsx           #   视频参数(帧数/帧率/宽高)
│       └── ...                       #   各具体节点
├── lib/
│   ├── agnes.ts                      # Agnes API 客户端
│   ├── cache.ts                      # 本地缓存管理(并发安全)
│   ├── workflow.ts                   # 工作流引擎(拓扑排序)
│   ├── store.ts                      # Zustand 全局状态 + 执行引擎
│   ├── useTheme.ts                   # 主题管理 hook
│   ├── useToast.ts                   # Toast 通知 store
│   └── types.ts                      # TypeScript 类型定义
├── public/                           # 静态资源
├── .env.example                      # 环境变量模板(不含真实 key)
├── .env.local                        # 你的本地配置(gitignore,不入库)
└── library/                          # 本地作品库(gitignore,运行时生成)
```

## 🎨 设计系统

采用 **Phosphor Studio** 美学方向:

- **配色** — 深蓝黑底(`#0a0e14`)+ 琥珀橙(`#f4a261`)+ 磷光绿(`#7dd3a0`)
- **字体** — Fraunces(衬线,有温度)+ JetBrains Mono(等宽,工程感)
- **节点符号** — 希腊字母标识类型(Τ/ℑ/Ϝ/Σ/Φ)
- **动效** — 连线流动、状态灯闪烁、按钮扫描线、进度条发光

亮色模式:暖米白底 + 深琥珀 + 墨绿,一键切换,持久化到 localStorage。

## 🚢 部署

### 本机

```bash
npm run build && npm start
```

### Vercel(推荐,一键部署)

支持完整 API route,免费额度够个人用:

1. 打开 [vercel.com](https://vercel.com) → Import Git Repository → 选 `techdou/agnes-workbench`
2. **Environment Variables** 里添加:
   - `AGNES_API_KEY` = `你的真实 key`
   - `AGNES_BASE_URL` = `https://apihub.agnes-ai.com`(可选,有默认值)
3. Deploy,几分钟后拿到 `xxx.vercel.app` 域名

> 仓库里已有 `vercel.json`,默认部署到香港节点(`hkg1`),国内访问较快。

### 其他云服务器

```bash
# 设置环境变量后
npm run build && npm start
# library/ 目录运行时自动创建
```

> 无需 GPU —— 所有生成走 Agnes 云端 API。

## 🔧 CI/CD

GitHub Actions 在每次 push/PR 时自动运行:
- 依赖安装(`npm ci`)
- TypeScript 类型检查(`tsc --noEmit`)
- 生产构建(`npm run build`)

构建状态徽章在 README 顶部。失败会阻止合并,保证主干始终可构建。

> CI 用占位符 key 构建,**真实 key 只在 Vercel 环境变量里**,不进代码仓库。

## ⚠️ 限制

- 免费用户视频 RPM ≈ 1 次/分钟,单次生成约 30-60 秒
- `num_frames` 必须满足 `8n+1`(81/121/241/441),已预设选项
- 视频宽高必须是 8 的倍数
- Agnes 的 `ti2vid` 模式限 1 张图,多图自动切 `keyframes` 模式

## 🔒 安全说明

- API Key 存在 `.env.local`,已被 `.gitignore` 排除,**不会入库**
- 生成内容缓存在本地 `library/` 目录,同样不入库
- 部署时通过环境变量注入 Key,不硬编码到代码

## 📝 License

[MIT](LICENSE) © 2026 TechDou
