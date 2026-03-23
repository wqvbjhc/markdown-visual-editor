import type { Element, Root } from 'hast'
import { visit } from 'unist-util-visit'

function createCaption(value: string): Element {
  return {
    type: 'element',
    tagName: 'figcaption',
    properties: {},
    children: [{ type: 'text', value }],
  }
}

export function rehypeVideo() {
  return (tree: Root) => {
    visit(tree, 'element', (node, index, parent) => {
      if (node.tagName !== 'video') return

      const source = node.properties.src || ((node.children || []).find((child) => {
        return child.type === 'element' && child.tagName === 'source'
      }) as Element | undefined)?.properties?.src || ''
      const title = String(node.properties.title || 'Video')
      const poster = String(node.properties.poster || '')
      const href = String(node.properties['data-media-link'] || source || '')

      node.properties = {
        ...node.properties,
        controls: true,
        playsInline: true,
        preload: node.properties.preload || 'metadata',
        crossOrigin: 'anonymous',
        referrerPolicy: 'no-referrer',
        title,
        'data-media-link': href,
      }

      const parentElement = parent as Element | undefined
      if (!parentElement || parentElement.tagName === 'figure' || typeof index !== 'number') return

      const nextChildren = [...(parentElement.children || [])]
      nextChildren[index] = {
        type: 'element',
        tagName: 'figure',
        properties: {
          className: ['media-figure', 'media-video'],
          'data-media-kind': 'video',
          'data-media-title': title,
          'data-media-link': href,
          ...(poster ? { 'data-media-poster': poster } : {}),
        },
        children: [
          node,
          ...(title ? [createCaption(title)] : []),
        ],
      }
      parentElement.children = nextChildren
    })
  }
}
