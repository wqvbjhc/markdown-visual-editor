export type LocalMediaKind = 'image' | 'video'

export interface LocalMediaRecord {
  id: string
  kind: LocalMediaKind
  name: string
  type: string
  size: number
  objectUrl: string
  file: File
}

export const LOCAL_MEDIA_PROTOCOL = 'local-media://'

const SVG_BG = '#f3f4f6'
const SVG_FG = '#6b7280'

export function buildLocalMediaSrc(id: string): string {
  return `${LOCAL_MEDIA_PROTOCOL}${id}`
}

export function parseLocalMediaId(src?: string | null): string | null {
  if (!src || !src.startsWith(LOCAL_MEDIA_PROTOCOL)) return null
  return src.slice(LOCAL_MEDIA_PROTOCOL.length)
}

export function escapeDirectiveValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

export function buildImageDirective(options: {
  src: string
  alt?: string
  title?: string
  caption?: string
  width?: string
}): string {
  const attrs = [
    `src="${escapeDirectiveValue(options.src)}"`,
    `alt="${escapeDirectiveValue(options.alt || '')}"`,
  ]

  if (options.title) attrs.push(`title="${escapeDirectiveValue(options.title)}"`)
  if (options.caption) attrs.push(`caption="${escapeDirectiveValue(options.caption)}"`)
  if (options.width) attrs.push(`width="${escapeDirectiveValue(options.width)}"`)

  return `::image{${attrs.join(' ')}}`
}

export function buildVideoDirective(options: {
  src: string
  poster?: string
  title?: string
  href?: string
}): string {
  const attrs = [`src="${escapeDirectiveValue(options.src)}"`]

  if (options.poster) attrs.push(`poster="${escapeDirectiveValue(options.poster)}"`)
  if (options.title) attrs.push(`title="${escapeDirectiveValue(options.title)}"`)
  if (options.href) attrs.push(`href="${escapeDirectiveValue(options.href)}"`)

  return `::video{${attrs.join(' ')}}`
}

export function buildMissingMediaSvg(kind: LocalMediaKind, label: string): string {
  return `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675" fill="none"><rect width="1200" height="675" rx="24" fill="${SVG_BG}"/><text x="600" y="320" fill="${SVG_FG}" font-family="Segoe UI, Arial, sans-serif" font-size="34" text-anchor="middle">${kind === 'image' ? 'Image unavailable' : 'Video unavailable'}</text><text x="600" y="372" fill="${SVG_FG}" font-family="Segoe UI, Arial, sans-serif" font-size="24" text-anchor="middle">${label}</text></svg>`
  )}`
}

export function getVideoSource(element: Element): string {
  if (element instanceof HTMLVideoElement) {
    const direct = element.getAttribute('src') || ''
    if (direct) return direct
    const source = element.querySelector('source')
    return source?.getAttribute('src') || ''
  }

  const video = element.querySelector('video')
  if (!video) return ''
  return getVideoSource(video)
}

export function getVideoPoster(element: Element): string {
  if (element instanceof HTMLVideoElement) {
    return element.getAttribute('poster') || ''
  }

  return (
    element.getAttribute('data-media-poster')
    || element.querySelector('video')?.getAttribute('poster')
    || ''
  )
}

export function getVideoTitle(element: Element): string {
  if (element instanceof HTMLVideoElement) {
    return element.getAttribute('title') || element.getAttribute('aria-label') || 'Video'
  }

  return (
    element.getAttribute('data-media-title')
    || element.querySelector('figcaption')?.textContent?.trim()
    || element.querySelector('video')?.getAttribute('title')
    || 'Video'
  )
}

export function getVideoLink(element: Element): string {
  return (
    element.getAttribute('data-media-link')
    || getVideoSource(element)
    || ''
  )
}

export async function blobToDataUrl(blob: Blob): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(reader.error || new Error('Failed to read blob'))
    reader.readAsDataURL(blob)
  })
}

export async function hydrateLocalMedia(
  root: ParentNode,
  localMediaMap: Record<string, LocalMediaRecord>,
): Promise<void> {
  root.querySelectorAll<HTMLImageElement>('img[src]').forEach((img) => {
    const mediaId = parseLocalMediaId(img.getAttribute('src'))
    if (!mediaId) return

    const media = localMediaMap[mediaId]
    if (media?.kind === 'image') {
      img.src = media.objectUrl
      img.dataset.localMediaResolved = 'true'
      return
    }

    img.src = buildMissingMediaSvg('image', 'Please re-select the local image file.')
    img.classList.add('img-fallback', 'media-missing')
    img.alt = img.alt || 'Local image unavailable'
  })

  root.querySelectorAll<HTMLElement>('[poster]').forEach((el) => {
    const mediaId = parseLocalMediaId(el.getAttribute('poster'))
    if (!mediaId) return

    const media = localMediaMap[mediaId]
    el.setAttribute(
      'poster',
      media?.kind === 'image'
        ? media.objectUrl
        : buildMissingMediaSvg('image', 'Please re-select the local poster image.'),
    )
  })

  root.querySelectorAll<HTMLVideoElement>('video').forEach((video) => {
    const source = video.querySelector('source')
    const rawSrc = video.getAttribute('src') || source?.getAttribute('src') || ''
    const mediaId = parseLocalMediaId(rawSrc)
    if (!mediaId) return

    const media = localMediaMap[mediaId]
    if (media?.kind === 'video') {
      if (video.hasAttribute('src')) {
        video.src = media.objectUrl
      } else if (source) {
        source.src = media.objectUrl
        video.load()
      }
      video.dataset.localMediaResolved = 'true'
      return
    }

    const placeholder = root.ownerDocument?.createElement('div')
    if (!placeholder) return

    placeholder.className = 'media-missing-card'
    placeholder.innerHTML = '<strong>Local video unavailable.</strong><span>Please re-select the local video file in this session.</span>'

    const figure = video.closest('figure')
    if (figure) {
      figure.replaceChildren(placeholder)
    } else {
      video.replaceWith(placeholder)
    }
  })
}
