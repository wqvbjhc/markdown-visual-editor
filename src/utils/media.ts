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

export interface PersistedLocalMediaRecord {
  id: string
  kind: LocalMediaKind
  name: string
  type: string
  size: number
  dataUrl: string
}

export interface RelativeMediaEntry {
  path: string
  dataUrl: string
}

export const LOCAL_MEDIA_PROTOCOL = 'local-media://'
export const LOCAL_MEDIA_STORAGE_KEY = 'md-local-media'
export const RELATIVE_MEDIA_STORAGE_KEY = 'md-relative-media'

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

export function buildVideoPosterFallback(title: string): string {
  return buildMissingMediaSvg('video', title || 'Preview available in editor')
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

export function readPersistedLocalMedia(): Record<string, PersistedLocalMediaRecord> {
  if (typeof localStorage === 'undefined') return {}

  try {
    const raw = localStorage.getItem(LOCAL_MEDIA_STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as PersistedLocalMediaRecord[]
    return Object.fromEntries(parsed.map((record) => [record.id, record]))
  } catch {
    return {}
  }
}

export function normalizeRelativeMediaPath(src: string): string | null {
  const normalized = src.trim().replace(/\\/g, '/').replace(/^\.\//, '')
  if (!normalized) return null
  if (/^(https?:|data:|local-media:|file:)/i.test(normalized)) return null
  if (normalized.startsWith('../')) return null
  return normalized
}

export function readPersistedRelativeMedia(): Record<string, RelativeMediaEntry> {
  if (typeof localStorage === 'undefined') return {}

  try {
    const raw = localStorage.getItem(RELATIVE_MEDIA_STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as RelativeMediaEntry[]
    return Object.fromEntries(parsed.map((entry) => [entry.path, entry]))
  } catch {
    return {}
  }
}

export async function hydrateLocalMedia(
  root: ParentNode,
  localMediaMap: Record<string, LocalMediaRecord>,
): Promise<void> {
  const persistedMediaMap = readPersistedLocalMedia()
  const persistedRelativeMedia = readPersistedRelativeMedia()

  root.querySelectorAll<HTMLImageElement>('img[src]').forEach((img) => {
    const rawSrc = img.getAttribute('data-original-src') || img.getAttribute('src') || ''
    const mediaId = parseLocalMediaId(rawSrc)
    if (mediaId) {
      const media = localMediaMap[mediaId]
      if (media?.kind === 'image') {
        img.src = media.objectUrl
        img.dataset.localMediaResolved = 'true'
        return
      }

      const persisted = persistedMediaMap[mediaId]
      if (persisted?.kind === 'image') {
        img.src = persisted.dataUrl
        img.dataset.localMediaResolved = 'persisted'
        return
      }

      img.src = buildMissingMediaSvg('image', 'Please re-select the local image file.')
      img.classList.add('img-fallback', 'media-missing')
      img.alt = img.alt || 'Local image unavailable'
      return
    }

    const relativePath = normalizeRelativeMediaPath(rawSrc)
    if (!relativePath) return

    const relativeEntry = persistedRelativeMedia[relativePath]
    if (relativeEntry) {
      img.src = relativeEntry.dataUrl
      img.dataset.localMediaResolved = 'relative'
      return
    }
  })

  root.querySelectorAll<HTMLElement>('[poster]').forEach((el) => {
    const mediaId = parseLocalMediaId(el.getAttribute('poster'))
    if (!mediaId) return

    const media = localMediaMap[mediaId]
    const persisted = persistedMediaMap[mediaId]
    el.setAttribute(
      'poster',
      media?.kind === 'image'
        ? media.objectUrl
        : persisted?.kind === 'image'
          ? persisted.dataUrl
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

    const persisted = persistedMediaMap[mediaId]
    if (persisted?.kind === 'video') {
      if (video.hasAttribute('src')) {
        video.src = persisted.dataUrl
      } else if (source) {
        source.src = persisted.dataUrl
        video.load()
      }
      video.dataset.localMediaResolved = 'persisted'
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
