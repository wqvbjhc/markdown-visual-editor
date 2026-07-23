import { normalizeCodeBlockText } from '@/components/CodeBlock'
import type { LocalMediaRecord } from './media'
import { blobToDataUrl, buildMissingMediaSvg, getVideoLink, normalizeRelativeMediaPath, parseLocalMediaId, readPersistedRelativeMedia } from './media'

export interface CopyPreparationResult {
  html: string
  text: string
  imageItem?: { type: string; blob: Blob }
  warnings: string[]
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
