import assert from 'node:assert/strict'
import { JSDOM } from 'jsdom'
import { processMarkdown } from '../src/pipeline/processor.ts'
import { applyFeishuStyles } from '../src/formats/feishu.ts'

// 回归：飞书粘贴不认嵌套列表**子项**里的公式（父项认；A/B/C/D + I/J/K 探测确认）。
// 唯一出路：含公式的嵌套列表拍平成单层，padding-left 模拟缩进。
// 纯文本列表（无公式）保持嵌套不动。
// 本测试守护：含公式列表必须被拍平，纯文本列表保持嵌套。

globalThis.DOMParser = class {
  parseFromString(src: string) {
    return new JSDOM(src).window.document
  }
}

// --- 含公式嵌套列表：必须拍平 ---
const mdWithFormula = `*   父项 (Semantic $\\{x_i^0\\}$)：
    *   视觉特征 ($v$)
    *   音频特征 ($a$)
`
const htmlWith = await processMarkdown(mdWithFormula, false)
const outWith = applyFeishuStyles(htmlWith)
const domWith = new JSDOM(outWith)
const withLists = domWith.window.document.querySelectorAll('ul, ol')

// 拍平后顶层列表只有 1 个（原嵌套合并成单层）
assert.equal(withLists.length, 1, `含公式列表应拍平成单层，仍剩 ${withLists.length} 个列表`)
// 所有公式 code 都在顶层列表的直系 li 里（无嵌套 li）
const topList = withLists[0]
const directLis = topList.querySelectorAll(':scope > li')
assert.ok(directLis.length >= 3, `拍平后直系 li 应 ≥3（父+2子），got ${directLis.length}`)
const formulaCodes = topList.querySelectorAll('code')
formulaCodes.forEach((c) => {
  const txt = c.textContent || ''
  if (!txt.startsWith('$')) return
  const parentLi = c.closest('li')
  assert.ok(parentLi?.parentElement === topList, `公式 code 必须在顶层列表直系 li 内，got ${parentLi?.outerHTML?.slice(0, 80)}`)
})
// 子项应有 padding-left 表达原层级
const hasIndent = Array.from(directLis).some((li) => {
  const style = li.getAttribute('style') || ''
  return /padding-left:\s*[1-9]/.test(style)
})
assert.ok(hasIndent, '拍平后子项 li 应有 padding-left 模拟缩进')

// --- 纯文本嵌套列表：保持嵌套不动 ---
const mdPlain = `*   父项：
    *   子项一
    *   子项二
`
const htmlPlain = await processMarkdown(mdPlain, false)
const outPlain = applyFeishuStyles(htmlPlain)
const domPlain = new JSDOM(outPlain)
const plainLists = domPlain.window.document.querySelectorAll('ul, ol')
// 保持嵌套：顶层 ul + 子 ul 共 2 个
assert.equal(plainLists.length, 2, `纯文本列表应保持嵌套（2 个列表），got ${plainLists.length}`)

console.log('feishu flatten nested list formulas ok')
