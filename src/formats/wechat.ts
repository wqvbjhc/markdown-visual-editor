import { inlineKatexStyles, type ExportMode } from './katex-inline'

function buildTagStyles(accent: string): Record<string, string> {
  return {
    h1: `font-size:22px;font-weight:bold;color:#1a1a1a;margin:24px 0 16px;border-bottom:2px solid ${accent};padding-bottom:8px;`,
    h2: `font-size:20px;font-weight:bold;color:#1a1a1a;margin:20px 0 12px;border-left:4px solid ${accent};padding-left:10px;`,
    h3: 'font-size:18px;font-weight:bold;color:#1a1a1a;margin:16px 0 8px;',
    h4: 'font-size:16px;font-weight:bold;color:#333;margin:12px 0 8px;',
    p: 'font-size:15px;line-height:1.8;color:#333;margin:8px 0;letter-spacing:0.5px;',
    blockquote: `border-left:4px solid ${accent};padding:12px 16px;margin:16px 0;background:#f6f6f6;color:#666;font-size:14px;`,
    pre: 'background:#f6f8fa;border-radius:4px;padding:16px;overflow-x:auto;font-size:13px;line-height:1.6;margin:12px 0;',
    code: 'background:#fff5f5;color:#ff502c;padding:2px 6px;border-radius:3px;font-size:90%;font-family:Menlo,Monaco,monospace;',
    table: 'border-collapse:collapse;width:100%;margin:12px 0;font-size:14px;',
    th: 'border:1px solid #ddd;padding:8px 12px;background:#f6f8fa;font-weight:bold;text-align:left;',
    td: 'border:1px solid #ddd;padding:8px 12px;',
    img: 'max-width:100%;height:auto;border-radius:4px;margin:8px 0;',
    a: `color:${accent};text-decoration:none;border-bottom:1px solid ${accent};`,
    strong: `color:${accent};font-weight:bold;`,
    em: 'font-style:italic;color:#666;',
    del: 'text-decoration:line-through;color:#999;',
    hr: `border:none;height:1px;background:linear-gradient(to right,transparent,${accent},transparent);margin:24px 0;`,
    ul: 'padding-left:24px;margin:8px 0;',
    ol: 'padding-left:24px;margin:8px 0;',
    li: 'font-size:15px;line-height:1.8;color:#333;margin:4px 0;',
  }
}

export function applyWechatStyles(html: string, accent = '#07c160'): string {
  const processed = inlineKatexStyles(html, 'wechat' as ExportMode)
  const tagStyles = buildTagStyles(accent)

  const parser = new DOMParser()
  const doc = parser.parseFromString(`<div>${processed}</div>`, 'text/html')
  const root = doc.body.firstElementChild as HTMLElement

  for (const [tag, style] of Object.entries(tagStyles)) {
    root.querySelectorAll(tag).forEach((el) => {
      const htmlEl = el as HTMLElement
      if (htmlEl.closest('.katex')) return
      const existing = htmlEl.getAttribute('style') || ''
      htmlEl.setAttribute('style', existing + style)
    })
  }

  root.querySelectorAll('pre code').forEach((el) => {
    const htmlEl = el as HTMLElement
    htmlEl.setAttribute('style', 'background:transparent;color:inherit;padding:0;font-size:inherit;')
  })

  return `<section style="padding:16px;max-width:100%;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Helvetica Neue',sans-serif;">${root.innerHTML}</section>`
}
