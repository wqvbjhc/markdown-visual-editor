/**
 * 飞书文档「复制粘贴」格式化。
 *
 * 背景：CF Workers / HF Spaces 都无法跑飞书后端（OAuth + 建文档代理），「创建飞书文档」按钮
 * 在部署环境不可用。飞书功能改走纯前端「复制 → 粘贴进飞书文档」。
 *
 * 公式：经 MVP 探测确认，飞书文档粘贴**认 LaTeX 源码**（`$...$` dollar / `\(...\)` paren 均生效），
 *   **不**认 MathML（C 纯文本）。故 `.katex` 节点 → 取 `<annotation encoding="application/x-tex">`
 *   的原始 LaTeX → 行内 `$tex$`、块级 `$$\ntex\n$$`。LaTeX 源码是飞书唯一可靠的公式粘贴入口。
 *
 * 图片：飞书粘贴不支持图片导入，公网图保留 src 碰运气，本地图/相对图转占位提示（复制时另给警告）。
 *
 * 样式从简：飞书粘贴主要认结构 + 内联 style，过度样式与飞书自身渲染冲突。沿用 wechat/toutiao 的
 *   tagStyles 模式但更克制，公式走源码（不调 inlineKatexStyles——那是转近似文本，方向相反）。
 */

const TAG_STYLES: Record<string, string> = {
  h1: 'font-size:22px;font-weight:bold;margin:16px 0 8px;',
  h2: 'font-size:19px;font-weight:bold;margin:14px 0 6px;',
  h3: 'font-size:17px;font-weight:bold;margin:12px 0 6px;',
  h4: 'font-size:15px;font-weight:bold;margin:10px 0 4px;',
  p: 'font-size:15px;line-height:1.8;margin:6px 0;',
  blockquote: 'border-left:3px solid #ccc;padding:8px 12px;margin:10px 0;color:#666;background:#fafafa;',
  pre: 'background:#f6f8fa;border-radius:4px;padding:12px;overflow-x:auto;font-size:13px;line-height:1.6;margin:10px 0;',
  code: 'background:#f0f0f0;color:#c7254e;padding:1px 4px;border-radius:3px;font-size:90%;font-family:Menlo,Monaco,monospace;',
  table: 'border-collapse:collapse;width:100%;margin:10px 0;font-size:14px;',
  th: 'border:1px solid #ddd;padding:6px 10px;background:#f6f8fa;font-weight:bold;text-align:left;',
  td: 'border:1px solid #ddd;padding:6px 10px;',
  a: 'color:#3370ff;text-decoration:none;',
  strong: 'font-weight:bold;',
  em: 'font-style:italic;',
  del: 'text-decoration:line-through;color:#999;',
  hr: 'border:none;border-top:1px solid #eee;margin:16px 0;',
  ul: 'padding-left:22px;margin:6px 0;',
  ol: 'padding-left:22px;margin:6px 0;',
  li: 'font-size:15px;line-height:1.8;margin:2px 0;',
  figcaption: 'font-size:13px;color:#888;text-align:center;margin-top:4px;',
  figure: 'margin:12px 0;',
}

/**
 * 把 .katex 节点替换成飞书可粘贴内容。
 * 飞书**正文**认 LaTeX 源码 `$...$` → 行内公式取 annotation LaTeX 包 code。
 * 飞书**标题不支持公式**，标题里的 .katex 若留 `$...$` 会显示成字面量 → 降级为 KaTeX 视觉文本
 *   （取 `.katex-html` 的 textContent，如 E=mc2；分式等复杂结构会塌平，但可读且无 $ 噪声）。
 *
 * 块级公式（.katex-display，必在正文段落）→ 独立 <p><code>$$\ntex\n$$</code></p>。
 */
function replaceKatexWithLatex(root: HTMLElement): void {
  // 块级公式：先处理 .katex-display 内的 .katex（替换整个 display 容器为段落）
  root.querySelectorAll('.katex-display').forEach((display) => {
    const annot = display.querySelector('annotation[encoding="application/x-tex"]')
    const tex = (annot?.textContent || '').trim()
    if (!tex) return
    const p = root.ownerDocument.createElement('p')
    const code = root.ownerDocument.createElement('code')
    code.textContent = `$$\n${tex}\n$$`
    p.appendChild(code)
    display.replaceWith(p)
  })
  // 行内公式：剩下的 .katex（display 已被替换，不会重复命中）
  root.querySelectorAll('.katex').forEach((katex) => {
    const inHeading = katex.closest('h1,h2,h3,h4,h5,h6') !== null
    if (inHeading) {
      // 标题不支持公式：降级为 KaTeX 视觉纯文本（去 MathML/annotation 重复）
      const htmlLayer = katex.querySelector('.katex-html')
      const visualText = (htmlLayer?.textContent || '').trim()
      katex.replaceWith(root.ownerDocument.createTextNode(visualText || ''))
      return
    }
    const annot = katex.querySelector('annotation[encoding="application/x-tex"]')
    const tex = (annot?.textContent || '').trim()
    if (!tex) return
    const code = root.ownerDocument.createElement('code')
    code.textContent = `$${tex}$`
    katex.replaceWith(code)
  })
}

