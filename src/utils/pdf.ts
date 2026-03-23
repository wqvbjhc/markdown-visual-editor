import { type FormatType } from './store'

const formatLabels: Record<FormatType, string> = {
  default: 'default',
  wechat: 'wechat',
  toutiao: 'toutiao',
  mobile: 'mobile',
}

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

function normalizeExportTree(clone: HTMLElement) {
  clone.style.overflow = 'visible'
  clone.style.height = 'auto'
  clone.style.minHeight = 'auto'
  clone.style.flex = 'none'

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
  const title = `markdown-preview-${formatLabels[format]}-${new Date().toISOString().slice(0, 10)}`

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
  frameWindow.print()
  cleanup()
}
