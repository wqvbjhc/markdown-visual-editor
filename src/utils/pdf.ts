import { type FormatType } from './store'

const BASE_PRINT_CSS = `
  @page {
    size: auto;
    margin: 12mm;
  }

  html, body {
    height: auto;
    overflow: visible;
    background: #ffffff;
  }

  body {
    margin: 0;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .pdf-shell {
    min-height: 100vh;
  }

  @supports (zoom: calc(1px / 1px)) {
    .pdf-shell .katex .base {
      zoom: min(1, calc(100cqw / var(--print-math-width, 1px)));
    }
  }

  .pdf-shell .code-block-content pre code > [data-print-line]::before {
    content: attr(data-print-line);
    position: absolute;
    inset-inline-end: 100%;
    margin-inline-end: 10px;
    opacity: 0.7;
  }

  .pdf-shell .export-mobile-notch {
    width: 60px;
    height: 6px;
    border-radius: 3px;
    margin: 0 auto 16px;
  }
`

function inlineComputedStyles(source: HTMLElement, target: HTMLElement) {
  const computed = window.getComputedStyle(source)
  const styleText = Array.from(computed)
    .map((property) => `${property}: ${computed.getPropertyValue(property)};`)
    .join(' ')

  target.setAttribute('style', styleText)
}

function cloneNodeWithComputedStyles(source: HTMLElement): HTMLElement {
  const clone = source.cloneNode(true) as HTMLElement

  const sourceElements = [source, ...Array.from(source.querySelectorAll<HTMLElement>('*'))]
  const cloneElements = [clone, ...Array.from(clone.querySelectorAll<HTMLElement>('*'))]

  sourceElements.forEach((sourceEl, index) => {
    const cloneEl = cloneElements[index]
    if (!cloneEl) return
    inlineComputedStyles(sourceEl, cloneEl)
  })

  return clone
}

function releaseMeasuredSize(element: HTMLElement) {
  // getComputedStyle 包含物理尺寸和逻辑尺寸；只移除 width/height 会留下像素约束。
  for (const property of ['width', 'height', 'inline-size', 'block-size']) {
    element.style.removeProperty(property)
  }
}

function allowPrintOverflow(element: HTMLElement) {
  element.style.removeProperty('overflow-inline')
  element.style.removeProperty('overflow-block')
  element.style.overflow = 'visible'
}

function normalizeExportFlow(clone: HTMLElement) {
  releaseMeasuredSize(clone)

  // 正文和相邻块始终按纸宽重排。保留公式内部盒子的度量，避免破坏分式、上下标等排版。
  const flow = '.prose-container, section, div, blockquote, h1, h2, h3, h4, h5, h6, p, ul, ol, li, pre, .katex-display'
  for (const element of clone.querySelectorAll<HTMLElement>(flow)) {
    if (element.closest('.katex, svg') || element.classList.contains('code-block-lines')) continue
    releaseMeasuredSize(element)
    if (element.matches('.prose-container, .katex-display')) {
      element.style.setProperty('container-type', 'inline-size')
    }
    if (element.classList.contains('prose-container')) {
      element.style.removeProperty('margin-left')
      element.style.removeProperty('margin-right')
      element.style.marginInline = 'auto'
    }
  }

  for (const element of clone.querySelectorAll<HTMLElement>('a, :not(pre) > code')) {
    if (element.closest('pre, .katex, svg')) continue
    element.style.whiteSpace = 'normal'
    element.style.overflowWrap = 'anywhere'
  }
}

function normalizeExportTables(clone: HTMLElement) {
  for (const wrapper of clone.querySelectorAll<HTMLElement>('.table-wrapper')) {
    const table = wrapper.querySelector<HTMLElement>(':scope > table')
    if (!table) continue

    allowPrintOverflow(wrapper)
    allowPrintOverflow(table)
    releaseMeasuredSize(table)
    table.style.width = '100%'

    for (const part of table.querySelectorAll<HTMLElement>('thead, tbody, tfoot, tr, th, td')) {
      releaseMeasuredSize(part)
    }
    // 内联样式也冻结了子节点的换行设置，长路径、链接和行内代码须在单元格内换行。
    for (const text of table.querySelectorAll<HTMLElement>('th, td, :is(th, td) :is(a, code, strong, em, del)')) {
      text.style.overflowWrap = 'anywhere'
      if (text.tagName === 'CODE') text.style.whiteSpace = 'normal'
    }
  }
}

