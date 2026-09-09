import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkMath from 'remark-math'
import { visit } from 'unist-util-visit'
import type { Root } from 'mdast'
import type { Point } from 'unist'

/**
 * 把 Pandoc 风格 LaTeX 定界符归一化成 remark-math 认识的 $ / $$。
 *
 * 背景：remark-math 只认 `$...$` / `$$...$$`。LaTeX 源码常见的 `\(...\)` / `\[...\]`
 * 落进 CommonMark 后先被反斜杠转义吃掉反斜杠（`\(V_s\)` → `(V_s)`），残留的 `_`
 * 下标再被强调规则（cjk-friendly 放宽 CJK 侧侧翼限制）跨段配对成 <em>，
 * 双重损坏。必须在 parse 之前的原文层做替换，parse 之后来不及（信息已丢）。
 *
 * 规则：
 * - 成对 `\(...\)` → `$...$`，成对 `\[...\]` → `$$...$$`；均原位替换定界符
 *   （内容自带的 \n 保留）。标准多行 display 形态 `\[\n内容\n\]` 天然变成
 *   `$$\n内容\n$$` 解析为块级公式；单行 `\[x\]` 变 `$$x$$` 渲染为 inline 公式
 *   （公式正确、居中块样式降级）。不成对不动（remark-math 会把落单 $ 当普通
 *   文本，转换不成对的定界符只会把错误提前）。
 * - 代码块（code）、行内代码（inlineCode）、已有公式（math/inlineMath）、原始 HTML
 *   块（html）内的定界符不转换——先 parse 一遍拿这些节点的位置做保护区间。
 * - 定界符等长替换（2 字符换 2 字符）、不引入/删除 \n，行数与列号不变，
 *   data-source-line 锚点不受影响。
 *
 * 已知边界：正文里手写转义方括号 `\[1,2\]`（本意字面量）会被当 display 公式转换；
 * 这种写法在正文里极罕见（不转义的 `[1,2]` 没有任何解析风险），接受该歧义。
 */

/** position 点（1 基行/列）→ 原文偏移量 */
function offsetOf(pos: Point, lineStarts: number[]): number {
  return lineStarts[pos.line - 1] + pos.column - 1
}

/** 收集不可转换的原文区间：code / inlineCode / math / inlineMath / html 节点的覆盖范围 */
function collectProtectedRanges(md: string): Array<[number, number]> {
  const tree = unified().use(remarkParse).use(remarkMath).parse(md) as Root
  const lineStarts: number[] = [0]
  for (let i = 0; i < md.length; i++) {
    if (md[i] === '\n') lineStarts.push(i + 1)
  }

  const ranges: Array<[number, number]> = []
  visit(tree, ['code', 'inlineCode', 'math', 'inlineMath', 'html'], (node) => {
    if (!node.position) return
    ranges.push([offsetOf(node.position.start, lineStarts), offsetOf(node.position.end, lineStarts)])
  })
  return ranges
}

interface MathSpan {
  start: number
  end: number
  repl: string
}

export function convertPandocMathDelimiters(md: string): string {
  // 快速通道：没有 Pandoc 定界符的文档（绝大多数）不做双 parse
  if (!md.includes('\\(') && !md.includes('\\[')) return md

  const protectedRanges = collectProtectedRanges(md)
  const overlapsProtected = (s: number, e: number) =>
    protectedRanges.some(([ps, pe]) => ps < e && s < pe)

  const spans: MathSpan[] = []
  const push = (re: RegExp, wrap: [string, string]) => {
    for (const m of md.matchAll(re)) {
      const content = m[1] || ''
      const start = m.index!
      const end = start + m[0].length
      // 空内容 / 跨进保护区间（含部分重叠）不转换
      if (!content.trim()) continue
      if (overlapsProtected(start, end)) continue
      spans.push({ start, end, repl: wrap[0] + content + wrap[1] })
    }
  }
  push(/\\\(([\s\S]+?)\\\)/g, ['$', '$'])
  push(/\\\[([\s\S]+?)\\\]/g, ['$$', '$$'])

  if (!spans.length) return md

  // 两类正则可能交叠（`\[a \(b\) c\]`），按起点排序后丢掉与已保留区间重叠的
  spans.sort((a, b) => a.start - b.start)
  let out = ''
  let cursor = 0
  for (const span of spans) {
    if (span.start < cursor) continue
    out += md.slice(cursor, span.start) + span.repl
    cursor = span.end
  }
  out += md.slice(cursor)
  return out
}
