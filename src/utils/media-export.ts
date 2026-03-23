import type { LocalMediaRecord } from './media'
import { blobToDataUrl, getVideoLink, getVideoPoster, parseLocalMediaId } from './media'

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
  localMediaMap: Record<string, LocalMediaRecord>,
): string[] {
  const parser = new DOMParser()
  const doc = parser.parseFromString(`<div>${html}</div>`, 'text/html')
  const root = doc.body.firstElementChild as HTMLElement | null
  if (!root) return []

  const errors: string[] = []
  const candidates = Array.from(root.querySelectorAll('figure.media-video, video'))

  candidates.forEach((node, index) => {
    const link = getVideoLink(node)
    const poster = getVideoPoster(node)
    const posterMediaId = parseLocalMediaId(poster)

    if (!link || parseLocalMediaId(link) || !isPublicHref(link)) {
      errors.push(`Video ${index + 1} is missing a public link. Add href="https://...".`)
    }

    if (!poster || (posterMediaId && !localMediaMap[posterMediaId])) {
      errors.push(`Video ${index + 1} is missing a valid poster image.`)
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

  const imageElements = Array.from(root.querySelectorAll<HTMLImageElement>('img[src]'))
  for (const img of imageElements) {
    const mediaId = parseLocalMediaId(img.getAttribute('src'))
    if (!mediaId) continue

    const media = localMediaMap[mediaId]
    if (!media || media.kind !== 'image') continue
    const dataUrl = await blobToDataUrl(media.file)
    img.setAttribute('src', dataUrl)
    localImages.push(media)
  }

  if (localImages.length > 1) {
    warnings.push('本地图片已以内嵌 HTML 方式复制，目标平台是否自动上传仍取决于浏览器和编辑器。')
  }

  const firstImage = localImages.length === 1 ? localImages[0] : undefined

  return {
    html: root.innerHTML,
    text: root.textContent || '',
    imageItem: firstImage ? { type: firstImage.type || 'image/png', blob: firstImage.file } : undefined,
    warnings,
  }
}
