# markdown-visual-editor 项目协作规则

> **子文件**（按需加载）：飞书模块 `@src/feishu-blocks/CLAUDE.md`、平台规则 `@docs/platform-rules.md`、复盘与 changelog `@docs/postmortems.md`。
> **维护规则**：错误修复后把「规则」进本文件（不停临时会话）；「叙事复盘 / bug 修复流水」进 `docs/postmortems.md`。

## 项目定位
Markdown 格式转换网站，处理预览 / 格式转换 / 复制 / 导出 / 平台兼容。明确分层：解析层 / 预览层 / 复制链路 / 导出链路 / 平台兼容层。

## 技术栈
React 19 + TypeScript + Vite 8 + CodeMirror 6 + unified/remark/rehype + Shiki + remark-math/rehype-katex + Mermaid + Tailwind + Zustand + rehype-sanitize。后端 Cloudflare Workers（飞书代理，`src/worker.ts`）。

## 常用命令
| 命令 | 说明 |
|------|------|
| `pnpm dev` | 开发服务器（**5173**，飞书 OAuth 端口） |
| `pnpm build` | 构建生产版本 |
| `pnpm preview` | 预览构建（8787，**飞书 OAuth 不通**） |
| `pnpm deploy` | 部署 Cloudflare Workers |
| `pnpm lint` | ESLint 检查 |
| `node --experimental-loader ./tests/_esm-resolve.mjs --test tests/*.test.ts` | 全量测试 |

## TL;DR 硬规则
**NEVER**：
- 删用户资源笔记 / PDF / TXT / 源码文件未授权（含被注释的调试代码——可能是后续调试入口）。
- 跨文件大重构 / 框架升级，未先说思路就执行。
- 给飞书 block 注 `text_color`（`99992402`，见 `@src/feishu-blocks/CLAUDE.md`）。
- 给 `<img>`/`<video>` 无条件加 `crossOrigin:'anonymous'`（致非 CORS CDN 热链加载失败）。
- 新增 HTML 标签/属性不同步 `src/utils/sanitize-schema.ts` 白名单（会被静默剥）。
- 改依赖不同步两份 lockfile（`pnpm-lock.yaml` + `package-lock.json`）。
- 行为测试不带 ESM loader（`--experimental-loader`，**非** `--import`）。
- 飞书本地开发用非 5173 端口（OAuth redirect_uri mismatch）。
- 飞书复制路径公式用 MathML 或近似文本（飞书只认 LaTeX 源码 `$...$`，见 `@src/feishu-blocks/CLAUDE.md`）。
- 用默认 mermaid 配置渲 PNG（v11 默认 `look:'neo'`+`htmlLabels:true` 产 `<foreignObject>`，SVG 经 `<img>` 画 canvas 必 tainted；复制拿 `store.html` 串实为裸文本不是图）。渲 PNG 须设顶层 `htmlLabels:false`+`look:'classic'`+`useMaxWidth:false` 且不缓存「已 init」（单例被 Preview 反复重置），见 `@src/feishu-blocks/CLAUDE.md`「tainted canvas」。

**ALWAYS**：
- 显示异常先分层（数据 / DOM / 布局 / 样式），未定层前不改实现。
- 多消费点问题先统一归一化输入，别只修派生数据。
- 回归测试约束真实责任点，非复述猜想。
- 本地图片区分「受控 `local-media://`」/「相对路径」/「`file:///`」；预览恢复与复制成功分别验证。
- 相对路径图保留原始 `src`（`data-original-src`），防 `onerror` 改 src 后 hydrate 拿不回。
- 包管理器构建失败先看日志是否停在依赖安装阶段（非业务代码）。
- 编新闻/第三方报错不确定时直说不知道，不编造链接/API/命令。
- 复制链路剥标题自锚超链接：rehype-autolink-headings(behavior:wrap) 产的 `<a href="#slug">` 离开本页是死链，复制到公众号/头条/飞书/默认都变无意义超链接。单点 `prepareClipboardHtml` 调 `unwrapSelfAnchorHeadingLinks`（`src/utils/heading-links.ts`，全格式覆盖），不在各 format 函数里重复剥。预览保留自锚（跳锚点导航），见 `@src/feishu-blocks/CLAUDE.md`「标题超链接」。
- TS 构建验证用 `npx tsc -b --force`（清 `.tsbuildinfo` 增量缓存全量编），**别**只信 `tsc -b` 增量——增量缓存会跳过未改文件，掩盖类型错（本地绿、HF 干净 `npm ci` 全量编红）。
- 编辑器/预览同步滚动走「源行号锚点」：`remark-source-line` 注 `data-source-line`，`scroll-sync.ts` 双向插值映射。任何接替/重建预览 DOM 的环节（CodeBlock 换 pre、rehype-mermaid 换 pre、未来新组件）都必须拷贝锚点属性，否则该类块对不齐；内部锚点不得流入复制/导出产物（`prepareClipboardHtml` 单点剥）。
- 测 CM6「视口顶行号」别用 `querySelectorAll('.cm-line')` 索引——CM6 虚拟化只渲染视口附近行，索引≠绝对行号；用文本标记反推或 gutter。

