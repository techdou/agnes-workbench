# ◈ Phosphor Studio

> 基于 [Agnes AI](https://agnes-ai.com) 全模态 API 的节点式创作工作台 · ComfyUI 风格连线画布

[![License: MIT](https://img.shields.io/badge/License-MIT-amber.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-16-black)](https://nextjs.org)
[![React Flow](https://img.shields.io/badge/React_Flow-12-blue)](https://reactflow.dev)
[![CI](https://github.com/techdou/agnes-workbench/actions/workflows/ci.yml/badge.svg)](https://github.com/techdou/agnes-workbench/actions/workflows/ci.yml)

通过拖拽节点、连线编排,一句话驱动 Agnes 的文本、图片、视频全模态生成能力。支持项目管理、工作流导入导出、中英双语、暗/亮双主题。

## 🖼️ 演示

**亮色模式** — 跨模态流水线:文本扩写 → 文生图 → 图生图 → 图生视频

![亮色模式 - 跨模态流水线](public/screenshots/demo-1.png)

**暗色模式** — 磷光工作室主题

![暗色模式 - Phosphor Studio](public/screenshots/demo-2.png)

---

## ✨ 功能特性

### 项目制管理

- **首页 Dashboard** — 打开就是项目卡片列表,缩略图 + 名称 + 时间一目了然
- **多画布** — 每个项目独立画布,互不干扰
- **IndexedDB 持久化** — 数据存在浏览器本地,容量充足,关闭不丢
- **自动保存** — 画布改动 1.5 秒后自动落盘,顶栏显示保存状态

### 工作流导入导出

- **导出** — 一键下载 `.json` 工作流文件,包含全部节点和连线
- **导入** — 从 `.json` 恢复工作流,自动创建新项目
- **格式开放** — 标准 JSON,便于分享、版本管理、二次开发

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

- **Command Palette** — 按 `/` 唤起节点搜索面板,关键词过滤 + 键盘导航,告别横向滚动
- **节点连线画布** — React Flow 驱动,拖拽连接,数据从上游流向下游
- **自动拓扑执行** — 点击下游节点自动跑完所有上游依赖
- **多选批量操作** — Shift/框选多节点,底部浮动操作栏(复制/删除)
- **中文 prompt 自动翻译** — 非英文提示词自动翻成英文再调 API
- **本地永久缓存** — 生成结果自动下载到 `library/`,原 URL 过期也能访问
- **作品归档** — 右侧抽屉展示历史作品,支持下载
- **中英双语** — 设置面板一键切换,即时生效
- **暗/亮双主题** — 磷光工作室风格,持久化

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

> 如果 3000 端口被占用,用 `npm run dev -- -p 3939` 指定其他端口。

## 📖 使用方法

### 项目管理

1. **打开首页** — 看到 Dashboard 项目卡片列表
2. **新建项目** — 点 `+ NEW PROJECT` 或空状态的大按钮
3. **进入画布** — 点项目卡片进入全屏编辑
4. **返回首页** — 点画布左上角 `←` 返回 Dashboard
5. **重命名** — 项目卡片上双击名称,或画布顶栏双击项目名
6. **导入/导出** — Dashboard 顶栏导入,卡片操作菜单或画布顶栏导出

### 画布操作

1. **添加节点** — 按 `/` 唤起 Command Palette,搜索 + Enter 添加
2. **连线** — 拖拽节点右侧 ● 到下一个节点左侧 ●
3. **运行** — 点节点底部「▶ EXECUTE」按钮,会自动先跑完上游
4. **多选** — Shift 点击多个节点,或框选拖拽
5. **批量删除** — 选中多节点后,底部浮动栏点删除
6. **归档** — 右上角「◈ ARCHIVE」查看历史作品

### 键盘快捷键

| 快捷键 | 功能 |
|--------|------|
| `/` | 唤起 Command Palette(节点添加) |
| `Ctrl/Cmd + Enter` | 运行选中节点 |
| `Delete` / `Backspace` | 删除选中节点 |
| `Esc` | 关闭弹窗 / Command Palette |
| `Shift + 点击` | 多选节点 |
| 框选拖拽 | 框选多个节点 |

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
| 存储 | IndexedDB (idb-keyval) | 项目持久化,容量充足 |
| 样式 | Tailwind CSS 4 | 原子化 CSS |
| i18n | 自建轻量方案 | 中英双语,零依赖 |
| 字体 | Fraunces + JetBrains Mono | 衬线 + 等宽 |
| API | Agnes AI | OpenAI 兼容协议 |

**零 Python 依赖,全 TypeScript。**

## 📁 项目结构

```
phosphor-studio/
├── app/
│   ├── page.tsx                      # 首页 Dashboard(项目列表)
│   ├── canvas/[projectId]/page.tsx   # 画布页(按项目 ID 加载)
│   ├── layout.tsx                    # 根布局(字体加载)
│   ├── globals.css                   # 设计系统(双主题 CSS 变量)
│   └── api/                          # 后端 API Routes
│       ├── agnes/                    # Agnes API 代理
│       │   ├── text/route.ts         #   文本生成
│       │   ├── image/route.ts        #   文生图 / 图生图
│       │   └── video/                #   视频(创建 + 状态轮询)
│       ├── cache/                    # 本地缓存代理
│       └── library/route.ts          # 作品库列表
├── components/
│   ├── Dashboard.tsx                 # 首页项目卡片列表
│   ├── ProjectCard.tsx               # 项目卡片(缩略图/重命名/操作菜单)
│   ├── FlowCanvas.tsx                # 画布主组件(键盘/edge/批量操作)
│   ├── Toolbar.tsx                   # 画布工具栏(返回/运行/导出/设置)
│   ├── CommandPalette.tsx            # 节点搜索面板(/ 唤起)
│   ├── SettingsModal.tsx             # 设置弹窗(API/参数/外观/语言)
│   ├── LibraryPanel.tsx              # 作品归档抽屉
│   ├── ToastContainer.tsx            # 全局通知
│   └── nodes/                        # 节点组件
│       ├── NodeShell.tsx             #   节点外壳(色条/状态灯/扫描线)
│       ├── VideoNodeBase.tsx         #   视频节点基类(配置驱动)
│       └── ...                       #   各具体节点
├── lib/
│   ├── db.ts                         # IndexedDB 存储层
│   ├── store.ts                      # Zustand 状态 + 执行引擎
│   ├── settings.ts                   # 全局设置(API Key/语言/默认参数)
│   ├── i18n.ts                       # 国际化(中英双语)
│   ├── dictionaries/                 # 翻译字典
│   │   ├── zh.ts                     #   中文
│   │   └── en.ts                     #   英文
│   ├── agnes.ts                      # Agnes API 客户端
│   ├── cache.ts                      # 本地缓存管理(并发安全)
│   ├── workflow.ts                   # 工作流引擎(拓扑排序)
│   ├── workflow-io.ts                # 工作流导入导出
│   ├── types.ts                      # TypeScript 类型定义
│   └── useToast.ts                   # Toast 通知 store
├── public/                           # 静态资源
├── .env.example                      # 环境变量模板(不含真实 key)
└── library/                          # 本地作品库(gitignore,运行时生成)
```

## ⚙️ 设置

点击界面右上角齿轮图标打开设置面板:

| 分类 | 选项 |
|------|------|
| **API** | API Key、Base URL、连接测试 |
| **生成参数** | 默认图片尺寸、视频帧数/帧率、自动翻译开关 |
| **外观** | 主题(暗/亮)、节点动画 |
| **语言** | 中文 / English |

> API Key 优先使用环境变量(`.env.local` 或部署平台环境变量),设置面板的 Key 为可选覆盖。

## 🎨 设计系统

采用 **Phosphor Studio** 美学方向:

- **配色** — 深蓝黑底(`#0a0e14`)+ 琥珀橙(`#f4a261`)+ 磷光绿(`#7dd3a0`)
- **字体** — Fraunces(衬线,有温度)+ JetBrains Mono(等宽,工程感)
- **节点符号** — 希腊字母标识类型(Τ/ℑ/Ϝ/Σ/Φ)
- **动效** — 连线流动、状态灯闪烁、按钮扫描线、进度条发光

亮色模式:暖米白底 + 深琥珀 + 墨绿,一键切换,持久化。

## 🚢 部署

### 本机

```bash
npm run build && npm start
```

### Vercel(推荐,一键部署)

1. 打开 [vercel.com](https://vercel.com) → Import Git Repository → 选 `techdou/agnes-workbench`
2. **Environment Variables** 里添加:
   - `AGNES_API_KEY` = `你的真实 key`
   - `AGNES_BASE_URL` = `https://apihub.agnes-ai.com`(可选,有默认值)
3. Deploy

> 仓库里已有 `vercel.json`,默认部署到香港节点(`hkg1`),国内访问较快。

> ⚠️ **Vercel 缓存限制**:Vercel serverless 函数的文件系统是临时的,`library/` 本地缓存在 Vercel 上**不会持久化**。生成内容能实时显示,但刷新后缓存可能丢失。如需持久缓存,请接入 Vercel Blob / S3 等对象存储。**自部署(`npm start`)则无此限制**。

## 🔧 CI/CD

GitHub Actions 在每次 push/PR 时自动运行:

- 依赖安装(`npm ci`)
- TypeScript 类型检查(`tsc --noEmit`)
- 生产构建(`npm run build`)

构建状态徽章在 README 顶部。失败会阻止合并,保证主干始终可构建。

## ⚠️ 限制

- 免费用户视频 RPM ≈ 1 次/分钟,单次生成约 30-60 秒
- `num_frames` 必须满足 `8n+1`(81/121/241/441),已预设选项
- 视频宽高必须是 8 的倍数
- Agnes 的 `ti2vid` 模式限 1 张图,多图自动切 `keyframes` 模式

## 🔒 安全说明

- API Key 存在 `.env.local`,已被 `.gitignore` 排除,**不会入库**
- 生成内容缓存在本地 `library/` 目录,同样不入库
- 部署时通过环境变量注入 Key,不硬编码到代码
- 缓存代理有 SSRF 白名单防护,只允许 Agnes 域名资源

## 📝 License

[MIT](LICENSE) © 2026 TechDou
