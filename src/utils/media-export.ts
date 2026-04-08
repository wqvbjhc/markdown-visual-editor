import { normalizeCodeBlockText } from '@/components/CodeBlock'
import type { LocalMediaRecord } from './media'
import { blobToDataUrl, getVideoLink, parseLocalMediaId } from './media'

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
      errors.push(`? ${index + 1} ???????????`)
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

  const codeElements = Array.from(root.querySelectorAll<HTMLElement>('pre code'))
  codeElements.forEach((codeEl) => {
    codeEl.textContent = normalizeCodeBlockText(codeEl.textContent || '')
  })

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
    warnings.push('???????? HTML ???????????????????????????')
  }

  const firstImage = localImages.length === 1 ? localImages[0] : undefined

  return {
    html: root.innerHTML,
    text: root.textContent || '',
    imageItem: firstImage ? { type: firstImage.type || 'image/png', blob: firstImage.file } : undefined,
    warnings,
  }
}