## 分层排查规则
1. 显示异常（多一行 / 空白 / 对齐 / 某侧正常某侧异常）先分层：**数据层**（多文本/尾随换行/空串）/ **DOM 层**（多节点/行/wrapper）/ **布局层**（flex/grid/padding/stretch/line-height）/ **样式层**（预览 CSS/导出样式/reset/第三方默认）。未完成分层前不改实现。
2. 「有空白但无对应编号/标记」优先怀疑**布局层**（flex 交叉轴高度传播 / stretch / padding / min-height / line-height 撑高容器）。无证据前别判成「真实多一行文本」。
3. 同一显示问题影响多个消费点（行号 / 高亮 / 复制 / 导出）→ 先提炼统一归一化函数，所有消费点共用。别只修派生数据（如行号计算）不修渲染源。
4. 回归测试约束真实责任点（数据归一化 / DOM 结构 / CSS 盒模型 / 导出结果），别写只验证「猜测实现」或复述当前推断的测试。
5. 左右双栏单侧空白先查**高度传播**（父 flex/grid、一侧 padding/min-height/line-height、另一侧 stretch、第三方内容被动填充），再看内容本身。

## sanitize 白名单
`rehype-sanitize` 严格按 `src/utils/sanitize-schema.ts` 白名单过滤属性，未列入的**静默剥**（不报错）。
- 踩过的坑：`<ol start>` / `<li value>` 曾未列入 → 有序列表全从 1 开始。
- 规则：遇「HTML 属性在预览/导出丢失」优先查白名单；新增标签/属性必须同步白名单。

## 本地图片资源
本地图片/视频预览是「受控本地资源」机制，非浏览器天然支持本地路径。区分：
1. **受控本地资源**：工具栏插入，`local-media://id`，本地资源存储可恢复。
2. **普通相对路径**：`./foo.png`，浏览器不自动当可预览。
3. **`file:///`**：浏览器安全边界，不可稳定预览。

规则：
- 「同一会话能预览」≠「刷新/复制后可恢复」。修本地图片先确认资源只在内存还是已持久化。
- 复制链路能转 data URL ≠ 预览链路自动具恢复能力。预览恢复与复制成功**分别验证**。
- `./foo.png` / `file:///` 不能默默当已支持；不可恢复给明确提示。
- 支持相对路径图必须补齐两条链路（预览 hydration 映射 + 复制/export 转 data URL），只修一条致「页面正常但粘贴失败」或反之下不一致。
- 目录授权模式：持久化映射 + 让 Preview 对 `relativeMediaMap` 变化响应重新 hydration（否则选了目录要手动刷新）。
- 相对路径图保留原始 `src`（`data-original-src`），否则浏览器按原路径加载失败 → `onerror` 改 src 为 fallback → 后续 hydration 拿不回原路径，目录映射无法命中。
- 普通 Markdown 图片 `title` **不**默认变可见图注（`![nms2.webp](nms2.webp "nms2.webp")` 会把文件名显示在图下，破坏阅读）。仅显式 caption 生成 `figcaption`。

## 包管理器 / lockfile
本项目本地 `pnpm`，但 CI / 托管平台可能默认 `npm`。
- **双 lockfile**：`pnpm-lock.yaml`（本地）+ `package-lock.json`（HF Dockerfile `npm ci`）。`pnpm add` 只更 `pnpm-lock.yaml`，**不**同步 `package-lock.json` → HF `npm ci` 报 Missing 失败。改依赖后必须 `CF_PAGES=1 npm install --package-lock-only` 同步，两份一起提交。
- `preinstall` 强制 `only-allow pnpm` 时，托管平台（Cloudflare Pages / HF）需放行（`ENV CF_PAGES=1` 绕过）。
- 「构建失败」先看日志是否停在依赖安装阶段（包管理器冲突），非误判 TS/Vite 构建错。
- 被源码直接 `import` 的类型包（尤其 `@types/*`）必须 `package.json` 显式声明，不依赖传递 hoisting（pnpm 严格模式不 hoist 传递依赖，`rm -rf node_modules` 重装暴露 latent bug）。诊断：`ls node_modules/@types/<name>`（顶层）vs `ls node_modules/.pnpm | grep @types+<name>`（.pnpm 仓库）。
- `MermaidBlock.tsx` 已静态 `import mermaid`，其它文件再 `import('mermaid')` 动态导入无分包效果，反触发 `INEFFECTIVE_DYNAMIC_IMPORT` 警告。同模块已静态引入时跟着静态导入。