function normalizeExportCode(clone: HTMLElement) {
  for (const element of clone.querySelectorAll<HTMLElement>('.code-block-wrapper, .code-block-body, .code-block-content, pre')) {
    allowPrintOverflow(element)
    element.style.minWidth = '0'
  }

  for (const element of clone.querySelectorAll<HTMLElement>('pre, pre code, pre code span')) {
    element.style.whiteSpace = 'pre-wrap'
    element.style.overflowWrap = 'anywhere'
  }

  for (const content of clone.querySelectorAll<HTMLElement>('.code-block-content')) {
    const lines = content.querySelectorAll<HTMLElement>('pre code > .line')
    if (!lines.length) continue

    // 预览的独立行号列不会跟随折行；打印时把行号放回每个源代码行。
    const gutter = content.parentElement?.querySelector<HTMLElement>('.code-block-lines')
    if (gutter) {
      content.style.paddingInlineStart = gutter.style.width || gutter.style.minWidth || '40px'
      gutter.style.display = 'none'
    }
    lines.forEach((line, index) => {
      if (gutter) line.dataset.printLine = String(index + 1)
      line.style.display = 'block'
      line.style.position = 'relative'
      line.style.minHeight = '1lh'
    })
    // Shiki 在每行 span 间留下换行文本；行已经是块元素，无需再次换行。
    for (const node of Array.from(lines[0].parentNode!.childNodes)) {
      if (node.nodeType === 3 && !node.textContent?.trim()) node.remove()
    }
  }
}

function normalizeExportMath(clone: HTMLElement) {
  for (const display of clone.querySelectorAll<HTMLElement>('.katex-display')) {
    allowPrintOverflow(display)
  }

  // 公众号和头条的公式已转换为普通 span；块级和行内都可按文本折行。
  for (const text of clone.querySelectorAll<HTMLElement>('.katex-semantic, .katex-semantic *')) {
    text.style.whiteSpace = 'normal'
    text.style.overflowWrap = 'anywhere'
  }

  // 只释放公式的外层宽高；在 KaTeX 提供的 base 组之间换行，不拆分式。
  for (const element of clone.querySelectorAll<HTMLElement>('.katex, .katex > .katex-html')) {
    releaseMeasuredSize(element)
    element.style.whiteSpace = 'normal'
  }

  // 单个公式组（例如宽分式）不能折行。给打印 CSS 保留组宽，仅在纸宽不足时等比缩小。
  for (const group of clone.querySelectorAll<HTMLElement>('.katex > .katex-html > .base')) {
    const width = group.style.width
    if (width.endsWith('px') && parseFloat(width) > 0) {
      group.style.setProperty('--print-math-width', width)
      group.style.removeProperty('zoom')
    }
  }
}

function normalizeExportTree(clone: HTMLElement) {
  normalizeExportFlow(clone)
  allowPrintOverflow(clone)
  clone.style.height = 'auto'
  clone.style.minHeight = 'auto'
  clone.style.flex = 'none'
  normalizeExportTables(clone)
  normalizeExportCode(clone)
  normalizeExportMath(clone)

  const mobileFrame = clone.querySelector<HTMLElement>('.mobile-frame')
  if (mobileFrame) {
    const notch = document.createElement('div')
    notch.className = 'export-mobile-notch'
    notch.setAttribute(
      'style',
      'width: 60px; height: 6px; background: rgb(233, 236, 239); border-radius: 3px; margin: 0 auto 16px;'
    )
    mobileFrame.prepend(notch)
  }
}

function buildPrintableDocument(format: FormatType, previewHtml: string): string {
  const title = `markdown-preview-${format}-${new Date().toISOString().slice(0, 10)}`

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title}</title>
    <style>${BASE_PRINT_CSS}</style>
  </head>
  <body>
    <div class="pdf-shell" data-format="${format}">${previewHtml}</div>
  </body>
</html>`
}

export async function exportCurrentPreviewAsPdf(format: FormatType): Promise<void> {
  const previewPane = document.querySelector<HTMLElement>('.preview-pane')
  if (!previewPane) {
    throw new Error('Preview pane not found')
  }

  const styledPreview = cloneNodeWithComputedStyles(previewPane)
  normalizeExportTree(styledPreview)

  const iframe = document.createElement('iframe')
  iframe.setAttribute('aria-hidden', 'true')
  iframe.style.position = 'fixed'
  iframe.style.right = '0'
  iframe.style.bottom = '0'
  iframe.style.width = '0'
  iframe.style.height = '0'
  iframe.style.border = '0'

  document.body.appendChild(iframe)

  const cleanup = () => {
    iframe.onload = null
    setTimeout(() => {
      iframe.remove()
    }, 0)
  }

  const frameWindow = iframe.contentWindow
  if (!frameWindow) {
    cleanup()
    throw new Error('Print frame not available')
  }

  const frameDocument = frameWindow.document
  frameDocument.open()
  frameDocument.write(buildPrintableDocument(format, styledPreview.outerHTML))
  frameDocument.close()

  await new Promise<void>((resolve) => {
    iframe.onload = () => resolve()
    setTimeout(() => resolve(), 500)
  })

  frameWindow.focus()
  try {
    frameWindow.print()
  } finally {
    // print() 可能抛（沙箱/策略禁打印/弹窗拦截），finally 保证 iframe 清理不留残
    cleanup()
  }
}
