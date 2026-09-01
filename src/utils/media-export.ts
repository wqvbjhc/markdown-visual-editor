import { normalizeCodeBlockText } from '@/components/CodeBlock'
import type { LocalMediaRecord } from './media'
import { blobToDataUrl, buildMissingMediaSvg, getVideoLink, normalizeRelativeMediaPath, parseLocalMediaId, readPersistedRelativeMedia } from './media'
import { renderMermaidToDataUrl } from './mermaid-png'
import { unwrapSelfAnchorHeadingLinks } from './heading-links'

export interface CopyPreparationResult {
  html: string
  text: string
  imageItem?: { type: string; blob: Blob }
  warnings: string[]
}

/**
 * 把 html 里的 mermaid 代码块（<div class="mermaid-block">）渲染成 PNG data URL <img>。
 *
 * 复制到公众号/头条/飞书必须走 PNG：SVG 粘贴被公众号白名单过滤（禁 <script>/<style>、AttributeName
 * 白名单）必丢，头条更严；PNG base64 粘贴公众号/头条自动转存、飞书认。预览里的 mermaid SVG 只活在
 * 预览 DOM 不在 store.html 串，复制拿串是裸文本，故复制前必须就地渲 PNG 替换。
 *
 * 渲染失败的块保留原样（裸文本），failed 计数供调用方提示。
 */
export async function injectMermaidPngs(html: string): Promise<{ html: string; failed: number }> {
  if (!html.includes('mermaid-block')) return { html, failed: 0 }
  const parser = new DOMParser()
  const doc = parser.parseFromString(`<div>${html}</div>`, 'text/html')
  const root = doc.body.firstElementChild as HTMLElement | null
  if (!root) return { html, failed: 0 }
  const blocks = Array.from(root.querySelectorAll<HTMLElement>('.mermaid-block'))
  if (blocks.length === 0) return { html, failed: 0 }
  let failed = 0
  await Promise.all(
    blocks.map(async (block) => {
      const code = block.getAttribute('data-mermaid') || block.textContent || ''
      const dataUrl = await renderMermaidToDataUrl(code)
      if (!dataUrl) {
        failed += 1
        return
      }
      const img = doc.createElement('img')
      img.setAttribute('src', dataUrl)
      img.setAttribute('alt', 'mermaid 图表')
      img.setAttribute('style', 'max-width:100%;height:auto;border-radius:4px;margin:8px 0;')
      block.replaceWith(img)
    }),
  )
  return { html: root.innerHTML, failed }
}

function isPublicHref(value: string): boolean {
  return /^https?:/i.test(value)
}

export function validateVideoExport(
  html: string,
  _localMediaMap: Record<string, LocalMediaRecord>,
): string[] {
  const parser = new DOMParser()
  const doc = parser.parseFromString(`<div>${html}</div>`, 'text/html')
  const root = doc.body.firstElementChild as HTMLElement | null
  if (!root) return []

  const errors: string[] = []
  const figures = Array.from(root.querySelectorAll('figure.media-video'))
  const standalones = Array.from(root.querySelectorAll('video')).filter((node) => !node.closest('figure.media-video'))
  const candidates = [...figures, ...standalones]

  candidates.forEach((node, index) => {
    const link = getVideoLink(node)
    if (!link || parseLocalMediaId(link) || !isPublicHref(link)) {
      errors.push(`视频 ${index + 1} 缺少封面或公开跳转链接`)
    }
  })

  return errors
}

export async function prepareClipboardHtml(
  html: string,
  localMediaMap: Record<string, LocalMediaRecord>,
): Promise<CopyPreparationResult> {
  const parser = new DOMParser()
  const doc = parser.parseFromString(`<div>${html}</div>`, 'text/html')
  const root = doc.body.firstElementChild as HTMLElement | null
  if (!root) {
    return { html, text: '', warnings: [] }
  }

  // 全格式统一剥标题自锚超链接：rehype-autolink-headings 把标题包进 <a href="#slug">，
  // 离开本页是死链，复制到公众号/头条/飞书/默认都只会变无意义超链接。此处是复制链路单点
  // （所有格式必经），零额外 DOM parse（复用已 parse 的 root）。
  unwrapSelfAnchorHeadingLinks(root)

  // 剥滚动同步锚点：data-source-line 是站内同步模块的内部属性，不应流入剪贴板/外部平台（同单点）
  root.querySelectorAll('[data-source-line]').forEach((el) => el.removeAttribute('data-source-line'))

  const warnings: string[] = []
  const localImages: LocalMediaRecord[] = []
  const persistedRelativeMedia = readPersistedRelativeMedia()

  const codeElements = Array.from(root.querySelectorAll<HTMLElement>('pre code'))
  codeElements.forEach((codeEl) => {
    codeEl.textContent = normalizeCodeBlockText(codeEl.textContent || '')
  })

  const imageElements = Array.from(root.querySelectorAll<HTMLImageElement>('img[src]'))
  // 并发 fetch（保 DOM 序：resolved 数组序 = imageElements 序，firstImage 仍取首张）
  const resolved = await Promise.all(imageElements.map(async (img) => {
    const rawSrc = img.getAttribute('src') || ''
    const mediaId = parseLocalMediaId(rawSrc)
    if (mediaId) {
      const media = localMediaMap[mediaId]
      if (!media || media.kind !== 'image') {
        // 本地图无 record（重开后未重选）：fallback SVG，防 local-media:// 协议流入外部平台显坏图
        return { img, dataUrl: buildMissingMediaSvg('image', '请重新选择本地图片'), media: null }
      }
      return { img, dataUrl: await blobToDataUrl(media.file), media }
    }
    const relativePath = normalizeRelativeMediaPath(rawSrc)
    if (!relativePath) return null
    const persisted = persistedRelativeMedia[relativePath]
    if (!persisted) return null
    return { img, dataUrl: persisted.dataUrl, media: null }
  }))
  for (const r of resolved) {
    if (!r) continue
    r.img.setAttribute('src', r.dataUrl)
    if (r.media) localImages.push(r.media)
  }

  if (localImages.length > 1) {
    warnings.push('复制内容含多张本地图片，仅把首张作为剪贴板图片项，其余内联为 base64')
  }

  const firstImage = localImages.length === 1 ? localImages[0] : undefined

  return {
    html: root.innerHTML,
    text: root.textContent || '',
    imageItem: firstImage ? { type: firstImage.type || 'image/png', blob: firstImage.file } : undefined,
    warnings,
  }
}