## 测试
- **源码正则测试**（`readFileSync` + `assert.match`，不 import src）：`node --test tests/xxx.test.ts`，不需 loader。
- **行为测试**（真 import src 跑转换 + 断言）：必须带 `node --experimental-loader ./tests/_esm-resolve.mjs --test tests/xxx.test.ts`（hook 补无扩展名相对导入 `.ts` + `@/` 别名）。⚠️ 用 `--experimental-loader`，**非** `--import`（后者不自动注册 resolve hook）。
- node ESM 不解析无扩展名相对导入；vite/webpack 才补扩展名。
- `remark-parse` code 节点 `.value` **无尾随换行**（测试断言别带 `\n`）。

## 部署
**Cloudflare Workers（推荐，飞书功能必需）**：内置 `src/worker.ts` 代理飞书 + 服务静态。配 secrets `FEISHU_APP_ID` / `FEISHU_APP_SECRET`；飞书后台 redirect_uri 配生产域名 `https://<domain>/api/feishu/oauth/callback`；`pnpm deploy`。纯静态部署飞书不可用。

**Hugging Face Spaces（Docker）** 已踩坑：
1. README 必须 UTF-8 **without BOM**（HF 解析 frontmatter 严要求首行 `---`，BOM 致 frontmatter 失效）。Windows 记事本默认加 BOM。
2. Dockerfile 用 `npm ci` + `package-lock.json`（canonical lockfile），`ENV CF_PAGES=1` 绕过 `only-allow pnpm`。
3. HF 硬性：uid 1000 非 root（`useradd -m -u 1000 user`）、监听 `0.0.0.0:7860`（非 `127.0.0.1`）、`COPY --chown=user`（非 `chown -R`，镜像翻倍）。
4. HF 初始化 Space 自带 commit（默认 README + LFS `.gitattributes`），首 push rejected → 先 `git fetch hf main` + `git merge hf/main --allow-unrelated-histories`。冲突：README 保本地，`.gitattributes` 本地规则在前再追加 HF LFS。
5. 「网页打不开但 Logs 显 Accepting connections」通常是网络层（GFW 对 `*.hf.space` TLS 不稳），先换网络/代理，别先怀疑容器。
6. 双 lockfile 同步（见上「包管理器」）。
7. **`@cloudflare/vite-plugin` 改变产物布局**：`vite build` 后产物**不**在 `dist/` 根，而是 `dist/client/`（SPA）+ `dist/markdown_visual_editor/`（Worker bundle）。Dockerfile 若 `COPY dist ./dist` 再 `serve -s dist`，因 `dist/index.html` 不存在（只在 `dist/client/`）→ `serve` 回退成**目录列表**（列 `client/` 和 `markdown_visual_editor/` 两文件夹）。
   - **本地能跑是假象**：本地 `dist/` 残留旧构建（无 cloudflare 插件时产物在根），根下还存旧 `index.html`；HF 是干净 `npm ci` + 全新 build，只产 `dist/client/`，根为空 → 才暴露。
   - **诊断法**：build 后查 `ls dist/index.html` 是否存在；只信干净构建（`rm -rf dist && npm run build`）的产物布局，别信累积 `dist/`。
   - **修法**：HF 不跑 Worker（飞书不可用），Dockerfile 只取 `dist/client`：`COPY --from=builder /app/dist/client ./dist`，`serve -s dist` 才命中 `index.html`。
   - **通用规则**：`@cloudflare/vite-plugin` 启用后，任何「拷 `dist/` 再伺服」的部署（Dockerfile / 静态服务器）都要确认产物根是 `dist/` 还是 `dist/client/`，别假设根有 `index.html`。
8. **HF 是干净 `npm ci` + 全量 `tsc`，本地增量缓存会掩盖错**：HF Dockerfile `COPY . .` 不带本地 `.tsbuildinfo`，`npm run build`（= `tsc -b && vite build`）走全量编译，本地被增量缓存跳过的类型错在 HF 全暴露（实测：`feishu.ts` `querySelectorAll` 返 `Element[]` 经 `.filter` 不缩窄到 `HTMLElement`，传 `HTMLElement` 形参报 TS2345，本地 `tsc -b` 绿、HF 红）。**提交前本地用 `npx tsc -b --force` 清缓存全量编**复现 HF 行为，别信增量。
9. **`serve -s`（SPA rewrite）会伪装 200**：HF `serve -s dist` 把未匹配路径（含 `/api/*`）fallback 到 `index.html` 仍返 **200 + text/html**。前端探测后端存活（如 `/api/feishu/status`）**不能只判 `res.ok`**——会把 SPA fallback 的「假 200」当真后端。必须额外校验 `Content-Type` 含 `application/json`（真 Worker `Response.json` → application/json；SPA fallback → text/html）。通用规则：探测静态部署上的 API 路由存活，一律验响应类型，不只看状态码。
