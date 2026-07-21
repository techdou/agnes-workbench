# ◈ Phosphor Studio

> 基于 [Agnes AI](https://agnes-ai.com) 全模态 API 的节点式创作工作台 · ComfyUI 风格连线画布

[![License: MIT](https://img.shields.io/badge/License-MIT-amber.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-16-black)](https://nextjs.org)
[![React Flow](https://img.shields.io/badge/@xyflow/react-12-blue)](https://reactflow.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6)](https://www.typescriptlang.org/)
[![Vitest](https://img.shields.io/badge/Tests-34%20passed-brightgreen)](lib/__tests__/)
[![CI](https://github.com/techdou/agnes-workbench/actions/workflows/ci.yml/badge.svg)](https://github.com/techdou/agnes-workbench/actions/workflows/ci.yml)

通过拖拽节点、连线编排,一句话驱动 Agnes 的文本、图片、视频全模态生成能力。支持项目管理、工作流导入导出、多图参考融合、结构化 prompt 扩写 + 中文摘要、★ 全局画廊收藏、移动端触屏适配、撤销/重做、中英双语。

## 🖼️ 演示

**亮色模式** — 跨模态流水线

![亮色模式](public/screenshots/demo-1.png)

**暗色模式** — 磷光工作室主题

![暗色模式](public/screenshots/demo-2.png)

---

## ✨ 功能特性

### 项目制管理

- **首页 Dashboard** — 项目卡片列表,缩略图 + 名称 + 时间,自动取画布首张生成图当缩略图
- **IndexedDB 持久化** — 数据存浏览器本地,容量充足,自动保存(1.5s 防抖)
- **工作流模板** — 3 个预置模板(文生图基础 / 图生视频 / 多图融合),一键创建
- **导入导出** — `.json` 格式,分享、复用、版本管理

### 节点系统(10 种)

| 节点 | 符号 | 能力 |
|------|------|------|
| 文本 | Τ | prompt 输入 + 结构化扩写(按目标类型选模板)+ 可选中文摘要 |
| 上传图片 | ↥ | 拖拽/点击上传本地图,hash 去重 |
| 文生图 | ℑ | 文本 → 图片 |
| 图生图 | ℜ | 多图参考融合编辑(支持 @节点引用) |
| 文生视频 | Ϝ | 文本 → 视频(异步) |
| 图生视频 | δ | 图片动画化 |
| 多图视频 | Σ | 多张参考图生成视频 |
| 关键帧 | Φ | 两图之间过渡动画 |
| 图片预览 | ▣ | 展示 + 下载 |
| 视频预览 | ▶ | 展示 + 下载 |

### 结构化 Prompt 扩写 + 中文摘要

文本节点勾选「结构化扩写」后,按**目标类型**自动选模板生成专业 prompt(参照 [OpenAI Cookbook](https://developers.openai.com/cookbook/examples/multimodal/image-gen-models-prompting-guide) 规范):

- **文生图**:场景 + 主体 + 细节 + 构图 + 约束(5 段式)
- **文生视频**:上述 + 镜头运动 + 时间线
- **图生图**:保留项 + 修改边界(编辑任务专用)
- **图生视频**:锚定帧 + 运动 + 相机
- **自动检测**:根据下游连线节点类型自动选模板

勾选「中文摘要」后,扩写完成会**额外调一次 LLM 把扩写后的英文 prompt 翻成简体中文**,展示在节点底部磷光绿色块里。**只给人看,不传下游**——下游节点拿到的还是英文 prompt。

### @节点引用(多图精确指定)

图生图/图生视频的 prompt 框输入 `@` → 弹出已连线的上游节点列表(带缩略图)→ 选中插入 `{@节点id}`。运行时:
- 系统解析 `{@xxx}`,按引用顺序提取图片 URL
- 安全限制:只能引用通过连线连到当前节点的上游节点
- prompt 里的 `{@xxx}` 替换成自然语言("the first reference image"),图片走 API 的 image 数组

### 画布交互

| 操作 | 方式 |
|------|------|
| **添加节点** | `/` 唤起 Command Palette,或拖连线到空白处弹出推荐 |
| **右键菜单** | 节点上:运行/复制/断开/删除;空白处:添加节点 |
| **撤销/重做** | `Ctrl+Z` / `Ctrl+Shift+Z`(zundo,上限 50 步;运行中禁用避免状态分叉) |
| **复制节点** | `Ctrl+D` 或 `Alt+拖拽` |
| **多选** | `Shift+点击` 或框选;移动端有专门的多选模式按钮 |
| **批量操作** | 底部浮动栏(运行/复制/删除) |
| **取消生成** | 运行中按钮变 CANCEL,点击真取消(abort fetch + pollVideo) |
| **快捷键速查** | `?` 弹出全部快捷键(移动端显示触屏手势) |

### 收藏与画廊

- **项目级归档** — 右侧 `◈ ARCHIVE` 抽屉,按项目隔离,自动收集本画布所有生成结果
- **★ 收藏** — 归档卡片右上角 ☆/★ 切换,乐观更新 + 失败回滚
- **全局画廊** — 首页顶栏 `★ Gallery` 入口,`/gallery` 独立路由跨项目聚合所有 ★ 内容,masonry 瀑布流,视频可点播放

### 移动端适配

桌面交互完整保留,触屏在**上面叠加**(不是替换式重写):

- **长按** — 节点 350ms / 空白 400ms 弹上下文菜单
- **手势** — 单指拖动平移画布、双指捏合缩放
- **底部工具条** — 撤销/重做圆形按钮(仅触屏显示)
- **多选模式** — 工具栏 ⊟ 按钮切换,点节点 toggle 选中
- **响应式** — handle 放大到 18px、MiniMap 隐藏、节点 280px、tab 栏横向滚动
- **触屏笔电识别** — `coarsePointer && !finePointer` 判断,Surface 等不算触屏

### 其他

- **中文 prompt 自动翻译** — 非英文提示词自动翻成英文再调 API
- **本地永久缓存** — 生成结果下载到 `library/`,原 URL 过期也能访问
- **Run All 限流** — 视频节点自动间隔 65s/个,避免触发 Agnes RPM 限制
- **中英双语** — 设置面板一键切换,即时生效
- **暗/亮双主题** — 磷光工作室风格,持久化,首屏防闪烁
- **动态模型** — 设置面板拉取 Agnes 最新可用模型,支持自定义填入新模型名
- **无障碍** — 触控目标 ≥44px、aria 语义、`prefers-reduced-motion` 自动关停装饰动画

## 🚀 快速开始

### 1. 获取 API Key

前往 [platform.agnes-ai.com](https://platform.agnes-ai.com) → 注册 → API Keys → Create new secret key

> Agnes 目前全模态 API **无限期免费开放**,无需绑卡。

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

> 也可以在设置面板 → API 里直接填 Key(优先于 .env)。

## 📖 使用方法

### 基本流程

1. **首页** → 新建项目(或从模板创建)
2. **画布** → 按 `/` 搜索添加节点,或从节点右侧 ● 拖到空白处弹出推荐
3. **连线** — 拖拽节点右侧 ● 到下一个节点左侧 ●
4. **运行** — 点节点底部 EXECUTE,自动先跑完上游
5. **归档** — 右侧 ARCHIVE 查看本项目作品;点 ☆ 收藏 → 首页 ★ Gallery 看全部收藏

### 文本节点扩写 + 中文摘要

1. 加文本节点,写 prompt
2. 选「扩写目标」(auto / 文生图 / 文生视频 / 图生图 / 图生视频)
3. 勾选「结构化扩写」
4. 想看中文意思?勾「中文摘要」(依赖扩写)
5. 点 AUGMENT → 按目标类型的专业模板生成英文 prompt + 中文摘要展示在底部

### 多图融合

1. 加多个「文生图」或「上传图片」节点,生成/上传不同的图
2. 全部连到同一个「图生图」节点
3. 在图生图的 prompt 框输入 `@` → 选择上游节点 → 插入引用
4. 写编辑指令(如「把 {@文生图_a1b2} 的风格融合到 {@上传_c3d4} 的构图」)
5. 运行 → 模型同时参考所有引用的图

### 键盘快捷键

| 快捷键 | 功能 |
|--------|------|
| `/` | 添加节点(Command Palette) |
| `?` | 快捷键速查表(移动端显示手势) |
| `Ctrl/⌘ + Enter` | 运行选中节点 |
| `Ctrl/⌘ + D` | 复制选中节点 |
| `Ctrl/⌘ + Z` | 撤销(运行中禁用) |
| `Ctrl/⌘ + Shift + Z` | 重做(运行中禁用) |
| `Delete` | 删除选中 |
| `Shift + 点击` | 多选 |
| 右键 / 长按 | 上下文菜单 |

## 🏗️ 技术栈

| 层 | 技术 | 说明 |
|----|------|------|
| 框架 | Next.js 16 (App Router) | 全栈 TypeScript,viewport 独立导出 |
| 画布 | @xyflow/react 12 | 节点连线引擎 |
| 状态 | Zustand 5 + zundo | 全局状态 + 撤销/重做(50 步上限) |
| 存储 | IndexedDB (idb-keyval) | 项目持久化 |
| 样式 | Tailwind CSS 4 | 原子化 CSS,CSS 变量双主题 |
| i18n | 自建轻量方案 | 中英双语,零依赖 |
| 字体 | Fraunces + JetBrains Mono | 衬线 + 等宽,本地化 |
| API | Agnes AI | OpenAI 兼容协议 |
| 测试 | Vitest | 34 个单测(4 个测试文件) |

**零 Python 依赖,全 TypeScript。**

## 📁 项目结构

```
agnes-workbench/
├── app/
│   ├── page.tsx                      # 首页 Dashboard
│   ├── canvas/[projectId]/page.tsx   # 画布页
│   ├── gallery/page.tsx              # ★ 全局画廊(跨项目收藏)
│   ├── layout.tsx                    # 根布局(viewport + 主题防闪烁)
│   ├── globals.css                   # 设计系统(双主题 + 移动端 + reduced-motion)
│   ├── error.tsx + global-error.tsx  # 错误边界
│   └── api/
│       ├── agnes/                    # Agnes API 代理
│       │   ├── text/                 #   文本生成 + 翻译
│       │   ├── image/                #   文生图 / 图生图(多图)
│       │   ├── video/                #   视频(创建 + 状态轮询)
│       │   └── models/               #   模型列表(GET /v1/models)
│       ├── cache/                    # 本地缓存代理
│       │   ├── [hash]/route.ts       #   GET 文件 + PATCH 收藏切换
│       │   └── item/route.ts         #   POST 缓存新 URL
│       ├── gallery/route.ts          # 全局画廊(★ 收藏列表)
│       ├── upload/                   # 图片上传
│       └── library/                  # 项目级归档列表
├── components/
│   ├── Dashboard.tsx                 # 项目列表
│   ├── ProjectCard.tsx               # 项目卡片
│   ├── FlowCanvas.tsx                # 画布(键盘/多选/批量/长按/触屏)
│   ├── Toolbar.tsx                   # 画布工具栏(响应式)
│   ├── CommandPalette.tsx            # / 唤起节点搜索
│   ├── NodeCreator.tsx               # 拖连线到空白弹出推荐
│   ├── NodeMentionInput.tsx          # @节点引用输入框
│   ├── ContextMenu.tsx               # 右键/长按菜单
│   ├── ShortcutsModal.tsx            # 快捷键/手势速查
│   ├── SettingsModal.tsx             # 设置(API/模型/参数/外观/语言)
│   ├── LibraryPanel.tsx              # 项目级归档抽屉 + ★ 收藏
│   ├── GalleryPage.tsx               # 全局画廊页面(masonry)
│   ├── MediaCard.tsx                 # 媒体卡片共用组件(GalleryVideo)
│   └── nodes/                        # 节点组件
│       ├── NodeShell.tsx             #   节点外壳(双主题)
│       ├── VideoNodeBase.tsx         #   视频节点基类
│       └── ...
├── lib/
│   ├── store.ts                      # Zustand 状态 + 执行引擎 + runAll 限流
│   ├── agnes.ts                      # Agnes API 客户端(动态模型 + 中文翻译)
│   ├── cache.ts                      # 缓存管理(SSRF + DNS rebinding 防护 + 收藏)
│   ├── cache-logic.ts                # 缓存纯逻辑(过滤/排序,无 IO 依赖,便于单测)
│   ├── prompt-templates.ts           # 结构化扩写模板
│   ├── prompt-resolve.ts             # @引用解析 + 目标检测
│   ├── settings.ts                   # 全局设置
│   ├── db.ts                         # IndexedDB 存储
│   ├── i18n.ts + dictionaries/       # 国际化(zh/en)
│   ├── node-metadata.ts              # 节点元数据(统一定义)
│   ├── workflow.ts                   # 拓扑排序 + 上游输出收集
│   ├── workflow-io.ts                # 导入导出
│   ├── templates.ts                  # 工作流模板
│   └── __tests__/                    # 单元测试(34 个)
└── public/                           # 静态资源(截图)
```

## ⚙️ 设置

点击界面齿轮图标:

| Tab | 选项 |
|-----|------|
| **API** | API Key(覆盖 .env)、Base URL、连接测试(分 ok/partial/fail 三档) |
| **模型** | 拉取 Agnes 最新模型列表、自定义文本/图片/视频模型名、开发者文档链接 |
| **生成参数** | 默认图片尺寸、视频帧数/帧率、自动翻译开关 |
| **外观** | 主题(暗/亮)、节点动画 |
| **语言** | 中文 / English |

## 🎨 设计系统

- **配色** — 深蓝黑底(`#0a0e14`) + 琥珀橙(`#f4a261`) + 磷光绿(`#7dd3a0`)
- **字体** — Fraunces(衬线) + JetBrains Mono(等宽)
- **节点符号** — 希腊字母(Τ/ℑ/Ϝ/Σ/Φ)
- **动效** — 连线流动、状态灯闪烁、扫描线、进度条发光
- **连线方向** — source handle 琥珀色圆形强发光,target handle 磷光绿圆角方形

## 🔒 安全

- **API Key** 存在 `.env.local`(或设置面板),`.gitignore` 排除,**不入库**
- **生成内容**缓存在 `library/`,不入库
- **SSRF 防护** — 缓存代理域名白名单(只允许 Agnes 域名,可 env 扩充)
- **DNS rebinding 防护** — fetch 前 `dns.lookup` 预解析所有 A/AAAA 记录,任一解析到内网段就拒绝
- **CSRF 防护** — PATCH 接口同源校验(origin/host 比对)
- **路径遍历防护** — 所有本地路径校验不越出 `library/` 目录
- **文件大小上限** — 200MB(缓存)/ 20MB(上传)/ 10MB(base64 转换)
- **@节点引用安全** — 只允许引用通过连线连到当前节点的上游节点
- **undo/redo 安全** — 节点运行中禁用撤销/重做,避免状态分叉

## 🚢 部署

### 本机

```bash
npm run build && npm start
```

### Vercel

1. [vercel.com](https://vercel.com) → Import → 选 `techdou/agnes-workbench`
2. Environment Variables 添加 `AGNES_API_KEY`
3. Deploy(`vercel.json` 已配置香港节点)

> ⚠️ Vercel serverless 文件系统临时,`library/` 缓存不持久。自部署无此限制。

## 🔧 CI/CD

GitHub Actions:push/PR 自动跑 `npm ci` + `tsc --noEmit` + `npm run build`。

## 🌿 分支说明

| 分支 | 说明 |
|------|------|
| `main` | 单机版,IndexedDB 本地存储,无鉴权 |
| `feat/multi-user` | 多用户版,Prisma + PostgreSQL + Auth.js v5 鉴权,数据按用户隔离 |

multi-user 分支需要额外的环境变量(`DATABASE_URL` / `AUTH_SECRET` / `ENCRYPTION_KEY`),详见 `.env.example` 对应段落。

## ⚠️ 限制

- 视频免费 RPM ≈ 1 次/分钟,单次 30-60 秒
- `num_frames` 必须 8n+1(81/121/241/441)
- 视频宽高必须 8 的倍数
- 多图视频 ≥ 2 张图自动切 `keyframes` 模式

## 🧪 测试

```bash
npm test          # 跑全部 34 个单测
npm run lint      # ESLint(0 error)
npx tsc --noEmit  # 类型检查(0 error)
```

测试覆盖:
- `workflow.test.ts` — 拓扑排序、上游输出收集、环检测
- `prompt-resolve.test.ts` — @引用解析、目标类型检测
- `store.test.ts` — 节点推荐列表
- `cache.test.ts` — 过滤排序纯函数(projectId/收藏/组合/老数据 fallback)

## 📝 License

[MIT](LICENSE) © 2026 TechDou
