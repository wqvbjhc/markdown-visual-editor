import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { JSDOM } from 'jsdom'
import { processMarkdown } from '../src/pipeline/processor.ts'
import { applyFeishuStyles } from '../src/formats/feishu.ts'

// 回归：飞书格式公式必须保留完整 LaTeX 源码（含反斜杠）。
// 历史假 bug：shell heredoc 把 \\ 降级致诊断失真，误以为 feishu.ts 丢反斜杠。
// 真实文件场景下 annotation + mdast value 均完整。本测试用真实 .md 夹具守护。
const md = readFileSync(new URL('./fixtures/feishu-math-input.md', import.meta.url), 'utf8')

// feishu.ts 用 new DOMParser，node 环境用 jsdom polyfill
globalThis.DOMParser = class {
  parseFromString(src: string) {
    return new JSDOM(src).window.document
  }
}

const html = await processMarkdown(md, false)
const out = applyFeishuStyles(html)

// 抽出所有 $...$ 公式源码（去掉外层 code 标签后的文本）
const formulas = (out.match(/\$[^$]+\$/g) || []).map((s) => s.slice(1, -1))

// 反斜杠命令必须保留（\pi / \text{} / \times / \int / \sqrt / \infty）
assert.ok(formulas.some((f) => f.includes('\\pi')), `行内 \\pi 应保留，got: ${JSON.stringify(formulas)}`)
assert.ok(formulas.some((f) => f.includes('\\text{atan2}')), `\\text{atan2} 应保留，got: ${JSON.stringify(formulas)}`)
assert.ok(formulas.some((f) => f.includes('\\times')), `\\times 应保留，got: ${JSON.stringify(formulas)}`)
assert.ok(formulas.some((f) => f.includes('\\int_{-\\infty}^{\\infty}')), `块级 \\int_{-\\infty}^{\\infty} 应保留，got: ${JSON.stringify(formulas)}`)
assert.ok(formulas.some((f) => f.includes('\\sqrt{\\pi}')), `块级 \\sqrt{\\pi} 应保留，got: ${JSON.stringify(formulas)}`)

// 中文括号、方括号内容不应破坏公式边界
assert.ok(formulas.some((f) => f.includes('[0, 2\\pi]')), `[0, 2\\pi] 应完整，got: ${JSON.stringify(formulas)}`)

// 块级公式必须是 $$...$$（独立段落），不能塌成行内
assert.ok(out.includes('$$'), '块级公式应输出 $$ 包裹')

console.log('feishu formula source preserved ok')
