# 复盘与变更日志（Postmortems & Changelog）

> 踩坑叙事 + bug 修复 changelog 归档。**不进每会话系统提示**，需要时按需读。项目硬规则见根 `CLAUDE.md`，飞书细节见 `src/feishu-blocks/CLAUDE.md`，平台规则见 `docs/platform-rules.md`。

---

## 代码块伪空行（历史复盘）
本项目代码块空白问题最终分三层：
1. **数据层**：尾随换行影响代码块行数计算和渲染输入，需统一归一化（`normalizeCodeBlockText`）。
2. **布局层**：左侧 `.code-block-lines` 纵向 padding 把 flex 行撑高，右侧代码区被动拉伸，形成无编号伪第二行。
3. **复制链路层**：预览与单块复制修好后，不代表 toolbar copy-all 自动同步；复制/导出若走另一条 HTML 序列化出口（`prepareClipboardHtml()`），必须单独检查 `<pre><code>` 是否应用同样归一化。

**教训**：遇到类似问题至少同时检查预览渲染出口 / 单块复制出口 / toolbar 序列化出口。别因「页面上看起来好了」就默认复制结果也对。

---

## 头条嵌套列表多轮试错（历史复盘）
根因不是单一实现失误，而是排错顺序错：
1. **过早下结论**：一开始把问题当「顶层序号错」，先修顶层 `<ol>`。实际三层：顶层 `<ol>` 被重排 / 内层 `<ul>/<li>` 被并入编号流 / `flex` 横排 paste 后分行。只修第一层，后两层继续暴露。
2. **没早抓「目标平台最终 HTML」**：前几轮看源码/预览/推断。真正钉死是后面打印 `applyToutiaoStyles()` 后的最终 HTML。
3. **误把「浏览器可工作」当「平台 paste 可工作」**：`flex + span + div` 预览正常 ≠ 头条 paste 保留布局语义。
4. **测试没对准最终结构**：早期测试沿用「原生 ordered marker 应保留」旧假设，实现已转显式 block 后测试还在误导。

**教训**：平台兼容问题先抓目标平台最终输入/输出证据，再拆层，优先最不依赖平台语义的结构，测试跟最终策略。详见 `docs/platform-rules.md`。

---

## Deep Research 引用标记
类似 `【27†L315-L323】` 的引用标记：
1. **解析层无问题**：`†`（dagger）/`【】`/`L315-L323` 在 remark/rehype 不被误解析，sanitize 不清。
2. **表格单元格宽度**：引用标记让单元格内容变长，窄屏/mobile 可能横向溢出。排查表格布局考虑长标记对列宽影响。
3. **平台导出兼容**：`†` 在公众号/头条号通常正常，但目标平台对特殊 Unicode 有过滤策略时可能字符丢失。遇「预览正常但导出后字符消失」优先怀疑平台字符过滤，非渲染链路。
4. **阅读体验**：大量引用标记降可读性。用户反馈「文章太乱」别默认渲染 bug，可能内容本身需清理标记（内容层非渲染层）。

---

## 飞书复制路径退役（§14.11）
**背景**：曾有「飞书」格式按钮 + 复制路径（`src/formats/feishu.ts`，text/plain 粘到已有飞书文档）。

**退役原因**：建文档路径（block API）是功能超集（图片/公式原生），复制路径弱（公式源码、图片占位）且两个飞书入口易混。删 `formats/feishu.ts` + 5 个复制路径测试 + Toolbar feishu 分支 + Preview 横幅。FormatType 删 `'feishu'`，`feishu-format-registered.test.ts` 改反向守护。

**复制路径曾证伪的 PNG 路线**（§14.4，建文档路径已绕开，仅记录）：
1. `html-to-image.toPng` 对 KaTeX 内层 `.katex-html` 截图静默返回空 `data:,`。
2. remark-stringify 序列化 image 节点转义 data URL 冒号（`data\:`），URL 废。
3. **致命**：飞书粘贴拒收 base64 图，Markdown 子集不支持 raw HTML，无后端无法换 URL。
建文档路径用 equation element（公式）+ 3 步图片上传 + Mermaid PNG 绕开这些限制。

---

## code-review 修复 changelog

### 飞书模块第一轮（2026-07-22，§14.13）
**Worker**：1000 块检查移 createDocument 前（防孤儿文档）；所有 `res.json()` 走 `readJson`（非 JSON 容错）；`handleOAuthCallback` 整体 try/catch；`handleExport` catch 区分 auth 过期 code → `need_auth`；`bindImages` 失败包 try 仍返 url；`getCookie` decodeURIComponent 容错防 DoS。

