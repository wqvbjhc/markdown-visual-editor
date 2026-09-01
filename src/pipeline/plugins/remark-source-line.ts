import type { Root } from 'mdast'
import { visit } from 'unist-util-visit'

// 注入同步滚动锚点的块级节点类型；listItem 一并注入，长列表内部也能对齐
const BLOCK_TYPES = new Set([
  'paragraph', 'heading', 'code', 'list', 'listItem', 'blockquote',
  'thematicBreak', 'table', 'html', 'math', 'leafDirective', 'containerDirective',
])

/**
 * remark 源行号锚点：为块级 mdast 节点注入 data-source-line（源码起始行号，1 基），
 * 供编辑器/预览双向同步滚动做行锚点映射。
 * 经 remark-rehype 的 data.hProperties 传递到 hast，序列化为 data-source-line 属性；
 * 须同步 src/utils/sanitize-schema.ts 白名单（'*' 加 dataSourceLine），否则被 rehype-sanitize 静默剥。
 */
export function remarkSourceLine() {
  return (tree: Root) => {
    visit(tree, (node) => {
      if (node.type === 'root') return
      if (!BLOCK_TYPES.has(node.type)) return
      if (node.position?.start == null) return
      const data = (node.data ??= {})
      const props = (data.hProperties ??= {})
      props.dataSourceLine = String(node.position.start.line)
    })
  }
}
