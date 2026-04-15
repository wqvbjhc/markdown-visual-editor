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
        crossOrigin: 'anonymous',
        onerror: "this.onerror=null;this.src='data:image/svg+xml,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"200\" height=\"150\" fill=\"%23ccc\"><rect width=\"200\" height=\"150\" rx=\"8\"/><text x=\"50%\" y=\"50%\" text-anchor=\"middle\" dy=\".3em\" fill=\"%23999\" font-size=\"14\">Image not found</text></svg>';this.classList.add('img-fallback')",
        'data-media-kind': 'image',
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
