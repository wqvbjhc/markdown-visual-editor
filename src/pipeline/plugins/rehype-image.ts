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

export function rehypeImage() {
  return (tree: Root) => {
    visit(tree, 'element', (node, index, parent) => {
      if (node.tagName !== 'img') return

      node.properties = {
        ...node.properties,
        loading: 'lazy',
        decoding: 'async',
        referrerPolicy: 'no-referrer',
        'data-media-kind': 'image',
        'data-original-src': node.properties.src,
      }

      if (!node.properties.className) {
        node.properties.className = []
      }

      const parentElement = parent as Element | undefined
      if (!parentElement || parentElement.tagName === 'figure' || typeof index !== 'number') return

      const caption = String(node.properties['data-caption'] || '').trim()
      const width = String(node.properties['data-width'] || '').trim()
      if (!caption && !width) return

      const nextChildren = [...(parentElement.children || [])]
      nextChildren[index] = {
        type: 'element',
        tagName: 'figure',
        properties: {
          className: ['media-figure', 'media-image'],
          'data-media-kind': 'image',
          ...(width ? { style: `max-width:${width};` } : {}),
        },
        children: [
          node,
          ...(caption ? [createCaption(caption)] : []),
        ],
      }
      parentElement.children = nextChildren
    })
  }
}
