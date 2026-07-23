---
title: Markdown Visual Editor
emoji: 📝
colorFrom: indigo
colorTo: pink
sdk: docker
app_port: 7860
pinned: false
license: mit
short_description: Markdown 实时预览 + 多平台导出（公众号 / 头条号 / 移动端 / 飞书云文档）
---

# Markdown 可视化编辑器

一个基于 React + TypeScript 的两栏式 Markdown 实时预览编辑器。
左侧编写 Markdown，右侧实时预览，支持 `默认 / 公众号 / 头条号 / Mobile` 四种格式，并支持复制格式化内容、按当前预览格式导出 PDF，以及一键「创建飞书文档」（原生 block 结构 + 公式 + 图片 + Mermaid）。

---

## 功能概览

- GFM 完整支持：表格、删除线、任务列表、自动链接
- 数学公式：支持行内 `$...$` 和块级 `$$...$$`，使用 KaTeX 渲染
- Mermaid 图表：支持流程图、时序图等，语法错误时不会拖垮整个页面
- 代码高亮：基于 Shiki，支持语言识别、行号、复制代码
- 脚注：支持 `[^1]` 语法
- TOC 目录：自动从标题生成，兼容中文锚点
- XSS 过滤：过滤 `<script>` 和 `javascript:` 等危险内容
- 多平台预览：默认、公众号、头条号、Mobile 四种模式
- 图片与视频：支持 Markdown 图片、扩展媒体指令、HTML video、本地媒体会话预览
- 一键复制：按当前目标格式复制 HTML 内容
- PDF 导出：按当前预览结果导出 PDF
- 飞书云文档：一键把 Markdown 转成飞书原生 block 文档（公式 / 图片 / Mermaid 上传，OAuth 用户身份）
- 深色 / 浅色主题：支持切换并自动保存偏好
- 配色方案：支持预设配色和自定义强调色
- 去 AI 味：可选地对文本做额外清理

---

## 环境要求

| 工具 | 推荐版本 | 检查命令 |
|------|----------|----------|
| Node.js | 18+ | `node -v` |
| pnpm | 9+ | `pnpm -v` |

说明：
- 本项目限制使用 `pnpm`
- 如果本机没有安装 `pnpm`，可以先执行：

```powershell
npm install -g pnpm
```

---

## 快速开始

### 1. 进入项目目录

```powershell
cd V:\AICollab\markdown-visual-editor
```

### 2. 安装依赖

```powershell
pnpm install
```

### 3. 启动开发服务器

```powershell
pnpm dev
```

启动成功后会看到类似输出：

```text
VITE v8.x.x  ready in xxx ms

  Local:   http://localhost:5173/
```

### 4. 打开浏览器

访问：`http://localhost:5173/`

---

## 使用说明

### 界面结构

- 左侧：Markdown 编辑区
- 右侧：实时预览区
- 顶部工具栏：格式切换、插入图片、插入视频、复制、导出 PDF、去 AI 味、配色方案、主题切换

### 工具栏说明

| 控件 | 作用 |
|------|------|
| `默认 / 公众号 / 头条号 / Mobile` | 切换当前预览格式 |
| `图片` | 插入远程图片 URL 或本地图片文件 |
| `视频` | 插入远程视频 URL 或本地视频文件 |
| `图片目录` | 授权本地目录批量载入相对路径图片（仅当前会话，刷新需重选） |
| `复制` | 复制当前格式对应的内容 |
| `导出 PDF` | 将当前预览内容导出为 PDF |
| `创建飞书文档` | 把当前 Markdown 转成飞书云文档（原生 block + 公式 + 图片 + Mermaid） |
| `去 AI 味` | 对文本做额外清理 |
| `调色` | 切换预设配色或自定义强调色 |
| 主题按钮 | 切换浅色 / 深色主题 |

### 四种格式说明