/**
 * 去掉标题里的超链接包裹。
 * rehype-autolink-headings (behavior:wrap) 把整个标题文本包在 <a href="#锚点"> 里，
 * 飞书粘贴会把标题变成超链接（点标题跳锚点，无意义且干扰）。unwrap：用 <a> 子节点替换 <a> 本身。
 */
function unwrapHeadingLinks(root: HTMLElement): void {
  root.querySelectorAll('h1,h2,h3,h4,h5,h6').forEach((h) => {
    h.querySelectorAll('a').forEach((a) => {
      const anchor = a as HTMLAnchorElement
      // 仅去掉标题内的锚点链接（href 以 # 开头的自锚）；外链保留（标题里外链罕见但不动）
      const href = anchor.getAttribute('href') || ''
      if (!href.startsWith('#')) return
      const parent = anchor.parentElement
      if (!parent) return
      while (anchor.firstChild) parent.insertBefore(anchor.firstChild, anchor)
      anchor.remove()
    })
  })
}

/**
 * 图片：飞书粘贴不支持图片导入。
 * 公网图（http/https/data）保留 src（粘贴碰运气，部分飞书版本可能加载）；
 * 本地图（local-media://）/相对路径 → 占位文本（防坏图标，复制时另给警告计数）。
 * 返回被替换占位的数量，供调用方凑 warning。
 */
function neutralizeImages(root: HTMLElement): number {
  let replaced = 0
  root.querySelectorAll<HTMLImageElement>('img').forEach((img) => {
    const src = img.getAttribute('src') || ''
    if (/^(https?:|data:)/i.test(src)) return
    // 本地图/相对图：占位
    replaced += 1
    const alt = img.getAttribute('alt') || img.getAttribute('data-original-src') || '图片'
    const placeholder = root.ownerDocument.createElement('span')
    placeholder.setAttribute('style', 'color:#999;font-style:italic;')
    placeholder.textContent = `［${alt}：飞书粘贴不支持图片，请手动插入］`
    img.replaceWith(placeholder)
  })
  return replaced
}

/** 视频：飞书不支持视频卡片粘贴，统一转「链接占位」 */
function neutralizeVideos(root: HTMLElement): void {
  root.querySelectorAll('figure.media-video, video').forEach((node) => {
    if (node.tagName === 'VIDEO' && node.closest('figure.media-video')) return
    const link = node.getAttribute('data-media-link') || (node as HTMLVideoElement).src || ''
    const title = node.getAttribute('data-media-title') || '视频'
    const placeholder = root.ownerDocument.createElement('span')
    placeholder.setAttribute('style', 'color:#999;font-style:italic;')
    placeholder.textContent = link ? `［${title}：${link}］` : `［${title}：飞书粘贴不支持视频，请手动插入］`
    node.replaceWith(placeholder)
  })
}

export function applyFeishuStyles(html: string): string {
  const parser = new DOMParser()
  const doc = parser.parseFromString(`<div>${html}</div>`, 'text/html')
  const root = doc.body.firstElementChild as HTMLElement

  replaceKatexWithLatex(root)
  unwrapHeadingLinks(root)
  neutralizeVideos(root)
  const replacedImages = neutralizeImages(root)

  for (const [tag, style] of Object.entries(TAG_STYLES)) {
    root.querySelectorAll(tag).forEach((el) => {
      const htmlEl = el as HTMLElement
      // 公式 code（feishu 产，文本以 $ 开头）不叠加代码块底色：飞书把带代码样式的 <code>
      // 当字面代码块，不触发 LaTeX 公式识别。无论 code 套在 <strong>/<em>/<a> 还是裸在 <p>，
      // 只要是公式源码就跳过样式。
      if (tag === 'code' && /^\$/.test(htmlEl.textContent || '')) return
      const existing = htmlEl.getAttribute('style') || ''
      htmlEl.setAttribute('style', existing + style)
    })
  }

  // pre code（代码块内的 code）去掉单独样式，继承 pre 背景
  root.querySelectorAll('pre code').forEach((el) => {
    const htmlEl = el as HTMLElement
    htmlEl.setAttribute('style', 'background:transparent;color:inherit;padding:0;font-size:inherit;')
  })

  const wrapper = root.ownerDocument.createElement('section')
  wrapper.setAttribute('style', 'padding:12px;max-width:100%;font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif;')
  wrapper.innerHTML = root.innerHTML

  // 通过 data 属性把图片占位数透传给复制层（prepareClipboardHtml 不改飞书，这里直接定稿）
  if (replacedImages > 0) {
    wrapper.dataset.feishuImagePlaceholders = String(replacedImages)
  }
  return wrapper.outerHTML
}

/** 从 applyFeishuStyles 产物里读图片占位数（复制时凑 warning 用） */
export function countFeishuImagePlaceholders(feishuHtml: string): number {
  const m = feishuHtml.match(/data-feishu-image-placeholders="(\d+)"/)
  return m ? parseInt(m[1], 10) : 0
}