**Converter**：`emitTodoItem` 不 break 丢 children；段落内 inline image 降级 + warning；`::video` 显式 warning；`emitList` 检 `List.start`；title 取首个 heading；title `clipTitle` 按 Unicode 码点截 100（防 emoji 代理对断裂）。

**Store**：`markdown` 判 null 非空串（清空编辑器刷新不回退样例）；所有 `setItem` 走 `safeSetItem`（防 Quota 白屏）。

**Toolbar**：`window.open` 长异步后被弹窗拦截 → 同步预开 `about:blank` tab 保 user gesture。

**Export**：mermaid v10+ cleanup 用 `id` 自身（v9 `d{id}`）防 DOM 残留。

### 飞书模块第二轮（2026-07-22，§14.14）
- Worker `/api/feishu/oauth/refresh` 端点（refresh_token 静默续期，不再每 2h 重 OAuth）。
- `uploadMedia` 20MB guard。
- `persistLocalMedia` 串行化（`persistChain`，防并发插入 race 丢记录）。
- `svgToPngDataUrl` 解析 viewBox（防 mermaid 无显式宽高被默认 300x150 压扁）。
- `genId` 非 secure context fallback。
- efficiency：`resolveImageSrc` 的 `readPersistedLocalMedia` 提循环外（O(N²)→O(N)）；`buildParser` 缓存；表列宽用 `extractPlainText`（无副作用）。

### 全项目（2026-07-22，§18 + §18.1）
**安全/sanitize-schema**：删 img `onerror` 白名单（XSS 向量）；加 `data-original-src`（相对路径图 hydration 恢复）；补 polyline/polygon/marker/foreignObject 属性（SVG allowlist drift）。

**pipeline**：`rehype-image`/`rehype-video` 删无条件 `crossOrigin:'anonymous'`（致非 CORS CDN 失败）；`remark-deai` `/释放.*的潜力/g` 贪婪跨句 → 限句内 15 字，删 `/，同时/`（误匹配同时代）；`remark-media-directive` `::image[alt]` 读 children 补 alt。

**React 生命周期**：Preview createRoot tracking + unmount + async seq guard（防 fiber 泄漏 + race）；App `renderMarkdown` seq guard（防 stale 覆盖）；CodeBlock clipboard try + timer ref；MediaInsertModal submit catch。

**formats**：wechat/toutiao tagStyles 循环 platformCard guard 用 `closest`（视频卡子节点样式被覆盖）。

**其它**：media-export mojibake 修；MermaidBlock cleanup 补 `id`；color-schemes `hexToRgb` 3-hex expand + 非 hex 返 null（防 NaN 坏主题），darken/lighten 容错；pdf iframe cleanup 移 `finally`。

**第三轮（efficiency + 设计）**：setMarkdown localStorage debounce 400ms；media-export 图片 Promise.all 并发 + local-media 无 record fallback；wechat/toutiao 内嵌 video 跳过；pdf formatLabels 恒等映射删；applyCustomColor contrast luminance 派生（防白上白文字消失）。

---

## 仍未修（纯重构/优化，非 correctness，按需）
- `Editor` useEffect deps `[theme]` only（理论外部 setMarkdown 不刷新 CodeMirror，但无外部调用源，不触发）。
- `katex-inline` 刮 KaTeX 内部 class 名 + magic -2.8em 判 sub/sup（KaTeX 升级即崩，latent）。
- `rehype-image` data-width 原样插 style（CSS 注入，self-XSS，低）。
- `processor` rehypeSanitize 非最后（slug/autolink/externalLinks 后跑，latent）。
- `pdf.cloneNodeWithComputedStyles` 索引配对无长度检查（PLAUSIBLE）。
- `wechat.replaceVideoNodes` selector 匹配 figure + 内 video（重排致嵌套卡，PLAUSIBLE）。
- `extractToc` 正则要求 id 首属性 + 不解码 entity（latent）。
- efficiency：Shiki `codeToHtml` 每 mount 重跑（应 singleton）、hydrate 每渲染重读 localStorage、wechat/toutiao `querySelectorAll` 24x、handleCopy 重跑 Preview 已算样式。
- simplification：store 5 `savedX` 重复、wechat/toutiao 双胞胎、escapeHtml/isPublicHref/normalizeOrderedLists/replaceVideoNodes/createCaption/DOMParser parseFromString 多处重复。