| 格式 | 适用场景 | 说明 |
|------|----------|------|
| 默认 | 本地阅读、博客预览 | 样式最完整，适合编辑和检查内容 |
| 公众号 | 微信公众号编辑器 | 会将关键样式尽量内联，便于复制粘贴 |
| 头条号 | 今日头条 / 头条号编辑器 | 针对头条号编辑器限制做适配 |
| Mobile | 手机端阅读效果检查 | 使用手机外框展示内容，适合检查移动端布局 |

### 创建飞书文档

工具栏右侧「创建飞书文档」按钮（任意格式下可用）把当前 Markdown 转成**飞书云文档**（docx block 原生结构，非剪贴板粘贴），并在新标签打开。

**支持的元素**：
- 文本结构：标题（H1-H9）/ 段落 / 列表（无序、有序、todo、嵌套缩进）/ 代码块（语言枚举映射）/ 引用 / 分隔线 / 表格 → 飞书原生 block
- 公式：行内 `$...$`、块级 `$$...$$` → 飞书 equation element（LaTeX 源直出，自动渲染）
- 图片：本地图 / 公网图 → 飞书素材 API 上传（3 步：descendant 建空 image block → `upload_all` 拿 file_token → `batch_update` replace_image 绑定）
- Mermaid：浏览器渲染成 PNG 后按图片链路上传（飞书不原生识别 mermaid 代码）

**鉴权（用户身份 OAuth）**：
- 首次点击跳飞书授权页（scope `docx:document drive:drive`），回调换 token 存 HttpOnly cookie
- access token 过期（约 2h）后下次导出自动用 refresh token 静默续期，无需重新走授权
- token 仅存浏览器 cookie（HttpOnly 防 JS 读），`app_secret` 只在 Worker 服务端，不进前端

**本地开发**：
- 必须 `pnpm dev`（端口 5173）——飞书后台「重定向 URL」配的是 `http://localhost:5173/api/feishu/oauth/callback`
- 不要用 `pnpm preview`（默认 8787，端口不匹配 OAuth 会失败）
- 在项目根 `.dev.vars` 配 `FEISHU_APP_ID` / `FEISHU_APP_SECRET`（gitignored，参考 `.dev.vars.example`）

**已知限制**：
- 飞书 docx 文本颜色是预设枚举（非任意 hex），不应用调色板 accent；文档走飞书原生标题层级色
- 单次创建 ≤ 1000 个 block（飞书 descendant API 上限）
- 段落内 inline 图片降级为 alt 文本（飞书 image 是 block 级）；`::video` 指令不支持导出到飞书

推荐使用方式：
- 写作和校对阶段：优先用 `默认`
- 发公众号前：切到 `公众号` 后再复制或导出
- 发头条号前：切到 `头条号` 后再复制或导出
- 检查移动端效果：切到 `Mobile`

### PDF 导出说明

PDF 导出遵循一条原则：

- 当前在预览什么格式，就导出什么格式

例如：
- 当前是 `默认`，导出的是默认预览样式
- 当前是 `公众号`，导出的是公众号格式预览样式
- 当前是 `头条号`，导出的是头条号格式预览样式
- 当前是 `Mobile`，导出的是移动端外框预览样式

注意：
- 当前实现基于浏览器打印能力导出 PDF
- 不同浏览器在分页、缩放、页边距处理上可能略有差异
- 如果你希望导出结果尽量接近预览，建议优先使用 Chromium 内核浏览器

### 复制到目标平台

1. 先切换到目标格式
2. 点击 `复制`
3. 到目标平台编辑器中粘贴

说明：
- 远程图片会作为 HTML 图片节点复制
- 本地图片会做最佳努力复制：会写入 HTML，并在单图场景尝试附带图片二进制剪贴板项
- 视频在公众号 / 头条号模式下不会复制 `<video>`，而是转换成“封面 + 标题 + 链接”卡片
- 本地视频仅支持当前会话预览；复制到公众号 / 头条号前请提供公开链接和封面
- 复制功能优先使用 Clipboard API 写入 `text/html`
- 如果浏览器权限受限，会自动退回到普通复制方式

