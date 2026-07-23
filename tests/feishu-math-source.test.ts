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

// 标题里的公式不认 LaTeX（飞书标题不支持公式），降级为纯文本：不能有 $ 字面量
assert.ok(!out.includes('E=mc^2'), `标题公式应降级去 LaTeX 源码，不应出现 E=mc^2 字面`)

// 标题里的 autolink 锚点 <a href="#..."> 必须去掉
const dom = new JSDOM(out)
const headings = dom.window.document.querySelectorAll('h1,h2,h3,h4,h5,h6')
headings.forEach((h) => {
  const anchor = h.querySelector('a[href^="#"]')
  assert.ok(!anchor, `标题内不应保留自锚点超链接，got: ${h.innerHTML}`)
})

// 公式 code（正文里的 $...$）必须不带代码块样式：飞书把带 background 的 <code> 当字面代码，
// 不触发 LaTeX 公式识别（含在 <strong>/<em> 等内联标签里的公式同样必须裸 code）。
// 用含加粗公式的独立 md 验证（夹具正文无加粗公式，这里补）。
const mdBold = '正文 **$E=mc^2$** 加粗公式'
const htmlBold = await processMarkdown(mdBold, false)
const outBold = applyFeishuStyles(htmlBold)
const domBold = new JSDOM(outBold)
const formulaCodes = domBold.window.document.querySelectorAll('code')
formulaCodes.forEach((c) => {
  const txt = c.textContent || ''
  if (!txt.startsWith('$')) return
  const style = c.getAttribute('style') || ''
  assert.ok(!/background:\s*#/.test(style), `公式 code 不应带 background 样式（飞书会当代码字面量），got: ${c.outerHTML}`)
})

console.log('feishu formula source preserved ok')
