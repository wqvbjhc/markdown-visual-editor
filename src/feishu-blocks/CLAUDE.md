# 飞书文档模块规则

> 飞书任务时加载本文件。项目总规则见根 `CLAUDE.md`。

## 模块结构
- `src/feishu-blocks/converter.ts`：mdast → 飞书 docx block（跑浏览器，复用 remark parse pipeline，Worker 不背 remark 依赖）
- `src/feishu-blocks/export.ts`：浏览器编排（fetch 图字节 / mermaid 渲染 PNG / OAuth refresh 重试）
- `src/feishu-blocks/types.ts`：飞书 block 极简类型
- `src/worker.ts`：Cloudflare Worker（OAuth + 建文档代理，用户身份 token）

## 两条路径
- **建文档路径**（converter + worker）：block 原生结构（标题/列表/代码/表格/equation 公式/图片上传/Mermaid PNG）。**当前唯一飞书路径**。
- **复制路径**（`text/plain` 粘到已有飞书文档）**已退役删除**（原因：建文档是功能超集，两入口易混）。要恢复需重建 `src/formats/feishu.ts`。

## 硬规则
- **NEVER** 给飞书 block 注 `text_color`（飞书 docx 是预设枚举 int，heading 块不接受；强加触发 `99992402 field validation failed`）。文档走飞书原生标题层级色，accent 仅预览/公众号/头条。
- **ALWAYS** 本地开发用 `pnpm dev`（5173 端口），与飞书后台 redirect_uri 一致。不用 `pnpm preview`（8787，OAuth mismatch）。
- **ALWAYS** 1000 块上限检查在 `createDocument` **之前**（否则超限返 413 但空文档已建，留孤儿）。
- **ALWAYS** 飞书 `res.json()` 走 `readJson`（非 JSON 响应容错，防 SyntaxError「Unexpected token <」掩盖 HTTP 状态）。
- **ALWAYS** `bindImages` 失败包 try（仍返 url，文档已建 media 已传，用户能找到）。
- **NEVER** 把 math/mermaid mdast 节点转 text 节点（remark-stringify 转义 `$`/`_` 致公式废）。
- **NEVER** multipart 手设 `Content-Type`（FormData 自动带 boundary，手设破坏分隔符）。

## 颜色限制
飞书 docx `text_element_style.text_color` 是 **预设枚举 int**（调色板索引），非任意 hex/RGB/string。heading 块（block_type 3-11）不接受 text_color。
- `color:"2563EB"`（string）→ 忽略，文字黑
- `text_color:2452459`（int RGB）/ `text_color:"2563EB"`（string）→ 均 `99992402`

文档走飞书原生层级色。若以后重试上色：先建带色文档调 `GET /docx/v1/documents/{id}/blocks/{id}` 反查飞书存的 `text_element_style` 真实结构 + 枚举表（飞书 JS 文档是 SPA，reader 拿不到字段定义）。

## 图片 3 步链路（不能预上传到文档根）
1. **descendant 建空 image block**：converter 产 `{block_type:27, image:{}}`。响应 `data.block_id_relations` 结构是 **`{index: {block_id(真实), temporary_block_id(临时)}}`**——不是扁平 `{临时:真实}`。必须 `Object.values` 展平成 `{temporary_block_id: block_id}`。不展平 → `relations[临时uuid]` 永远 undefined → upload_all 根本不跑 → 飞书页空图框「图片上传失败」。
2. **upload_all**：`POST /drive/v1/medias/upload_all`（multipart），`parent_type=docx_image`、`parent_node=真实 block_id`、`size`、`file`。返回 `data.file_token`。单文件 ≤ 20MB。
3. **batch_update 绑回**：`PATCH /docx/v1/documents/{id}/blocks/batch_update`，`{requests:[{block_id:真实id, replace_image:{token:file_token}}]}`。

权限：零新 scope（`drive:drive` + `docx:document` 覆盖 upload_all + batch_update）。

浏览器侧（export.ts）：converter 返 `images:[{block_id, src, kind?, mermaidCode?}]`；浏览器 fetch/渲染成 base64 随请求送 Worker；`local-media://id` → objectUrl 或 persisted dataUrl；公网图 CORS 挡则跳过 + warning。`readPersistedLocalMedia` 提到循环外算一次（O(N)）。单张失败不阻断整篇。

## 公式 equation element
- inlineMath `$E=mc^2$` / 块级 `$$x^2$$` → `{equation:{content}}`，content 是 LaTeX **不带 `$` delimiters**（mdast `.value` 已剥）。
- equation 是 ParagraphElement，与 text_run 同级，可同块混排。
- **不**降级为 `$...$` 文本（飞书显字面量不渲染）。