### 配色方案

支持多种预设配色，以及自定义强调色。
配色会影响：
- 预览中的强调色
- 公众号 / 头条号导出内容中的强调色
- PDF 导出中的当前视觉结果

不影响飞书文档（飞书 docx 文本色为预设枚举，不支持任意 hex）。

### 主题切换

- 支持浅色 / 深色主题
- 切换结果会保存到本地，下次打开自动恢复

---

## 头条号平台限制

头条号编辑器对 HTML 和 CSS 的支持比较严格，以下是需要特别注意的点：

| 限制项 | 说明 |
|--------|------|
| `class` 可能被剥离 | 因此导出时需要依赖内联样式 |
| `<style>` 可能被过滤 | 外部样式和页面级样式不可靠 |
| 部分 CSS 属性可能失效 | 某些颜色、定位、垂直对齐可能不生效 |
| SVG / Mermaid 支持有限 | 复杂图表可能无法直接保留 |

建议：
- 数学公式、复杂图表较多时，优先使用公众号渠道发布
- 头条号发布前，先在目标平台编辑器里实际粘贴验证一次

---

## 支持的 Markdown 语法

### 基础语法

```markdown
# 一级标题
## 二级标题
**粗体** *斜体* ~~删除线~~
[链接](https://example.com)
![图片](https://example.com/demo.png)
> 引用
- 无序列表
1. 有序列表
`行内代码`
---
```

### GFM 扩展

```markdown
- [x] 已完成任务
- [ ] 未完成任务

| 姓名 | 年龄 |
|------|------|
| 张三 | 25   |

~~删除线文本~~
```

### 媒体语法

```markdown
::image{src="https://example.com/demo.png" alt="示例图片" caption="可选图注" width="720px"}

::video{src="https://example.com/demo.mp4" poster="https://example.com/poster.png" title="视频标题" href="https://example.com/watch"}

<video src="https://example.com/demo.mp4" poster="https://example.com/poster.png" controls title="HTML 视频"></video>
```

说明：
- `::image` 适合带图注、宽度控制的图片块
- `::video` 和 HTML `<video>` 都支持默认 / Mobile 实时预览
- 公众号 / 头条号模式下，视频会预览和导出为媒体卡片
- 本地图片 / 本地视频只在当前会话中可预览；刷新后需要重新选择文件

### 数学公式

```markdown
行内公式：$E = mc^2$

块级公式：
$$
\int_{-\infty}^{\infty} e^{-x^2} dx = \sqrt{\pi}
$$
```

### 代码块

````markdown
```typescript
function hello(name: string): string {
  return `Hello, ${name}!`
}
```
````

### Mermaid 图表

````markdown
```mermaid
graph TD
    A[开始] --> B{条件判断}
    B -->|是| C[操作 A]
    B -->|否| D[操作 B]
```
````

### 脚注

```markdown
这是一个脚注示例[^1]。

[^1]: 这是脚注内容
```

---

## 项目结构

