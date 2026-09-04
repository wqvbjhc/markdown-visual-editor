import type { Root } from 'mdast'
import { visit } from 'unist-util-visit'

type DirectiveNode = {
  type: 'textDirective' | 'leafDirective'
  name?: string
  attributes?: Record<string, string>
  children?: Array<{ value?: string }>
  position?: import('unist').Position
}

/** 项目实际使用的 media directive 名（::image{...} / ::video{...}），保留其语义不还原 */
const MEDIA_NAMES = ['image', 'video']

function attrsToString(attrs: Record<string, string>): string {
  const parts = Object.entries(attrs).map(([k, v]) => (v === 'true' ? k : `${k}="${v}"`))
  return parts.length ? `{${parts.join(' ')}}` : ''
}

function childrenToText(children: Array<{ value?: string }> | undefined): string {
  if (!Array.isArray(children)) return ''
  return children.map((c) => c.value || '').join('')
}

/**
 * 把 remark-directive 误解析的 directive 还原成纯文本。
 *
 * 背景：remark-directive 语法里裸 `:name`（无 [label]{props}）也是合法的内联 textDirective，
 * 名字允许数字和连字符（如 `80-87`）。中文技术正文的 `1:1`、`dataLoader.py:80-87`、`4:1`
 * 这类比例 / file:line 会被解析成空 `<div></div>`（名字被丢弃），预览直接丢字。
 *
 * 规则：
 * - textDirective（内联 `:name`）：非 image/video 一律还原成文本（项目从不用内联指令）。
 * - leafDirective（行首 `:name` / `::name`）：仅还原「裸」形态（无 label 无属性）——
 *   带 {…} 的是有意使用的指令（如 ::image{src=…}），保持原渲染。
 * - containerDirective（:::name）：不动（块级结构，正文中罕见误伤）。
 */
export function remarkRecoverDirective() {
  return (tree: Root) => {
    visit(tree, ['textDirective', 'leafDirective'], (node, index, parent) => {
      const directive = node as DirectiveNode
      if (!directive.name || MEDIA_NAMES.includes(directive.name)) return
      if (index === undefined || !parent) return

      const label = childrenToText(directive.children)
      const attrs = attrsToString(directive.attributes || {})
      const source = `:${directive.name}${label}${attrs}`

      if (directive.type === 'textDirective') {
        // 内联：原位换成 text 节点
        parent.children[index] = { type: 'text', value: source }
      } else if (!label && !attrs) {
        // 行首裸指令：块级位置不能直接放 text，包一层 paragraph；保留 position 供滚动同步锚点用
        parent.children[index] = {
          type: 'paragraph',
          children: [{ type: 'text', value: source }],
          position: directive.position,
        }
      }
    })
  }
}