## Mermaid PNG（建文档路径）
- converter `emitCode` mermaid 分支：产空 image block + `images.push({block_id, src:'', kind:'mermaid', mermaidCode})}`。
- export.ts `renderMermaidPng`：`mermaid.render` → SVG → canvas **2x scale + 白底填充** → PNG base64。
- 渲染依赖 DOM，只能浏览器跑；node 测试不覆盖 `renderMermaidPng`，仅 converter 侧可测。
- cleanup：mermaid v10+ 临时 svg 用 `id` 自身（v9 用 `d{id}`），两者都清防 DOM 残留。
- Worker 不感知 mermaid（统一当 image 上传，3 步链路不变）。

## 其他转换器要点
- 临时 block_id 用 `crypto.randomUUID()`（非 secure context fallback：`b-{ts36}-{rand}`）。
- heading 动态 key（heading1..9）：`(block as unknown as Record<string, unknown>)[...]` 赋值（TS 不允许 string key 直接索引 FeishuBlock）。
- `remark-parse` code 节点 `.value` **无尾随换行**（测试断言别带 `\n`）。
- `emitTodoItem` 首段作正文，rest 段落/嵌套列表 push 到 children（与 emitListItem 一致，不 break 丢内容）。
- 段落内 inline image 降级 alt + warning（飞书 image 是 block 级，独占段落的图才上传）。
- `::video` 指令不支持导出到飞书（显式 warning）。
- `emitList` 检 `List.start`（飞书 ordered 从 1 自动编号，非 1 起始给 warning）。
- title 取首个 heading（非首个产 id 节点），`clipTitle` 按 Unicode 码点截 100（防 emoji 代理对中间截断产孤立 surrogate）。
- `new Blob([uint8])` TS 报错：cast `new Blob([bytes as unknown as ArrayBuffer], {type})`（TS lib Uint8Array 泛型与 BlobPart 不兼容，运行时无碍）。

## 本地开发端口
- `pnpm dev`（= vite + `@cloudflare/vite-plugin`）：5173，前端 + worker 同端口。
- 飞书后台 redirect_uri = `http://localhost:5173/api/feishu/oauth/callback`，**必须 5173**。
- 不用 `pnpm preview` / 裸 `wrangler dev`（默认 8787，OAuth redirect_uri mismatch）。非要用 wrangler dev 加 `--port 5173`。
- cookie 过期或换端口后旧 cookie 失效，重新走 `http://localhost:5173/api/feishu/oauth/start`。
- `.dev.vars` 配 `FEISHU_APP_ID` / `FEISHU_APP_SECRET`（参考 `.dev.vars.example`，gitignored）。

## OAuth
- 用户身份 token（scope `docx:document drive:drive`），HttpOnly cookie（`feishu_token` + `feishu_refresh`）。
- access token ~2h，过期前端先 POST `/api/feishu/oauth/refresh` 用 refresh_token 静默续期 + 重试 export，refresh 也失效才跳完整 OAuth。
- `handleExport` catch 区分 auth 过期 code（`/code=9999166\d/`）→ 返 `need_auth`，前端跳 re-OAuth。
- `handleOAuthCallback` 整体 try/catch（token 交换失败重定向回首页带错误，避免用户卡 /callback，auth code 已消费）。
- `getCookie` decodeURIComponent 容错（非法 % 序列当原文，防攻击者构造 cookie 抛 URIError 做 DoS）。

## 测试
- 行为测试带 ESM loader：`node --experimental-loader ./tests/_esm-resolve.mjs --test tests/feishu-block-converter.test.ts`（loader 解析 src 无扩展名相对导入 + `@/` 别名）。
- converter 侧可测（mermaid/image block + images 清单 + equation + todo children + title heading + list.start warning）。
- `feishu-format-registered.test.ts` 正向守护飞书「复制粘贴」格式（FormatType 含 feishu、formats 数组含飞书、handleCopy 调 applyFeishuStyles、公式走 LaTeX 源码非 MathML）。

## 飞书「复制粘贴」路径（CF/HF 无后端时的主路径）
CF Workers / HF Spaces 都跑不了飞书后端（OAuth + 建文档代理），「创建飞书文档」按钮仅在 Workers 环境显示（前端探测 `/api/feishu/status` 200 才渲染）。其余环境走 `src/formats/feishu.ts` 格式化 + 「复制」按钮，粘进飞书文档。

**公式粘贴结论（MVP 探测确认，勿推翻）**：飞书**正文**粘贴认 LaTeX 源码 `$...$` / `\(...\)`（dollar + paren 均生效，行内/块级均如此），**不认 MathML**（粘贴成纯文本）。故 `feishu.ts` 从 `.katex` 的 `<annotation encoding="application/x-tex">` 取原始 LaTeX → 行内 `$tex$`、块级 `$$\ntex\n$$`。**不能**调 `inlineKatexStyles`（那是把公式转近似 Unicode 文本，方向相反），**不能**用 MathML（飞书不解析）。