```text
V:\AICollab\markdown-visual-editor\
├── index.html
├── package.json
├── vite.config.ts
├── wrangler.jsonc          # Cloudflare Workers 配置
├── Dockerfile              # Hugging Face Spaces 部署
├── .dev.vars.example       # 飞书 app_id/secret 本地配置样例（.dev.vars 实际 gitignored）
├── tsconfig.json
├── tsconfig.app.json
├── tsconfig.node.json
├── public/
│   ├── favicon.svg
│   └── icons.svg
└── src/
    ├── main.tsx
    ├── App.tsx
    ├── worker.ts            # Cloudflare Worker：飞书 OAuth + 文档创建代理
    ├── index.css
    ├── assets/
    ├── components/
    │   ├── Editor.tsx
    │   ├── Preview.tsx
    │   ├── Toolbar.tsx
    │   ├── TOC.tsx
    │   ├── CodeBlock.tsx
    │   ├── MermaidBlock.tsx
    │   └── MediaInsertModal.tsx
    ├── pipeline/
    │   ├── processor.ts
    │   └── plugins/
    │       ├── rehype-image.ts
    │       ├── rehype-mermaid.ts
    │       ├── rehype-table-wrap.ts
    │       ├── rehype-video.ts
    │       ├── remark-deai.ts
    │       └── remark-media-directive.ts
    ├── formats/
    │   ├── katex-inline.ts
    │   ├── wechat.ts
    │   └── toutiao.ts
    ├── feishu-blocks/
    │   ├── converter.ts     # mdast → 飞书 docx block
    │   ├── export.ts        # 浏览器侧编排：fetch 图字节 + mermaid PNG + OAuth refresh
    │   └── types.ts
    ├── themes/
    │   └── variables.css
    └── utils/
        ├── color-schemes.ts
        ├── media.ts
        ├── media-export.ts
        ├── pdf.ts
        ├── sample.ts
        ├── sanitize-schema.ts
        └── store.ts
```

---

## 构建与部署

### 本地开发

```powershell
pnpm dev
```

### 构建生产版本

```powershell
pnpm build
```

构建产物输出到：`dist/`

### 本地预览构建结果

```powershell
pnpm preview
```

### 部署到 Cloudflare Workers（推荐，飞书功能必需）

项目内置 Cloudflare Worker（`src/worker.ts`）代理飞书 API + 服务静态资源。飞书「创建飞书文档」**必须**在 Workers 环境运行（纯静态部署无后端代理飞书）。

1. Cloudflare Workers Settings → Variables 配 secrets：
   - `FEISHU_APP_ID`
   - `FEISHU_APP_SECRET`
2. 飞书开放平台后台「重定向 URL」配 `https://<your-domain>/api/feishu/oauth/callback`
3. 部署：

```powershell
pnpm deploy
```

### 部署到 Hugging Face Spaces

项目含 `Dockerfile` + 顶部 YAML frontmatter（`sdk: docker`），可作为 Docker SDK Space 部署。**飞书功能不可用**（HF 无 Cloudflare Worker 运行环境），其余功能正常。README 必须 UTF-8 无 BOM，否则 frontmatter 解析失效。

### 部署到纯静态服务器（无飞书功能）

仅部署 `dist/` 到静态服务器，**飞书文档功能不可用**（无后端），其余（预览 / 复制 / PDF）正常：

- Nginx
- Vercel
- Netlify
- GitHub Pages

Nginx 示例：

