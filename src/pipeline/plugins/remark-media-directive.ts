import type { Root } from 'mdast'
import { visit } from 'unist-util-visit'

type DirectiveNode = {
  type: 'containerDirective' | 'leafDirective' | 'textDirective' | 'html'
  name?: string
  attributes?: Record<string, string>
  value?: string
  data?: Record<string, unknown>
}

function textNode(value: string) {
  return { type: 'text', value }
}

function parseHtmlAttributes(value: string): Record<string, string> {
  const attrs: Record<string, string> = {}
  const attrRe = /([:\w-]+)(?:=(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g
  let match: RegExpExecArray | null

  while ((match = attrRe.exec(value)) !== null) {
    const name = match[1]
    const raw = match[2] ?? match[3] ?? match[4] ?? 'true'
    attrs[name] = raw
  }

  return attrs
}

function normalizeHtmlVideo(node: DirectiveNode) {
  if (node.type !== 'html' || !node.value) return
  const trimmed = node.value.trim()
  const match = trimmed.match(/^<video\b([^>]*)>(?:[\s\S]*?<\/video>)?$/i)
  if (!match) return

  const attrs = parseHtmlAttributes(match[1] || '')
  node.type = 'leafDirective'
  node.name = 'video'
  node.attributes = {
    src: attrs.src || '',
    poster: attrs.poster || '',
    title: attrs.title || 'Video',
    href: attrs['data-media-link'] || attrs.href || attrs.src || '',
  }
  delete node.value
}

function createFigure(node: DirectiveNode) {
  const attrs = node.attributes || {}

  if (node.name === 'image') {
    const src = attrs.src || ''
    const alt = attrs.alt || ''
    const title = attrs.title || ''
    const caption = attrs.caption || title
    const width = attrs.width || ''

    node.data = {
      hName: 'figure',
      hProperties: {
        className: ['media-figure', 'media-image'],
        'data-media-kind': 'image',
        ...(width ? { style: `max-width:${width};` } : {}),
      },
      hChildren: [
        {
          type: 'element',
          tagName: 'img',
          properties: {
            src,
            alt,
            title,
            ...(caption ? { 'data-caption': caption } : {}),
            ...(width ? { 'data-width': width } : {}),
          },
          children: [],
        },
        ...(caption
          ? [{ type: 'element', tagName: 'figcaption', properties: {}, children: [textNode(caption)] }]
          : []),
      ],
    }
  }

  if (node.name === 'video') {
    const src = attrs.src || ''
    const poster = attrs.poster || ''
    const title = attrs.title || 'Video'
    const href = attrs.href || src

    node.data = {
      hName: 'figure',
      hProperties: {
        className: ['media-figure', 'media-video'],
        'data-media-kind': 'video',
        'data-media-title': title,
        'data-media-link': href,
        ...(poster ? { 'data-media-poster': poster } : {}),
      },
      hChildren: [
        {
          type: 'element',
          tagName: 'video',
          properties: {
            src,
            controls: true,
            playsInline: true,
            preload: 'metadata',
            title,
            ...(poster ? { poster } : {}),
            'data-media-link': href,
          },
          children: [],
        },
        ...(title
          ? [{ type: 'element', tagName: 'figcaption', properties: {}, children: [textNode(title)] }]
          : []),
      ],
    }
  }
}

export function remarkMediaDirective() {
  return (tree: Root) => {
    visit(tree, (node) => {
      const directive = node as DirectiveNode
      if (directive.type === 'html') {
        normalizeHtmlVideo(directive)
      }
      if (!directive?.name || !['image', 'video'].includes(directive.name)) return
      createFigure(directive)
    })
  }
}
