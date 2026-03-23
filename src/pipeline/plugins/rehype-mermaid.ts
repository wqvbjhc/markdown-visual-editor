import type { Root, Element } from 'hast'
import { visit } from 'unist-util-visit'

export function rehypeMermaid() {
  return (tree: Root) => {
    visit(tree, 'element', (node, index, parent) => {
      if (
        node.tagName !== 'pre' ||
        !parent ||
        index === undefined ||
        !node.children[0] ||
        (node.children[0] as Element).tagName !== 'code'
      ) return

      const codeEl = node.children[0] as Element
      const classes = (codeEl.properties?.className as string[]) || []
      if (!classes.some((c) => c === 'language-mermaid')) return

      let code = ''
      const extractText = (el: Element | { type: string; value?: string }) => {
        if (el.type === 'text' && 'value' in el) code += el.value
        if ('children' in el) (el as Element).children.forEach(extractText as never)
      }
      extractText(codeEl)

      const mermaidDiv: Element = {
        type: 'element',
        tagName: 'div',
        properties: {
          className: ['mermaid-block'],
          'data-mermaid': code,
        },
        children: [{ type: 'text', value: code }],
      }
      ;(parent as Element).children[index] = mermaidDiv
    })
  }
}