```nginx
server {
    listen 80;
    server_name your-domain.com;
    root /path/to/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

---

## 常用命令

| 命令 | 说明 |
|------|------|
| `pnpm dev` | 启动开发服务器（5173，飞书 OAuth 端口） |
| `pnpm build` | 构建生产版本 |
| `pnpm preview` | 本地预览构建结果（8787，不走 vite，飞书 OAuth 不通） |
| `pnpm deploy` | 部署到 Cloudflare Workers |
| `pnpm lint` | 运行 ESLint 检查 |

### 测试

```powershell
# 全量测试（含行为测试，带 ESM loader 解析 src 的无扩展名相对导入 + @/ 别名）
node --experimental-loader ./tests/_esm-resolve.mjs --test tests/*.test.ts
```

测试分两类：
- **源码正则测试**：`readFileSync` 后断言源码字串（不 import src，不需 loader）
- **行为测试**：真 import src 跑转换 / 断言输出（必须带 loader，否则 node ESM 不解析无扩展名相对导入）

---

## 技术栈

| 类别 | 技术 | 用途 |
|------|------|------|
| 框架 | React 19 + TypeScript | UI 组件与类型系统 |
| 构建 | Vite 8 | 开发服务与打包 |
| 编辑器 | CodeMirror 6 | Markdown 编辑 |
| Markdown 解析 | unified + remark + rehype | AST 解析与转换 |
| 代码高亮 | Shiki | 语法高亮 |
| 数学公式 | remark-math + rehype-katex | 公式渲染 |
| 图表 | Mermaid | 图表渲染 |
| 样式 | Tailwind CSS | 基础样式系统 |
| 状态管理 | Zustand | 全局状态 |
| 安全 | rehype-sanitize | XSS 过滤 |
| 后端 | Cloudflare Workers | 飞书 OAuth + 文档创建代理（`src/worker.ts`，用户身份 token） |

---

## 常见问题

### Q: 为什么 `npm install` 不行？

因为项目限制使用 `pnpm`。请改用：

```powershell
pnpm install
```

### Q: 启动后页面空白怎么办？

优先检查：
- 终端是否有构建报错
- 浏览器控制台是否有运行时报错
- 依赖是否安装完整

可以尝试重新安装依赖：

```powershell
Remove-Item -Recurse -Force node_modules
pnpm install
pnpm dev
```

### Q: 公众号粘贴后样式丢失怎么办？

请确认操作顺序：
1. 切换到 `公众号` 模式
2. 点击 `复制`
3. 在公众号编辑器中粘贴

如果直接复制默认模式内容，目标平台通常不会保留预期样式。

### Q: 为什么导出的 PDF 和页面预览有差异？

当前 PDF 导出基于浏览器打印能力实现，可能在以下方面存在差异：
- 分页位置
- 页边距
- 缩放比例
- 某些浏览器的打印样式处理

如果你非常依赖导出一致性，建议优先使用 Chromium 内核浏览器测试。

### Q: 本地图片和本地视频复制到平台时有什么限制？

- 本地图片：当前实现是最佳努力复制，不是稳定上传能力
- 单张本地图片场景会尝试同时写入 HTML 和图片剪贴板项
- 多张本地图片或复杂混排内容，最终是否自动上传取决于浏览器和目标编辑器
- 本地视频不会直接复制到公众号 / 头条号；请提供公开链接和封面，系统会导出为媒体卡片

### Q: Mermaid 图表显示错误怎么办？

Mermaid 语法错误时会显示错误提示，而不是让整个页面崩溃。
请检查图表语法，必要时参考官方文档：
- `https://mermaid.js.org/`

### Q: 数学公式没有渲染怎么办？

请确认语法正确：
- 行内公式：`$E=mc^2$`
- 块级公式：

```markdown
$$
\sum_{i=1}^{n} x_i
$$
```

### Q: 如何修改主题或强调色？

- 日常使用：直接通过顶部工具栏切换
- 想改默认主题变量：编辑 `src/themes/variables.css`
- 想调整配色方案：查看 `src/utils/color-schemes.ts`

### Q: 创建飞书文档 401 或一直跳授权页？

token 过期或未授权。本地必须用 `pnpm dev`（5173 端口），与飞书后台「重定向 URL」一致；换端口（如 `pnpm preview` 的 8787）OAuth 必失败。访问 `http://localhost:5173/api/feishu/status` 可看当前 `authed` 状态。token 过期会自动用 refresh token 续期，仅 refresh 也失效时才需重新授权。

### Q: 飞书文档里图片显示「上传失败」？

排查：
- 本地图是否当前会话插入（刷新页面后需重新选择文件）
- 公网图是否 CORS 可达（飞书代理不下载，浏览器侧 fetch 受 CORS）
- 单图是否 > 20MB（飞书 `upload_all` 单文件上限）
- Mermaid 语法错误会渲染失败（飞书文档对应位置留空框）

### Q: 飞书文档颜色没跟随调色板 accent？

飞书 docx 文本色是预设枚举（非任意 hex），不支持调色板的精确 accent。文档走飞书原生标题层级色；调色板仅作用于预览 / 公众号 / 头条号 / PDF。
