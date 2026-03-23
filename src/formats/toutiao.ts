import { inlineKatexStyles, type ExportMode } from './katex-inline'
import { getVideoLink, getVideoPoster, getVideoTitle } from '@/utils/media'

function buildTagStyles(accent: string): Record<string, string> {
  return {
    h1: `font-size:24px;font-weight:bold;color:#222;margin:28px 0 16px;`,
    h2: `font-size:20px;font-weight:bold;color:#222;margin:24px 0 12px;border-bottom:1px solid #eee;padding-bottom:8px;`,
    h3: 'font-size:18px;font-weight:bold;color:#333;margin:20px 0 8px;',
    p: 'font-size:16px;line-height:1.9;color:#333;margin:10px 0;text-align:justify;',
    blockquote: `border-left:3px solid ${accent};padding:12px 16px;margin:16px 0;background:#fdf6f6;color:#666;font-size:15px;`,
    pre: 'background:#282c34;border-radius:6px;padding:16px;overflow-x:auto;font-size:14px;line-height:1.5;margin:16px 0;color:#abb2bf;',
    code: `background:#f0f0f0;color:${accent};padding:2px 6px;border-radius:3px;font-size:90%;font-family:Consolas,monospace;`,
    table: 'border-collapse:collapse;width:100%;margin:16px 0;font-size:15px;',
    th: 'border:1px solid #ddd;padding:10px 14px;background:#f8f8f8;font-weight:bold;',
    td: 'border:1px solid #ddd;padding:10px 14px;',
    img: 'max-width:100%;height:auto;border-radius:4px;margin:12px 0;',
    a: `color:${accent};text-decoration:none;`,
    strong: `color:${accent};font-weight:bold;`,
    hr: 'border:none;height:1px;background:#eee;margin:28px 0;',
    ul: 'padding-left:24px;margin:10px 0;',
    ol: 'padding-left:24px;margin:10px 0;',
    li: 'font-size:16px;line-height:1.9;color:#333;margin:4px 0;',
    figcaption: 'font-size:13px;line-height:1.6;color:#666;text-align:center;margin-top:8px;',
    figure: 'margin:18px 0;',
  }
}

function replaceVideoNodes(root: HTMLElement, accent: string) {
  const nodes = Array.from(root.querySelectorAll('figure.media-video, video'))

  nodes.forEach((node) => {
    if (node instanceof HTMLElement && node.dataset.platformCard === 'true') return

    const poster = getVideoPoster(node)
    const link = getVideoLink(node)
    const title = getVideoTitle(node)
    const wrapper = root.ownerDocument.createElement('figure')
    wrapper.dataset.platformCard = 'true'
    wrapper.setAttribute('style', 'margin:22px 0;border:1px solid #ececec;border-radius:16px;overflow:hidden;background:#ffffff;box-shadow:0 12px 28px rgba(15,23,42,0.05);')

    const anchor = root.ownerDocument.createElement('a')
    anchor.href = link || '#'
    anchor.setAttribute('style', 'display:block;color:inherit;text-decoration:none;')

    if (poster) {
      const img = root.ownerDocument.createElement('img')
      img.src = poster
      img.alt = title
      img.setAttribute('style', 'display:block;width:100%;aspect-ratio:16/9;object-fit:cover;background:#f5f5f5;margin:0;border-radius:0;')
      anchor.appendChild(img)
    }

    const body = root.ownerDocument.createElement('div')
    body.setAttribute('style', 'padding:16px 18px;')

    const heading = root.ownerDocument.createElement('div')
    heading.textContent = title
    heading.setAttribute('style', 'font-size:17px;font-weight:700;line-height:1.5;color:#111827;margin-bottom:8px;')

    const desc = root.ownerDocument.createElement('div')
    desc.textContent = link ? 'Toutiao export keeps a media card with poster, title and link.' : 'Add a public link before copying to Toutiao.'
    desc.setAttribute('style', 'font-size:13px;line-height:1.7;color:#6b7280;margin-bottom:10px;')

    const cta = root.ownerDocument.createElement('span')
    cta.textContent = link ? 'Open video link' : 'Missing video link'
    cta.setAttribute('style', `display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border-radius:999px;background:${accent};color:#fff;font-size:12px;font-weight:600;`)

    body.append(heading, desc, cta)
    anchor.appendChild(body)
    wrapper.appendChild(anchor)
    node.replaceWith(wrapper)
  })
}

export function applyToutiaoStyles(html: string, accent = '#e74c3c'): string {
  const processed = inlineKatexStyles(html, 'toutiao' as ExportMode)
  const tagStyles = buildTagStyles(accent)

  const parser = new DOMParser()
  const doc = parser.parseFromString(`<div>${processed}</div>`, 'text/html')
  const root = doc.body.firstElementChild as HTMLElement

  replaceVideoNodes(root, accent)

  for (const [tag, style] of Object.entries(tagStyles)) {
    root.querySelectorAll(tag).forEach((el) => {
      const htmlEl = el as HTMLElement
      if (htmlEl.closest('.katex')) return
      if (htmlEl.dataset.platformCard === 'true') return
      const existing = htmlEl.getAttribute('style') || ''
      htmlEl.setAttribute('style', existing + style)
    })
  }

  root.querySelectorAll('pre code').forEach((el) => {
    const htmlEl = el as HTMLElement
    htmlEl.setAttribute('style', 'background:transparent;color:inherit;padding:0;font-size:inherit;')
  })

  return `<section style="padding:20px;max-width:100%;font-family:'PingFang SC','Microsoft YaHei',sans-serif;">${root.innerHTML}</section>`
}
