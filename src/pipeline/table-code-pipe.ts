import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import { visit } from 'unist-util-visit'
import type { Root } from 'mdast'

/**
 * 表格单元格里的行内代码含裸 `|` 时，把 `|` 转义成 `\|`。
 *
 * 背景：GFM 表格按未转义的 `|` 切分单元格，切分发生在行内解析**之前**——
 * 代码 span 保护不了自己的管道符。`` | `stats_{main|neg}.json` | `` 会被切成
 * 三格：`` `stats_{main `` / `` neg}.json` `` / 说明列，前两格反引号落单显示原文，
 * 第三格整格被丢弃（超列数的格直接丢，正文损失）。
 *
 * 修法分两层，缺一不可：
 * 1. parse 一遍拿 table 节点的**行范围**——AST 只能提供这个。被 pipe 切断的
 *    代码 span 在 AST 里根本没有 inlineCode 节点（切格先于行内解析），想从
 *    AST 拿 span 偏移是鸡生蛋。
 * 2. 表格行内自己按 CommonMark 规则扫描反引号 run 配对找代码 span（等长
 *    run 才闭合；span 外 `\`+ASCII 标点为转义，跳过两字符），只对 span 内容
 *    里的活 `|` 插 `\`。
 *
 * 表格层切完格后会把 `\|` 还原成 `|` 再做行内解析，代码 span 值干净（实测
 * `<code>x|y</code>`，无反斜杠残留）。
 *
 * 为什么必须精确圈定表格行：非表格段落的代码 span 里 `\|` 是字面量（反斜杠
 * 可见），误伤会引入渲染差异。AST 定位保证只动真表格。
 *
 * 不变量：不引入/删除 \n，行数不变，data-source-line 锚点不受影响（列号可能
 * 行内偏移，锚点只用行号）。
 *
 * 已知边界：正文 `$a|b$` 行内公式在表格里同样会被切格（math 也是行内构造，
 * 先切格后解析）——同类问题、未处理，实报再修。
 */

/** ASCII 标点（CommonMark 转义生效集合） */
const ASCII_PUNCT = /[!-/:-@[-`{-~]/

/** 单行内找代码 span（CommonMark 配对：等长反引号 run 闭合），span 内容里的活 `|` 插 `\` */
function escapePipesInLineCodeSpans(line: string): string {
  let out = ''
  let i = 0
  while (i < line.length) {
    const c = line[i]
    if (c === '\\') {
      // span 外的反斜杠转义（含 \=、\|）：原样跳过两字符，反引号不参与配对
      if (i + 1 < line.length && ASCII_PUNCT.test(line[i + 1]!)) {
        out += line.slice(i, i + 2)
        i += 2
      } else {
        out += c
        i++
      }
      continue
    }
    if (c !== '`') {
      out += c
      i++
      continue
    }
    const run = /^`+/.exec(line.slice(i))![0].length
    // 找下一个**等长** run 闭合；不等长 run 是内容字面量，跳过
    let j = i + run
    let closer = -1
    while (j < line.length) {
      if (line[j] === '`') {
        const r2 = /^`+/.exec(line.slice(j))![0].length
        if (r2 === run) {
          closer = j
          break
        }
        j += r2
      } else {
        j++
      }
    }
    if (closer === -1) {
      // 落单 run 是字面量
      out += line.slice(i, i + run)
      i += run
      continue
    }
    out +=
      line.slice(i, i + run) +
      escapeLivePipes(line.slice(i + run, closer)) +
      line.slice(closer, closer + run)
    i = closer + run
  }
  return out
}

/** 内容串里的活 `|` 插 `\`；`\|`（奇数个前导反斜杠）视为已转义不动，`\\|` 的 `|` 是活的 */
function escapeLivePipes(s: string): string {
  let out = ''
  let bs = 0
  for (const ch of s) {
    if (ch === '\\') {
      out += ch
      bs++
      continue
    }
    if (ch === '|' && bs % 2 === 0) {
      out += '\\|'
      bs = 0
      continue
    }
    out += ch
    bs = 0
  }
  return out
}

/** parse 一遍收集所有 table 节点覆盖的行号（1 基） */
function collectTableLines(md: string): Set<number> {
  const tree = unified().use(remarkParse).use(remarkGfm).parse(md) as Root
  const lines = new Set<number>()
  visit(tree, 'table', (t) => {
    if (!t.position) return
    for (let ln = t.position.start.line; ln <= t.position.end.line; ln++) lines.add(ln)
  })
  return lines
}

export function escapeTableCodePipes(md: string): string {
  // 快速通道：没有 | 或没有 ` 就不可能命中，不做双 parse
  if (!md.includes('|') || !md.includes('`')) return md

  const tableLines = collectTableLines(md)
  if (!tableLines.size) return md

  const lines = md.split('\n')
  for (const ln of tableLines) {
    const idx = ln - 1
    const line = lines[idx]
    if (line !== undefined && line.includes('|') && line.includes('`')) {
      lines[idx] = escapePipesInLineCodeSpans(line)
    }
  }
  return lines.join('\n')
}
