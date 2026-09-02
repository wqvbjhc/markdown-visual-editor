import assert from 'node:assert/strict'
import { JSDOM } from 'jsdom'
import { processMarkdown } from '../src/pipeline/processor.ts'

// 回归：数字范围波浪线不得被 GFM 删除线配对吞掉。
// GFM 的 strikethrough 默认允许单个 ~ 作定界符（singleTilde:true），中文技术写作的
// 「0.1~0.2、2024~2026」同段出现多个范围时，~ 会被顺序配对成 <del>，中间整段正文被划掉。
// processor.ts 用 remarkGfm({ singleTilde:false }) 关掉单波浪线，~~删除~~ 双波浪线仍可用。
// 本测试守这个责任点。

const rangeMd =
  '梯队相邻间距 0.1~0.2、顶部窗格总宽 0.4——而是 2024~2026 三个年度的方法在 95.4~95.6 这 0.2 的窗格里换位。'
const rangeHtml = await processMarkdown(rangeMd, false)
const rangeDoc = new JSDOM(rangeHtml).window.document

// 不得产生 <del>
assert.equal(rangeDoc.querySelectorAll('del').length, 0, '数字范围 ~ 不得被解析成删除线')

// 正文逐字保留（~ 原样输出，数字不丢）
const text = rangeDoc.querySelector('p')?.textContent || ''
for (const frag of ['0.1~0.2', '2024~2026', '95.4~95.6']) {
  assert.ok(text.includes(frag), `正文应原样保留 ${frag}，got: ${text}`)
}

// 对照：双波浪线删除线必须仍然可用（关 singleTilde 不能误伤 ~~x~~）
const delHtml = await processMarkdown('这是~~删除线~~文本', false)
const delDoc = new JSDOM(delHtml).window.document
assert.equal(delDoc.querySelectorAll('del').length, 1, '~~x~~ 删除线应仍可用')
assert.equal(delDoc.querySelector('del')?.textContent, '删除线')
assert.ok((delDoc.querySelector('p')?.textContent || '').includes('这是') && (delDoc.querySelector('p')?.textContent || '').includes('文本'), '删除线前后文本保留')

// 边界：单个孤立 ~ 不受影响
const soloHtml = await processMarkdown('约 ~20 分钟', false)
assert.ok((new JSDOM(soloHtml).window.document.querySelector('p')?.textContent || '').includes('~20'), '孤立单 ~ 原样保留')

console.log('tilde range strikethrough regression ok')
