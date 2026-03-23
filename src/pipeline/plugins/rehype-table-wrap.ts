import type { Root, Element } from 'hast'
import { visit } from 'unist-util-visit'

export function rehypeTableWrap() {
  return (tree: Root) => {
    visit(tree, 'element', (node, index, parent) => {
      if (node.tagName !== 'table' || !parent || index === undefined) return
      const wrapper: Element = {
        type: 'element',
        tagName: 'div',
        properties: { className: ['table-wrapper'] },
        children: [node],
      }
      ;(parent as Element).children[index] = wrapper
    })
  }
}