**标题里的公式**（飞书标题不支持公式识别）：`.katex` 若在 `h1-6` 内，不取 LaTeX 源码（会显示 `$...$` 字面量），改降级为 `.katex-html` 的 textContent（KaTeX 视觉纯文本，如 `E=mc2`、`π`；分式等复杂结构会塌平）。判断：`katex.closest('h1,h2,h3,h4,h5,h6')`。

**标题超链接**：rehype-autolink-headings (`behavior:'wrap'`) 把标题整段包在 `<a href="#自锚">`，飞书粘贴会把标题变超链接。`unwrapHeadingLinks` 用 `<a>` 子节点替换 `<a>` 本身（仅去 `#` 开头的自锚，外链保留）。

**公式 code 不能带样式（隐蔽坑）**：飞书把带 `background`/`color` 样式的 `<code>` 当**字面代码块**，不触发 LaTeX 公式识别 → 公式变纯文本。故 feishu.ts 所有公式 code（文本以 `$` 开头）**一律跳过** TAG_STYLES.code 样式，**不靠 parent 判断**（早期版本只跳 `parentElement===P` 的，漏了公式套在 `<strong>`/`<em>`/`<a>` 内联标签里的情况——加粗/斜体里的公式仍带样式 → 飞书不识别）。判断公式 code 只看自身文本 `/^\$/`，不看 parent。

**图片粘贴**：飞书不支持，公网图保留 src 碰运气，本地图/相对图转占位提示，复制后给「N 张图需手动插入」warning。

**公式源码可靠性（踩过假 bug）**：从 `.katex` 的 `<annotation encoding="application/x-tex">` 取原始 LaTeX **可靠**（含 `\pi` / `\text{}` / `\times` / `\int` 等反斜杠命令完整保留）。mdast `inlineMath/math` 节点 `.value` 同样可靠。
- **诊断陷阱**：shell heredoc (`cat << EOF`) 会把 JS 源里的 `\\` 降级成 `\`，再被 JS 字符串解析吞掉反斜杠，制造「feishu.ts 丢反斜杠」假象。诊断公式必须用 **Write 工具写 `.md` 文件 + `readFileSync` 读**，绝不经 heredoc。
- 回归守护：`tests/feishu-math-source.test.ts`（真实 `.md` 夹具 + jsdom polyfill `DOMParser`，断言 `\pi`/`\text{}`/`\times`/`\int`/`\sqrt` 反斜杠保留）。

**嵌套列表公式（飞书粘贴硬限制）**：飞书粘贴引擎认扁平列表内公式，认嵌套列表**父项**公式，**不认嵌套列表子项**公式（code/span/裸文本三种包裹全废，经 A/B/C/D + I/J/K + v2 + v3 四轮探测确认；拍平 L 成）。真因不在 feishu.ts 产出（产出 HTML 正确：扁平与嵌套都是 `<code>$v$</code>` 在 `<li>` 内），在飞书粘贴解析嵌套子列表时的行为。**唯一出路：含公式的列表树拍平成单层**，padding-left 模拟原层级缩进（顶层 0、一层 22px、两层 44px…，对齐 ul 原 padding-left:22px）。纯文本列表（无公式）保持嵌套不动（用户选择，避免连带副作用）。
- 实现：`flattenNestedListsWithFormulas`（feishu.ts，`replaceKatexWithLatex` 后调、TAG_STYLES 前）。DFS 遍历含公式列表，clone li → 移除内部嵌套列表 → 递归子列表 append 到扁平数组（保序）→ 重建单层 ul/ol。
- **避坑**：clone 后残留空白文本节点（li 末尾多空行）需手动删（递归 childNodes 删空 Text）；**不用 `createTreeWalker`/`NodeFilter`**——node 测试环境无 `NodeFilter` 全局，浏览器有，用了测试崩。
- 判断列表含公式：`list.querySelectorAll('code')` 任一 `/^\$/`（公式 code 文本以 $ 开头，与 `replaceKatexWithLatex` 产物一致）。
- 回归守护：`tests/feishu-flatten-nested.test.ts`（含公式列表拍平成单层 + 所有公式 code 在顶层 li 直系 + 子项 padding-left 缩进；纯文本列表保持 2 层嵌套）。

## 历史复盘（不每次加载）
复制路径退役（feishu.ts 删除）、PNG 渲染证伪、code-review bug 修复（14.13/14.14/18/18.1）叙事见 `docs/postmortems.md`。
