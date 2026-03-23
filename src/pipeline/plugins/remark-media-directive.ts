import type { Root } from 'mdast'
import { visit } from 'unist-util-visit'

type DirectiveNode = {
  type: 'containerDirective' | 'leafDirective' | 'textDirective'
  name?: string
  attributes?: Record<string, string>
  data?: Record<string, unknown>
}

function textNode(value: string) {
  return { type: 'text', value }
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
      if (!directive?.name || !['image', 'video'].includes(directive.name)) return
      createFigure(directive)
    })
  }
}
