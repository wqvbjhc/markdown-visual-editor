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
          // 保留 remark-source-line 注入的源行号锚点（滚动同步用；pre 整体替换时属性会丢）
          ...(codeEl.properties?.dataSourceLine !== undefined
            ? { dataSourceLine: codeEl.properties.dataSourceLine }
            : {}),
        },
        children: [{ type: 'text', value: code }],
      }
      ;(parent as Element).children[index] = mermaidDiv
    })
  }
}
