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

function normalizeExportTables(clone: HTMLElement) {
  const resized = new Set<HTMLElement>()
  for (const wrapper of clone.querySelectorAll<HTMLElement>('.table-wrapper')) {
    const table = wrapper.querySelector<HTMLElement>(':scope > table')
    if (!table) continue

    // 从表格外壳到预览面板都要释放宽高，否则平台格式的外层 section 仍会锁住纸宽。
    for (let container: HTMLElement | null = wrapper; container && !resized.has(container); container = container.parentElement) {
      releaseMeasuredSize(container)
      resized.add(container)
      if (container.classList.contains('prose-container')) {
        container.style.removeProperty('margin-left')
        container.style.removeProperty('margin-right')
        container.style.marginInline = 'auto'
      }
      if (container === clone) break
    }
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

function normalizeExportTree(clone: HTMLElement) {
  allowPrintOverflow(clone)
  clone.style.height = 'auto'
  clone.style.minHeight = 'auto'
  clone.style.flex = 'none'
  normalizeExportTables(clone)

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
