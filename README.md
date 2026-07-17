# ◈ Phosphor Studio

> 基于 [Agnes AI](https://agnes-ai.com) 全模态 API 的节点式创作工作台 · ComfyUI 风格连线画布

[![License: MIT](https://img.shields.io/badge/License-MIT-amber.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-16-black)](https://nextjs.org)
[![React Flow](https://img.shields.io/badge/React_Flow-12-blue)](https://reactflow.dev)
[![CI](https://github.com/techdou/agnes-workbench/actions/workflows/ci.yml/badge.svg)](https://github.com/techdou/agnes-workbench/actions/workflows/ci.yml)

通过拖拽节点、连线编排，一句话驱动 Agnes 的文本、图片、视频全模态生成能力。支持项目管理、工作流导入导出、多图参考融合、结构化 prompt 扩写、撤销/重做、中英双语。

## 🖼️ 演示

**亮色模式** — 跨模态流水线

![亮色模式](public/screenshots/demo-1.png)

**暗色模式** — 磷光工作室主题

![暗色模式](public/screenshots/demo-2.png)

---

## ✨ 功能特性

### 项目制管理

- **首页 Dashboard** — 项目卡片列表，缩略图 + 名称 + 时间，自动取画布首张生成图当缩略图
- **IndexedDB 持久化** — 数据存浏览器本地，容量充足，自动保存（1.5s 防抖）
- **工作流模板** — 3 个预置模板（文生图基础 / 图生视频 / 多图融合），一键创建
- **导入导出** — `.json` 格式，分享、复用、版本管理

### 节点系统（10 种）

| 节点 | 符号 | 能力 |
|------|------|------|
| 文本 | Τ | prompt 输入 + 结构化扩写（按目标类型选模板） |
| 上传图片 | ↥ | 拖拽/点击上传本地图，hash 去重 |
| 文生图 | ℑ | 文本 → 图片 |
| 图生图 | ℜ | 多图参考融合编辑（支持 @节点引用） |
| 文生视频 | Ϝ | 文本 → 视频（异步） |
| 图生视频 | δ | 图片动画化 |
| 多图视频 | Σ | 多张参考图生成视频 |
| 关键帧 | Φ | 两图之间过渡动画 |
| 图片预览 | ▣ | 展示 + 下载 |
| 视频预览 | ▶ | 展示 + 下载 |

### 结构化 Prompt 扩写

文本节点勾选「结构化扩写」后，按**目标类型**自动选模板生成专业 prompt（参照 [OpenAI Cookbook](https://developers.openai.com/cookbook/examples/multimodal/image-gen-models-prompting-guide) 规范）：

- **文生图**：场景 + 主体 + 细节 + 构图 + 约束（5 段式）
- **文生视频**：上述 + 镜头运动 + 时间线
- **图生图**：保留项 + 修改边界（编辑任务专用）
- **图生视频**：锚定帧 + 运动 + 相机
- **自动检测**：根据下游连线节点类型自动选模板

### @节点引用（多图精确指定）

图生图/图生视频的 prompt 框输入 `@` → 弹出已连线的上游节点列表（带缩略图）→ 选中插入 `{@节点id}`。运行时：
- 系统解析 `{@xxx}`，按引用顺序提取图片 URL
- 安全限制：只能引用通过连线连到当前节点的上游节点
- prompt 里的 `{@xxx}` 替换成自然语言（"the first reference image"），图片走 API 的 image 数组

### 画布交互

| 操作 | 方式 |
|------|------|
| **添加节点** | `/` 唤起 Command Palette，或拖连线到空白处弹出推荐 |
| **右键菜单** | 节点上：运行/复制/断开/删除；空白处：添加节点 |
| **撤销/重做** | `Ctrl+Z` / `Ctrl+Shift+Z`（zundo，上限 50 步） |
| **复制节点** | `Ctrl+D` 或 `Alt+拖拽` |
| **多选** | `Shift+点击` 或框选 |
| **批量操作** | 底部浮动栏（复制/删除） |
| **取消生成** | 运行中按钮变 CANCEL，点击真取消（abort fetch） |
| **快捷键速查** | `?` 弹出全部快捷键 |

### 其他

- **中文 prompt 自动翻译** — 非英文提示词自动翻成英文再调 API
- **本地永久缓存** — 生成结果下载到 `library/`，原 URL 过期也能访问
- **作品归档** — 右侧抽屉展示历史作品
- **中英双语** — 设置面板一键切换，即时生效
- **暗/亮双主题** — 磷光工作室风格，持久化，首屏防闪烁
- **动态模型** — 设置面板拉取 Agnes 最新可用模型，支持自定义填入新模型名

## 🚀 快速开始

### 1. 获取 API Key

前往 [platform.agnes-ai.com](https://platform.agnes-ai.com) → 注册 → API Keys → Create new secret key

> Agnes 目前全模态 API **无限期免费开放**，无需绑卡。

### 2. 配置环境变量

```bash
cp .env.example .env.local
# 编辑 .env.local，填入你的 API Key
```

### 3. 配置数据库（多用户版本必填）

```bash
# 本地 PostgreSQL 示例
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/phosphor"
# 或用 Neon / Supabase / RDS 等托管服务的连接串

# 首次启动前跑迁移
npm run db:migrate   # 开发环境
# 或
npm run db:push      # 生产环境直接推 schema
```

### 4. 生成密钥

```bash
# Auth.js 登录会话签名
echo AUTH_SECRET=$(openssl rand -base64 32)

# 用户 API Key 加密（AES-256-GCM）
echo ENCRYPTION_KEY=$(openssl rand -base64 32)
```

填入 `.env.local`。

### 5. 安装并启动

```bash
npm install
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000)，进入 `/register` 注册账号。

> ⚠️ **首个管理员** 用 `.env` 里的 `ADMIN_EMAIL` 注册，自动获得 ADMIN 角色。注册后可访问 `/admin` 入口管理用户。

## 🔐 多用户部署

每个用户登录后:
- 在「设置 → API」填自己的 Agnes Key（独立计费，AES-256 加密后入库）
- 自己的项目 / 工作流 / 媒体都隔离在服务端 DB 里
- 管理员可在 `/admin` 管理所有用户

**权限模型：**
- `USER` — 普通使用者，只能访问自己的项目和媒体
- `ADMIN` — 超级管理员，可访问 `/admin` 后台、切换用户角色、禁用账号

**安全防护（服务端强制，所有项目/媒体按 userId 隔离）：**
- 所有 API Route 必须登录
- 媒体文件读取校验所有权（不能访问别人的缓存）
- API Key 仅入库密文，前端只拿 `hasApiKey` + `apiKeyHint`（脱敏显示）
- 密码 bcrypt(cost=12)哈希

## 📖 使用方法

### 基本流程

1. **首页** → 新建项目（或从模板创建）
2. **画布** → 按 `/` 搜索添加节点，或从节点右侧 ● 拖到空白处弹出推荐
3. **连线** — 拖拽节点右侧 ● 到下一个节点左侧 ●
4. **运行** — 点节点底部 EXECUTE，自动先跑完上游
5. **归档** — 右侧 ARCHIVE 查看历史作品

### 文本节点扩写

1. 加文本节点，写 prompt
2. 选「扩写目标」（auto / 文生图 / 文生视频 / 图生图 / 图生视频）
3. 勾选「结构化扩写」
4. 点 AUGMENT → 按目标类型的专业模板生成英文 prompt

### 多图融合

1. 加多个「文生图」或「上传图片」节点，生成/上传不同的图
2. 全部连到同一个「图生图」节点
3. 在图生图的 prompt 框输入 `@` → 选择上游节点 → 插入引用
4. 写编辑指令（如「把 {@文生图_a1b2} 的风格融合到 {@上传_c3d4} 的构图」）
5. 运行 → 模型同时参考所有引用的图

### 键盘快捷键

| 快捷键 | 功能 |
|--------|------|
| `/` | 添加节点（Command Palette） |
| `?` | 快捷键速查表 |
| `Ctrl/⌘ + Enter` | 运行选中节点 |
| `Ctrl/⌘ + D` | 复制选中节点 |
| `Ctrl/⌘ + Z` | 撤销 |
| `Ctrl/⌘ + Shift + Z` | 重做 |
| `Delete` | 删除选中 |
| `Shift + 点击` | 多选 |
| 右键 | 上下文菜单 |

## 🏗️ 技术栈

| 层 | 技术 | 说明 |
|----|------|------|
| 框架 | Next.js 16 (App Router) | 全栈 TypeScript |
| 画布 | @xyflow/react 12 | 节点连线引擎 |
| 状态 | Zustand 5 + zundo | 全局状态 + 撤销/重做 |
| 存储 | IndexedDB (idb-keyval) | 项目持久化 |
| 样式 | Tailwind CSS 4 | 原子化 CSS |
| i18n | 自建轻量方案 | 中英双语，零依赖 |
| 字体 | Fraunces + JetBrains Mono | 衬线 + 等宽 |
| API | Agnes AI | OpenAI 兼容协议 |
| 测试 | Vitest | 27 个单测 |

**零 Python 依赖，全 TypeScript。**

## 📁 项目结构

```
phosphor-studio/
├── app/
│   ├── page.tsx                      # 首页 Dashboard
│   ├── canvas/[projectId]/page.tsx   # 画布页
│   ├── layout.tsx                    # 根布局（主题防闪烁）
│   ├── globals.css                   # 设计系统（双主题）
│   ├── error.tsx + global-error.tsx  # 错误边界
│   └── api/
│       ├── agnes/                    # Agnes API 代理
│       │   ├── text/                 #   文本生成
│       │   ├── image/                #   文生图 / 图生图（多图）
│       │   ├── video/                #   视频（创建 + 状态轮询）
│       │   └── models/               #   模型列表（GET /v1/models）
│       ├── cache/                    # 本地缓存代理
│       ├── upload/                   # 图片上传
│       └── library/                  # 作品库
├── components/
│   ├── Dashboard.tsx                 # 项目列表
│   ├── ProjectCard.tsx               # 项目卡片
│   ├── FlowCanvas.tsx                # 画布（右键/键盘/多选/批量）
│   ├── Toolbar.tsx                   # 画布工具栏
│   ├── CommandPalette.tsx            # / 唤起节点搜索
│   ├── NodeCreator.tsx               # 拖连线到空白弹出推荐
│   ├── NodeMentionInput.tsx          # @节点引用输入框
│   ├── ContextMenu.tsx               # 右键菜单
│   ├── ShortcutsModal.tsx            # 快捷键速查
│   ├── SettingsModal.tsx             # 设置（API/模型/参数/外观/语言）
│   ├── LibraryPanel.tsx              # 作品归档
│   └── nodes/                        # 节点组件
│       ├── NodeShell.tsx             #   节点外壳
│       ├── VideoNodeBase.tsx         #   视频节点基类
│       └── ...
├── lib/
│   ├── store.ts                      # Zustand 状态 + 执行引擎
│   ├── agnes.ts                      # Agnes API 客户端（动态模型）
│   ├── prompt-templates.ts           # 结构化扩写模板
│   ├── prompt-resolve.ts             # @引用解析 + 目标检测
│   ├── settings.ts                   # 全局设置
│   ├── db.ts                         # IndexedDB 存储
│   ├── i18n.ts + dictionaries/       # 国际化
│   ├── node-metadata.ts              # 节点元数据（统一定义）
│   ├── workflow.ts                   # 拓扑排序
│   ├── workflow-io.ts                # 导入导出
│   ├── templates.ts                  # 工作流模板
│   ├── cache.ts                      # 缓存管理（SSRF 防护）
│   └── __tests__/                    # 单元测试（27 个）
└── public/                           # 静态资源
```

## ⚙️ 设置

点击界面齿轮图标：

| Tab | 选项 |
|-----|------|
| **API** | API Key（覆盖 .env）、Base URL、连接测试 |
| **模型** | 拉取 Agnes 最新模型列表、自定义文本/图片/视频模型名、开发者文档链接 |
| **生成参数** | 默认图片尺寸、视频帧数/帧率、自动翻译开关 |
| **外观** | 主题（暗/亮）、节点动画 |
| **语言** | 中文 / English |

## 🎨 设计系统

- **配色** — 深蓝黑底（`#0a0e14`）+ 琥珀橙（`#f4a261`）+ 磷光绿（`#7dd3a0`）
- **字体** — Fraunces（衬线）+ JetBrains Mono（等宽）
- **节点符号** — 希腊字母（Τ/ℑ/Ϝ/Σ/Φ）
- **动效** — 连线流动、状态灯闪烁、扫描线、进度条发光
- **连线方向** — source handle 琥珀色圆形强发光，target handle 磷光绿圆角方形

## 🔒 安全

- API Key 存在 `.env.local`（或设置面板），`.gitignore` 排除，**不入库**
- 生成内容缓存在 `library/`，不入库
- 缓存代理 SSRF 白名单（只允许 Agnes 域名）
- 路径遍历防护
- 文件大小上限 200MB（缓存）/ 20MB（上传）
- @节点引用安全限制（只允许引用已连线节点）

## 🚢 部署

### 本机

```bash
npm run build && npm start
```

### Vercel

1. [vercel.com](https://vercel.com) → Import → 选 `techdou/agnes-workbench`
2. Environment Variables 添加 `AGNES_API_KEY`
3. Deploy（`vercel.json` 已配置香港节点）

> ⚠️ Vercel serverless 文件系统临时，`library/` 缓存不持久。自部署无此限制。

## 🔧 CI/CD

GitHub Actions：push/PR 自动跑 `npm ci` + `tsc --noEmit` + `npm run build`。

## ⚠️ 限制

- 视频免费 RPM ≈ 1 次/分钟，单次 30-60 秒
- `num_frames` 必须 8n+1（81/121/241/441）
- 视频宽高必须 8 的倍数
- 多图视频 ≥ 2 张图自动切 `keyframes` 模式

## 📝 License

[MIT](LICENSE) © 2026 TechDou
